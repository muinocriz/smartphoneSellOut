(() => {
  const root = document.documentElement;
  const script = document.currentScript;
  const base = new URL('.', script.src);
  const pages = [
    ['sales', '销量追踪', ''],
    ['market-share', '市场份额', 'market-share.html'],
    ['sales-estimator', '热销机型与榜单研究', 'sales-estimator.html'],
    ['sales-data-editor', '销量数据处理', 'sales-data-editor.html'],
    ['sales-increment', '销量增量追踪', 'sales-increment.html']
  ];
  const current = script.dataset.page;
  const legacy = current === 'sales' && pages.find(([id,, path]) => path && location.hash === '#' + id);
  if (legacy) {
    const destination = new URL(legacy[2], base);
    destination.search = location.search;
    location.replace(destination);
  }

  const themeKey = 'phoneSales.theme';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['system', 'light', 'dark'].includes(value);
  function readTheme() {
    try {
      const current = localStorage.getItem(themeKey);
      if (valid(current)) return current;
      const old = localStorage.getItem('increments.theme');
      if (old === 'light' || old === 'dark') return old;
    } catch (_) {}
    return 'system';
  }

  let preference = readTheme();
  let themeControl;
  function applyTheme() {
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    const changed = root.dataset.theme !== theme;
    root.dataset.theme = theme;
    if (themeControl) themeControl.value = preference;
    if (changed) window.dispatchEvent(new Event('site-theme-change'));
  }

  function sessionRead(key) {
    try { return JSON.parse(sessionStorage.getItem(key)); }
    catch (_) { return null; }
  }

  function sessionWrite(key, value) {
    try {
      if (value == null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      if (value != null) {
        try { sessionStorage.removeItem(key); } catch (_) {}
      }
      return false;
    }
  }

  window.SalesSite = {sessionRead, sessionWrite, redirecting: Boolean(legacy)};
  applyTheme();
  system.addEventListener('change', applyTheme);
  window.addEventListener('storage', event => {
    if (event.key === themeKey || event.key == null) {
      preference = readTheme();
      applyTheme();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const host = document.querySelector('.site-header');
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', '模块导航');
    const menu = document.createElement('details');
    menu.className = 'site-module-menu';
    const summary = document.createElement('summary');
    summary.textContent = pages.find(([id]) => id === current)?.[1] || '模块';
    menu.append(summary);
    const mobileLinks = nav.cloneNode();
    for (const [id, title, path] of pages) {
      const link = document.createElement('a');
      link.href = new URL(path || './', base);
      link.textContent = title;
      if (id === current) link.setAttribute('aria-current', 'page');
      nav.append(link);
      mobileLinks.append(link.cloneNode(true));
    }
    menu.append(mobileLinks);
    const label = document.createElement('label');
    label.textContent = '外观 ';
    themeControl = document.createElement('select');
    for (const [value, title] of [['system','跟随系统'], ['light','浅色'], ['dark','深色']]) {
      themeControl.add(new Option(title, value));
    }
    themeControl.value = preference;
    themeControl.addEventListener('change', () => {
      preference = themeControl.value;
      try { localStorage.setItem(themeKey, preference); } catch (_) {}
      applyTheme();
    });
    label.append(themeControl);
    host.append(nav, menu, label);
    window.addEventListener('pageshow', () => { menu.open = false; });
  });
})();
