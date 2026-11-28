/* Shared CSV syntax for browser scripts, Cloudflare Workers, and Node. */
(function (root) {
  'use strict';

  function decodeCSV(bytes) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder('gbk').decode(bytes);
    }
  }

  function parseCSV(raw, { mode = 'strict' } = {}) {
    const strict = mode === 'strict';
    const market = mode === 'market-share';
    const editor = mode === 'editor';
    const text = String(raw).replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], cell = '', quoted = false, closed = false;

    function finishField() {
      row.push(market ? cell.trim() : cell);
      cell = '';
      closed = false;
    }

    function finishRow() {
      finishField();
      if (row.some(value => (editor ? value.trim() : value) !== '')) rows.push(row);
      row = [];
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char !== '"') {
          cell += char;
        } else if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else if (char === ',') {
        finishField();
      } else if (char === '\r' || char === '\n') {
        finishRow();
        if (char === '\r' && text[i + 1] === '\n') i++;
      } else if (char === '"') {
        if (market && cell.trim() !== '') throw new Error('CSV 引号格式错误');
        if (strict && (cell !== '' || closed)) throw new Error('CSV 引号格式不正确。');
        if (market || cell === '') quoted = true;
        else cell += char;
      } else {
        if (strict && closed) throw new Error('CSV 引号格式不正确。');
        cell += char;
      }
    }

    if (quoted) throw new Error(market ? 'CSV 引号未闭合' : 'CSV 引号未闭合。');
    finishRow();
    return rows;
  }

  function quoteCell(value, quote) {
    const text = String(value ?? '');
    return quote === 'all' || /[",\r\n]/.test(text)
      ? '"' + text.replaceAll('"', '""') + '"'
      : text;
  }

  function stringifyCSV(rows, {
    bom = false,
    eol = '\r\n',
    trailingNewline = false,
    quote = 'all',
    headerQuote = quote
  } = {}) {
    const body = rows.map((row, i) => {
      const style = i === 0 ? headerQuote : quote;
      return row.map(value => quoteCell(value, style)).join(',');
    }).join(eol);
    return (bom ? '\uFEFF' : '') + body + (trailingNewline ? eol : '');
  }

  const api = Object.freeze({ decodeCSV, parseCSV, stringifyCSV });
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CsvUtils = api;
})(globalThis);
