// Appearance choice, saved per device. "auto" follows the phone's light/dark setting.
// index.html applies the saved choice before first paint; keep the storage key in sync with it.
export type Theme = 'auto' | 'light' | 'dark';
export const THEME_KEY = 'tt-theme';
const COLORS = { light: '#fffbfc', dark: '#22161f' };

export function savedTheme(): Theme {
  try { const v = localStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
  // Keep the iPhone status bar color matching the chosen look.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(m => {
    const own = m.media.includes('dark') ? COLORS.dark : COLORS.light;
    m.content = theme === 'auto' ? own : COLORS[theme];
  });
}

export function setTheme(theme: Theme) {
  try { if (theme === 'auto') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, theme); } catch { /* private mode: applies for this visit only */ }
  applyTheme(theme);
}
