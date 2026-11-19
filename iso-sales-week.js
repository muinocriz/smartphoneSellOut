/* ISO calendar-week and device full-sales-week utilities.
 * Single source of truth for browser module 1 and future Node-based pipelines.
 * All timestamps are UTC midnight for date-only arithmetic, not sale-event timestamps.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.IsoSalesWeek = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const DAY = 86400000;
  function utcDate(parts) {
    if (!Array.isArray(parts) || parts.length !== 3 ||
        !parts.every(Number.isInteger)) return null;
    const [y, m, d] = parts;
    if (y < 1 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(0);
    date.setUTCFullYear(y, m - 1, d);
    date.setUTCHours(0, 0, 0, 0);
    const t = date.getTime();
    return date.getUTCFullYear() === y &&
      date.getUTCMonth() + 1 === m && date.getUTCDate() === d ? t : null;
  }
  function isoMonday(parts) {
    const t = utcDate(parts);
    if (t == null) return null;
    return t - ((new Date(t).getUTCDay() + 6) % 7) * DAY;
  }
  function isoWeek1Monday(year) {
    const jan4 = utcDate([year, 1, 4]);
    return jan4 == null ? null : isoMonday([year, 1, 4]);
  }
  function isoWeekMonday(year, week) {
    if (!Number.isInteger(week) || week < 1 || week > 53) return null;
    const start = isoWeek1Monday(year);
    const next = isoWeek1Monday(year + 1);
    if (start == null || next == null) return null;
    const monday = start + (week - 1) * 7 * DAY;
    return monday < next ? monday : null;
  }
  function firstFullWeekMonday(parts) {
    const t = utcDate(parts), monday = isoMonday(parts);
    return t == null ? null : (t === monday ? monday : monday + 7 * DAY);
  }
  function lifecycleWeekIndex(isoWeekMondayTimestamp, w1Monday) {
    if (isoWeekMondayTimestamp == null || w1Monday == null) return null;
    const gap = isoWeekMondayTimestamp - w1Monday;
    if (gap < 0 || gap % (7 * DAY) !== 0) return null;
    return gap / (7 * DAY) + 1;
  }
  function partialWeek(parts) {
    const t = utcDate(parts), monday = isoMonday(parts);
    if (t == null || t === monday) return null;
    return { isoMonday: monday, days: 7 - (t - monday) / DAY };
  }
  return Object.freeze({
    DAY, utcDate, isoMonday, isoWeek1Monday, isoWeekMonday,
    firstFullWeekMonday, lifecycleWeekIndex, partialWeek
  });
});
