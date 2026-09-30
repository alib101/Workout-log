/* Split Log: pure logic. No DOM, no storage, so it can be unit-tested in Node.
   Loaded in the browser as a classic script (defines global `Logic`) and in Node via require(). */
(function (root) {
  "use strict";

  var WEEKS = ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Deload"];
  var DELOAD = 6;
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MAX_SESSIONS = 7;

  // ---------- small helpers ----------
  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function fmt(n) { return String(Math.round(n * 100) / 100); }
  function niceLabel(v) { return v >= 1000 ? Math.round(v).toLocaleString("en-GB") : fmt(Math.round(v * 2) / 2); }
  function lowReps(r) { var m = String(r).match(/\d+/); return m ? m[0] : ""; }
  function topReps(r) { var m = String(r).match(/\d+/g); return m ? +m[m.length - 1] : 0; }
  // "2-3 min" -> 180, "60-90s" -> 90, "90s" -> 90. Uses the top of a range.
  function restSecs(r) {
    var nums = (String(r).match(/\d+/g) || []).map(Number);
    if (!nums.length) return 90;
    var top = nums[nums.length - 1];
    return /min/i.test(r) ? top * 60 : top;
  }
  // Exercises measured in seconds, e.g. "30-45s /side".
  function isTimed(ex) { return /\d\s*s\b/i.test(String(ex.reps)); }
  function incOf(ex) { var n = parseFloat(ex.inc); return n > 0 ? n : 2.5; }
  function targetSets(w, ex) { var n = Math.max(1, parseInt(ex.sets, 10) || 3); return w === DELOAD ? Math.ceil(n / 2) : n; }
  function planTitle(n) {
    var words = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
    return (words[n] || n) + "-Day Split";
  }

  // ---------- progression ----------
  // Double progression: if every set last time reached the top of the rep range, add weight.
  // prevSets: last week's sets for this exercise; n: how many sets were planned last week.
  function progression(prevSets, n, ex) {
    if (!prevSets) return null;
    var logged = prevSets.slice(0, n).filter(function (s) { return num(s[0]) != null && num(s[1]) != null; });
    if (!n || logged.length < n) return null;
    var maxKg = Math.max.apply(null, logged.map(function (s) { return num(s[0]); }));
    var top = topReps(ex.reps);
    var hit = top > 0 && logged.every(function (s) { return num(s[1]) >= top; });
    if (hit) return { up: true, kg: fmt(maxKg + incOf(ex)), from: fmt(maxKg), top: top };
    return { up: false, kg: fmt(maxKg), top: top };
  }

  // Per-week figures for one exercise: heaviest set, estimated 1RM (Epley) and volume.
  function weekStats(log, id) {
    return WEEKS.map(function (_, w) {
      var p = log[w] && log[w][id], out = { top: null, topReps: null, e1rm: null, vol: null };
      (p || []).forEach(function (s) {
        var kg = num(s[0]), r = num(s[1]);
        if (kg == null || r == null || r <= 0) return;
        var e = r === 1 ? kg : kg * (1 + r / 30);
        if (out.e1rm == null || e > out.e1rm) out.e1rm = e;
        if (out.top == null || kg > out.top || (kg === out.top && r > out.topReps)) { out.top = kg; out.topReps = r; }
        out.vol = (out.vol || 0) + kg * r;
      });
      return out;
    });
  }

  // ---------- muscles ----------
  var MUSCLES = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quads", "Hamstrings", "Glutes", "Calves", "Core"];
  // Primary muscle from the exercise name. Order matters: more specific phrases first.
  var MUSCLE_RULES = [
    [/calf/, "Calves"],
    [/dead ?bug|plank|pallof|bird ?dog|\bab |\babs\b|crunch|\bcore\b|hanging|knee raise|leg raise/, "Core"],
    [/rear delt|face pull|upright row|lateral|raise|shoulder press|overhead press|military/, "Shoulders"],
    [/leg curl|hamstring|rdl|romanian|nordic/, "Hamstrings"],
    [/hip thrust|glute|bridge|kickback|abduct/, "Glutes"],
    [/leg ext|squat|leg press|lunge|split|step.?up|hack/, "Quads"],
    [/tri|pushdown|skull|dip/, "Triceps"],
    [/curl/, "Biceps"],
    [/deadlift|rack pull|\brow|pull ?down|pulldown|pull-?up|\bchin|\blat |\blats\b|\bback\b|pullover|shrug/, "Back"],
    [/chest|bench|fly|pec|incline|press ?up|push ?up/, "Chest"]
  ];
  function muscleOf(name) {
    var n = String(name).toLowerCase() + " ";
    for (var i = 0; i < MUSCLE_RULES.length; i++) if (MUSCLE_RULES[i][0].test(n)) return MUSCLE_RULES[i][1];
    return null;
  }

  // ---------- flexible days: what's up next ----------
  function peek(state, w, id) { var W = state.log[w]; return W && W[id] ? W[id] : null; }
  function sessionDone(state, w, di) {
    return state.plan[di].ex.some(function (ex) { var p = peek(state, w, ex.id); return p && p.some(function (x) { return x[2]; }); });
  }
  function lastTrained(state) {
    var best = null;
    Object.keys(state.sessions || {}).forEach(function (k) {
      var parts = k.split("|"), w = +parts[0], di = -1;
      state.plan.forEach(function (d, i) { if (d.key === parts[1]) di = i; });
      if (di < 0 || !(w >= 0)) return;
      if (!best || state.sessions[k] > best.ts) best = { w: w, di: di, ts: state.sessions[k] };
    });
    if (best) return best;
    for (var w = WEEKS.length - 1; w >= 0; w--)
      for (var di = state.plan.length - 1; di >= 0; di--) if (sessionDone(state, w, di)) return { w: w, di: di, ts: 0 };
    return null;
  }
  // Sessions run in order whatever the weekday. Up next = the one after your last session,
  // or the one you're in the middle of (a set ticked within the last 4 hours).
  function upNext(state, now) {
    var D = state.plan.length, lt = lastTrained(state);
    if (!lt) return { w: 0, di: 0 };
    if (lt.ts && now - lt.ts < 4 * 3600e3) return { w: lt.w, di: lt.di };
    var idx = lt.w * D + lt.di + 1;
    if (idx >= WEEKS.length * D) return { w: WEEKS.length - 1, di: D - 1, finished: true };
    return { w: Math.floor(idx / D), di: idx % D };
  }

  // ---------- saved data ----------
  // Checks saved or restored data and fills in anything newer versions added. Returns null if it isn't ours.
  function normalizeState(st) {
    if (!st || typeof st !== "object" || !Array.isArray(st.plan) || !st.log || typeof st.log !== "object") return null;
    if (st.plan.length < 1 || st.plan.length > MAX_SESSIONS) return null;
    for (var i = 0; i < st.plan.length; i++) {
      var d = st.plan[i];
      if (!d || typeof d.key !== "string" || !Array.isArray(d.ex)) return null;
      if (typeof d.name !== "string") d.name = "Day " + (i + 1);
    }
    ["pain", "sessions", "days", "setCounts"].forEach(function (k) { if (!st[k] || typeof st[k] !== "object") st[k] = {}; });
    return st;
  }
  function parseBackup(text) {
    var j = JSON.parse(text), st = normalizeState(j && j.data ? j.data : j);
    if (!st) throw new Error("not a backup");
    return { state: st, savedAt: j && j.savedAt ? new Date(j.savedAt) : null };
  }
  function loggedCount(st) {
    var n = 0;
    Object.keys(st.log || {}).forEach(function (w) {
      Object.keys(st.log[w] || {}).forEach(function (id) {
        (st.log[w][id] || []).forEach(function (x) { if (x && (x[2] || x[0] !== "" || x[1] !== "")) n++; });
      });
    });
    return n;
  }

  // ---------- plan templates ----------
  // Exercise rows: [name, sets, reps, rest, add-kg step, form note].
  var TEMPLATES = {
    back5: {
      title: "Five-day, back-friendly",
      blurb: "Push, pull, legs and upper, built around a recovering lower back: machines and supported positions, no loaded twisting or bending forward.",
      idPrefix: "v2", // keep: existing logs are stored against these ids
      days: [
        { key: "push", name: "Push", day: 1, focus: "Chest, shoulders, triceps", ex: [
          ["Chest press", 3, "8-10", "2 min", 2.5, ""],
          ["Incline bench press machine", 3, "8-10", "2 min", 2.5, ""],
          ["Cable fly", 3, "12-15", "60-90s", 2.5, ""],
          ["Seated DB shoulder press", 3, "8-10", "2 min", 2, "Backrest upright, back on the pad. Take DBs from the rack, not the floor."],
          ["Cable raise 2 handles", 3, "12-15", "60s", 2.5, ""],
          ["X-cable triceps extensions", 3, "10-12", "60-90s", 2.5, ""],
          ["Overhead tri rope 1 arm", 3, "10-12", "60s", 2.5, "Seated or kneeling, ribs down. Don't arch your lower back."],
          ["Dead bug", 3, "8 /side", "60s", 0, "Replaces the ab bench. Keep your lower back pressed into the floor. Slow."] ] },
        { key: "pull", name: "Pull", day: 2, focus: "Back, rear delts, biceps", ex: [
          ["Chest-supported row machine", 4, "8-10", "2 min", 2.5, "Replaces rack pulls for now. Chest stays on the pad."],
          ["Low row (V-bar or 2 handles)", 3, "10-12", "90s", 2.5, "Was 1-handle. Two hands avoids twisting. Sit tall, don't rock."],
          ["Wide arm pull down", 3, "8-12", "90s", 2.5, ""],
          ["Rope back narrow machine", 3, "10-12", "90s", 2.5, ""],
          ["Upright row", 3, "12-15", "60s", 2.5, "Stop at chest height if your shoulders pinch."],
          ["Machine rear delt fly", 3, "12-15", "60s", 2.5, ""],
          ["Curl machine", 3, "10-12", "60s", 2.5, "Machine rather than standing DBs while your back settles."],
          ["Cable rope hammer curls", 3, "10-12", "60s", 2.5, "Soft knees, brace, no swinging."] ] },
        { key: "lowerA", name: "Lower A", day: 3, focus: "Quads, back-friendly", ex: [
          ["Hack squat (or leg press)", 4, "8-10", "2-3 min", 5, "Replaces barbell squat. Leave 2-3 reps in reserve. Stop before your hips tuck under."],
          ["Leg press", 3, "10-12", "2 min", 5, "Stop before your lower back lifts off the pad."],
          ["Leg extensions", 3, "12-15", "60-90s", 2.5, ""],
          ["Lying leg curl", 3, "10-12", "60-90s", 2.5, ""],
          ["Split lunges (DBs)", 3, "8-10 /leg", "90s", 2, "Upright torso. Pick DBs up from the rack, not the floor."],
          ["Seated calf raise", 4, "12-15", "60s", 2.5, ""],
          ["Side plank", 3, "30-45s /side", "60s", 0, "Replaces hanging abs. Straight line from head to heels."] ] },
        { key: "upper", name: "Upper", day: 5, focus: "Chest, back, arms", ex: [
          ["DB incline press", 3, "8-10", "2 min", 2, "Rest the DBs on your knees while seated, then kick them up. No bending down."],
          ["Machine bench press", 3, "8-10", "2 min", 2.5, ""],
          ["Sit down row narrow", 3, "10-12", "90s", 2.5, "Sit tall. Don't lean back to finish the rep."],
          ["Lat pull down curvy bar", 3, "10-12", "90s", 2.5, ""],
          ["Lateral raise", 3, "12-15", "60s", 1, ""],
          ["Cable curl bar", 3, "10-12", "60s", 2.5, ""],
          ["Overhead tri 1 arm (seated)", 3, "10-12", "60s", 2.5, "Seated, ribs down."],
          ["Pallof press", 3, "10 /side", "60s", 2.5, "Anti-twist: resist the cable pulling you round. Start light."] ] },
        { key: "lowerB", name: "Lower B", day: 6, focus: "Hips and glutes, back-friendly", ex: [
          ["Hip thrust machine / glute bridge", 4, "8-12", "2 min", 5, "Ribs down, squeeze at the top. Don't arch your back."],
          ["Leg press (feet high)", 3, "10-12", "2 min", 5, "Stop before your lower back lifts off the pad."],
          ["Seated leg curl", 3, "10-12", "60-90s", 2.5, ""],
          ["Bulgarian split squat", 3, "8-10 /leg", "90s", 2, "Upright torso. DBs from the rack or use the Smith machine."],
          ["Leg extensions", 3, "12-15", "60-90s", 2.5, ""],
          ["Calf press on leg press", 4, "12-15", "60s", 5, "Keeps weight off your spine, unlike standing calf raises."],
          ["Bird dog", 3, "8 /side", "60s", 0, "Slow, hips level, hold 2 seconds at full reach."] ] }
      ]
    },
    ppl5: {
      title: "Five-day, free weights",
      blurb: "Push, pull, quad-focused legs, upper and hip-focused legs, built around the big barbell lifts. For lifters with some experience.",
      days: [
        { key: "push", name: "Push", day: 1, focus: "Chest, shoulders, triceps", ex: [
          ["Barbell bench press", 4, "5-8", "2-3 min", 2.5, ""], ["Incline dumbbell press", 3, "8-10", "2 min", 2, ""],
          ["Seated dumbbell shoulder press", 3, "8-10", "2 min", 2, ""], ["Cable lateral raise", 4, "12-15", "60-90s", 2.5, ""],
          ["Pec deck / cable fly", 3, "12-15", "60-90s", 2.5, ""], ["Triceps rope pushdown", 3, "10-12", "60-90s", 2.5, ""],
          ["Overhead cable triceps extension", 3, "10-12", "60-90s", 2.5, ""] ] },
        { key: "pull", name: "Pull", day: 2, focus: "Back, rear delts, biceps", ex: [
          ["Weighted pull-up / lat pulldown", 4, "6-10", "2-3 min", 2.5, ""], ["Chest-supported row", 4, "8-10", "2 min", 2.5, ""],
          ["Seated cable row (neutral grip)", 3, "10-12", "90s", 2.5, ""], ["Face pull / rear delt fly", 3, "15-20", "60s", 2.5, ""],
          ["Incline dumbbell curl", 3, "10-12", "60-90s", 2, ""], ["Hammer curl", 3, "10-12", "60-90s", 2, ""] ] },
        { key: "lowerA", name: "Lower A", day: 3, focus: "Quad-focused legs", ex: [
          ["Back squat", 4, "5-8", "2-3 min", 5, ""], ["Leg press", 3, "10-12", "2 min", 5, ""],
          ["Romanian deadlift", 3, "8-10", "2 min", 5, ""], ["Leg extension", 3, "12-15", "60-90s", 2.5, ""],
          ["Seated leg curl", 3, "10-12", "60-90s", 2.5, ""], ["Standing calf raise", 4, "10-15", "60s", 5, ""] ] },
        { key: "upper", name: "Upper", day: 5, focus: "Full upper body", ex: [
          ["Barbell overhead press", 3, "6-8", "2-3 min", 2.5, ""], ["T-bar / barbell row", 3, "8-10", "2 min", 2.5, ""],
          ["Flat dumbbell bench press", 3, "8-10", "2 min", 2, ""], ["Neutral-grip lat pulldown", 3, "10-12", "90s", 2.5, ""],
          ["Dumbbell lateral raise", 3, "15-20", "60s", 1, ""], ["EZ-bar curl", 2, "10-12", "60-90s", 2.5, ""],
          ["Skullcrusher", 2, "10-12", "60-90s", 2.5, ""] ] },
        { key: "lowerB", name: "Lower B", day: 6, focus: "Hip-focused legs", ex: [
          ["Deadlift (or trap-bar)", 3, "4-6", "3 min", 5, ""], ["Hack squat / front squat", 3, "8-10", "2 min", 5, ""],
          ["Barbell hip thrust", 3, "8-12", "2 min", 5, ""], ["Bulgarian split squat", 3, "8-10 /leg", "90s", 2, ""],
          ["Lying leg curl", 3, "10-12", "60-90s", 2.5, ""], ["Seated calf raise", 4, "12-15", "60s", 2.5, ""],
          ["Cable crunch", 3, "12-15", "60s", 2.5, ""] ] }
      ]
    },
    ul4: {
      title: "Four-day upper / lower",
      blurb: "Two upper and two lower sessions a week. A good all-round plan with a rest day between each pair.",
      days: [
        { key: "upperA", name: "Upper A", day: 1, focus: "Heavier presses and rows", ex: [
          ["Barbell bench press", 4, "6-8", "2-3 min", 2.5, ""], ["Barbell row", 4, "6-8", "2 min", 2.5, ""],
          ["Seated dumbbell shoulder press", 3, "8-10", "2 min", 2, ""], ["Lat pulldown", 3, "8-12", "90s", 2.5, ""],
          ["Triceps pushdown", 3, "10-12", "60-90s", 2.5, ""], ["Dumbbell curl", 3, "10-12", "60-90s", 2, ""] ] },
        { key: "lowerA", name: "Lower A", day: 2, focus: "Squat focus", ex: [
          ["Back squat", 4, "6-8", "2-3 min", 5, ""], ["Romanian deadlift", 3, "8-10", "2 min", 5, ""],
          ["Leg press", 3, "10-12", "2 min", 5, ""], ["Lying leg curl", 3, "10-12", "60-90s", 2.5, ""],
          ["Standing calf raise", 4, "10-15", "60s", 5, ""], ["Plank", 3, "30-60s", "60s", 0, ""] ] },
        { key: "upperB", name: "Upper B", day: 4, focus: "Lighter, higher reps", ex: [
          ["Incline dumbbell press", 4, "8-10", "2 min", 2, ""], ["Seated cable row", 4, "8-10", "90s", 2.5, ""],
          ["Lateral raise", 3, "12-15", "60s", 1, ""], ["Pull-up (or assisted)", 3, "6-10", "2 min", 2.5, ""],
          ["Overhead triceps extension", 3, "10-12", "60-90s", 2.5, ""], ["Hammer curl", 3, "10-12", "60-90s", 2, ""] ] },
        { key: "lowerB", name: "Lower B", day: 5, focus: "Deadlift focus", ex: [
          ["Deadlift", 3, "5", "3 min", 5, ""], ["Hack squat / front squat", 3, "8-10", "2 min", 5, ""],
          ["Walking lunge", 3, "10 /leg", "90s", 2, ""], ["Leg extension", 3, "12-15", "60-90s", 2.5, ""],
          ["Seated calf raise", 4, "12-15", "60s", 2.5, ""], ["Hanging knee raise", 3, "10-15", "60s", 0, ""] ] }
      ]
    },
    fb3: {
      title: "Three-day full body",
      blurb: "Every muscle three times a week in shorter sessions. Good for beginners or anyone short on time.",
      days: [
        { key: "fbA", name: "Full body A", day: 1, focus: "Squat and bench", ex: [
          ["Back squat", 3, "6-8", "2-3 min", 5, ""], ["Barbell bench press", 3, "6-8", "2-3 min", 2.5, ""],
          ["Chest-supported row", 3, "8-10", "2 min", 2.5, ""], ["Lying leg curl", 3, "10-12", "60-90s", 2.5, ""],
          ["Lateral raise", 3, "12-15", "60s", 1, ""], ["Triceps pushdown", 2, "10-12", "60s", 2.5, ""] ] },
        { key: "fbB", name: "Full body B", day: 3, focus: "Hinge and overhead press", ex: [
          ["Romanian deadlift", 3, "8-10", "2 min", 5, ""], ["Overhead press", 3, "6-8", "2 min", 2.5, ""],
          ["Lat pulldown", 3, "8-12", "90s", 2.5, ""], ["Leg press", 3, "10-12", "2 min", 5, ""],
          ["Incline dumbbell curl", 2, "10-12", "60s", 2, ""], ["Plank", 3, "30-45s", "60s", 0, ""] ] },
        { key: "fbC", name: "Full body C", day: 5, focus: "Legs, incline and rows", ex: [
          ["Hack squat", 3, "8-10", "2 min", 5, ""], ["Incline dumbbell press", 3, "8-10", "2 min", 2, ""],
          ["Seated cable row", 3, "10-12", "90s", 2.5, ""], ["Hip thrust", 3, "8-12", "2 min", 5, ""],
          ["Cable fly", 2, "12-15", "60s", 2.5, ""], ["Hammer curl", 2, "10-12", "60s", 2, ""] ] }
      ]
    },
    custom: {
      title: "Start from scratch",
      blurb: "Empty sessions for you to fill in with your own exercises. Choose how many sessions below.",
      custom: true,
      days: []
    }
  };
  var TEMPLATE_ORDER = ["back5", "ppl5", "ul4", "fb3", "custom"];
  var CUSTOM_DAYS = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };

  // Builds a plan from a template. Exercise ids stay stable so re-choosing a template picks up old logs.
  function buildPlan(id, opts) {
    var t = TEMPLATES[id];
    if (!t) throw new Error("Unknown template " + id);
    if (t.custom) {
      var n = Math.max(1, Math.min(MAX_SESSIONS, (opts && opts.sessions) || 3)), dow = CUSTOM_DAYS[n] || CUSTOM_DAYS[3];
      var out = [];
      for (var i = 0; i < n; i++) out.push({ key: "day" + (i + 1), name: "Day " + (i + 1), day: dow[i] != null ? dow[i] : i % 7, focus: "", ex: [] });
      return out;
    }
    var prefix = t.idPrefix || ("t-" + id + "-");
    return t.days.map(function (d) {
      return { key: d.key, name: d.name, day: d.day, focus: d.focus,
        ex: d.ex.map(function (e, i) { return { id: prefix + d.key + i, name: e[0], sets: e[1], reps: e[2], rest: e[3], inc: e[4] || 2.5, note: e[5] || "" }; }) };
    });
  }

  var Logic = {
    WEEKS: WEEKS, DELOAD: DELOAD, DAYS: DAYS, MAX_SESSIONS: MAX_SESSIONS, MUSCLES: MUSCLES,
    TEMPLATES: TEMPLATES, TEMPLATE_ORDER: TEMPLATE_ORDER,
    num: num, fmt: fmt, niceLabel: niceLabel, lowReps: lowReps, topReps: topReps, restSecs: restSecs,
    isTimed: isTimed, incOf: incOf, targetSets: targetSets, planTitle: planTitle,
    progression: progression, weekStats: weekStats, muscleOf: muscleOf,
    sessionDone: sessionDone, lastTrained: lastTrained, upNext: upNext,
    normalizeState: normalizeState, parseBackup: parseBackup, loggedCount: loggedCount, buildPlan: buildPlan
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Logic;
  else root.Logic = Logic;
})(typeof window !== "undefined" ? window : this);
