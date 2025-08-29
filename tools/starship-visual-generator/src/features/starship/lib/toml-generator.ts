import type { TPromptState, TStarshipModule } from '../types/starship';
import TOML from '@iarna/toml';

export function generateToml(state: TPromptState): string {
  const config: Record<string, unknown> = {};
  const enabledModules = state.modules.slice().sort(orderAsc).filter(isEnabled);
  const hasFormat = typeof state.format === 'string' && state.format.trim().length > 0;
  config.format = hasFormat ? state.format : buildFormatFromModules(enabledModules);
  if (state.palette && state.palette.name && state.palette.name !== 'default') {
    config.palette = state.palette.name;
    config.palettes = { [state.palette.name]: state.palette.colors };
  }
  for (let i = 0; i < enabledModules.length; i++) {
    const m = enabledModules[i];
    if (m.config && Object.keys(m.config).length > 0) {
      config[m.name] = m.config as unknown;
    }
  }
  if (enabledModules.some(isDotfilesModule)) {
    config['custom.dotfiles_version'] = {
      command: '~/.config/dotfiles/bin/dotfiles-version-short',
      when: 'test -f ~/.config/dotfiles/bin/dotfiles-version-short',
      style: 'bg:#6A1B9A white bold',
      format: '[ 󰔘 v$output ]($style)',
      description: 'Show current dotfiles version'
    } as unknown;
  }
  return TOML.stringify(config as unknown as TOML.JsonMap);
}

export function parseTomlToState(tomlContent: string): Partial<TPromptState> {
  try {
    const parsed = TOML.parse(tomlContent) as Record<string, unknown>;
    const formatString = typeof parsed.format === 'string' ? (parsed.format as string) : '';
    const orderNames = extractModuleOrder(formatString);
    const moduleNamesFromConfig = Object.keys(parsed)
      .filter(k => k !== 'format' && k !== 'palette' && k !== 'palettes');
    const modules: TStarshipModule[] = [];
    let orderIndex = 0;
    for (let i = 0; i < orderNames.length; i++) {
      const name = orderNames[i];
      const conf = (parsed as Record<string, unknown>)[name] as Record<string, unknown> | undefined;
      modules.push({
        id: `${name}-${orderIndex}`,
        name,
        displayName: getDisplayName(name),
        category: getModuleCategory(name),
        enabled: true,
        config: conf || {},
        order: orderIndex
      });
      orderIndex++;
    }
    for (let i = 0; i < moduleNamesFromConfig.length; i++) {
      const name = moduleNamesFromConfig[i];
      if (!orderNames.includes(name)) {
        const conf = (parsed as Record<string, unknown>)[name] as Record<string, unknown> | undefined;
        modules.push({
          id: `${name}-${orderIndex}`,
          name,
          displayName: getDisplayName(name),
          category: getModuleCategory(name),
          enabled: false,
          config: conf || {},
          order: orderIndex
        });
        orderIndex++;
      }
    }
    let palette = { name: 'default', colors: {} as Record<string, string> };
    if (
      typeof (parsed as Record<string, unknown>).palette === 'string' &&
      typeof (parsed as Record<string, unknown>).palettes === 'object' &&
      (parsed as Record<string, any>).palettes !== null
    ) {
      const paletteName = (parsed as Record<string, string>).palette;
      const palettesObj = (parsed as Record<string, any>).palettes as Record<string, any>;
      if (palettesObj[paletteName]) {
        palette = { name: paletteName, colors: palettesObj[paletteName] as Record<string, string> };
      }
    }
    return { modules, palette, format: formatString, customCommands: {} };
  } catch {
    return {};
  }
}

function orderAsc(a: TStarshipModule, b: TStarshipModule): number {
  return a.order - b.order;
}

function isEnabled(m: TStarshipModule): boolean {
  return m.enabled === true;
}

function isDotfilesModule(m: TStarshipModule): boolean {
  return m.name === 'custom.dotfiles_version' && m.enabled === true;
}

function buildFormatFromModules(mods: TStarshipModule[]): string {
  const parts: string[] = [];
  for (let i = 0; i < mods.length; i++) {
    const module = mods[i];
    if (module.name === 'custom.dotfiles_version') {
      parts.push('[](bg:#6A1B9A fg:color_yellow)\\');
      parts.push('$custom.dotfiles_version\\');
      parts.push('[](bg:color_aqua fg:#6A1B9A)\\');
    } else if (module.name === 'line_break') {
      parts.push('$line_break');
    } else {
      parts.push(`$${module.name}\\`);
    }
  }
  return `"""\n${parts.join('\n')}\n$character"""`;
}

function extractModuleOrder(format: string): string[] {
  const set = new Set<string>();
  const list: string[] = [];
  const re = /\$[a-zA-Z_][a-zA-Z0-9_.]*/g;
  let m: RegExpExecArray | null = null;
  do {
    m = re.exec(format);
    if (m && m[0]) {
      const name = m[0].slice(1);
      if (!set.has(name)) {
        set.add(name);
        list.push(name);
      }
    }
  } while (m);
  return list;
}

function getDisplayName(moduleName: string): string {
  const displayNames: Record<string, string> = {
    os: 'Operating System',
    username: 'Username',
    directory: 'Directory',
    git_branch: 'Git Branch',
    git_status: 'Git Status',
    nodejs: 'Node.js',
    rust: 'Rust',
    golang: 'Go',
    php: 'PHP',
    docker_context: 'Docker Context',
    time: 'Time',
    character: 'Character',
    line_break: 'Line Break',
    'custom.dotfiles_version': 'Dotfiles Version'
  };
  return (
    displayNames[moduleName] ||
    moduleName.replace(/_/g, ' ').replace(/\b\w/g, function toUpper(l) {
      return l.toUpperCase();
    })
  );
}

function getModuleCategory(moduleName: string): TStarshipModule['category'] {
  if (moduleName.startsWith('custom.')) return 'custom';
  if (moduleName === 'git_branch' || moduleName === 'git_status') return 'git';
  if (moduleName === 'nodejs' || moduleName === 'rust' || moduleName === 'golang' || moduleName === 'php' || moduleName === 'python') return 'language';
  if (moduleName === 'directory' || moduleName === 'username' || moduleName === 'os') return 'system';
  if (moduleName === 'docker_context' || moduleName === 'kubernetes') return 'environment';
  return 'prompt';
}
