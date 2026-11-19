'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const get = name => fs.readFileSync(path.join(root, name), 'utf8');
const shared = get('studio-ui.css');
const market = get('market-share.html');
const importer = get('market-share-import.js');
const estimator = get('sales-estimator.html');
const inline = html => html.split('<style>')[1].split('</style>')[0];

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
  assert.match(importer, /class="ui-field ui-field--inline grow/);
  assert.match(importer, /class="ui-section-title">CSV 数据源与历史周/);
  assert.match(market, /ui-section-title/);
  assert.match(estimator, /safe-box-title ui-section-title/);
  assert.match(estimator, /class="field ui-field/);
  assert.match(shared, /--ui-text-md:14px/);
  assert.match(shared, /--ui-text-subheading:16px/);
  assert.match(shared, /ui-safe-slider-label/);
  assert.equal((market.match(/class="ui-safe-slider-label/g) || []).length, 2);
  assert.equal((estimator.match(/class="safe-slider-label ui-safe-slider-label"/g) || []).length, 2);
});

test('data and poster logic are still present after CSS migration', () => {
  assert.match(market, /function renderDumbbellChart\(/);
  assert.match(market, /function getComputedMarketData\(/);
  assert.match(estimator, /function canvasText\(/);
  assert.match(estimator, /function syncPaletteChooser\(/);
  assert.match(estimator, /id="wmDiagonalEnabled"/);
  assert.match(market, /id="wmDiagonalEnabled"/);
});
