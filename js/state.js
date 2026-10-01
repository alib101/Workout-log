/* Split Log: app state, saving and loading, and small helpers shared by every screen.
   Scripts load in order (see index.html) and share one scope, so later files can use these names. */
"use strict";

var APP_VERSION = "13";
var PLAN_VERSION = 2;

var WEEKS = Logic.WEEKS, DELOAD = Logic.DELOAD, DAYS = Logic.DAYS;
var KEY = "split-log-v2", VIEW_KEY = "split-log-view";

// Pure helpers live in logic.js (tested). Short names kept so the screen code reads the same.
var fmt = Logic.fmt, num = Logic.num, niceLabel = Logic.niceLabel, lowReps = Logic.lowReps, topReps = Logic.topReps;
var restSecs = Logic.restSecs, isTimed = Logic.isTimed, inc = Logic.incOf, muscleOf = Logic.muscleOf, MUSCLES = Logic.MUSCLES;
function targetSets(w, ex) { return Logic.targetSets(w, ex); }

function uid() { return Math.random().toString(36).slice(2, 9); }
// The back-friendly plan. Used for the one-off "Load new plan" upgrade from the very first version.
function freshPlan() { return Logic.buildPlan("back5"); }
function blankState(plan) {
  return { plan: plan, log: {}, pain: {}, sessions: {}, days: {}, setCounts: {}, planVersion: PLAN_VERSION };
}

// state = { plan: [...sessions], log: { weekIndex: { exId: [[kg, reps, done], ...] } }, ... }
var state = blankState(freshPlan());
var view = { week: 0, day: 0, edit: false, section: "train", pweek: null, focus: false, fi: null, fiKey: null, setup: false, changing: false };
try { view.focus = localStorage.getItem("split-log-focus") === "1"; } catch (e) {}
try { if (localStorage.getItem("split-log-section") === "progress") view.section = "progress"; } catch (e) {}
var openCharts = {}, openNotes = {};

function load() {
  var raw = null, s = null;
  try { raw = localStorage.getItem(KEY); } catch (e) {}
  try { s = Logic.normalizeState(JSON.parse(raw || "null")); } catch (e) {}
  if (s) {
    state = s;
  } else {
    // Nothing saved yet (a new phone or a friend's phone): show the plan picker.
    // If something was saved but can't be read, keep a copy rather than ever overwriting it.
    if (raw) { try { localStorage.setItem(KEY + "-unreadable-" + Date.now(), raw); } catch (e) {} }
    view.setup = true;
  }
  var nx = upNext(); view.week = nx.w; view.day = Math.min(nx.di, state.plan.length - 1);
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
function saveView() { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ week: view.week, day: view.day })); } catch (e) {} }

// Flexible days (logic in logic.js): sessions run in order, whatever the weekday.
function sessionDone(w, di) { return Logic.sessionDone(state, w, di); }
function lastTrained() { return Logic.lastTrained(state); }
function upNext() { return Logic.upNext(state, Date.now()); }

function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function $(id) { return document.getElementById(id); }

// Sets shown for this exercise in this week: the plan's number unless changed on the fly with + / -.
function setCount(w, ex) {
  var o = state.setCounts && state.setCounts[w + "|" + ex.id];
  return o > 0 ? o : targetSets(w, ex);
}
function peek(w, id) { var W = state.log[w]; return W && W[id] ? W[id] : null; }
function sets(w, id, n) {
  var W = state.log[w] || (state.log[w] = {});
  var a = W[id] || (W[id] = []);
  while (a.length < n) a.push(["", "", 0]);
  return a;
}

// Double progression (see logic.js): compares with last week's sets for this exercise.
function progression(w, ex) {
  if (w === 0 || w === DELOAD) return null;
  return Logic.progression(peek(w - 1, ex.id), setCount(w - 1, ex), ex);
}
