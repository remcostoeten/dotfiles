type TProps = {
  onThemeChange?: (theme: 'light' | 'dark') => void;
};

export function ThemeToggle({ onThemeChange }: TProps) {
  function getStored(): 'light' | 'dark' {
    const v = localStorage.getItem('theme') || 'dark';
    return v === 'light' ? 'light' : 'dark';
  }
  function setTheme(next: 'light' | 'dark'): void {
    localStorage.setItem('theme', next);
    const root = document.documentElement;
    if (next === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    if (onThemeChange) onThemeChange(next);
  }
  function handleClick(): void {
    const cur = getStored();
    setTheme(cur === 'dark' ? 'light' : 'dark');
  }
  function init(): void {
    const cur = getStored();
    setTheme(cur);
  }
  init();
  return (
    <button onClick={handleClick} className="px-3 py-1 text-sm rounded-lg border dark:border-haptic.border border-gray-300 dark:bg-haptic.muted bg-white dark:text-haptic.text text-gray-700">
      Theme
    </button>
  );
}
