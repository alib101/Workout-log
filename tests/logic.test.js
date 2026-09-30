// Run with: npm test   (no installs needed)
"use strict";
var test = require("node:test");
var assert = require("node:assert/strict");
var L = require("../js/logic.js");

function stateWith(plan, log, sessions) {
  return L.normalizeState({ plan: plan, log: log || {}, sessions: sessions || {} });
}

test("rest times parse from the plan's wording", function () {
  assert.equal(L.restSecs("2-3 min"), 180);
  assert.equal(L.restSecs("60-90s"), 90);
  assert.equal(L.restSecs("90s"), 90);
  assert.equal(L.restSecs(""), 90);
});

test("rep ranges and timed exercises", function () {
  assert.equal(L.topReps("8-10 /leg"), 10);
  assert.equal(L.lowReps("8-10"), "8");
  assert.equal(L.isTimed({ reps: "30-45s /side" }), true);
  assert.equal(L.isTimed({ reps: "8 /side" }), false);
  assert.equal(L.isTimed({ reps: "12-15" }), false);
});

test("deload halves the sets, rounding up", function () {
  assert.equal(L.targetSets(0, { sets: 3 }), 3);
  assert.equal(L.targetSets(L.DELOAD, { sets: 3 }), 2);
  assert.equal(L.targetSets(L.DELOAD, { sets: 4 }), 2);
});

test("progression adds weight only when every set hit the top of the range", function () {
  var ex = { reps: "8-10", inc: 2.5 };
  var up = L.progression([["80", "10", 1], ["80", "10", 1], ["80", "10", 1]], 3, ex);
  assert.deepEqual(up, { up: true, kg: "82.5", from: "80", top: 10 });
  var hold = L.progression([["80", "10", 1], ["80", "9", 1], ["80", "8", 1]], 3, ex);
  assert.equal(hold.up, false); assert.equal(hold.kg, "80");
  assert.equal(L.progression([["80", "10", 1], ["", "", 0]], 2, ex), null, "incomplete week gives no hint");
  assert.equal(L.progression(null, 3, ex), null);
  assert.equal(L.progression([["20", "10"], ["20", "10"]], 2, { reps: "10", inc: 2 }).kg, "22", "uses the exercise's step");
});

test("chart stats: heaviest set, estimated 1RM and volume per week", function () {
  var s = L.weekStats({ 0: { a: [["25", "6", 1], ["20", "10", 1]] } }, "a");
  assert.equal(s.length, L.WEEKS.length);
  assert.equal(s[0].top, 25); assert.equal(s[0].topReps, 6);
  assert.equal(Math.round(s[0].e1rm * 10) / 10, 30);
  assert.equal(s[0].vol, 350);
  assert.equal(s[1].top, null);
});

test("muscle groups for every exercise in every template", function () {
  var expect = {
    "Incline bench press machine": "Chest", "Machine bench press": "Chest", "Rope back narrow machine": "Back",
    "Upright row": "Shoulders", "Machine rear delt fly": "Shoulders", "Leg extensions": "Quads", "X-cable triceps extensions": "Triceps",
    "Lying leg curl": "Hamstrings", "Cable rope hammer curls": "Biceps", "Calf press on leg press": "Calves",
    "Hanging knee raise": "Core", "Side plank": "Core", "Deadlift": "Back", "Romanian deadlift": "Hamstrings",
    "Hip thrust machine / glute bridge": "Glutes", "Incline dumbbell curl": "Biceps", "Pull-up (or assisted)": "Back"
  };
  Object.keys(expect).forEach(function (n) { assert.equal(L.muscleOf(n), expect[n], n); });
  L.TEMPLATE_ORDER.forEach(function (id) {
    if (L.TEMPLATES[id].custom) return;
    L.buildPlan(id).forEach(function (d) {
      d.ex.forEach(function (ex) { assert.ok(L.muscleOf(ex.name), id + ": no muscle group for " + ex.name); });
    });
  });
});

test("templates build valid plans with unique ids and keys", function () {
  L.TEMPLATE_ORDER.forEach(function (id) {
    var plan = L.buildPlan(id, { sessions: 4 });
    assert.ok(stateWith(plan), id + " passes the saved-data check");
    var keys = plan.map(function (d) { return d.key; });
    assert.equal(new Set(keys).size, keys.length, id + " keys unique");
    var ids = []; plan.forEach(function (d) { d.ex.forEach(function (e) { ids.push(e.id); }); });
    assert.equal(new Set(ids).size, ids.length, id + " ids unique");
  });
  assert.equal(L.buildPlan("custom", { sessions: 4 }).length, 4);
  assert.equal(L.buildPlan("fb3").length, 3);
});

test("the back-friendly plan keeps the exercise ids existing logs use", function () {
  var plan = L.buildPlan("back5");
  assert.equal(plan[0].ex[0].id, "v2push0");
  assert.equal(plan[1].ex[0].id, "v2pull0");
  assert.equal(plan[4].ex[6].id, "v2lowerB6");
});

test("up next follows the rotation for any number of sessions", function () {
  var plan = L.buildPlan("fb3"), now = Date.parse("2026-10-01T18:00:00Z");
  assert.deepEqual(L.upNext(stateWith(plan), now), { w: 0, di: 0 }, "nothing logged: first session");
  var day = 24 * 3600e3;
  assert.deepEqual(L.upNext(stateWith(plan, {}, { "0|fbA": now - day }), now), { w: 0, di: 1 });
  assert.deepEqual(L.upNext(stateWith(plan, {}, { "0|fbC": now - day }), now), { w: 1, di: 0 }, "wraps to next week");
  assert.deepEqual(L.upNext(stateWith(plan, {}, { "0|fbB": now - 3600e3 }), now), { w: 0, di: 1 }, "stays on a session in progress");
  var last = L.upNext(stateWith(plan, {}, { "6|fbC": now - day }), now);
  assert.equal(last.finished, true); assert.equal(last.di, 2);
  var five = L.buildPlan("back5");
  assert.deepEqual(L.upNext(stateWith(five, {}, { "0|lowerB": now - day }), now), { w: 1, di: 0 });
});

test("up next falls back to ticked sets when there are no timestamps", function () {
  var plan = L.buildPlan("back5"), log = { 0: { v2pull0: [["15", "10", 1]] } };
  assert.deepEqual(L.upNext(stateWith(plan, log), Date.now()), { w: 0, di: 2 });
});

test("saved data: accepts old and new backups, rejects anything else", function () {
  var oldBackup = { plan: L.buildPlan("back5"), log: { 0: {} }, planVersion: 2 };
  var st = L.normalizeState(JSON.parse(JSON.stringify(oldBackup)));
  assert.ok(st); assert.deepEqual(st.sessions, {}); assert.deepEqual(st.setCounts, {});
  assert.equal(L.normalizeState(null), null);
  assert.equal(L.normalizeState({ plan: [], log: {} }), null);
  assert.equal(L.normalizeState({ a: 1 }), null);
  var wrapped = JSON.stringify({ app: "five-day-split", savedAt: "2026-09-29T05:00:17.321Z", data: oldBackup });
  var b = L.parseBackup(wrapped);
  assert.equal(b.state.plan.length, 5); assert.equal(b.savedAt.getUTCDate(), 29);
  assert.throws(function () { L.parseBackup('{"hello":1}'); });
  assert.throws(function () { L.parseBackup("not json"); });
});

test("logged set count for the restore confirmation", function () {
  assert.equal(L.loggedCount({ log: { 0: { a: [["80", "8", 1], ["", "", 0], ["", "5", 0]] } } }), 2);
});

test("plan titles", function () {
  assert.equal(L.planTitle(5), "Five-Day Split");
  assert.equal(L.planTitle(3), "Three-Day Split");
});
