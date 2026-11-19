'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const get = name => fs.readFileSync(path.join(root, name), 'utf8');
const shared = get('studio-ui.css');
const market = get('market-share.html');
const marketCss = get('market-share.css');
const importer = get('market-share-import.js');
const estimator = get('sales-estimator.html');
const inline = html => html.includes('<style>') ? html.split('<style>')[1].split('</style>')[0] : '';

test('both tools load the shared stylesheet and use the scoped root', () => {
  for (const [name, source] of [['market share', market], ['estimator', estimator]]) {
    assert.match(source, /href="studio-ui\.css"/, name);
    assert.match(source, /<body class="[^"]*studio-ui/, name);
    assert.doesNotMatch(inline(source), /--ui-text-xs:11px/, name);
  }
});

test('shared CSS is the sole source for palette, section and watermark component rules', () => {
  for (const cls of ['ui-panel', 'ui-section-title', 'ui-field',
    'ui-palette-grid', 'ui-palette-card', 'ui-palette-name',
    'ui-swatches', 'ui-watermark-card', 'wm-toggle', 'wm-section']) {
    assert.ok(shared.includes('.' + cls), 'Missing shared class: ' + cls);
  }
  for (const [name, source] of [['market share', market], ['estimator', estimator]]) {
    assert.doesNotMatch(inline(source), /\.wm-card\s*\{|\.wm-toggle\s*\{|\.wm-section\s*\{/,
      'duplicate watermark rules in ' + name);
    assert.doesNotMatch(inline(source), /\.palette-card\s*\{|\.theme-grid\s*\{/,
      'duplicate palette rules in ' + name);
    assert.match(source, /ui-watermark-card/);
  }
});

test('theme cards use one class model and preserve selection handlers', () => {
  assert.match(market, /btn\.className = `ui-palette-card/);
  assert.match(market, /btn\.setAttribute\('aria-pressed'/);
  assert.match(estimator, /id="paletteChooser"/);
  assert.equal((estimator.match(/class="ui-palette-card(?: is-selected)?"/g) || []).length, 6);
  assert.equal((estimator.match(/class="ui-swatch"/g) || []).length, 18);
  assert.match(estimator, /btn\.classList\.toggle\('is-selected'/);
  assert.match(estimator, /btn\.querySelectorAll\('\.ui-swatches i'\)/);
  assert.match(shared, /white-space:nowrap/);
  assert.doesNotMatch(market, /activePaletteName/);
});

test('shared fields and section headings include dynamic CSV controls', () => {
  assert.match(importer, /class="ui-field ui-field--inline"/);
  assert.match(importer, /class="ui-section-title">CSV 数据源与历史周/);
  assert.match(market, /ui-section-title/);
  assert.match(estimator, /safe-box-title ui-section-title/);
  assert.match(estimator, /class="field ui-field/);
  const expectedSizes = {small:12, body:14, heading:16, metric:24};
  const declarations = [...shared.matchAll(/--ui-text-([a-z]+):(\d+)px;/g)]
    .map(([,name,value]) => [name, Number(value)]);
  assert.deepEqual(Object.fromEntries(declarations), expectedSizes);
  assert.doesNotMatch(shared, /--ui-text-(?:xs|sm|md|subheading|section|feature|display|title)\b/);
  for (const source of [market, estimator, importer]) {
    assert.doesNotMatch(source, /--ui-text-(?:xs|sm|md|subheading|section|feature|display|title)\b/);
  }
  assert.match(shared, /ui-safe-slider-label/);
  assert.equal((market.match(/class="ui-safe-slider-label/g) || []).length, 2);
  assert.equal((estimator.match(/class="safe-slider-label ui-safe-slider-label"/g) || []).length, 2);
});

test('console font stacks come from shared tokens, not repeated literals', () => {
  assert.match(shared, /--ui-font-body:/);
  assert.match(shared, /--ui-font-number:/);
  for (const source of [marketCss, inline(estimator)]) {
    assert.match(source, /font-family:var\(--ui-font-body\)/);
    assert.match(source, /font-family:var\(--ui-font-number\)/);
    assert.doesNotMatch(source, /font-family:"IBM Plex Mono",ui-monospace/);
  }
});

test('headers and selector buttons share explicit UI roles', () => {
  for (const c of ['ui-eyebrow','ui-eyebrow-dot','ui-page-title','ui-meta-badge','ui-choice']) {
    assert.ok(shared.includes('.'+c), 'Missing shared '+c);
  }
  for (const [name,s] of [['market',market],['estimator',estimator]]) {
    assert.match(s, /class="ui-eyebrow"/, name);
    assert.match(s, /class="ui-page-title"/, name);
    assert.match(s, /ui-meta-badge/, name);
  }
  assert.equal((market.match(/class="chart-btn ui-choice/g)||[]).length,5);
  assert.equal((estimator.match(/class="tab ui-choice(?: active)?"/g)||[]).length,3);
  assert.doesNotMatch(inline(estimator), /\.eyebrow\s*\{|h1\s*\{\s*font-size/);
});

test('market share uses local CSS without Tailwind and retains editing/export contracts', () => {
  assert.match(market, /href="market-share\.css"/);
  assert.doesNotMatch(market, /cdn\.tailwindcss\.com|<style>|grid-cols-|peer-checked:|bg-gradient-to-r/);
  assert.doesNotMatch(importer, /grid-cols-|space-y-|bg-slate-|text-xs|text-slate-/);
  for (const role of ['ms-sidebar','ms-card','ms-chart-grid','ms-editor-panel',
    'ms-editor-row','ms-preview','ms-overlay','ms-toggle-track','ms-csv-controls']) {
    assert.ok(marketCss.includes('.' + role), 'Missing local style role ' + role);
  }
  assert.equal((market.match(/<button data-type="(?:combo|diverging|stacked|slope|dumbbell)"/g) || []).length, 5);
  assert.match(market, /class="ms-editor-panel hidden"/);
  assert.match(market, /class="ms-toggle-track"/);
  assert.match(market, /function renderDataInputs\(\)/);
  assert.match(market, /function exportHighResPNG\(\)/);
  assert.match(market, /const exportSvg=svg\.cloneNode\(true\)/);
  assert.match(market, /canvas\.toBlob\(/);
});

test('data and poster logic are still present after CSS migration', () => {
  assert.match(market, /function renderDumbbellChart\(/);
  assert.match(market, /function getComputedMarketData\(/);
  assert.match(estimator, /function canvasText\(/);
  assert.match(estimator, /function syncPaletteChooser\(/);
  assert.match(estimator, /id="wmDiagonalEnabled"/);
  assert.match(market, /id="wmDiagonalEnabled"/);
});
