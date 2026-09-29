// Synchronous, local-only appearance mirror. Never stores sensitive data.
(() => {
  try {
    const p = JSON.parse(localStorage.getItem('fatorati.display.v2') || '{}');
    const root = document.documentElement;
    root.dataset.theme = p.theme === 'dark' || (p.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    root.dataset.accent = /^#[0-9a-f]{6}$/i.test(p.accent || '') && p.accent.toLowerCase() !== '#2563eb' ? 'custom' : 'original';
    if (/^#[0-9a-f]{6}$/i.test(p.accent || '')) root.style.setProperty('--accent', p.accent);
    if (['en','ar','fr','es','pt'].includes(p.language)) { root.lang = p.language; root.dir = p.language === 'ar' ? 'rtl' : 'ltr'; }
    root.dataset.spacing = p.spacing === 'compact' ? 'compact' : 'comfortable';
  } catch { /* Safe defaults; native splash stays visible until Preferences loads. */ }
})();
