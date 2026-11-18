/* Public device preference only. Loaded before styles to avoid a theme flash. */
(() => {
  const key = 'mygarage_theme';
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  const valid = value => ['light', 'dark', 'system'].includes(value);
  let preference = 'system';
  try { const stored = localStorage.getItem(key); if (valid(stored)) preference = stored; } catch (_) {}
  function apply(value = preference, persist = false) {
    preference = valid(value) ? value : 'system';
    const theme = preference === 'system' ? (system?.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    if (document.body) document.body.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111827' : '#f5f7fa');
    document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preference)));
    document.querySelectorAll('[data-theme-select]').forEach(select => { select.value = preference; });
    if (persist) { try { localStorage.setItem(key, preference); } catch (_) {} }
    return theme;
  }
  window.RodadoAppearance = { apply, preference: () => preference };
  apply();
  document.addEventListener('DOMContentLoaded', () => apply());
  system?.addEventListener?.('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) apply(valid(event.newValue) ? event.newValue : 'system'); });
})();
