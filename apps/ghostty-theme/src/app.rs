use std::collections::HashSet;
use std::io;
use std::sync::Arc;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::thread;
use std::time::{Duration, Instant};

use crossterm::event::{
    self, DisableMouseCapture, EnableMouseCapture, KeyCode, KeyEvent, KeyEventKind, KeyModifiers,
    MouseEventKind,
};
use crossterm::execute;
use ratatui::layout::Rect;
use ratatui_image::FontSize;
use ratatui_image::picker::{Picker, ProtocolType};

use crate::config::{Settings, render_config, theme_image};
use crate::data::{self, Background, Paths};
use crate::ghostty::Applier;
use crate::preview::{ImageKey, Loaded, Previewer};
use crate::theme::{Theme, discover_themes};
use crate::ui;

pub enum Event {
    Input(event::Event),
    Image(ImageKey, Loaded),
    Fonts(Vec<String>),
    ApplyFailed(String),
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Section {
    Themes,
    Backgrounds,
    Fonts,
    Typography,
    Window,
}

pub const SECTIONS: [Section; 5] = [
    Section::Themes,
    Section::Backgrounds,
    Section::Fonts,
    Section::Typography,
    Section::Window,
];

impl Section {
    pub fn name(self) -> &'static str {
        match self {
            Self::Themes => "Themes",
            Self::Backgrounds => "Backgrounds",
            Self::Fonts => "Fonts",
            Self::Typography => "Typography",
            Self::Window => "Window",
        }
    }

    fn is_list(self) -> bool {
        matches!(self, Self::Themes | Self::Backgrounds | Self::Fonts)
    }

    fn index(self) -> usize {
        SECTIONS.iter().position(|s| *s == self).unwrap_or(0)
    }
}

#[derive(Clone, Copy)]
enum Opacity {
    Image,
    Window,
}

pub const SCOPES: [&str; 4] = ["all", "custom", "favorites", "recent"];

pub struct Status {
    pub text: String,
    pub error: bool,
    expires: Instant,
}

pub struct App {
    pub paths: Paths,
    pub cfg: Settings,
    baseline: String,
    pub themes: Vec<Theme>,
    pub backgrounds: Vec<Background>,
    pub fonts: Vec<String>,
    pub fonts_loading: bool,
    pub favorites: HashSet<String>,
    recents: Vec<String>,
    pub section: Section,
    pub cursor: usize,
    pub offset: usize,
    pub visible: Vec<usize>,
    pub query: String,
    pub searching: bool,
    pub scope: usize,
    pub live: bool,
    pub status: Option<Status>,
    pub image_area: Option<Rect>,
    pub previewer: Previewer,
    current_theme: Option<usize>,
    fallback_theme: Theme,
    applier: Applier,
}

impl App {
    fn new(
        paths: Paths,
        cfg: Settings,
        raw: String,
        previewer: Previewer,
        applier: Applier,
    ) -> Self {
        let themes = discover_themes(&paths.custom_themes, &paths.system_themes);
        let mut backgrounds = vec![Background {
            name: "none".into(),
            key: "none".into(),
            path: String::new(),
        }];
        backgrounds.extend(data::discover_backgrounds(&paths.assets));
        let mut app = Self {
            favorites: data::read_lines(&paths.favorites()).into_iter().collect(),
            recents: data::read_lines(&paths.recents()),
            fallback_theme: Theme::fallback(&cfg.theme),
            paths,
            cfg,
            baseline: raw,
            themes,
            backgrounds,
            fonts: Vec::new(),
            fonts_loading: true,
            section: Section::Themes,
            cursor: 0,
            offset: 0,
            visible: Vec::new(),
            query: String::new(),
            searching: false,
            scope: 0,
            live: true,
            status: None,
            image_area: None,
            previewer,
            current_theme: None,
            applier,
        };
        app.sync_theme();
        app.rebuild_visible();
        app.cursor = app.current_index();
        app
    }

    pub fn theme(&self) -> &Theme {
        self.current_theme
            .and_then(|i| self.themes.get(i))
            .unwrap_or(&self.fallback_theme)
    }

    fn sync_theme(&mut self) {
        if self
            .current_theme
            .and_then(|i| self.themes.get(i))
            .is_some_and(|t| t.name == self.cfg.theme)
        {
            return;
        }
        self.current_theme = self.themes.iter().position(|t| t.name == self.cfg.theme);
        if self.current_theme.is_none() {
            self.fallback_theme = Theme::fallback(&self.cfg.theme);
        }
    }

    fn rebuild_visible(&mut self) {
        let query = self.query.to_lowercase();
        self.visible = match self.section {
            Section::Themes => {
                let mut out: Vec<usize> = self
                    .themes
                    .iter()
                    .enumerate()
                    .filter(|(_, t)| query.is_empty() || t.key.contains(&query))
                    .filter(|(_, t)| match self.scope {
                        1 => t.custom,
                        2 => self.favorites.contains(&t.name),
                        3 => self.recents.contains(&t.name),
                        _ => true,
                    })
                    .map(|(i, _)| i)
                    .collect();
                if self.scope == 3 {
                    out.sort_by_key(|&i| {
                        self.recents
                            .iter()
                            .position(|name| *name == self.themes[i].name)
                    });
                }
                out
            }
            Section::Backgrounds => self
                .backgrounds
                .iter()
                .enumerate()
                .filter(|(_, b)| query.is_empty() || b.key.contains(&query))
                .map(|(i, _)| i)
                .collect(),
            Section::Fonts => self
                .fonts
                .iter()
                .enumerate()
                .filter(|(_, f)| query.is_empty() || f.to_lowercase().contains(&query))
                .map(|(i, _)| i)
                .collect(),
            Section::Typography | Section::Window => Vec::new(),
        };
    }

    pub fn item_count(&self) -> usize {
        match self.section {
            Section::Typography => 3,
            Section::Window => 5,
            _ => self.visible.len(),
        }
    }

    fn current_index(&self) -> usize {
        let position = match self.section {
            Section::Themes => self
                .visible
                .iter()
                .position(|&i| self.themes[i].name == self.cfg.theme),
            Section::Backgrounds => self
                .visible
                .iter()
                .position(|&i| self.backgrounds[i].path == self.cfg.background),
            Section::Fonts => self
                .visible
                .iter()
                .position(|&i| self.fonts[i] == self.cfg.font),
            _ => None,
        };
        position.unwrap_or(0)
    }

    fn step(&mut self, delta: isize) {
        let n = self.item_count();
        if n == 0 {
            self.cursor = 0;
            return;
        }
        self.cursor = (self.cursor as isize + delta).rem_euclid(n as isize) as usize;
    }

    fn jump(&mut self, target: isize) {
        let n = self.item_count();
        self.cursor = target.clamp(0, n.saturating_sub(1) as isize) as usize;
    }

    fn select_current(&mut self) {
        if let Some(&i) = self.visible.get(self.cursor) {
            match self.section {
                Section::Themes => {
                    self.cfg.theme = self.themes[i].name.clone();
                    if let Some(image) = theme_image(&self.cfg.theme, &self.paths.assets) {
                        self.cfg.background = image.to_string_lossy().into_owned();
                    }
                    self.sync_theme();
                }
                Section::Backgrounds => self.cfg.background = self.backgrounds[i].path.clone(),
                Section::Fonts => self.cfg.font = self.fonts[i].clone(),
                _ => {}
            }
        }
        if self.live {
            self.preview();
        }
    }

    fn rendered(&self) -> String {
        render_config(&self.baseline, &self.cfg)
    }

    fn preview(&self) {
        self.applier.preview(self.rendered());
    }

    fn commit(&mut self) {
        let data = self.rendered();
        self.applier.flush(data.clone());
        self.baseline = data;
        if self.section == Section::Themes {
            self.recents = data::record_recent(&self.paths.recents(), &self.cfg.theme);
        }
        self.flash("Applied. This is now your Ghostty configuration", false);
    }

    fn flash(&mut self, text: &str, error: bool) {
        self.status = Some(Status {
            text: text.into(),
            error,
            expires: Instant::now() + Duration::from_millis(2200),
        });
    }

    fn change_section(&mut self, delta: isize) {
        let next = (self.section.index() as isize + delta).rem_euclid(SECTIONS.len() as isize);
        self.section = SECTIONS[next as usize];
        self.query.clear();
        self.searching = false;
        self.offset = 0;
        self.rebuild_visible();
        self.cursor = self.current_index();
    }

    fn change_value(&mut self, delta: i32) {
        match self.section {
            Section::Themes | Section::Backgrounds | Section::Fonts => {
                self.step(delta as isize);
                self.select_current();
                return;
            }
            Section::Typography => match self.cursor {
                0 => self.cfg.font_size = (self.cfg.font_size + delta).clamp(6, 48),
                1 => self.cfg.line_height = (self.cfg.line_height + delta * 5).clamp(-20, 60),
                _ => self.cfg.letter_spacing = (self.cfg.letter_spacing + delta * 2).clamp(-20, 30),
            },
            Section::Window => match self.cursor {
                0 => self.cfg.opacity = (self.cfg.opacity + delta * 5).clamp(0, 100),
                1 => self.cfg.blur = (self.cfg.blur + delta * 5).clamp(0, 100),
                2 => self.cfg.padding = (self.cfg.padding + delta * 2).clamp(0, 40),
                3 => self.cfg.decorations = !self.cfg.decorations,
                _ => self.cfg.image_opacity = (self.cfg.image_opacity + delta * 5).clamp(0, 100),
            },
        }
        if self.live {
            self.preview();
        }
    }

    fn clear_background(&mut self) {
        self.cfg.background.clear();
        if self.section == Section::Backgrounds {
            self.cursor = self.current_index();
        }
        self.flash("Background image off", false);
        if self.live {
            self.preview();
        }
    }

    fn nudge_opacity(&mut self, target: Opacity, delta: i32) {
        let (value, label) = match target {
            Opacity::Image => (&mut self.cfg.image_opacity, "Image opacity"),
            Opacity::Window => (&mut self.cfg.opacity, "Background opacity"),
        };
        *value = (*value + delta).clamp(0, 100);
        let text = format!("{label} {}%", *value);
        self.flash(&text, false);
        if self.live {
            self.preview();
        }
    }

    fn on_query_changed(&mut self) {
        self.rebuild_visible();
        self.cursor = 0;
        self.offset = 0;
        self.select_current();
    }

    fn handle_search_key(&mut self, key: KeyEvent) -> bool {
        match key.code {
            KeyCode::Esc => {
                self.searching = false;
                self.query.clear();
                self.rebuild_visible();
                self.cursor = self.current_index();
            }
            KeyCode::Enter => self.searching = false,
            KeyCode::Backspace => {
                self.query.pop();
                self.on_query_changed();
            }
            KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => return true,
            KeyCode::Char(c) if !key.modifiers.contains(KeyModifiers::CONTROL) => {
                self.query.push(c);
                self.on_query_changed();
            }
            _ => {}
        }
        false
    }

    fn handle_key(&mut self, key: KeyEvent) -> bool {
        if key.kind == KeyEventKind::Release {
            return false;
        }
        if self.searching {
            return self.handle_search_key(key);
        }
        let ctrl = key.modifiers.contains(KeyModifiers::CONTROL);
        match key.code {
            KeyCode::Char('c') if ctrl => return true,
            KeyCode::Char('q') | KeyCode::Esc => return true,
            KeyCode::Tab | KeyCode::Char(']' | 'l') => self.change_section(1),
            KeyCode::BackTab | KeyCode::Char('[' | 'h') => self.change_section(-1),
            KeyCode::Up | KeyCode::Char('k') => {
                self.step(-1);
                self.select_current();
            }
            KeyCode::Down | KeyCode::Char('j') => {
                self.step(1);
                self.select_current();
            }
            KeyCode::Left => self.change_value(-1),
            KeyCode::Right => self.change_value(1),
            KeyCode::PageUp => {
                self.jump(self.cursor as isize - 6);
                self.select_current();
            }
            KeyCode::PageDown => {
                self.jump(self.cursor as isize + 6);
                self.select_current();
            }
            KeyCode::Home | KeyCode::Char('g') => {
                self.jump(0);
                self.select_current();
            }
            KeyCode::End | KeyCode::Char('G') => {
                self.jump(isize::MAX);
                self.select_current();
            }
            KeyCode::Char('/') if self.section.is_list() => {
                self.searching = true;
                self.query.clear();
            }
            KeyCode::Enter => self.commit(),
            KeyCode::Char('x') => self.clear_background(),
            KeyCode::Char('-') => self.nudge_opacity(Opacity::Image, -5),
            KeyCode::Char('+' | '=') => self.nudge_opacity(Opacity::Image, 5),
            KeyCode::Char('<' | ',') => self.nudge_opacity(Opacity::Window, -5),
            KeyCode::Char('>' | '.') => self.nudge_opacity(Opacity::Window, 5),
            KeyCode::Char('p') => {
                self.live = !self.live;
                if self.live {
                    self.preview();
                    self.flash("Live preview on", false);
                } else {
                    self.flash("Live preview paused", false);
                }
            }
            KeyCode::Char('v') if self.section == Section::Themes => {
                self.scope = (self.scope + 1) % SCOPES.len();
                self.query.clear();
                self.offset = 0;
                self.rebuild_visible();
                self.cursor = self.current_index();
                self.select_current();
            }
            KeyCode::Char('f') if self.section == Section::Themes => {
                if let Some(&i) = self.visible.get(self.cursor) {
                    let name = self.themes[i].name.clone();
                    let (added, lines) = data::toggle_line(&self.paths.favorites(), &name);
                    self.favorites = lines.into_iter().collect();
                    if self.scope == 2 {
                        self.rebuild_visible();
                        self.cursor = self.cursor.min(self.visible.len().saturating_sub(1));
                    }
                    self.flash(
                        if added {
                            "Added to favorites"
                        } else {
                            "Removed from favorites"
                        },
                        false,
                    );
                }
            }
            _ => {}
        }
        false
    }

    fn handle_event(&mut self, event: Event) -> bool {
        match event {
            Event::Input(event::Event::Key(key)) => return self.handle_key(key),
            Event::Input(event::Event::Mouse(mouse)) => match mouse.kind {
                MouseEventKind::ScrollUp => {
                    self.step(-1);
                    self.select_current();
                }
                MouseEventKind::ScrollDown => {
                    self.step(1);
                    self.select_current();
                }
                _ => {}
            },
            Event::Input(_) => {}
            Event::Image(key, loaded) => {
                let shown = self.shown_image_key();
                self.previewer.insert(key, loaded, shown.as_ref());
            }
            Event::Fonts(fonts) => {
                self.fonts = fonts;
                self.fonts_loading = false;
                if self.section == Section::Fonts {
                    self.rebuild_visible();
                    self.cursor = self.current_index();
                }
            }
            Event::ApplyFailed(err) => self.flash(&format!("Could not update config: {err}"), true),
        }
        false
    }

    pub fn shown_image_key(&self) -> Option<ImageKey> {
        let area = self.image_area?;
        (!self.cfg.background.is_empty()).then(|| ImageKey {
            path: Arc::from(self.cfg.background.as_str()),
            cells: (area.width, area.height),
        })
    }

    fn request_images(&mut self) {
        let Some(area) = self.image_area else {
            return;
        };
        let cells = (area.width, area.height);
        let mut paths: Vec<String> = Vec::with_capacity(self.backgrounds.len() + 8);
        paths.push(self.cfg.background.clone());
        match self.section {
            Section::Themes => {
                for distance in 1..=4 {
                    for index in [
                        self.cursor.checked_sub(distance),
                        Some(self.cursor + distance),
                    ] {
                        let Some(&i) = index.and_then(|index| self.visible.get(index)) else {
                            continue;
                        };
                        if let Some(image) = theme_image(&self.themes[i].name, &self.paths.assets) {
                            paths.push(image.to_string_lossy().into_owned());
                        }
                    }
                }
            }
            Section::Backgrounds => {
                let mut nearby: Vec<(usize, usize)> = self
                    .visible
                    .iter()
                    .enumerate()
                    .map(|(position, &i)| (position.abs_diff(self.cursor), i))
                    .collect();
                nearby.sort_unstable();
                paths.extend(
                    nearby
                        .into_iter()
                        .map(|(_, i)| self.backgrounds[i].path.clone()),
                );
            }
            _ => {}
        }
        paths.extend(self.backgrounds.iter().map(|b| b.path.clone()));
        let keys = paths
            .into_iter()
            .filter(|path| !path.is_empty())
            .map(|path| ImageKey {
                path: Arc::from(path),
                cells,
            })
            .collect();
        self.previewer.want(keys);
    }

    fn next_deadline(&self) -> Option<Instant> {
        self.status.as_ref().map(|status| status.expires)
    }

    fn expire_status(&mut self) -> bool {
        if self
            .status
            .as_ref()
            .is_some_and(|status| Instant::now() >= status.expires)
        {
            self.status = None;
            return true;
        }
        false
    }
}

fn ghostty_picker() -> Option<Picker> {
    let inside_ghostty = std::env::var("TERM_PROGRAM").is_ok_and(|term| term == "ghostty");
    if !inside_ghostty || std::env::var_os("TMUX").is_some() {
        return None;
    }
    let size = crossterm::terminal::window_size().ok()?;
    if size.columns == 0 || size.rows == 0 || size.width == 0 || size.height == 0 {
        return None;
    }
    let font = FontSize::new(size.width / size.columns, size.height / size.rows);
    // Ghostty always speaks the kitty graphics protocol, so skip the stdin capability query.
    #[allow(deprecated)]
    let mut picker = Picker::from_fontsize(font);
    picker.set_protocol_type(ProtocolType::Kitty);
    Some(picker)
}

pub fn run(paths: Paths) -> io::Result<()> {
    let (cfg, raw) = crate::config::load_settings(&paths.config)?;
    let (tx, rx) = mpsc::channel::<Event>();

    let fonts_tx = tx.clone();
    thread::spawn(move || {
        let _ = fonts_tx.send(Event::Fonts(data::discover_fonts()));
    });

    let mut terminal = ratatui::init();
    execute!(io::stdout(), EnableMouseCapture)?;
    let picker = ghostty_picker()
        .unwrap_or_else(|| Picker::from_query_stdio().unwrap_or_else(|_| Picker::halfblocks()));
    let kitty = picker.protocol_type() == ProtocolType::Kitty;

    let applier = Applier::spawn(paths.config.clone(), raw.clone(), tx.clone());
    let previewer = Previewer::spawn(picker, paths.cache.clone(), tx.clone());
    let mut app = App::new(paths, cfg, raw, previewer, applier);

    let input_tx = tx;
    thread::spawn(move || {
        while let Ok(event) = event::read() {
            if input_tx.send(Event::Input(event)).is_err() {
                break;
            }
        }
    });

    let result = event_loop(&mut terminal, &mut app, &rx);

    if kitty {
        use std::io::Write;
        let mut stdout = io::stdout();
        let _ = stdout.write_all(b"\x1b_Ga=d,d=A,q=2\x1b\\");
        let _ = stdout.flush();
    }
    let _ = execute!(io::stdout(), DisableMouseCapture);
    ratatui::restore();
    app.applier.finish(app.baseline.clone());
    result
}

fn event_loop(
    terminal: &mut ratatui::DefaultTerminal,
    app: &mut App,
    rx: &mpsc::Receiver<Event>,
) -> io::Result<()> {
    let mut dirty = true;
    loop {
        if dirty {
            terminal.draw(|frame| ui::render(frame, app))?;
            app.request_images();
        }
        let first = match app.next_deadline() {
            Some(deadline) => {
                match rx.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
                    Ok(event) => Some(event),
                    Err(RecvTimeoutError::Timeout) => None,
                    Err(RecvTimeoutError::Disconnected) => return Ok(()),
                }
            }
            None => match rx.recv() {
                Ok(event) => Some(event),
                Err(_) => return Ok(()),
            },
        };
        dirty = app.expire_status();
        if let Some(event) = first {
            dirty = true;
            if app.handle_event(event) {
                return Ok(());
            }
            while let Ok(event) = rx.try_recv() {
                if app.handle_event(event) {
                    return Ok(());
                }
            }
        }
    }
}
