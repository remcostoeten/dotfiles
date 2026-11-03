use ratatui::Frame;
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, BorderType, Padding, Paragraph};
use ratatui_image::Image;

use crate::app::{App, SCOPES, SECTIONS, Section};
use crate::data::background_name;
use crate::preview::Loaded;
use crate::theme::Rgb;

const MUTED: Color = Color::Rgb(0x6f, 0x70, 0x85);
const BORDER: Color = Color::Rgb(0x3a, 0x3a, 0x4c);
const ERROR: Color = Color::Rgb(0xff, 0x6b, 0x7a);
const SWATCH_FALLBACK: [Rgb; 8] = [
    [0x19, 0x19, 0x22],
    [0xef, 0x6b, 0x73],
    [0x58, 0xc7, 0x8d],
    [0xe5, 0xc0, 0x7b],
    [0x61, 0xaf, 0xef],
    [0xc6, 0x78, 0xdd],
    [0x56, 0xb6, 0xc2],
    [0xab, 0xb2, 0xbf],
];

fn rgb([r, g, b]: Rgb) -> Color {
    Color::Rgb(r, g, b)
}

struct Styles {
    accent: Color,
    bg: Color,
    title: Style,
    muted: Style,
    key: Style,
    selected: Style,
}

fn styles(app: &App) -> Styles {
    let theme = app.theme();
    let (accent, bg, text) = (
        rgb(theme.cursor),
        rgb(theme.background),
        rgb(theme.foreground),
    );
    Styles {
        accent,
        bg,
        title: Style::new().fg(text).add_modifier(Modifier::BOLD),
        muted: Style::new().fg(MUTED),
        key: Style::new().fg(accent).add_modifier(Modifier::BOLD),
        selected: Style::new().fg(bg).bg(accent).add_modifier(Modifier::BOLD),
    }
}

fn panel() -> Block<'static> {
    Block::bordered()
        .border_type(BorderType::Rounded)
        .border_style(Style::new().fg(BORDER))
        .padding(Padding::horizontal(1))
}

pub fn render(frame: &mut Frame, app: &mut App) {
    let s = styles(app);
    let outer = frame.area().inner(ratatui::layout::Margin::new(2, 1));
    let [header, tabs, body, footer] = Layout::vertical([
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Fill(1),
        Constraint::Length(1),
    ])
    .areas(outer);

    frame.render_widget(
        Line::from(vec![
            Span::styled("◇ GHOSTTY STUDIO", s.title),
            Span::styled("   appearance, without the guesswork", s.muted),
        ]),
        header,
    );

    let tab_spans: Vec<Span> = SECTIONS
        .iter()
        .map(|section| {
            let label = format!(" {} ", section.name());
            if *section == app.section {
                Span::styled(
                    label,
                    Style::new()
                        .fg(s.bg)
                        .bg(s.accent)
                        .add_modifier(Modifier::BOLD),
                )
            } else {
                Span::styled(label, s.muted)
            }
        })
        .collect();
    frame.render_widget(Line::from(tab_spans), tabs);

    let (left, right) = if body.width >= 84 {
        let left_width = (body.width * 38 / 100).clamp(30, 48);
        let [left, _, right] = Layout::horizontal([
            Constraint::Length(left_width),
            Constraint::Length(1),
            Constraint::Fill(1),
        ])
        .areas(body);
        (left, right)
    } else {
        let [left, right] =
            Layout::vertical([Constraint::Percentage(45), Constraint::Fill(1)]).areas(body);
        (left, right)
    };

    let list_block = panel();
    let list_inner = list_block.inner(left);
    frame.render_widget(list_block, left);
    render_list(frame, app, list_inner, &s);

    let preview_block = panel();
    let preview_inner = preview_block.inner(right);
    frame.render_widget(preview_block, right);
    render_preview(frame, app, preview_inner, &s);

    render_footer(frame, app, footer, &s);
}

fn list_label(app: &App, index: usize) -> String {
    match app.section {
        Section::Presets => {
            let preset = &app.presets[app.visible[index]];
            let dot = if preset.matches(&app.cfg) {
                "● "
            } else {
                "  "
            };
            format!("{dot}{}", preset.name)
        }
        Section::Themes => {
            let theme = &app.themes[app.visible[index]];
            let star = if app.favorites.contains(&theme.name) {
                "★ "
            } else {
                "  "
            };
            let suffix = if theme.custom { "  ·" } else { "" };
            format!("{star}{}{suffix}", theme.name)
        }
        Section::Backgrounds => app.backgrounds[app.visible[index]].name.clone(),
        Section::Fonts => app.fonts[app.visible[index]].clone(),
        Section::Typography => match index {
            0 => format!("Font size          {} pt", app.cfg.font_size),
            1 => format!("Line height        {:+}%", app.cfg.line_height),
            _ => format!("Letter spacing     {:+}%", app.cfg.letter_spacing),
        },
        Section::Window => match index {
            0 => format!("Bg opacity         {}%", app.cfg.opacity),
            1 => format!("Backdrop blur      {}", app.cfg.blur),
            2 => format!("Window padding     {} px", app.cfg.padding),
            3 => format!(
                "Decorations        {}",
                if app.cfg.decorations {
                    "system"
                } else {
                    "hidden"
                }
            ),
            _ => format!("Image opacity      {}%", app.cfg.image_opacity),
        },
    }
}

fn render_list(frame: &mut Frame, app: &mut App, area: Rect, s: &Styles) {
    let mut title = app.section.name().to_string();
    if app.section == Section::Themes {
        title = format!("{title}  {}", SCOPES[app.scope]);
    }
    if let Some(name) = &app.naming {
        title = format!("save as: {name}▌");
    } else if app.searching {
        title = format!("/ {}▌", app.query);
    } else if !app.query.is_empty() {
        title = format!("{title}  /{}", app.query);
    }
    let count = app.item_count();
    let mut lines = vec![Line::styled(title, s.title), Line::raw("")];

    let rows = (area.height as usize).saturating_sub(lines.len()).max(1);
    if app.cursor < app.offset {
        app.offset = app.cursor;
    } else if app.cursor >= app.offset + rows {
        app.offset = app.cursor + 1 - rows;
    }
    app.offset = app.offset.min(count.saturating_sub(rows));

    let width = area.width as usize;
    for index in app.offset..count.min(app.offset + rows) {
        let label = list_label(app, index);
        if index == app.cursor {
            let text = format!("› {label}");
            let pad = width.saturating_sub(text.chars().count());
            lines.push(Line::styled(
                format!("{text}{}", " ".repeat(pad)),
                s.selected,
            ));
        } else {
            lines.push(Line::raw(format!("  {label}")));
        }
    }
    if count == 0 {
        let empty = if app.section == Section::Fonts && app.fonts_loading {
            "  Loading fonts"
        } else if app.section == Section::Presets && app.presets.is_empty() {
            "  No presets yet, press s to save one"
        } else {
            "  No matches"
        };
        lines.push(Line::styled(empty, s.muted));
    }
    frame.render_widget(Paragraph::new(lines), area);
}

fn render_preview(frame: &mut Frame, app: &mut App, area: Rect, s: &Styles) {
    let image_label = if app.cfg.background.is_empty() {
        format!("Background  none  ·  bg {}%", app.cfg.opacity)
    } else {
        format!(
            "Background  {}  ·  image {}%  ·  bg {}%",
            background_name(&app.cfg.background),
            app.cfg.image_opacity,
            app.cfg.opacity
        )
    };

    if app.section == Section::Backgrounds {
        let [title, label, _, image, _, swatches] = Layout::vertical([
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Fill(1),
            Constraint::Length(1),
            Constraint::Length(2),
        ])
        .areas(area);
        frame.render_widget(Line::styled("Background preview", s.title), title);
        frame.render_widget(Line::styled(image_label, s.muted), label);
        render_image(frame, app, image, s);
        render_swatches(frame, app, swatches);
        return;
    }

    let spread = app.cfg.line_height >= 20 && area.height > 24;
    let mock_height = if spread { 15 } else { 9 };
    let [title, meta, _, mock, _, swatches, _, label, image] = Layout::vertical([
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Length(mock_height),
        Constraint::Length(1),
        Constraint::Length(2),
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Fill(1),
    ])
    .areas(area);
    let mut heading = "Live terminal preview".to_string();
    let mut meta_text = format!(
        "{}  ·  {}pt  ·  line {:+}%  ·  cell {:+}%",
        app.cfg.font, app.cfg.font_size, app.cfg.line_height, app.cfg.letter_spacing
    );
    if app.section == Section::Presets
        && let Some(preset) = app.visible.get(app.cursor).map(|&i| &app.presets[i])
    {
        heading = format!("{}  ·  {}", preset.name, app.cfg.theme);
        if !preset.description.is_empty() {
            meta_text = format!("{}  ·  {meta_text}", preset.description);
        }
    }
    frame.render_widget(Line::styled(heading, s.title), title);
    frame.render_widget(Line::styled(meta_text, s.muted), meta);
    render_mock(frame, app, mock, spread, s);
    render_swatches(frame, app, swatches);
    frame.render_widget(Line::styled(image_label, s.muted), label);
    render_image(frame, app, image, s);
}

fn render_mock(frame: &mut Frame, app: &App, area: Rect, spread: bool, s: &Styles) {
    let theme = app.theme();
    let bg = rgb(theme.background);
    let fg = rgb(theme.foreground);
    let color = |i: usize| theme.palette[i].map_or(s.accent, rgb);
    let base = Style::new().fg(fg).bg(bg);
    let paint = |i: usize| base.fg(color(i));
    let bold = |i: usize| paint(i).add_modifier(Modifier::BOLD);
    let mut lines = vec![
        Line::from(vec![
            Span::styled("~/dotfiles", bold(4)),
            Span::raw("  "),
            Span::styled("❯", bold(2)),
            Span::raw(" cargo run --release"),
        ]),
        Line::raw(""),
        Line::from(vec![
            Span::styled("fn", paint(5)),
            Span::raw(" "),
            Span::styled("main", paint(6)),
            Span::raw("() {"),
        ]),
        Line::from(vec![
            Span::raw("    println!("),
            Span::styled("\"hello, ghostty\"", paint(3)),
            Span::raw(");"),
        ]),
        Line::raw("}"),
        Line::raw(""),
        Line::from(vec![
            Span::styled("✓ built in 183ms", paint(2)),
            Span::raw("   0123456789  Aa Bb Cc"),
        ]),
    ];
    if spread {
        let last = lines.len() - 1;
        lines = lines
            .into_iter()
            .enumerate()
            .flat_map(|(i, line)| {
                let gap = (i < last).then(|| Line::raw(""));
                std::iter::once(line).chain(gap)
            })
            .collect();
    }
    let block = Block::new().style(base).padding(Padding::new(2, 2, 1, 1));
    frame.render_widget(Paragraph::new(lines).style(base).block(block), area);
}

fn render_swatches(frame: &mut Frame, app: &App, area: Rect) {
    let theme = app.theme();
    let row = |start: usize| -> Line {
        Line::from(
            (start..start + 8)
                .map(|i| {
                    let color = theme.palette[i].unwrap_or(SWATCH_FALLBACK[i % 8]);
                    Span::styled("   ", Style::new().bg(rgb(color)))
                })
                .collect::<Vec<_>>(),
        )
    };
    frame.render_widget(Paragraph::new(vec![row(0), row(8)]), area);
}

fn render_image(frame: &mut Frame, app: &mut App, area: Rect, s: &Styles) {
    if area.height < 3 || area.width < 8 {
        app.image_area = None;
        return;
    }
    app.image_area = Some(area);
    let Some(key) = app.shown_image_key() else {
        return;
    };
    match app.previewer.get(&key) {
        Some(Loaded::Ready(protocol)) => {
            let size = protocol.size();
            let width = size.width.min(area.width);
            let height = size.height.min(area.height);
            let centered = Rect::new(area.x + (area.width - width) / 2, area.y, width, height);
            frame.render_widget(Image::new(protocol), centered);
        }
        Some(Loaded::Failed(err)) => {
            frame.render_widget(
                Line::styled(
                    format!("Could not read image: {err}"),
                    Style::new().fg(ERROR),
                ),
                area,
            );
        }
        None => frame.render_widget(Line::styled("decoding…", s.muted), area),
    }
}

fn render_footer(frame: &mut Frame, app: &App, area: Rect, s: &Styles) {
    if app.naming.is_some() {
        let spans = vec![
            Span::styled("enter", s.key),
            Span::styled(" save to configs/ghostty/presets", s.muted),
            Span::raw("   "),
            Span::styled("esc", s.key),
            Span::styled(" cancel", s.muted),
        ];
        frame.render_widget(Line::from(spans), area);
        return;
    }
    if let Some(status) = &app.status {
        let style = if status.error {
            Style::new().fg(ERROR).add_modifier(Modifier::BOLD)
        } else {
            s.key
        };
        frame.render_widget(Line::styled(status.text.as_str(), style), area);
        return;
    }
    let mut hints = vec![
        ("↑↓", " navigate"),
        ("←→", " adjust"),
        ("/", " search"),
        ("enter", " apply"),
        (
            "p",
            if app.live {
                " preview on"
            } else {
                " preview paused"
            },
        ),
        ("q", " restore & quit"),
    ];
    if app.section == Section::Presets {
        hints.push(("s", " save as preset"));
    }
    if app.section == Section::Themes {
        hints.extend([("f", " favorite"), ("v", " view")]);
    }
    if app.section == Section::Backgrounds {
        hints.extend([("x", " no image"), ("-+", " image %"), ("<>", " bg %")]);
    }
    let mut spans = Vec::with_capacity(hints.len() * 3);
    for (i, (key, label)) in hints.into_iter().enumerate() {
        if i > 0 {
            spans.push(Span::raw("   "));
        }
        spans.push(Span::styled(key, s.key));
        spans.push(Span::styled(label, s.muted));
    }
    frame.render_widget(Line::from(spans), area);
}
