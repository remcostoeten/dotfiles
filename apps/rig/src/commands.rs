use crate::cli::Opts;
use crate::project::{
    self, Need, Project, Task, explicit_port, flag_applies, has_node_modules, is_orchestrated,
    resolve_task, script_candidates, workspace_packages,
};
use crate::run::{Plan, Serve, StepOutcome, hint_for, run_step, serve};
use crate::ui;
use std::path::Path;

const INTERRUPTED: i32 = 130;

fn prepare(opts: &Opts, need: Need) -> Result<Project, i32> {
    let located = match project::locate(&opts.cwd, need, opts.workspace.as_deref()) {
        Ok(located) => located,
        Err(message) => {
            ui::fatal(&message);
            return Err(1);
        }
    };
    let dir = match located {
        project::Located::One(dir) => dir,
        project::Located::Many(dirs) => {
            let items: Vec<(String, String)> = dirs
                .iter()
                .map(|dir| {
                    let name = project::Manifest::load(dir)
                        .and_then(|m| m.name)
                        .unwrap_or_else(|| {
                            dir.file_name()
                                .map(|n| n.to_string_lossy().to_string())
                                .unwrap_or_default()
                        });
                    (name, ui::home_relative(dir))
                })
                .collect();
            match ui::choose(
                &format!("several packages can run {}, pick one", need.label()),
                &items,
            ) {
                Some(index) => {
                    println!();
                    dirs[index].clone()
                }
                None => {
                    ui::fatal("pick a package interactively or pass -w <name>");
                    return Err(2);
                }
            }
        }
    };
    project::load(&dir).map_err(|message| {
        ui::fatal(&message);
        1
    })
}

fn relative_to_root(project: &Project) -> String {
    let relative = project
        .dir
        .strip_prefix(&project.root)
        .unwrap_or(&project.dir);
    if relative.as_os_str().is_empty() {
        return "root".to_string();
    }
    relative.display().to_string()
}

fn describe(project: &Project, task: Option<&Task>) {
    let name = project.manifest.name.clone().unwrap_or_else(|| {
        project
            .dir
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default()
    });
    ui::row("project", &ui::bold(&name));
    if project.layout != project::Layout::Single {
        ui::row(
            "workspace",
            &format!(
                "{} {} {}",
                project.layout.label(),
                ui::dim("·"),
                relative_to_root(project)
            ),
        );
    }
    match &project.framework {
        Some(framework) => {
            let version = framework
                .version
                .as_deref()
                .map(|v| format!(" {v}"))
                .unwrap_or_default();
            let plus = if framework.vite_plus {
                ui::dim("  (vite-plus)")
            } else {
                String::new()
            };
            ui::row(
                "framework",
                &format!("{}{}{}", framework.label, version, plus),
            );
        }
        None => ui::row("framework", &ui::dim("none detected")),
    }
    ui::row(
        "manager",
        &format!(
            "{}  {}",
            project.manager.name(),
            ui::dim(&format!("({})", project.manager_source))
        ),
    );
    if let Some(task) = task {
        ui::row("command", &command_line(project, task));
    }
    ui::row("folder", &ui::home_relative(&project.dir));
    let modules = if has_node_modules(&project.dir, &project.root) {
        ui::ok("installed")
    } else {
        ui::warn("missing")
    };
    ui::row("modules", &modules);
    println!();
}

fn command_line(project: &Project, task: &Task) -> String {
    let manager = project.manager.name();
    match (&task.script, &task.cli) {
        (Some((name, body)), _) => {
            format!("{manager} run {name}  {}", ui::dim(&format!("→ {body}")))
        }
        (None, Some((bin, args))) => format!(
            "{manager} {} {bin} {}",
            if manager == "bun" { "x" } else { "exec" },
            args.join(" ")
        ),
        _ => String::new(),
    }
}

fn plan_for(
    project: &Project,
    task: &Task,
    extra: Vec<String>,
    env: Vec<(String, String)>,
) -> Plan {
    let manager = project.manager;
    let args = match (&task.script, &task.cli) {
        (Some((name, _)), _) => manager.script_args(name, &extra),
        (None, Some((bin, base))) => {
            let mut all = base.clone();
            all.extend(extra);
            manager.exec_args(bin, &all)
        }
        _ => Vec::new(),
    };
    Plan {
        program: manager.name().to_string(),
        args,
        cwd: project.dir.clone(),
        env,
    }
}

fn child_env(port: Option<u16>) -> Vec<(String, String)> {
    let mut env = vec![("BROWSER".to_string(), "none".to_string())];
    if let Some(port) = port {
        env.push(("PORT".to_string(), port.to_string()));
    }
    if ui::color_on() {
        env.push(("FORCE_COLOR".to_string(), "1".to_string()));
    }
    env
}

fn missing_script(project: &Project, need: Need) {
    let available: Vec<&str> = project
        .manifest
        .scripts
        .keys()
        .map(String::as_str)
        .collect();
    let rows = [
        ("folder", ui::home_relative(&project.dir)),
        (
            "looked for",
            script_candidates(need, project.framework.as_ref()).join(", "),
        ),
        (
            "scripts",
            if available.is_empty() {
                "none".to_string()
            } else {
                available.join(", ")
            },
        ),
    ];
    ui::error_panel(
        &format!("no {} script found", need.label()),
        &rows,
        &[],
        Some("Add the script to package.json, or run from the package you want with -C or -w."),
    );
}

fn install_plan(project: &Project, extra: &[String]) -> Plan {
    let mut args = vec!["install".to_string()];
    args.extend(extra.iter().cloned());
    Plan {
        program: project.manager.name().to_string(),
        args,
        cwd: project.root.clone(),
        env: Vec::new(),
    }
}

fn report_step(title: &str, plan: &Plan, outcome: StepOutcome, done: &str) -> Result<(), i32> {
    match outcome {
        StepOutcome::Done(elapsed) => {
            println!();
            ui::success(&format!(
                "{done} {}",
                ui::dim(&format!("in {}", ui::format_duration(elapsed)))
            ));
            println!();
            Ok(())
        }
        StepOutcome::Failed {
            code,
            elapsed,
            tail,
        } => {
            let rows = [
                ("command", plan.shown()),
                ("folder", ui::home_relative(&plan.cwd)),
                (
                    "exit",
                    format!("code {code} after {}", ui::format_duration(elapsed)),
                ),
            ];
            let start = tail.len().saturating_sub(10);
            ui::error_panel(
                &format!("{title} failed"),
                &rows,
                &tail[start..],
                hint_for(&tail),
            );
            Err(code)
        }
        StepOutcome::Interrupted => {
            ui::stopped(&format!("{title} interrupted"));
            Err(INTERRUPTED)
        }
        StepOutcome::SpawnFailed(reason) => {
            ui::error_panel(
                &format!("cannot run {title}"),
                &[("command", plan.shown()), ("reason", reason)],
                &[],
                None,
            );
            Err(127)
        }
    }
}

fn install_step(project: &Project, extra: &[String]) -> Result<(), i32> {
    let plan = install_plan(project, extra);
    ui::rule(&plan.shown());
    let outcome = run_step(&plan);
    report_step("install", &plan, outcome, "dependencies installed")
}

fn build_step(project: &Project, task: &Task) -> Result<(), i32> {
    let plan = plan_for(project, task, Vec::new(), child_env(None));
    ui::rule(&plan.shown());
    let outcome = run_step(&plan);
    report_step("build", &plan, outcome, "build finished")
}

fn ensure_modules(project: &Project) -> Result<(), i32> {
    if has_node_modules(&project.dir, &project.root) {
        return Ok(());
    }
    let nothing_to_install = project.manifest.deps.is_empty()
        && project.root_manifest.deps.is_empty()
        && project.layout == project::Layout::Single;
    if nothing_to_install {
        return Ok(());
    }
    ui::warning("no node_modules found, installing first");
    install_step(project, &[])
}

struct PortPlan {
    base: Option<u16>,
    flag: Option<&'static str>,
}

fn port_plan(project: &Project, task: &Task, opts: &Opts, need: Need) -> PortPlan {
    let body = task.script.as_ref().map(|(_, body)| body.as_str());
    if body.is_some_and(is_orchestrated) {
        ui::note("the script starts several apps, ports are detected after launch");
        return PortPlan {
            base: None,
            flag: None,
        };
    }
    let framework = project.framework.as_ref();
    let from_env = std::env::var("PORT")
        .ok()
        .and_then(|value| value.parse().ok());
    let from_framework = framework.map(|f| {
        if need == Need::Start {
            f.start_port
        } else {
            f.dev_port
        }
    });
    let base = opts
        .port
        .or(body.and_then(explicit_port))
        .or(from_env)
        .or(from_framework);
    let flag = framework.and_then(|f| {
        let applies = task.cli.is_some() || body.is_some_and(|b| flag_applies(b, f));
        if applies { f.flag } else { None }
    });
    PortPlan { base, flag }
}

fn serve_flow(opts: &Opts, need: Need) -> i32 {
    ui::banner(need.label());
    let project = match prepare(opts, need) {
        Ok(project) => project,
        Err(code) => return code,
    };
    let Some(task) = resolve_task(&project.manifest, project.framework.as_ref(), need) else {
        missing_script(&project, need);
        return 1;
    };
    describe(&project, Some(&task));
    if let Err(code) = ensure_modules(&project) {
        return code;
    }
    if need == Need::Start && !opts.skip_build {
        match resolve_task(&project.manifest, project.framework.as_ref(), Need::Build) {
            Some(build) => {
                if let Err(code) = build_step(&project, &build) {
                    return code;
                }
            }
            None => ui::note("no build script found, skipping the build"),
        }
    }
    let ports = port_plan(&project, &task, opts, need);
    let spec = Serve {
        make_plan: Box::new(|port| {
            let mut extra = Vec::new();
            if let (Some(port), Some(flag)) = (port, ports.flag) {
                extra.push(flag.to_string());
                extra.push(port.to_string());
            }
            extra.extend(opts.extra.iter().cloned());
            plan_for(&project, &task, extra, child_env(port))
        }),
        base_port: ports.base,
    };
    serve(&spec)
}

pub fn dev(opts: &Opts) -> i32 {
    serve_flow(opts, Need::Dev)
}

pub fn start(opts: &Opts) -> i32 {
    serve_flow(opts, Need::Start)
}

pub fn install(opts: &Opts) -> i32 {
    ui::banner("install");
    let project = match prepare(opts, Need::Install) {
        Ok(project) => project,
        Err(code) => return code,
    };
    describe(&project, None);
    match install_step(&project, &opts.extra) {
        Ok(()) => 0,
        Err(code) => code,
    }
}

pub fn build(opts: &Opts) -> i32 {
    ui::banner("build");
    let project = match prepare(opts, Need::Build) {
        Ok(project) => project,
        Err(code) => return code,
    };
    let Some(task) = resolve_task(&project.manifest, project.framework.as_ref(), Need::Build)
    else {
        missing_script(&project, Need::Build);
        return 1;
    };
    describe(&project, Some(&task));
    if let Err(code) = ensure_modules(&project) {
        return code;
    }
    match build_step(&project, &task) {
        Ok(()) => 0,
        Err(code) => code,
    }
}

pub fn info(opts: &Opts) -> i32 {
    ui::banner("info");
    let nearest = project::nearest_package(&opts.cwd).filter(|_| opts.workspace.is_none());
    let loaded = match nearest {
        Some(dir) => project::load(&dir).map_err(|message| {
            ui::fatal(&message);
            1
        }),
        None => prepare(opts, Need::Install),
    };
    let project = match loaded {
        Ok(project) => project,
        Err(code) => return code,
    };
    describe(&project, None);
    for need in [Need::Dev, Need::Start, Need::Build] {
        let found = resolve_task(&project.manifest, project.framework.as_ref(), need);
        let value = match &found {
            Some(task) => command_line(&project, task),
            None => ui::dim("not available"),
        };
        ui::row(need.label(), &value);
    }
    if project.layout != project::Layout::Single {
        println!();
        ui::row("root", &ui::home_relative(&project.root));
        let packages = workspace_packages(&project.root, &project.root_manifest);
        for package in packages {
            let relative = package.strip_prefix(&project.root).unwrap_or(Path::new(""));
            let name = project::Manifest::load(&package)
                .and_then(|m| m.name)
                .unwrap_or_default();
            ui::row(
                "package",
                &format!("{:<22}{}", name, ui::dim(&relative.display().to_string())),
            );
        }
    }
    println!();
    0
}
