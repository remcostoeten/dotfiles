// Theme Toggle Functionality

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update icon
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    }

    // Animate transition
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    setTimeout(() => {
        document.body.style.transition = '';
    }, 300);
}

// Load saved theme on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', theme);

    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
});

// Optional: Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const savedTheme = localStorage.getItem('theme');
    if (!savedTheme) {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);

        const icon = document.getElementById('theme-icon');
        if (icon) {
            icon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
        }
    }
});

// Advanced theme handling: system/light/dark/auto/gruvbox + cycling
(function() {
    const STORAGE_KEY = 'theme';
    const MODE_KEY = 'theme_mode'; // system | explicit

    function detectAvailableThemes() {
        const names = new Set(['light','dark','gruvbox']);
        // scan stylesheets for [data-theme="..."] selectors
        for (const sheet of Array.from(document.styleSheets)) {
            let rules;
            try { rules = sheet.cssRules; } catch { continue; }
            if (!rules) continue;
            for (const r of Array.from(rules)) {
                if (r.selectorText && r.selectorText.includes('[data-theme="')) {
                    const m = r.selectorText.match(/\[data-theme=\"([^\"]+)\"\]/);
                    if (m && m[1]) names.add(m[1]);
                }
            }
        }
        return Array.from(names);
    }

    const availableThemes = detectAvailableThemes();

    function applyTheme(theme, mode='explicit') {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
        localStorage.setItem(MODE_KEY, mode);
        const icon = document.getElementById('theme-icon');
        if (icon) icon.textContent = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🎨';
        const currentThemeLabel = document.getElementById('current-theme');
        if (currentThemeLabel) currentThemeLabel.textContent = theme.charAt(0).toUpperCase()+theme.slice(1);
    }

    function applySystem() {
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(dark ? 'dark' : 'light', 'system');
    }

    function applyAutoByTime() {
        const h = new Date().getHours();
        const isDark = (h >= 19 || h < 7);
        applyTheme(isDark ? 'dark' : 'light', 'auto');
    }

    // Public helpers
    window.ThemeControl = {
        setLight: () => applyTheme('light'),
        setDark: () => applyTheme('dark'),
        setGruvbox: () => applyTheme('gruvbox'),
        setSystem: applySystem,
        setAuto: applyAutoByTime,
        cycle: () => {
            const cur = document.documentElement.getAttribute('data-theme') || 'dark';
            const idx = availableThemes.indexOf(cur);
            const next = availableThemes[(idx + 1) % availableThemes.length];
            applyTheme(next);
        },
        availableThemes
    };
})();