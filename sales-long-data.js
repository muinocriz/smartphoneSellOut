/* Schema and validation shared by the sales-long.csv readers and editors. */
(function (root) {
  'use strict';

  const META_COLUMNS = Object.freeze(['brand', 'model', 'category', 'date']);
  const COLUMNS = Object.freeze([...META_COLUMNS, 'period', 'metric', 'value_wan', 'operator']);
  const METRICS = Object.freeze(['cumulative', 'weekly']);
  const OPERATORS = Object.freeze(['=', '>=', '<', '≈']);

  function hasModelIdentity(brand, model) {
    return brand.trim() !== '' && model.trim() !== '';
  }

  function isRecordType(metric, operator) {
    return METRICS.includes(metric) && OPERATORS.includes(operator);
  }

  function isDecimal(value) {
    return /^\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value));
  }

  function numberText(raw) {
    let text = String(raw).trim().replace(/，/g, ',');
    if (!text) return null;
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, '');
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(Number(text))) {
      throw new Error('请输入非负数字（单位：万台）。');
    }
    if (text.startsWith('.')) text = '0' + text;
    if (text.endsWith('.')) text = text.slice(0, -1);
    return text;
  }

  function modelKey(brand, model) {
    return JSON.stringify([brand, model]);
  }

  function recordKey(brand, model, period, metric) {
    return JSON.stringify([brand, model, period, metric]);
  }

  function sameModelMetadata(left, right) {
    return left === right || Boolean(left && right && left[0] === right[0] && left[1] === right[1]);
  }

  function addUniqueRecord(index, key, value) {
    if (index.has(key)) return false;
    index.set(key, value);
    return true;
  }

  const api = Object.freeze({
    COLUMNS, META_COLUMNS, METRICS, hasModelIdentity, isRecordType, isDecimal, numberText,
    modelKey, recordKey, sameModelMetadata, addUniqueRecord
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SalesLongData = api;
})(globalThis);
