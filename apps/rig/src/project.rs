use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Manager {
    Bun,
    Pnpm,
    Yarn,
    Npm,
}

impl Manager {
    pub fn name(self) -> &'static str {
        match self {
            Manager::Bun => "bun",
            Manager::Pnpm => "pnpm",
            Manager::Yarn => "yarn",
            Manager::Npm => "npm",
        }
    }

    pub fn script_args(self, script: &str, extra: &[String]) -> Vec<String> {
        let mut args = vec!["run".to_string(), script.to_string()];
        if self == Manager::Npm && !extra.is_empty() {
            args.push("--".to_string());
        }
        args.extend(extra.iter().cloned());
        args
    }

    pub fn exec_args(self, bin: &str, args: &[String]) -> Vec<String> {
        let mut out = match self {
            Manager::Bun => vec!["x".to_string(), bin.to_string()],
            Manager::Pnpm | Manager::Yarn => vec!["exec".to_string(), bin.to_string()],
            Manager::Npm => vec!["exec".to_string(), "--".to_string(), bin.to_string()],
        };
        out.extend(args.iter().cloned());
        out
    }

    fn from_field(field: &str) -> Option<Manager> {
        match field.split('@').next()? {
            "bun" => Some(Manager::Bun),
            "pnpm" => Some(Manager::Pnpm),
            "yarn" => Some(Manager::Yarn),
            "npm" => Some(Manager::Npm),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct Manifest {
    pub name: Option<String>,
    pub scripts: BTreeMap<String, String>,
    pub deps: BTreeMap<String, String>,
    pub package_manager: Option<String>,
    pub workspaces: Vec<String>,
}

impl Manifest {
    pub fn load(dir: &Path) -> Option<Manifest> {
        let text = fs::read_to_string(dir.join("package.json")).ok()?;
        let value: Value = serde_json::from_str(&text).ok()?;
        Some(Manifest::from_value(&value))
    }

    fn from_value(value: &Value) -> Manifest {
        let table = |key: &str| -> BTreeMap<String, String> {
            value
                .get(key)
                .and_then(Value::as_object)
                .map(|object| {
                    object
                        .iter()
                        .filter_map(|(name, entry)| {
                            Some((name.clone(), entry.as_str()?.to_string()))
                        })
                        .collect()
                })
                .unwrap_or_default()
        };
        let mut deps = table("dependencies");
        deps.extend(table("devDependencies"));
        deps.extend(table("optionalDependencies"));
        let list = |entry: Option<&Value>| -> Vec<String> {
            entry
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|item| item.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default()
        };
        let workspaces = match value.get("workspaces") {
            Some(Value::Array(_)) => list(value.get("workspaces")),
            Some(Value::Object(object)) => list(object.get("packages")),
            _ => Vec::new(),
        };
        Manifest {
            name: value.get("name").and_then(Value::as_str).map(String::from),
            scripts: table("scripts"),
            deps,
            package_manager: value
                .get("packageManager")
                .and_then(Value::as_str)
                .map(String::from),
            workspaces,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Layout {
    Single,
    Turborepo,
    Nx,
    Lerna,
    Rush,
    PnpmWorkspace,
    Workspaces,
}

impl Layout {
    pub fn label(self) -> &'static str {
        match self {
            Layout::Single => "single package",
            Layout::Turborepo => "turborepo",
            Layout::Nx => "nx workspace",
            Layout::Lerna => "lerna monorepo",
            Layout::Rush => "rush monorepo",
            Layout::PnpmWorkspace => "pnpm workspace",
            Layout::Workspaces => "workspaces monorepo",
        }
    }
}

const SKIPPED_DIRS: &[&str] = &[
    "node_modules",
    "dist",
    "build",
    "target",
    "vendor",
    "out",
    "coverage",
    "__pycache__",
];

fn layout_of(dir: &Path, manifest: &Manifest) -> Option<Layout> {
    if let Ok(text) = fs::read_to_string(dir.join("turbo.json"))
        && !text.contains("\"extends\"")
    {
        return Some(Layout::Turborepo);
    }
    if dir.join("nx.json").is_file() {
        return Some(Layout::Nx);
    }
    if dir.join("lerna.json").is_file() {
        return Some(Layout::Lerna);
    }
    if dir.join("rush.json").is_file() {
        return Some(Layout::Rush);
    }
    if dir.join("pnpm-workspace.yaml").is_file() {
        return Some(Layout::PnpmWorkspace);
    }
    (!manifest.workspaces.is_empty()).then_some(Layout::Workspaces)
}

fn ancestors_until_git(start: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    for dir in start.ancestors() {
        dirs.push(dir.to_path_buf());
        if dir.join(".git").exists() {
            break;
        }
    }
    dirs
}

pub fn find_root(start: &Path) -> Option<(PathBuf, Layout)> {
    for dir in ancestors_until_git(start) {
        let manifest = Manifest::load(&dir).unwrap_or_default();
        if let Some(layout) = layout_of(&dir, &manifest) {
            return Some((dir, layout));
        }
    }
    None
}

pub fn nearest_package(start: &Path) -> Option<PathBuf> {
    start
        .ancestors()
        .find(|dir| dir.join("package.json").is_file())
        .map(Path::to_path_buf)
}

fn subdirs(base: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(base) else {
        return Vec::new();
    };
    let mut dirs: Vec<PathBuf> = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            let hidden = name.starts_with('.');
            (entry.path().is_dir() && !hidden && !SKIPPED_DIRS.contains(&name.as_str()))
                .then(|| entry.path())
        })
        .collect();
    dirs.sort();
    dirs
}

fn wildcard_match(pattern: &str, name: &str) -> bool {
    match pattern.split_once('*') {
        Some((head, tail)) => {
            name.len() >= head.len() + tail.len() && name.starts_with(head) && name.ends_with(tail)
        }
        None => pattern == name,
    }
}

fn expand(base: &Path, segments: &[&str], depth: usize, out: &mut Vec<PathBuf>) {
    let Some((segment, rest)) = segments.split_first() else {
        out.push(base.to_path_buf());
        return;
    };
    if depth > 6 {
        return;
    }
    if *segment == "**" {
        expand(base, rest, depth + 1, out);
        for dir in subdirs(base) {
            expand(&dir, segments, depth + 1, out);
        }
    } else if segment.contains('*') {
        for dir in subdirs(base) {
            let name = dir
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            if wildcard_match(segment, &name) {
                expand(&dir, rest, depth + 1, out);
            }
        }
    } else {
        expand(&base.join(segment), rest, depth + 1, out);
    }
}

fn pnpm_workspace_patterns(root: &Path) -> Vec<String> {
    let Ok(text) = fs::read_to_string(root.join("pnpm-workspace.yaml")) else {
        return Vec::new();
    };
    let mut inside = false;
    let mut patterns = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("packages:") {
            inside = true;
            continue;
        }
        if inside {
            if let Some(item) = trimmed.strip_prefix("- ") {
                patterns.push(
                    item.trim()
                        .trim_matches(|c| c == '"' || c == '\'')
                        .to_string(),
                );
            } else if !trimmed.is_empty() && !trimmed.starts_with('#') {
                inside = false;
            }
        }
    }
    patterns
}

fn scan_packages(base: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth == 0 {
        return;
    }
    for dir in subdirs(base) {
        if dir.join("package.json").is_file() {
            out.push(dir.clone());
        }
        scan_packages(&dir, depth - 1, out);
    }
}

pub fn workspace_packages(root: &Path, manifest: &Manifest) -> Vec<PathBuf> {
    let mut patterns = manifest.workspaces.clone();
    patterns.extend(pnpm_workspace_patterns(root));
    let mut found = Vec::new();
    if patterns.is_empty() {
        scan_packages(root, 3, &mut found);
    } else {
        let mut excluded = Vec::new();
        for pattern in &patterns {
            if let Some(negated) = pattern.strip_prefix('!') {
                excluded.push(root.join(negated.trim_end_matches('/')));
                continue;
            }
            let segments: Vec<&str> = pattern
                .trim_start_matches("./")
                .split('/')
                .filter(|s| !s.is_empty())
                .collect();
            expand(root, &segments, 0, &mut found);
        }
        found.retain(|dir| dir.join("package.json").is_file() && !excluded.contains(dir));
    }
    found.sort();
    found.dedup();
    found
}

pub fn packages_below(base: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    scan_packages(base, 3, &mut found);
    found
}

pub fn detect_manager(dir: &Path, field: Option<&str>) -> (Manager, String) {
    let declared = field.and_then(Manager::from_field);
    for ancestor in ancestors_until_git(dir) {
        let pnpm = ancestor.join("pnpm-lock.yaml").is_file();
        let bun_lock = ["bun.lock", "bun.lockb"]
            .into_iter()
            .find(|f| ancestor.join(f).is_file());
        if pnpm && bun_lock.is_some() {
            if declared == Some(Manager::Bun) {
                return (
                    Manager::Bun,
                    "bun lockfile and packageManager field".to_string(),
                );
            }
            return (Manager::Pnpm, "pnpm-lock.yaml".to_string());
        }
        if pnpm {
            return (Manager::Pnpm, "pnpm-lock.yaml".to_string());
        }
        if let Some(file) = bun_lock {
            return (Manager::Bun, file.to_string());
        }
        if ancestor.join("yarn.lock").is_file() {
            return (Manager::Yarn, "yarn.lock".to_string());
        }
        if ancestor.join("package-lock.json").is_file() {
            return (Manager::Npm, "package-lock.json".to_string());
        }
    }
    if let Some(manager) = declared {
        return (manager, "packageManager field".to_string());
    }
    for ancestor in ancestors_until_git(dir) {
        if ancestor.join("pnpm-workspace.yaml").is_file() {
            return (Manager::Pnpm, "pnpm-workspace.yaml".to_string());
        }
    }
    (Manager::Bun, "default".to_string())
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Need {
    Dev,
    Start,
    Build,
    Install,
}

impl Need {
    pub fn label(self) -> &'static str {
        match self {
            Need::Dev => "dev",
            Need::Start => "start",
            Need::Build => "build",
            Need::Install => "install",
        }
    }
}

struct Spec {
    dep: &'static str,
    id: &'static str,
    label: &'static str,
    dev_port: u16,
    start_port: u16,
    flag: Option<&'static str>,
    bins: &'static [&'static str],
    cli: Option<&'static str>,
    cli_dev: &'static [&'static str],
    cli_build: &'static [&'static str],
    cli_start: &'static [&'static str],
    prefers_preview: bool,
}

const SPECS: &[Spec] = &[
    Spec {
        dep: "next",
        id: "next",
        label: "Next.js",
        dev_port: 3000,
        start_port: 3000,
        flag: Some("--port"),
        bins: &["next"],
        cli: Some("next"),
        cli_dev: &["dev"],
        cli_build: &["build"],
        cli_start: &["start"],
        prefers_preview: false,
    },
    Spec {
        dep: "nuxt",
        id: "nuxt",
        label: "Nuxt",
        dev_port: 3000,
        start_port: 3000,
        flag: Some("--port"),
        bins: &["nuxt", "nuxi"],
        cli: Some("nuxt"),
        cli_dev: &["dev"],
        cli_build: &["build"],
        cli_start: &["preview"],
        prefers_preview: true,
    },
    Spec {
        dep: "astro",
        id: "astro",
        label: "Astro",
        dev_port: 4321,
        start_port: 4321,
        flag: Some("--port"),
        bins: &["astro"],
        cli: Some("astro"),
        cli_dev: &["dev"],
        cli_build: &["build"],
        cli_start: &["preview"],
        prefers_preview: true,
    },
    Spec {
        dep: "@sveltejs/kit",
        id: "sveltekit",
        label: "SvelteKit",
        dev_port: 5173,
        start_port: 4173,
        flag: Some("--port"),
        bins: &["vite", "svelte-kit", "vp"],
        cli: Some("vite"),
        cli_dev: &["dev"],
        cli_build: &["build"],
        cli_start: &["preview"],
        prefers_preview: true,
    },
    Spec {
        dep: "@react-router/dev",
        id: "react-router",
        label: "React Router",
        dev_port: 5173,
        start_port: 3000,
        flag: Some("--port"),
        bins: &["react-router"],
        cli: Some("react-router"),
        cli_dev: &["dev"],
        cli_build: &["build"],
        cli_start: &[],
        prefers_preview: false,
    },
    Spec {
        dep: "@remix-run/dev",
        id: "remix",
        label: "Remix",
        dev_port: 5173,
        start_port: 3000,
        flag: Some("--port"),
        bins: &["remix", "vite"],
        cli: None,
        cli_dev: &[],
        cli_build: &[],
        cli_start: &[],
        prefers_preview: false,
    },
    Spec {
        dep: "@tanstack/react-start",
        id: "tanstack-start",
        label: "TanStack Start",
        dev_port: 3000,
        start_port: 3000,
        flag: Some("--port"),
        bins: &["vite", "vinxi", "vp"],
        cli: None,
        cli_dev: &[],
        cli_build: &[],
        cli_start: &[],
        prefers_preview: false,
    },
    Spec {
        dep: "@solidjs/start",
        id: "solid-start",
        label: "SolidStart",
        dev_port: 3000,
        start_port: 3000,
        flag: Some("--port"),
        bins: &["vinxi", "vite"],
        cli: Some("vinxi"),
        cli_dev: &["dev"],
        cli_build: &["build"],
        cli_start: &["start"],
        prefers_preview: false,
    },
    Spec {
        dep: "@angular/core",
        id: "angular",
        label: "Angular",
        dev_port: 4200,
        start_port: 4200,
        flag: Some("--port"),
        bins: &["ng"],
        cli: Some("ng"),
        cli_dev: &["serve"],
        cli_build: &["build"],
        cli_start: &[],
        prefers_preview: false,
    },
    Spec {
        dep: "gatsby",
        id: "gatsby",
        label: "Gatsby",
        dev_port: 8000,
        start_port: 9000,
        flag: Some("--port"),
        bins: &["gatsby"],
        cli: Some("gatsby"),
        cli_dev: &["develop"],
        cli_build: &["build"],
        cli_start: &["serve"],
        prefers_preview: false,
    },
    Spec {
        dep: "@docusaurus/core",
        id: "docusaurus",
        label: "Docusaurus",
        dev_port: 3000,
        start_port: 3000,
        flag: Some("--port"),
        bins: &["docusaurus"],
        cli: Some("docusaurus"),
        cli_dev: &["start"],
        cli_build: &["build"],
        cli_start: &["serve"],
        prefers_preview: false,
    },
    Spec {
        dep: "react-scripts",
        id: "cra",
        label: "Create React App",
        dev_port: 3000,
        start_port: 3000,
        flag: None,
        bins: &["react-scripts"],
        cli: Some("react-scripts"),
        cli_dev: &["start"],
        cli_build: &["build"],
        cli_start: &[],
        prefers_preview: false,
    },
    Spec {
        dep: "vite",
        id: "vite",
        label: "Vite",
        dev_port: 5173,
        start_port: 4173,
        flag: Some("--port"),
        bins: &["vite"],
        cli: Some("vite"),
        cli_dev: &["dev"],
        cli_build: &["build"],
        cli_start: &["preview"],
        prefers_preview: true,
    },
];

#[derive(Clone, Debug)]
pub struct Framework {
    pub id: &'static str,
    pub label: String,
    pub version: Option<String>,
    pub dev_port: u16,
    pub start_port: u16,
    pub flag: Option<&'static str>,
    pub bins: Vec<&'static str>,
    pub cli: Option<&'static str>,
    pub cli_dev: &'static [&'static str],
    pub cli_build: &'static [&'static str],
    pub cli_start: &'static [&'static str],
    pub prefers_preview: bool,
    pub vite_plus: bool,
}

fn installed_version(dirs: &[&Path], dep: &str, range: Option<&String>) -> Option<String> {
    for dir in dirs {
        let path = dir.join("node_modules").join(dep).join("package.json");
        if let Ok(text) = fs::read_to_string(path)
            && let Ok(value) = serde_json::from_str::<Value>(&text)
            && let Some(version) = value.get("version").and_then(Value::as_str)
        {
            return Some(version.to_string());
        }
    }
    range.map(|r| r.trim_start_matches(['^', '~']).to_string())
}

fn uses_vite_plus(dir: &Path, manifest: &Manifest) -> bool {
    if manifest.deps.contains_key("vite-plus") {
        return true;
    }
    if manifest
        .scripts
        .values()
        .any(|body| body.split_whitespace().any(|t| t == "vp"))
    {
        return true;
    }
    [
        "vite.config.ts",
        "vite.config.js",
        "vite.config.mts",
        "vite.config.mjs",
    ]
    .iter()
    .filter_map(|file| fs::read_to_string(dir.join(file)).ok())
    .any(|text| text.contains("vite-plus"))
}

pub fn detect_framework(dir: &Path, root: &Path, manifest: &Manifest) -> Option<Framework> {
    let plus = uses_vite_plus(dir, manifest);
    let search = [dir, root];
    let spec = SPECS
        .iter()
        .find(|spec| manifest.deps.contains_key(spec.dep));
    let vite_family = matches!(spec.map(|s| s.id), Some("vite") | None);
    let spec = match (spec, plus) {
        (Some(spec), _) => spec,
        (None, true) => SPECS.iter().find(|spec| spec.id == "vite")?,
        (None, false) => return None,
    };
    let version = installed_version(&search, spec.dep, manifest.deps.get(spec.dep));
    let is_plus = plus && vite_family;
    let mut bins = spec.bins.to_vec();
    if is_plus {
        bins.push("vp");
    }
    Some(Framework {
        id: spec.id,
        label: if is_plus {
            "Vite+".to_string()
        } else {
            spec.label.to_string()
        },
        version: if is_plus {
            installed_version(&search, "vite-plus", manifest.deps.get("vite-plus")).or(version)
        } else {
            version
        },
        dev_port: spec.dev_port,
        start_port: spec.start_port,
        flag: spec.flag,
        bins,
        cli: if is_plus { Some("vp") } else { spec.cli },
        cli_dev: spec.cli_dev,
        cli_build: spec.cli_build,
        cli_start: spec.cli_start,
        prefers_preview: spec.prefers_preview,
        vite_plus: is_plus,
    })
}

#[derive(Clone, Debug)]
pub struct Task {
    pub script: Option<(String, String)>,
    pub cli: Option<(String, Vec<String>)>,
}

const DEV_SCRIPTS: &[&str] = &["dev", "develop", "start:dev", "dev:web", "dev:app", "serve"];
const BUILD_SCRIPTS: &[&str] = &["build", "build:prod", "build:production", "compile"];
const PROD_SCRIPTS: &[&str] = &["start:prod", "start:production", "prod", "serve:prod"];

pub fn script_candidates(need: Need, framework: Option<&Framework>) -> Vec<&'static str> {
    match need {
        Need::Dev => {
            let mut names = DEV_SCRIPTS.to_vec();
            if framework.is_none_or(|f| f.id == "cra") {
                names.push("start");
            }
            names
        }
        Need::Start => {
            let mut names = if framework.is_some_and(|f| f.prefers_preview) {
                vec!["preview", "start", "serve"]
            } else {
                vec!["start", "preview", "serve"]
            };
            names.extend(PROD_SCRIPTS);
            names
        }
        Need::Build => BUILD_SCRIPTS.to_vec(),
        Need::Install => Vec::new(),
    }
}

pub fn resolve_task(
    manifest: &Manifest,
    framework: Option<&Framework>,
    need: Need,
) -> Option<Task> {
    let dev_body = DEV_SCRIPTS
        .iter()
        .find_map(|name| manifest.scripts.get(*name));
    for name in script_candidates(need, framework) {
        let Some(body) = manifest.scripts.get(name) else {
            continue;
        };
        let vite_start = need == Need::Start
            && name == "start"
            && framework.is_some_and(|f| f.prefers_preview)
            && Some(body) == dev_body;
        if vite_start {
            continue;
        }
        return Some(Task {
            script: Some((name.to_string(), body.clone())),
            cli: None,
        });
    }
    let framework = framework?;
    let bin = framework.cli?;
    let args = match need {
        Need::Dev => framework.cli_dev,
        Need::Build => framework.cli_build,
        Need::Start => framework.cli_start,
        Need::Install => return None,
    };
    if args.is_empty() {
        return None;
    }
    Some(Task {
        script: None,
        cli: Some((
            bin.to_string(),
            args.iter().map(|a| a.to_string()).collect(),
        )),
    })
}

const ORCHESTRATORS: &[&str] = &[
    "turbo",
    "nx",
    "lerna",
    "concurrently",
    "npm-run-all",
    "npm-run-all2",
    "run-p",
    "run-s",
    "wireit",
    "moon",
    "rush",
];

pub fn is_orchestrated(body: &str) -> bool {
    body.split_whitespace()
        .any(|token| ORCHESTRATORS.contains(&token))
}

pub fn flag_applies(body: &str, framework: &Framework) -> bool {
    let tokens: Vec<&str> = body.split_whitespace().collect();
    let chained = tokens
        .iter()
        .any(|t| matches!(*t, "&&" | "||" | ";" | "|" | "&"));
    if chained || is_orchestrated(body) {
        return false;
    }
    tokens.iter().any(|token| {
        let base = token.rsplit('/').next().unwrap_or(token);
        framework.bins.contains(&base)
    })
}

pub fn explicit_port(body: &str) -> Option<u16> {
    let tokens: Vec<&str> = body.split_whitespace().collect();
    for (index, token) in tokens.iter().enumerate() {
        if let Some(value) = token
            .strip_prefix("--port=")
            .or_else(|| token.strip_prefix("PORT="))
            && let Ok(port) = value.parse()
        {
            return Some(port);
        }
        if matches!(*token, "--port" | "-p")
            && let Some(port) = tokens.get(index + 1).and_then(|v| v.parse().ok())
        {
            return Some(port);
        }
    }
    None
}

pub fn has_node_modules(dir: &Path, root: &Path) -> bool {
    if root.join(".pnp.cjs").is_file() {
        return true;
    }
    [dir, root].iter().any(|base| {
        fs::read_dir(base.join("node_modules"))
            .map(|mut entries| entries.next().is_some())
            .unwrap_or(false)
    })
}

#[derive(Clone, Debug)]
pub struct Project {
    pub dir: PathBuf,
    pub root: PathBuf,
    pub layout: Layout,
    pub manifest: Manifest,
    pub root_manifest: Manifest,
    pub manager: Manager,
    pub manager_source: String,
    pub framework: Option<Framework>,
}

pub fn load(dir: &Path) -> Result<Project, String> {
    let manifest = Manifest::load(dir)
        .ok_or_else(|| format!("{} has no readable package.json", dir.display()))?;
    let (root, layout) = find_root(dir).unwrap_or((dir.to_path_buf(), Layout::Single));
    let root_manifest = if root == dir {
        manifest.clone()
    } else {
        Manifest::load(&root).unwrap_or_default()
    };
    let field = manifest
        .package_manager
        .clone()
        .or(root_manifest.package_manager.clone());
    let (manager, manager_source) = detect_manager(dir, field.as_deref());
    let framework = detect_framework(dir, &root, &manifest);
    Ok(Project {
        dir: dir.to_path_buf(),
        root,
        layout,
        manifest,
        root_manifest,
        manager,
        manager_source,
        framework,
    })
}

pub enum Located {
    One(PathBuf),
    Many(Vec<PathBuf>),
}

fn can_serve(dir: &Path, root: &Path, need: Need) -> bool {
    if need == Need::Install {
        return true;
    }
    let Some(manifest) = Manifest::load(dir) else {
        return false;
    };
    let framework = detect_framework(dir, root, &manifest);
    resolve_task(&manifest, framework.as_ref(), need).is_some()
}

fn pick(mut found: Vec<PathBuf>, none_message: String) -> Result<Located, String> {
    match found.len() {
        0 => Err(none_message),
        1 => Ok(Located::One(found.remove(0))),
        _ => Ok(Located::Many(found)),
    }
}

pub fn locate(cwd: &Path, need: Need, filter: Option<&str>) -> Result<Located, String> {
    let nearest = nearest_package(cwd);
    let anchor = nearest.clone().unwrap_or_else(|| cwd.to_path_buf());
    let root = find_root(&anchor);
    if let Some(wanted) = filter {
        let (root_dir, _) = root.ok_or("no workspace root found for --workspace")?;
        let manifest = Manifest::load(&root_dir).unwrap_or_default();
        let mut packages = workspace_packages(&root_dir, &manifest);
        packages.push(root_dir.clone());
        let hit = packages.into_iter().find(|dir| {
            let relative = dir
                .strip_prefix(&root_dir)
                .unwrap_or(dir)
                .display()
                .to_string();
            let name = Manifest::load(dir).and_then(|m| m.name).unwrap_or_default();
            let base = dir
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            name == wanted || relative == wanted || base == wanted
        });
        return hit
            .map(Located::One)
            .ok_or_else(|| format!("no workspace package matches `{wanted}`"));
    }
    let root_dir = root.as_ref().map(|(dir, _)| dir.clone());
    let root_for_checks = root_dir.clone().unwrap_or_else(|| anchor.clone());
    if need == Need::Install {
        if let Some(dir) = &nearest {
            return Ok(Located::One(root_dir.unwrap_or_else(|| dir.clone())));
        }
        return pick(
            packages_below(cwd),
            "no package.json found here or in the folders below".to_string(),
        );
    }
    let Some(dir) = nearest else {
        let found: Vec<PathBuf> = packages_below(cwd)
            .into_iter()
            .filter(|d| can_serve(d, &root_for_checks, need))
            .collect();
        return pick(
            found,
            format!(
                "no package.json with a {} script found here or below",
                need.label()
            ),
        );
    };
    if can_serve(&dir, &root_for_checks, need) {
        return Ok(Located::One(dir));
    }
    match root_dir {
        Some(root_dir) if root_dir == dir => {
            let manifest = Manifest::load(&root_dir).unwrap_or_default();
            let found: Vec<PathBuf> = workspace_packages(&root_dir, &manifest)
                .into_iter()
                .filter(|d| can_serve(d, &root_dir, need))
                .collect();
            pick(
                found,
                format!("no workspace package has a {} script", need.label()),
            )
        }
        _ => {
            let found: Vec<PathBuf> = packages_below(&dir)
                .into_iter()
                .filter(|d| can_serve(d, &root_for_checks, need))
                .collect();
            pick(
                found,
                format!("no {} script found in {}", need.label(), dir.display()),
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sandbox(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("rig-test-{name}-{}", std::process::id()));
        fs::remove_dir_all(&dir).ok();
        fs::create_dir_all(dir.join(".git")).unwrap();
        dir
    }

    fn write(path: &Path, text: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }

    #[test]
    fn pnpm_lock_beats_default() {
        let dir = sandbox("pnpm");
        write(&dir.join("package.json"), "{}");
        write(&dir.join("pnpm-lock.yaml"), "");
        assert_eq!(detect_manager(&dir, None).0, Manager::Pnpm);
    }

    #[test]
    fn bun_is_the_default() {
        let dir = sandbox("default");
        write(&dir.join("package.json"), "{}");
        assert_eq!(detect_manager(&dir, None).0, Manager::Bun);
    }

    #[test]
    fn bun_lock_with_pnpm_lock_follows_package_manager_field() {
        let dir = sandbox("both");
        write(&dir.join("bun.lock"), "");
        write(&dir.join("pnpm-lock.yaml"), "");
        assert_eq!(detect_manager(&dir, Some("bun@1.2.0")).0, Manager::Bun);
        assert_eq!(detect_manager(&dir, None).0, Manager::Pnpm);
    }

    #[test]
    fn lockfile_is_found_in_a_parent_folder() {
        let dir = sandbox("parent");
        write(&dir.join("pnpm-lock.yaml"), "");
        write(&dir.join("apps/web/package.json"), "{}");
        assert_eq!(detect_manager(&dir.join("apps/web"), None).0, Manager::Pnpm);
    }

    #[test]
    fn turborepo_root_is_found_from_an_app() {
        let dir = sandbox("turbo");
        write(&dir.join("turbo.json"), "{}");
        write(&dir.join("package.json"), "{\"workspaces\":[\"apps/*\"]}");
        write(
            &dir.join("apps/web/package.json"),
            "{\"scripts\":{\"dev\":\"next dev\"},\"dependencies\":{\"next\":\"^15.0.0\"}}",
        );
        let (root, layout) = find_root(&dir.join("apps/web")).unwrap();
        assert_eq!(root, dir);
        assert_eq!(layout, Layout::Turborepo);
        let manifest = Manifest::load(&dir).unwrap();
        assert_eq!(
            workspace_packages(&dir, &manifest),
            vec![dir.join("apps/web")]
        );
    }

    #[test]
    fn pnpm_workspace_patterns_are_expanded() {
        let dir = sandbox("pnpmws");
        write(
            &dir.join("pnpm-workspace.yaml"),
            "packages:\n  - 'apps/*'\n  - 'tools/**'\n",
        );
        write(&dir.join("apps/a/package.json"), "{}");
        write(&dir.join("tools/x/y/package.json"), "{}");
        let packages = workspace_packages(&dir, &Manifest::default());
        assert_eq!(packages, vec![dir.join("apps/a"), dir.join("tools/x/y")]);
    }

    #[test]
    fn next_uses_start_and_vite_uses_preview() {
        let next = Manifest::from_value(&serde_json::json!({
            "scripts": {"dev": "next dev", "start": "next start", "build": "next build"},
            "dependencies": {"next": "15.0.0"}
        }));
        let fw = detect_framework(Path::new("/nowhere"), Path::new("/nowhere"), &next).unwrap();
        assert_eq!(
            resolve_task(&next, Some(&fw), Need::Start)
                .unwrap()
                .script
                .unwrap()
                .0,
            "start"
        );

        let vite = Manifest::from_value(&serde_json::json!({
            "scripts": {"dev": "vite", "start": "vite", "preview": "vite preview"},
            "devDependencies": {"vite": "6.0.0"}
        }));
        let fw = detect_framework(Path::new("/nowhere"), Path::new("/nowhere"), &vite).unwrap();
        assert_eq!(
            resolve_task(&vite, Some(&fw), Need::Start)
                .unwrap()
                .script
                .unwrap()
                .0,
            "preview"
        );
    }

    #[test]
    fn vite_plus_is_detected_from_dependency_and_scripts() {
        let by_dep =
            Manifest::from_value(&serde_json::json!({"devDependencies": {"vite-plus": "1.0.0"}}));
        let fw = detect_framework(Path::new("/nowhere"), Path::new("/nowhere"), &by_dep).unwrap();
        assert!(fw.vite_plus);
        let by_script = Manifest::from_value(
            &serde_json::json!({"scripts": {"dev": "vp dev"}, "devDependencies": {"vite": "6.0.0"}}),
        );
        let fw =
            detect_framework(Path::new("/nowhere"), Path::new("/nowhere"), &by_script).unwrap();
        assert_eq!(fw.label, "Vite+");
    }

    #[test]
    fn explicit_ports_are_read_from_scripts() {
        assert_eq!(explicit_port("next dev -p 4000"), Some(4000));
        assert_eq!(explicit_port("vite --port=5000"), Some(5000));
        assert_eq!(explicit_port("PORT=8080 node server.js"), Some(8080));
        assert_eq!(explicit_port("next dev"), None);
    }

    #[test]
    fn port_flags_skip_orchestrated_and_chained_scripts() {
        let manifest =
            Manifest::from_value(&serde_json::json!({"dependencies": {"next": "15.0.0"}}));
        let fw = detect_framework(Path::new("/nowhere"), Path::new("/nowhere"), &manifest).unwrap();
        assert!(flag_applies("next dev", &fw));
        assert!(!flag_applies("turbo dev", &fw));
        assert!(!flag_applies("next dev && echo hi", &fw));
        assert!(is_orchestrated("turbo run dev --parallel"));
    }

    #[test]
    fn script_args_follow_the_manager() {
        let extra = vec!["--port".to_string(), "3001".to_string()];
        assert_eq!(
            Manager::Bun.script_args("dev", &extra),
            vec!["run", "dev", "--port", "3001"]
        );
        assert_eq!(
            Manager::Npm.script_args("dev", &extra),
            vec!["run", "dev", "--", "--port", "3001"]
        );
    }
}
