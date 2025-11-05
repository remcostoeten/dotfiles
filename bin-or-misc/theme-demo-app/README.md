# Theme Demo App

A complete demonstration application showcasing the **Dotfiles Theme** system.

## 🚀 Quick Start

### Option 1: Open Directly
Simply open `index.html` in your web browser:

```bash
# From the theme-demo-app directory
open index.html
# or
firefox index.html
# or
google-chrome index.html
```

### Option 2: Use a Local Server (Recommended)
For best results, serve via a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (http-server)
npx http-server

# Using PHP
php -S localhost:8000
```

Then visit: `http://localhost:8000`

---

## 📁 Project Structure

```
theme-demo-app/
├── index.html              # Dashboard page
├── pages/
│   ├── components.html     # Component showcase
│   ├── forms.html          # Form examples
│   └── settings.html       # Settings page
├── styles/
│   ├── app.css             # Application styles
│   └── theme.js            # Theme toggle functionality
└── README.md               # This file
```

---

## 🎨 Features Demonstrated

### Dashboard (`index.html`)
- **Stats Cards** - Key metrics with icons and trends
- **Activity Feed** - Real-time activity list with avatars
- **Quick Actions** - Grid of action buttons
- **System Status** - Service health indicators
- **Data Table** - Project listing with progress bars
- **Navigation** - Responsive topbar navigation

### Components (`pages/components.html`)
- Buttons (default, accent, disabled, sizes)
- Cards (basic, accent, colored)
- Badges & Status Indicators
- Filter Chips
- Sidebar Navigation Items
- Avatars & Avatar Groups
- Progress Bars
- Icons & Emoji

### Forms (`pages/forms.html`)
- Sign In Form
- Registration Form
- Contact Form
- Search & Filters
- Input Fields
- Textareas
- Checkboxes
- Select Dropdowns

### Settings (`pages/settings.html`)
- Profile Management
- Theme Switcher (Visual)
- Toggle Switches
- Notification Preferences
- Danger Zone Actions

---

## 🎯 Theme Features

### Dark Theme (Default)
- Background: `#0a0a0a`
- Accent: `#4ec9b0` (green)
- Perfect for coding and low-light environments

### Light Theme
- Background: `#ffffff`
- Accent: `#2d9d8c` (teal)
- High contrast for bright environments

### Theme Toggle
Click the moon/sun icon in the navigation to switch themes. Your preference is saved in localStorage.

---

## 🔧 Customization

### Changing Colors
Edit the CSS variables in the imported theme file or override them:

```css
:root {
  --color-accent: #your-color;
  --color-background: #your-bg;
}
```

### Adding New Components
1. Create your HTML structure
2. Use existing classes: `.btn`, `.card`, `.input`, etc.
3. Or use CSS variables: `var(--color-accent)`

### Creating New Pages
Copy any existing page and modify:

```bash
cp pages/components.html pages/your-page.html
```

Don't forget to:
1. Update the title
2. Add navigation link
3. Update active nav state

---

## 💡 Code Examples

### Button
```html
<button class="btn btn-accent">Click Me</button>
```

### Card
```html
<div class="card">
  <h3>Card Title</h3>
  <p>Card content</p>
</div>
```

### Input
```html
<input type="text" class="input w-full" placeholder="Enter text" />
```

### Using CSS Variables
```css
.custom-element {
  background: var(--color-background);
  color: var(--color-foreground);
  border: 1px solid var(--color-border-primary);
}
```

---

## 📱 Responsive Design

The app is responsive and works on:
- ✅ Desktop (1400px+)
- ✅ Laptop (1024px - 1399px)
- ✅ Tablet (768px - 1023px)
- ✅ Mobile (< 768px)

Navigation automatically adapts on smaller screens.

---

## 🎨 Color Palette Reference

### Dark Theme
- Primary BG: `#0a0a0a`
- Secondary BG: `#0d0d0d`
- Accent: `#4ec9b0`
- Accent BG: `#1e3a2e`
- Text: `#d4d4d4`
- Borders: `#2a2a2a`

### Light Theme
- Primary BG: `#ffffff`
- Secondary BG: `#f8f9fa`
- Accent: `#2d9d8c`
- Accent BG: `#e6f7f4`
- Text: `#1a1a1a`
- Borders: `#dee2e6`

---

## 🚀 Integration

To use this theme in your own project:

1. **Copy the theme CSS:**
   ```bash
   cp ../tailwind-theme.css your-project/
   ```

2. **Import in your HTML:**
   ```html
   <link rel="stylesheet" href="tailwind-theme.css">
   ```

3. **Set theme attribute:**
   ```html
   <html data-theme="dark">
   ```

4. **Use the components:**
   ```html
   <button class="btn btn-accent">Action</button>
   ```

---

## 📚 Documentation

Full documentation available in the parent directory:

- `THEME_README.md` - Complete API reference
- `THEME_INSTALLATION.md` - Installation guides
- `THEME_QUICK_REFERENCE.md` - Quick lookup
- `theme-types.ts` - TypeScript definitions
- `theme-react-hooks.tsx` - React integration
- `theme-nextjs-integration.tsx` - Next.js integration

---

## ✨ Highlights

- 🎨 Beautiful dark/light themes
- 🚀 Zero dependencies
- ⚡ Fast and lightweight
- 📱 Fully responsive
- ♿ Accessible components
- 🔧 Easy to customize
- 💼 Production-ready

---

## 🐛 Troubleshooting

**Theme not switching?**
- Check browser console for errors
- Ensure `theme.js` is loaded
- Clear localStorage: `localStorage.clear()`

**Styles not applying?**
- Verify CSS file path is correct
- Check that `data-theme` attribute is set
- Inspect element to see if CSS variables are loaded

**Layout issues?**
- Check browser compatibility (modern browsers only)
- Verify viewport meta tag is present
- Test with browser dev tools responsive mode

---

## 📄 License

Part of the dotfiles project. Free to use and modify.

---

**Built with ❤️ using the Dotfiles Theme**