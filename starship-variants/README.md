# Starship Prompt Variants

This directory contains multiple Starship prompt configurations that you can easily switch between.

## Available Variants

### 🎯 DEFAULT
Your original configuration with purple/pink gradient colors, heart icon, and current layout.

### 🌈 NEON
Bright cyberpunk colors with electric blues, magentas, and yellows. Features lightning emoji and futuristic arrows.

### 🔥 FIRE
Hot flame colors with deep reds, bright oranges, and golden yellows. Features fire emoji and intense warm palette.

### ❄️ ICE
Cool ice theme with deep blues, bright cyans, and icy whites. Features snowflake emoji and crisp cold palette.

### ☢️ TOXIC
Radioactive green theme with black base and bright toxic greens. Features radioactive emoji and hazardous styling.

### 👑 ROYAL
Luxurious theme with deep purples, royal blues, and gold accents. Features crown emoji and regal colors.

### 🌆 SYNTHWAVE
Retro-futuristic 80s theme with hot pink, electric purple, and neon blue. Features city emoji and synthwave vibes.

## Usage

### Quick Commands
```bash
# List all available variants
prompt list

# Switch to a specific variant
prompt switch NEON
prompt switch OCEAN
prompt switch MINIMAL

# Preview a variant before switching
prompt preview MATRIX

# See current variant
prompt current

# Reload starship
prompt reload
```

### Via Dotfiles CLI
```bash
# All the same commands work through dotfiles
dotfiles prompt list
dotfiles prompt switch SUNSET
dotfiles prompt preview NEON
```

## Customization

Each `.toml` file in this directory is a complete Starship configuration. You can:

1. **Create new variants**: Copy an existing variant and modify colors/layout
2. **Edit existing variants**: Directly edit the `.toml` files
3. **Share variants**: Copy your variants to share with others

### Creating a New Variant

1. Copy an existing variant:
   ```bash
   cp OCEAN.toml CUSTOM.toml
   ```

2. Edit the colors and styling in `CUSTOM.toml`

3. Test it:
   ```bash
   prompt preview CUSTOM
   prompt switch CUSTOM
   ```

## Color Schemes

Each variant uses a specific color philosophy:

- **DEFAULT**: Purple-pink gradient (original)
- **NEON**: Electric cyberpunk colors (magenta, cyan, yellow, green)
- **FIRE**: Flame spectrum (dark red, orange, yellow, hot pink)
- **ICE**: Cool blues and whites (navy, blue, cyan, ice white)
- **TOXIC**: Radioactive greens (black, lime, spring green, toxic green)
- **ROYAL**: Regal colors (indigo, purple, gold, orchid)
- **SYNTHWAVE**: 80s retro (dark blue, hot pink, purple, electric blue, neon)

## Features Preserved

All variants maintain the same functional layout:
- Username segment
- Directory path with smart truncation
- Git branch and status
- Programming language detection
- Docker context when relevant
- Time display with custom emoji
- Custom success/error symbols

The variants only change the visual styling while keeping all functionality intact.
