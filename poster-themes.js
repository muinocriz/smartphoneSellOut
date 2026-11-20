/* Shared poster themes for market-share.html (SVG) and sales-estimator.html (Canvas).
 * Canonical theme values originate from module 2; independent brand identification
 * colors remain in the chart data and do not become theme accents.
 * Update palette values HERE, not in individual HTML files.
 */
(function (root) {
  'use strict';

  const RAW_PALETTES = {
        lilac_cloud: {
          id: 'lilac_cloud',
          name: '柔雾丁香',
          isDark: false,
          swatches: ['#f5f2fb', '#7155a4', '#b86b81'],
          bgTop: '#f5f2fb',
          bgBottom: '#eae5f4',
          cardBg: '#fefcff',
          cardBorder: '#ddd5ea',
          textPrimary: '#2e2540',
          textSecondary: '#625576',
          textMuted: '#80728f',
          upColor: '#7155a4',
          upBg: 'rgba(113, 85, 164, 0.12)',
          upRowHighlight: 'rgba(113, 85, 164, 0.11)',
          downColor: '#b05267',
          downBg: 'rgba(176, 82, 103, 0.12)',
          downRowHighlight: 'rgba(176, 82, 103, 0.11)',
          flatColor: '#82758f',
          flatBg: 'rgba(130, 117, 143, 0.12)',
          gridLine: '#e8e1f2',
          axisLine: '#8c7d9f',
          badgeBg: 'rgba(113, 85, 164, 0.09)',
          badgeBorder: 'rgba(113, 85, 164, 0.25)',
          badgeText: '#61428f'
        },
        editorial_paper: {
          id: 'editorial_paper',
          name: '编辑部米白',
          isDark: false,
          swatches: ['#f8f5ef', '#c83e37', '#2b5b84'],
          bgTop: '#f8f5ef',
          bgBottom: '#efeae0',
          cardBg: '#ffffff',
          cardBorder: '#e2dcd0',
          textPrimary: '#1c1917',
          textSecondary: '#57534e',
          textMuted: '#78716c',
          upColor: '#c83e37',
          upBg: 'rgba(200, 62, 55, 0.12)',
          upRowHighlight: 'rgba(200, 62, 55, 0.10)',
          downColor: '#2b5b84',
          downBg: 'rgba(43, 91, 132, 0.12)',
          downRowHighlight: 'rgba(43, 91, 132, 0.10)',
          flatColor: '#78716c',
          flatBg: 'rgba(120, 113, 108, 0.12)',
          gridLine: '#e7e2d8',
          axisLine: '#78716c',
          badgeBg: 'rgba(200, 62, 55, 0.08)',
          badgeBorder: 'rgba(200, 62, 55, 0.25)',
          badgeText: '#991b1b'
        },
        pure_white: {
          id: 'pure_white',
          name: '极简纯白',
          isDark: false,
          swatches: ['#ffffff', '#f43f5e', '#10b981'],
          bgTop: '#ffffff',
          bgBottom: '#f8fafc',
          cardBg: '#ffffff',
          cardBorder: '#e2e8f0',
          textPrimary: '#0f172a',
          textSecondary: '#475569',
          textMuted: '#94a3b8',
          upColor: '#f43f5e',
          upBg: 'rgba(244, 63, 94, 0.12)',
          upRowHighlight: 'rgba(244, 63, 94, 0.10)',
          downColor: '#10b981',
          downBg: 'rgba(16, 185, 129, 0.12)',
          downRowHighlight: 'rgba(16, 185, 129, 0.10)',
          flatColor: '#64748b',
          flatBg: 'rgba(100, 116, 139, 0.12)',
          gridLine: '#f1f5f9',
          axisLine: '#94a3b8',
          badgeBg: 'rgba(244, 63, 94, 0.09)',
          badgeBorder: 'rgba(244, 63, 94, 0.28)',
          badgeText: '#9f1239'
        },
        mist_minimal: {
          id: 'mist_minimal',
          name: '雾蓝极简',
          isDark: false,
          swatches: ['#f1f6f9', '#366b9a', '#be6e5c'],
          bgTop: '#f1f6f9',
          bgBottom: '#e6edf4',
          cardBg: '#ffffff',
          cardBorder: '#d6e1ea',
          textPrimary: '#203047',
          textSecondary: '#52657a',
          textMuted: '#708399',
          upColor: '#366b9a',
          upBg: 'rgba(54, 107, 154, 0.11)',
          upRowHighlight: 'rgba(54, 107, 154, 0.10)',
          downColor: '#be6e5c',
          downBg: 'rgba(190, 110, 92, 0.11)',
          downRowHighlight: 'rgba(190, 110, 92, 0.10)',
          flatColor: '#71859a',
          flatBg: 'rgba(113, 133, 154, 0.12)',
          gridLine: '#dce6ef',
          axisLine: '#8295aa',
          badgeBg: 'rgba(54, 107, 154, 0.08)',
          badgeBorder: 'rgba(54, 107, 154, 0.24)',
          badgeText: '#274e77'
        },
        coral_sunset: {
          id: 'coral_sunset',
          name: '日落珊瑚',
          isDark: false,
          swatches: ['#fff2e8', '#c35644', '#277b79'],
          bgTop: '#fff2e8',
          bgBottom: '#fae7db',
          cardBg: '#fffbf7',
          cardBorder: '#eccbbf',
          textPrimary: '#402c2b',
          textSecondary: '#76534e',
          textMuted: '#916e65',
          upColor: '#c35644',
          upBg: 'rgba(195, 86, 68, 0.12)',
          upRowHighlight: 'rgba(195, 86, 68, 0.10)',
          downColor: '#277b79',
          downBg: 'rgba(39, 123, 121, 0.12)',
          downRowHighlight: 'rgba(39, 123, 121, 0.10)',
          flatColor: '#947a75',
          flatBg: 'rgba(148, 122, 117, 0.12)',
          gridLine: '#f0d8cb',
          axisLine: '#ab8679',
          badgeBg: 'rgba(195, 86, 68, 0.09)',
          badgeBorder: 'rgba(195, 86, 68, 0.25)',
          badgeText: '#9e3c32'
        },
        morandi_sage: {
          id: 'morandi_sage',
          name: '莫兰迪绿野',
          isDark: false,
          swatches: ['#eef3ef', '#d97706', '#2d6a4f'],
          bgTop: '#eef3ef',
          bgBottom: '#e2eae4',
          cardBg: '#f9fbf9',
          cardBorder: '#cbd8ce',
          textPrimary: '#1b2e23',
          textSecondary: '#4a6354',
          textMuted: '#748c7d',
          upColor: '#d97706',
          upBg: 'rgba(217, 119, 6, 0.13)',
          upRowHighlight: 'rgba(217, 119, 6, 0.11)',
          downColor: '#2d6a4f',
          downBg: 'rgba(45, 106, 79, 0.13)',
          downRowHighlight: 'rgba(45, 106, 79, 0.11)',
          flatColor: '#748c7d',
          flatBg: 'rgba(116, 140, 125, 0.12)',
          gridLine: '#dce6de',
          axisLine: '#748c7d',
          badgeBg: 'rgba(217, 119, 6, 0.10)',
          badgeBorder: 'rgba(217, 119, 6, 0.28)',
          badgeText: '#92400e'
        }
      };

  const aliases = Object.freeze({
    lilac:'lilac_cloud',
    editorial:'editorial_paper',
    pure:'pure_white',
    mist:'mist_minimal',
    coral:'coral_sunset',
    olive:'morandi_sage'
  });
  // Common visual geometry, relative to each poster's design width.
  const layout = Object.freeze({
    outerInsetRatio:0.0213,
    mainRadiusRatio:0.029,
    innerRadiusRatio:0.020,
    dotStepRatio:0.027,
    dotOpacity:0.038
  });
  const palettes = Object.freeze(Object.fromEntries(
    Object.entries(RAW_PALETTES).map(([id, base]) => [
      id, Object.freeze({
        ...base,
        // All reports share a white foreground surface; themes color the exterior.
        cardBg:'#ffffff',
        swatches:Object.freeze([base.bgTop,base.upColor,base.downColor])
      })
    ])
  ));
  const estimatorPalettes = Object.freeze(Object.fromEntries(
    Object.entries(aliases).map(([alias,id]) => {
      const p=palettes[id];
      return [alias,Object.freeze({
        id:p.id, name:p.name,
        bg:p.bgTop, bgTop:p.bgTop, bgBottom:p.bgBottom,
        panel:p.cardBg, panel2:p.upRowHighlight,
        ink:p.textPrimary, sub:p.textSecondary, muted:p.textMuted,
        hair:p.cardBorder, gridLine:p.gridLine,
        // In a ranking, primary=leader and secondary=ordinary bar.
        // In market share, up/down retain their trend semantics.
        bar:p.downColor, bar2:p.upColor, accent:p.upColor,
        primary:p.upColor, secondary:p.downColor,
        warn:p.downColor, track:p.gridLine,
        swatches:p.swatches
      })];
    })
  ));
  root.PosterThemes = Object.freeze({
    palettes, estimatorPalettes, aliases, layout,
    market(id) { return palettes[id] || palettes.lilac_cloud; },
    estimator(id) { return estimatorPalettes[id] || estimatorPalettes.editorial; },
    swatches(id) {
      const key=aliases[id]||id;
      return (palettes[key]||palettes.editorial_paper).swatches;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
