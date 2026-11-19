// node --test tests/iso-sales-week.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const iso = require("../iso-sales-week.js");

test("Monday opening: opening week is W1, no P0", () => {
  const d = [2026, 9, 14];
  assert.equal(iso.partialWeek(d), null);
  assert.equal(iso.firstFullWeekMonday(d), iso.isoWeekMonday(2026, 38));
  assert.equal(iso.lifecycleWeekIndex(iso.isoWeekMonday(2026, 38), iso.firstFullWeekMonday(d)), 1);
});
test("Wednesday opening: P0=5 days and W1/W4/W8 mapping", () => {
  const d = [2026, 9, 9], w1 = iso.firstFullWeekMonday(d);
  assert.deepEqual(iso.partialWeek(d), {isoMonday:iso.isoWeekMonday(2026,37),days:5});
  assert.equal(w1, iso.isoWeekMonday(2026,38));
  assert.equal(iso.lifecycleWeekIndex(iso.isoWeekMonday(2026,37),w1),null);
  assert.equal(iso.lifecycleWeekIndex(iso.isoWeekMonday(2026,41),w1),4);
  assert.equal(iso.lifecycleWeekIndex(iso.isoWeekMonday(2026,45),w1),8);
});
test("Sunday opening: P0 is one day", () => {
  assert.equal(iso.partialWeek([2026,9,13]).days,1);
  assert.equal(iso.firstFullWeekMonday([2026,9,13]),iso.isoWeekMonday(2026,38));
});
test("ISO year boundaries: 2021-01-01 belongs to 2020W53", () => {
  const monday=iso.isoMonday([2021,1,1]);
  assert.equal(monday,iso.isoWeekMonday(2020,53));
  assert.equal(iso.isoWeekMonday(2021,53),null);
  assert.equal(iso.isoWeekMonday(2020,53)+7*iso.DAY,iso.isoWeekMonday(2021,1));
  assert.equal(iso.firstFullWeekMonday([2021,1,1]),iso.isoWeekMonday(2021,1));
});
test("invalid dates and week numbers do not silently normalize", () => {
  assert.equal(iso.utcDate([2026,2,30]),null);
  assert.equal(iso.isoWeekMonday(2026,54),null);
  assert.equal(iso.firstFullWeekMonday([2026,2,30]),null);
});
