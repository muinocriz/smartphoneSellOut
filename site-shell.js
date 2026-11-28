(() => {
  const root = document.documentElement;
  const script = document.currentScript;
  const base = new URL('.', script.src);
  const pages = [
    ['sales-increment', '销量增量追踪', 'sales-increment.html'],
    ['sales-data-editor', '销量数据处理', 'sales-data-editor.html'],
    ['sales-estimator', '热销机型与榜单研究', 'sales-estimator.html']
  ];
  const current = script.dataset.page;

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
  let themeToggle;
  function applyTheme() {
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    const changed = root.dataset.theme !== theme;
    root.dataset.theme = theme;
    if (themeToggle) {
      const dark = theme === 'dark';
      themeToggle.title = dark ? '切换到浅色模式' : '切换到深色模式';
      themeToggle.setAttribute('aria-label', (dark ? '当前为深色模式，' : '当前为浅色模式，') + themeToggle.title);
    }
    if (changed) window.dispatchEvent(new Event('site-theme-change'));
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let themeTransition;
  let themeTransitionTimer;
  function toggleTheme() {
    if (themeTransition) return;
    const update = () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(themeKey, preference); } catch (_) {}
      applyTheme();
    };

    if (reducedMotion.matches) {
      update();
    } else if (document.startViewTransition) {
      themeTransition = document.startViewTransition(update);
      const finish = () => { themeTransition = null; };
      themeTransition.finished.then(finish, finish);
    } else {
      root.classList.add('site-theme-transition');
      update();
      clearTimeout(themeTransitionTimer);
      themeTransitionTimer = setTimeout(() => root.classList.remove('site-theme-transition'), 200);
    }
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

  const projectAPIOrigin = ''; // GitHub Pages build injects the public Worker origin.
  const projectUsesDatabase = root.dataset.salesSource === 'd1' || Boolean(projectAPIOrigin);
  const projectSupportsAdmin = root.dataset.salesSource === 'd1' && !projectAPIOrigin;
  function createDeploymentLink() {
    const githubPages = new URL('https://muinocriz.github.io/smartphoneSellOut/');
    const cloudflare = new URL(projectAPIOrigin || 'https://smartphonesellout.zirconium.workers.dev/');
    const onGitHub = location.origin === githubPages.origin && location.pathname.startsWith(githubPages.pathname);
    const onCloudflare = projectSupportsAdmin || location.origin === cloudflare.origin;
    const path = pages.find(([id]) => id === current)?.[2];
    if (!path || (!onGitHub && !onCloudflare)) return null;

    const link = document.createElement('a');
    link.className = 'site-deployment-link';
    link.href = new URL(path, onGitHub ? cloudflare : githubPages);
    const platform = onGitHub ? 'GitHub Pages' : 'Cloudflare';
    const target = onGitHub ? 'Cloudflare' : 'GitHub Pages';
    link.title = '切换到 ' + target;
    if (root.dataset.salesAdmin === 'true') link.title += ' 的公开页面';
    link.setAttribute('aria-label', '当前为 ' + platform + '，' + link.title);
    link.textContent = platform;
    link.insertAdjacentHTML('beforeend', '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h17m-4-4 4 4-4 4M21 16H4m4-4-4 4 4 4"/></svg>');
    return link;
  }

  const projectTables = new Map([
    ['sales-long.csv', ['/api/tracking', SalesLongData.COLUMNS]],
    ['model-master.csv', ['/api/models', 'model_id model_name brand brand_group aliases series generation variant form_factor sale_start_date predecessor_id launch_price chip_vendor chip_model base_ram base_rom source_url notes verification tracking_group'.split(' ')]],
    ['sales-estimates.csv', ['/api/rankings', 'dataset_id source series period_type period period_start period_end top_n actual_count rank model brand_group pixels estimated_units estimated_wan fit_k fit_mode calibration_count accepted_count outlier_threshold algorithm_version saved_at'.split(' ')]],
    ['market-share.csv', ['/api/market-share', 'period trend apple huawei osta xiaomi oppo oneplus realme vivo iqoo honor'.split(' '), 'ISO 周,趋势,苹果,华为,OSTA,小米,OPPO,一加,realme,vivo,iQOO,荣耀']]
  ]);

  async function readProject(name, decode = response => response.text()) {
    const table = projectUsesDatabase && projectTables.get(name);
    const response = await fetch(table ? new URL(table[0], projectAPIOrigin || location.origin) : new URL(name, document.baseURI), {cache:'no-store'});
    if (!response.ok) throw Error('HTTP ' + response.status);
    if (!table) return decode(response);

    // Keep existing parsers and their validation rules at the boundary.
    const {data} = await response.json();
    if (!Array.isArray(data)) throw Error('数据库返回的数据格式无效');
    const [, keys, headings] = table;
    const rows = data.map(row => keys.map(key => {
      const value = row[key];
      return headings && key === 'period' ? String(value ?? '').replace('-W', 'W') : value;
    }));
    return CsvUtils.stringifyCSV([headings ? headings.split(',') : keys, ...rows]);
  }

  window.SalesSite = {sessionRead, sessionWrite, readProject, projectUsesDatabase, projectSupportsAdmin};
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
    themeToggle = document.createElement('button');
    themeToggle.type = 'button';
    themeToggle.className = 'site-theme-toggle';
    themeToggle.innerHTML = '<svg class="site-theme-sun" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>' +
      '<svg class="site-theme-moon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
    themeToggle.addEventListener('click', toggleTheme);
    applyTheme();
    const actions = document.createElement('div');
    actions.className = 'site-header-actions';
    const deployment = createDeploymentLink();
    if (deployment) actions.append(deployment);
    const github = document.createElement('a');
    github.className = 'site-github-link';
    github.href = 'https://github.com/muinocriz/smartphoneSellOut';
    github.target = '_blank';
    github.rel = 'noopener noreferrer';
    github.setAttribute('aria-label', 'GitHub 项目仓库（在新标签页打开）');
    github.title = '打开 GitHub 项目仓库';
    github.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.6 9.6 0 0 1 12 6.82c.85 0 1.71.11 2.51.34 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>';
    const commit = root.dataset.siteCommit;
    if (/^[0-9a-f]{40}$/.test(commit)) {
      const version = document.createElement('a');
      const shortCommit = commit.slice(0, 7);
      version.className = 'site-build-version';
      version.href = github.href + '/commit/' + commit;
      version.target = github.target;
      version.rel = github.rel;
      version.title = '当前部署提交 ' + commit;
      version.setAttribute('aria-label', '查看当前部署提交 ' + shortCommit);
      version.innerHTML = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M3 12h6m6 0h6"/></svg>';
      version.append(shortCommit);
      const divider = document.createElement('span');
      divider.className = 'site-header-divider';
      divider.setAttribute('aria-hidden', 'true');
      actions.append(version, divider);
    }
    actions.append(github, themeToggle);
    host.append(nav, menu, actions);
    window.addEventListener('pageshow', () => { menu.open = false; });
  });
})();
