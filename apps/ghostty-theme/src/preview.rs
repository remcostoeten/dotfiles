use std::collections::hash_map::DefaultHasher;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::mpsc::Sender;
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::UNIX_EPOCH;

use fast_image_resize::images::Image as ResizeTarget;
use fast_image_resize::{FilterType, PixelType, ResizeAlg, ResizeOptions, Resizer};
use image::{DynamicImage, ImageFormat, RgbImage};
use ratatui::layout::Size;
use ratatui_image::Resize;
use ratatui_image::picker::Picker;
use ratatui_image::protocol::Protocol;

use crate::app::Event;

const THUMB_MAX: (u32, u32) = (1280, 720);
const CACHE_LIMIT: usize = 32;

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct ImageKey {
    pub path: Arc<str>,
    pub cells: (u16, u16),
}

pub enum Loaded {
    Ready(Protocol),
    Failed(String),
}

#[derive(Default)]
struct Queue {
    stack: Vec<ImageKey>,
    warm: Vec<Arc<str>>,
    warmed: HashSet<Arc<str>>,
    in_flight: HashSet<ImageKey>,
}

enum Job {
    Encode(ImageKey),
    Warm(Arc<str>),
}

pub struct Previewer {
    shared: Arc<(Mutex<Queue>, Condvar)>,
    cache: HashMap<ImageKey, Loaded>,
    rank: HashMap<ImageKey, usize>,
}

impl Previewer {
    pub fn spawn(picker: Picker, cache_dir: PathBuf, events: Sender<Event>) -> Self {
        let shared = Arc::new((Mutex::new(Queue::default()), Condvar::new()));
        let workers = thread::available_parallelism().map_or(2, |n| n.get().clamp(2, 6));
        let thumbs = cache_dir.join("thumbs");
        let _ = fs::create_dir_all(&thumbs);
        for _ in 0..workers {
            let shared = Arc::clone(&shared);
            let picker = picker.clone();
            let thumbs = thumbs.clone();
            let events = events.clone();
            thread::spawn(move || worker(&shared, &picker, &thumbs, &events));
        }
        Self {
            shared,
            cache: HashMap::new(),
            rank: HashMap::new(),
        }
    }

    pub fn get(&self, key: &ImageKey) -> Option<&Loaded> {
        self.cache.get(key)
    }

    pub fn want(&mut self, keys: Vec<ImageKey>) {
        let mut seen = HashSet::with_capacity(keys.len());
        let mut ordered: Vec<ImageKey> = keys
            .into_iter()
            .filter(|key| seen.insert(key.clone()))
            .collect();
        let overflow = ordered.split_off(ordered.len().min(CACHE_LIMIT));
        self.rank = ordered
            .iter()
            .enumerate()
            .map(|(position, key)| (key.clone(), position))
            .collect();

        let (lock, ready) = &*self.shared;
        let Ok(mut queue) = lock.lock() else {
            return;
        };
        queue.stack = ordered
            .into_iter()
            .filter(|key| !self.cache.contains_key(key) && !queue.in_flight.contains(key))
            .rev()
            .collect();
        let warm: Vec<Arc<str>> = overflow
            .into_iter()
            .map(|key| key.path)
            .filter(|path| !queue.warmed.contains(path))
            .rev()
            .collect();
        queue.warm = warm;
        if !queue.stack.is_empty() || !queue.warm.is_empty() {
            ready.notify_all();
        }
    }

    pub fn insert(&mut self, key: ImageKey, loaded: Loaded, keep: Option<&ImageKey>) {
        self.cache.insert(key, loaded);
        while self.cache.len() > CACHE_LIMIT {
            let worst = self
                .cache
                .keys()
                .filter(|key| Some(*key) != keep)
                .max_by_key(|key| self.rank.get(*key).copied().unwrap_or(usize::MAX))
                .cloned();
            let Some(worst) = worst else {
                break;
            };
            self.cache.remove(&worst);
        }
    }
}

fn worker(
    shared: &(Mutex<Queue>, Condvar),
    picker: &Picker,
    thumbs: &Path,
    events: &Sender<Event>,
) {
    let (lock, ready) = shared;
    let mut resizer = Resizer::new();
    loop {
        let job = {
            let Ok(mut queue) = lock.lock() else {
                return;
            };
            loop {
                if let Some(key) = queue.stack.pop() {
                    queue.in_flight.insert(key.clone());
                    break Job::Encode(key);
                }
                if let Some(path) = queue.warm.pop() {
                    queue.warmed.insert(Arc::clone(&path));
                    break Job::Warm(path);
                }
                queue = match ready.wait(queue) {
                    Ok(queue) => queue,
                    Err(_) => return,
                };
            }
        };
        let key = match job {
            Job::Encode(key) => key,
            Job::Warm(path) => {
                let _ = thumbnail(Path::new(&*path), thumbs, &mut resizer);
                continue;
            }
        };
        let loaded = match encode(&key, picker, thumbs, &mut resizer) {
            Ok(protocol) => Loaded::Ready(protocol),
            Err(err) => Loaded::Failed(err),
        };
        let sent = events.send(Event::Image(key.clone(), loaded));
        if let Ok(mut queue) = lock.lock() {
            queue.in_flight.remove(&key);
        }
        if sent.is_err() {
            return;
        }
    }
}

fn encode(
    key: &ImageKey,
    picker: &Picker,
    thumbs: &Path,
    resizer: &mut Resizer,
) -> Result<Protocol, String> {
    let thumb = thumbnail(Path::new(&*key.path), thumbs, resizer)?;
    let font = picker.font_size();
    let bounds = (
        u32::from(key.cells.0) * u32::from(font.width),
        u32::from(key.cells.1) * u32::from(font.height),
    );
    let image = fit(&thumb, bounds, resizer)?;
    let size = Size::new(key.cells.0, key.cells.1);
    picker
        .new_protocol(DynamicImage::ImageRgb8(image), size, Resize::Fit(None))
        .map_err(|err| err.to_string())
}

fn thumbnail(source: &Path, thumbs: &Path, resizer: &mut Resizer) -> Result<RgbImage, String> {
    let meta = fs::metadata(source).map_err(|err| err.to_string())?;
    let mut hasher = DefaultHasher::new();
    source.hash(&mut hasher);
    meta.len().hash(&mut hasher);
    meta.modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|age| age.as_nanos())
        .hash(&mut hasher);
    THUMB_MAX.hash(&mut hasher);
    let cached = thumbs.join(format!("{:016x}.qoi", hasher.finish()));

    if let Ok(bytes) = fs::read(&cached)
        && let Ok(image) = image::load_from_memory_with_format(&bytes, ImageFormat::Qoi)
    {
        return Ok(image.into_rgb8());
    }

    let decoded = image::ImageReader::open(source)
        .map_err(|err| err.to_string())?
        .with_guessed_format()
        .map_err(|err| err.to_string())?
        .decode()
        .map_err(|err| err.to_string())?
        .into_rgb8();
    let thumb = fit(&decoded, THUMB_MAX, resizer)?;
    drop(decoded);

    let tmp = cached.with_extension(format!("tmp{}", std::process::id()));
    if thumb.save_with_format(&tmp, ImageFormat::Qoi).is_ok() {
        let _ = fs::rename(&tmp, &cached);
    } else {
        let _ = fs::remove_file(&tmp);
    }
    Ok(thumb)
}

fn fit(
    image: &RgbImage,
    (max_w, max_h): (u32, u32),
    resizer: &mut Resizer,
) -> Result<RgbImage, String> {
    let (w, h) = image.dimensions();
    let scale = (f64::from(max_w) / f64::from(w)).min(f64::from(max_h) / f64::from(h));
    if scale >= 1.0 {
        return Ok(image.clone());
    }
    let target_w = ((f64::from(w) * scale).round() as u32).max(1);
    let target_h = ((f64::from(h) * scale).round() as u32).max(1);
    let mut target = ResizeTarget::new(target_w, target_h, PixelType::U8x3);
    let options = ResizeOptions::new().resize_alg(ResizeAlg::Convolution(FilterType::Bilinear));
    resizer
        .resize(image, &mut target, &options)
        .map_err(|err| err.to_string())?;
    RgbImage::from_raw(target_w, target_h, target.into_vec())
        .ok_or_else(|| "resize produced a short buffer".into())
}
