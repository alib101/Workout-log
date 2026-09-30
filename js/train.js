/* Split Log: the Train screen (session tabs, exercise cards, focus mode, editing). */
"use strict";

// Most recent earlier week where this exercise has any numbers logged.
function lastLogged(w, id) {
  for (var k = w - 1; k >= 0; k--) {
    var p = peek(k, id);
    if (p) {
      var filled = p.filter(function (x) { return x[0] !== "" || x[1] !== ""; });
      if (filled.length) return { w: k, sets: p, lastFilled: filled[filled.length - 1] };
    }
  }
  return null;
}
function dayKeyOf(ex) {
  var key = null;
  state.plan.forEach(function (d) { d.ex.forEach(function (e) { if (e === ex) key = d.key; }); });
  return key || state.plan[view.day].key;
}

function holdRef(w, ex) {
  if (w === 0) return "First week: hold as long as your form stays solid. Tap \u25B6 to time it.";
  var bits = (peek(w - 1, ex.id) || []).filter(function (x) { return x[1] !== ""; }).map(function (x) { return x[1] + "s"; });
  return bits.length ? WEEKS[w - 1] + ": " + bits.join("  ") : "Nothing logged for " + WEEKS[w - 1] + ".";
}
// Number box with - and + either side. Starts from the grey suggestion if the box is empty.
function stepper(input, step, min, what) {
  var wrap = el("div", "stp");
  function nudge(dir) {
    var v = num(input.value); if (v == null) v = num(input.placeholder); if (v == null) v = 0;
    v = Math.max(min, Math.round((v + dir * step) * 100) / 100);
    input.value = fmt(v); input.oninput();
  }
  var m = el("button", "nudge", "\u2212"); m.type = "button"; m.setAttribute("aria-label", "Less " + what);
  var pl = el("button", "nudge", "+"); pl.type = "button"; pl.setAttribute("aria-label", "More " + what);
  m.onclick = function () { nudge(-1); }; pl.onclick = function () { nudge(1); };
  wrap.appendChild(m); wrap.appendChild(input); wrap.appendChild(pl);
  return wrap;
}

// Focus mode: after the last set of an exercise is ticked, move on to the next one.
function afterSetDone(ex, w) {
  if (!view.focus) return;
  var n = setCount(w, ex), p = peek(w, ex.id) || [];
  for (var i = 0; i < n; i++) if (!p[i] || !p[i][2]) return;
  var list = state.plan[view.day].ex, idx = list.indexOf(ex);
  if (idx < 0) return;
  setTimeout(function () {
    if (!view.focus || view.fi !== idx) return;
    view.fi = idx + 1; renderMain(); window.scrollTo(0, 0);
  }, 900);
}
function firstUnfinished(w, list) {
  for (var i = 0; i < list.length; i++) {
    var n = setCount(w, list[i]), p = peek(w, list[i].id) || [];
    for (var k = 0; k < n; k++) if (!p[k] || !p[k][2]) return i;
  }
  return list.length;
}

function prevSet(w, id, s) {
  if (w === 0) return null;
  var p = peek(w - 1, id);
  if (!p) return null;
  var src = p[s] && (p[s][0] !== "" || p[s][1] !== "") ? p[s] : null;
  if (!src) for (var k = p.length - 1; k >= 0; k--) if (p[k][0] !== "") { src = p[k]; break; }
  if (!src) return null;
  var kg = src[0];
  if (w === DELOAD && kg !== "" && !isNaN(parseFloat(kg))) kg = fmt(Math.round(parseFloat(kg) * 0.6 / 2.5) * 2.5);
  return { kg: kg, reps: src[1] };
}
function refLine(w, id) {
  if (w === 0) return "First week: pick weights that leave 1-2 reps in reserve.";
  var bits = (peek(w - 1, id) || []).filter(function (s) { return s[0] !== "" || s[1] !== ""; })
    .map(function (s) { return (s[0] || "?") + "×" + (s[1] || "?"); });
  if (!bits.length) return "Nothing logged for " + WEEKS[w - 1] + ".";
  return WEEKS[w - 1] + (w === DELOAD ? " (deload is 60% of this): " : ": ") + bits.join("  ");
}

function totals(w, di) {
  var total = 0, done = 0;
  state.plan[di].ex.forEach(function (ex) {
    var n = setCount(w, ex); total += n;
    var p = peek(w, ex.id);
    if (p) for (var s = 0; s < n && s < p.length; s++) if (p[s][2]) done++;
  });
  return { total: total, done: done };
}
function updateProgress() {
  var t = totals(view.week, view.day), c = $("count");
  if (c) c.textContent = t.done + " / " + t.total + " sets";
  state.plan.forEach(function (d, di) {
    var x = totals(view.week, di), bar = document.querySelector('.tab[data-i="' + di + '"] .bar i');
    if (bar) bar.style.width = (x.total ? Math.round(100 * x.done / x.total) : 0) + "%";
  });
}

var TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function renderWeeks() {
  var box = $("weeks"); box.textContent = "";
  WEEKS.forEach(function (label, w) {
    var b = el("button", "chip", label); b.type = "button";
    b.setAttribute("aria-pressed", w === view.week ? "true" : "false");
    b.onclick = function () { view.week = w; saveView(); renderWeeks(); renderTabs(); renderMain(); };
    box.appendChild(b);
  });
}
function renderTabs() {
  var box = $("tabs"), nx = upNext(); box.textContent = "";
  box.style.gridTemplateColumns = "repeat(" + state.plan.length + ", minmax(0, 1fr))";
  state.plan.forEach(function (d, di) {
    var b = el("button", "tab"); b.type = "button"; b.setAttribute("role", "tab"); b.dataset.i = di;
    b.setAttribute("aria-selected", di === view.day ? "true" : "false");
    b.appendChild(el("span", "n", d.name));
    var isNext = !nx.finished && nx.w === view.week && nx.di === di, done = sessionDone(view.week, di);
    b.appendChild(el("span", "d" + (isNext ? " next" : ""), isNext ? (done ? "Now" : "Next") : done ? "Done" : ""));
    var bar = el("span", "bar"); bar.appendChild(el("i")); b.appendChild(bar);
    b.onclick = function () { view.day = di; view.fi = null; saveView(); renderTabs(); renderMain(); window.scrollTo(0, 0); };
    box.appendChild(b);
  });
}

function planBanner() {
  var b = el("section", "planbanner");
  b.appendChild(el("strong", null, "Your back-friendly plan is ready"));
  b.appendChild(el("p", null, "Loading it replaces the exercise list on this phone with your adapted split. Sets you've already logged won't show against the new exercises."));
  var row = el("div", "row");
  var go = el("button", "primary", "Load new plan"); go.type = "button";
  go.onclick = function () {
    if (!go.classList.contains("confirm")) { go.classList.add("confirm"); go.textContent = "Tap again to load"; return; }
    state.plan = freshPlan(); state.planVersion = PLAN_VERSION; save(); renderTabs(); renderMain();
  };
  var keep = el("button", null, "Keep my current list"); keep.type = "button";
  keep.onclick = function () { state.planVersion = PLAN_VERSION; save(); renderMain(); };
  row.appendChild(go); row.appendChild(keep); b.appendChild(row);
  return b;
}

function painRow(w, d) {
  var box = el("div", "pain"), W = state.pain[w] || {};
  var lb = el("label", null, "Back pain after this session"); lb.htmlFor = "pain-in";
  var i = el("input"); i.id = "pain-in"; i.type = "text"; i.inputMode = "numeric"; i.placeholder = "0-10"; i.autocomplete = "off";
  i.value = W[d.key] != null ? W[d.key] : "";
  var tip = el("div", "paintip");
  function paintTip() {
    var v = num(i.value);
    tip.textContent = v == null ? "Up to about 3/10 during a set is usually fine. If it's worse tomorrow morning, drop the weight or skip that exercise next time."
      : v <= 3 ? "Fine to carry on as planned."
      : v <= 5 ? "Hold weights steady next session and check how it feels in the morning."
      : "Higher than you'd want. Go lighter next session, drop anything that set it off, and get it checked if it keeps up.";
    tip.className = "paintip" + (v != null && v > 5 ? " high" : v != null && v > 3 ? " mid" : "");
  }
  i.oninput = function () {
    var v = i.value.replace(/[^\d]/g, "").slice(0, 2); if (v !== "" && +v > 10) v = "10"; i.value = v;
    var P = state.pain[w] || (state.pain[w] = {});
    if (v === "") delete P[d.key]; else P[d.key] = +v;
    save(); paintTip();
  };
  var top = el("div", "painrow"); top.appendChild(lb); top.appendChild(i);
  box.appendChild(top); box.appendChild(tip); paintTip();
  return box;
}


function paintNav() {
  Array.prototype.forEach.call($("nav").children, function (b) { b.setAttribute("aria-pressed", b.dataset.s === view.section ? "true" : "false"); });
  var prog = view.section === "progress";
  $("nav").hidden = view.setup;
  $("weeks").hidden = prog || view.setup; $("tabs").hidden = prog || view.setup;
  $("title").textContent = view.setup && !view.changing ? "Split Log" : Logic.planTitle(state.plan.length);
}
function renderMain() {
  var main = $("main"); main.textContent = "";
  paintNav();
  if (view.setup) { renderSetup(main); return; }
  if (view.day >= state.plan.length) view.day = state.plan.length - 1;
  if (view.section === "progress") { renderProgress(main); return; }
  var d = state.plan[view.day], w = view.week;
  var head = el("div", "dayhead");
  var l = el("div"); l.appendChild(el("h2", null, d.name)); l.appendChild(el("div", "focus", d.focus)); head.appendChild(l);
  var r = el("div", "dayright");
  var eb = el("button", "editbtn", view.edit ? "Done editing" : "Edit"); eb.type = "button";
  eb.setAttribute("aria-pressed", view.edit ? "true" : "false");
  eb.onclick = function () { view.edit = !view.edit; renderMain(); };
  var btns = el("div", "hbtns");
  if (!view.edit) {
    var fb = el("button", "editbtn", "Focus"); fb.type = "button";
    fb.setAttribute("aria-pressed", view.focus ? "true" : "false");
    fb.onclick = function () {
      view.focus = !view.focus; view.fi = null;
      try { localStorage.setItem("split-log-focus", view.focus ? "1" : ""); } catch (e) {}
      renderMain(); window.scrollTo(0, 0);
    };
    btns.appendChild(fb);
  }
  btns.appendChild(eb); r.appendChild(btns);
  if (!view.edit) { var c = el("div", "count"); c.id = "count"; r.appendChild(c); }
  head.appendChild(r); main.appendChild(head);

  if (state.planVersion !== PLAN_VERSION) main.appendChild(planBanner());
  if (view.edit) { renderEdit(main, d); return; }
  var nx = upNext();
  if (nx.finished && w === nx.w && view.day === nx.di) {
    main.appendChild(el("div", "banner", "Block finished. Well done. Clear your logged sets under Backup > More options to start a new block, after saving a backup."));
  } else if (!nx.finished && (nx.w !== w || nx.di !== view.day)) {
    var jump = el("button", "jump", "Up next: " + state.plan[nx.di].name + ", " + WEEKS[nx.w] + " \u2192"); jump.type = "button";
    jump.onclick = function () { view.week = nx.w; view.day = nx.di; renderWeeks(); renderTabs(); renderMain(); window.scrollTo(0, 0); };
    main.appendChild(jump);
  }
  if (!d.ex.length) {
    main.appendChild(el("div", "banner", "No exercises in this session yet. Tap Edit to add some."));
    updateProgress();
    return;
  }
  if (w === DELOAD) main.appendChild(el("div", "banner", "Deload week: about 60% of Wk 6 weight and half the sets. Grey numbers are suggestions."));
  if (view.focus && d.ex.length) {
    var key = w + "|" + view.day;
    if (view.fiKey !== key || view.fi == null) { view.fiKey = key; view.fi = firstUnfinished(w, d.ex); }
    var N = d.ex.length, fi = Math.max(0, Math.min(view.fi, N));
    view.fi = fi;
    var nav = el("div", "fnav");
    var pb = el("button", "wbtn", "\u2039"); pb.type = "button"; pb.disabled = fi === 0; pb.setAttribute("aria-label", "Previous exercise");
    var nb = el("button", "wbtn", "\u203A"); nb.type = "button"; nb.disabled = fi >= N; nb.setAttribute("aria-label", "Next exercise");
    pb.onclick = function () { view.fi = fi - 1; renderMain(); window.scrollTo(0, 0); };
    nb.onclick = function () { view.fi = fi + 1; renderMain(); window.scrollTo(0, 0); };
    var dots = el("div", "fdots");
    d.ex.forEach(function (ex, i) {
      var n = setCount(w, ex), p = peek(w, ex.id) || [], done = true;
      for (var k = 0; k < n; k++) if (!p[k] || !p[k][2]) done = false;
      var dot = el("button", "fdot" + (i === fi ? " cur" : "") + (done ? " done" : "")); dot.type = "button";
      dot.setAttribute("aria-label", "Go to " + ex.name);
      dot.onclick = function () { view.fi = i; renderMain(); window.scrollTo(0, 0); };
      dots.appendChild(dot);
    });
    var mid = el("div", "fmid"); mid.appendChild(el("span", "fpos", fi < N ? "Exercise " + (fi + 1) + " of " + N : "Finish")); mid.appendChild(dots);
    nav.appendChild(pb); nav.appendChild(mid); nav.appendChild(nb);
    main.appendChild(nav);
    if (fi < N) {
      main.appendChild(exCard(d.ex[fi], w));
      main.appendChild(el("div", "nextup", fi + 1 < N ? "Next: " + d.ex[fi + 1].name : "Last exercise. Then rate your back."));
    } else {
      main.appendChild(el("div", "banner", "Session done. Rate your back below, then take a break."));
      main.appendChild(painRow(w, d));
    }
    updateProgress();
    return;
  }
  d.ex.forEach(function (ex) { main.appendChild(exCard(ex, w)); });
  main.appendChild(painRow(w, d));
  updateProgress();
}

function exCard(ex, w) {
  var n = setCount(w, ex), data = sets(w, ex.id, n), planned = targetSets(w, ex);
  var card = el("section", "ex"), eh = el("div", "ex-head");
  eh.appendChild(el("h3", null, ex.name));
  var tg = el("div", "target", n + " × " + ex.reps); tg.appendChild(el("small", null, (n !== planned ? "planned " + planned + " \u00B7 " : "") + "rest " + ex.rest));
  eh.appendChild(tg); card.appendChild(eh);
  if (ex.note) card.appendChild(el("div", "exnote", ex.note));
  var meta = el("div", "meta");
  meta.appendChild(el("div", "ref", isTimed(ex) ? holdRef(w, ex) : refLine(w, ex.id)));
  var cb = el("button", "chartbtn"); cb.type = "button";
  cb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20h18M5 16l5-5 4 3 6-7"/></svg>Progress';
  var open = !!openCharts[ex.id];
  cb.setAttribute("aria-expanded", open ? "true" : "false");
  var tools = el("div", "tools");
  var nbtn = el("button", "chartbtn notesbtn" + (ex.setup ? " has" : "")); nbtn.type = "button";
  nbtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>Notes';
  nbtn.setAttribute("aria-expanded", openNotes[ex.id] ? "true" : "false");
  tools.appendChild(nbtn);
  if (!isTimed(ex)) tools.appendChild(cb);
  meta.appendChild(tools);
  card.appendChild(meta);

  // Machine and setup notes: kept on the exercise, so they show every week.
  var notesHost = el("div");
  function paintNotes() {
    notesHost.textContent = "";
    nbtn.setAttribute("aria-expanded", openNotes[ex.id] ? "true" : "false");
    nbtn.classList.toggle("has", !!ex.setup);
    if (openNotes[ex.id]) {
      var box = el("div", "setupbox");
      var lb = el("label", "setuplab", "Machine and setup notes"); lb.htmlFor = "setup-" + ex.id;
      var ta = el("textarea"); ta.id = "setup-" + ex.id; ta.rows = 3; ta.value = ex.setup || "";
      ta.placeholder = "e.g. Seat 4, back pad 2, handles in the middle. Pin 7 is 45 kg.";
      ta.oninput = function () { ex.setup = ta.value; save(); nbtn.classList.toggle("has", !!ex.setup.trim()); };
      var done = el("button", "setupdone", "Done"); done.type = "button";
      done.onclick = function () { openNotes[ex.id] = false; paintNotes(); };
      box.appendChild(lb); box.appendChild(ta); box.appendChild(done);
      notesHost.appendChild(box);
    } else if (ex.setup && ex.setup.trim()) {
      var pv = el("button", "setupnote"); pv.type = "button";
      pv.setAttribute("aria-label", "Edit setup notes: " + ex.setup);
      pv.appendChild(el("span", "setupico", "Setup"));
      pv.appendChild(el("span", "setuptxt", ex.setup.trim()));
      pv.onclick = function () { openNotes[ex.id] = true; paintNotes(); };
      notesHost.appendChild(pv);
    }
  }
  nbtn.onclick = function () {
    openNotes[ex.id] = !openNotes[ex.id]; paintNotes();
    if (openNotes[ex.id]) { var t = notesHost.querySelector("textarea"); if (t) t.focus(); }
  };
  paintNotes();
  card.appendChild(notesHost);
  var chartHost = el("div"); chartHost.hidden = !open;
  if (open) chartHost.appendChild(chartBlock(ex));
  cb.onclick = function () {
    openCharts[ex.id] = !openCharts[ex.id];
    cb.setAttribute("aria-expanded", openCharts[ex.id] ? "true" : "false");
    chartHost.textContent = "";
    if (openCharts[ex.id]) chartHost.appendChild(chartBlock(ex));
    chartHost.hidden = !openCharts[ex.id];
  };
  card.appendChild(chartHost);
  function refreshChart() { if (openCharts[ex.id]) { chartHost.textContent = ""; chartHost.appendChild(chartBlock(ex)); } }
  var prog = progression(w, ex);
  if (prog) {
    card.appendChild(el("div", "hintline" + (prog.up ? "" : " hold"), prog.up
      ? "Add weight: you hit " + prog.top + " reps on every set at " + prog.from + " kg. Try " + prog.kg + " kg."
      : "Stay at " + prog.kg + " kg and aim for " + prog.top + " reps on every set."));
  }
  var last = lastLogged(w, ex.id);
  if (last) {
    var empty = data.slice(0, n).some(function (x) { return x[0] === "" && x[1] === ""; });
    var rb = el("button", "repeatbtn", "Same as last time (" + WEEKS[last.w] + (w === DELOAD ? ", at 60%" : "") + ")"); rb.type = "button";
    rb.disabled = !empty;
    if (!empty) rb.textContent = "All sets filled";
    rb.onclick = function () {
      for (var i = 0; i < n; i++) {
        var src = last.sets[i] && (last.sets[i][0] !== "" || last.sets[i][1] !== "") ? last.sets[i] : last.lastFilled;
        if (!src) continue;
        if (data[i][0] === "" && src[0] !== "") {
          var k = num(src[0]);
          data[i][0] = w === DELOAD && k != null ? fmt(Math.round(k * 0.6 / 2.5) * 2.5) : src[0];
        }
        if (data[i][1] === "" && src[1] !== "") data[i][1] = src[1];
      }
      save(); card.replaceWith(exCard(ex, w));
    };
    card.appendChild(rb);
  }
  var timed = isTimed(ex);
  var gh = el("div", "grid-head" + (timed ? " timed" : "")); (timed ? ["", "seconds", "hold", ""] : ["", "kg", "reps", ""]).forEach(function (t) { gh.appendChild(el("span", null, t)); });
  card.appendChild(gh);
  for (var s = 0; s < n; s++) (function (s) {
    var row = el("div", "set" + (timed ? " timed" : "") + (data[s][2] ? " done" : "")), pv = prevSet(w, ex.id, s);
    row.appendChild(el("span", "setn", String(s + 1)));
    var kg = el("input"); kg.type = "text"; kg.inputMode = "decimal"; kg.autocomplete = "off";
    kg.setAttribute("aria-label", ex.name + " set " + (s + 1) + " kg");
    kg.placeholder = prog ? prog.kg : (pv && pv.kg !== "" ? pv.kg : "kg"); kg.value = data[s][0];
    var rp = el("input"); rp.type = "text"; rp.inputMode = "numeric"; rp.autocomplete = "off";
    rp.setAttribute("aria-label", ex.name + " set " + (s + 1) + " reps");
    rp.placeholder = prog && prog.up ? (lowReps(ex.reps) || "reps") : (pv && pv.reps !== "" ? pv.reps : (lowReps(ex.reps) || "reps")); rp.value = data[s][1];
    var tk = el("button", "tick"); tk.type = "button"; tk.innerHTML = TICK;
    tk.setAttribute("aria-label", "Mark set " + (s + 1) + " done"); tk.setAttribute("aria-pressed", data[s][2] ? "true" : "false");
    kg.oninput = function () { data[s][0] = kg.value.replace(",", ".").trim(); save(); refreshChart(); };
    rp.oninput = function () { data[s][1] = rp.value.trim(); save(); refreshChart(); };
    function markDone(on) {
      if (on) {
        if (!kg.value && !isNaN(parseFloat(kg.placeholder))) { kg.value = kg.placeholder; data[s][0] = kg.value; }
        if (!rp.value && !isNaN(parseFloat(rp.placeholder))) { rp.value = rp.placeholder; data[s][1] = rp.value; }
      }
      data[s][2] = on ? 1 : 0;
      if (on) {
        state.sessions[w + "|" + dayKeyOf(ex)] = Date.now();
        var dk = stamp(), dl = state.days[dk] || (state.days[dk] = []);
        if (dl.indexOf(dayKeyOf(ex)) < 0) dl.push(dayKeyOf(ex));
        renderTabs();
      }
      row.classList.toggle("done", on); tk.setAttribute("aria-pressed", on ? "true" : "false");
      save(); updateProgress(); refreshChart();
      if (on) { unlockAudio(); startRest(restSecs(ex.rest)); afterSetDone(ex, w); }
    }
    tk.onclick = function () { markDone(!data[s][2]); };
    if (timed) {
      var hb = el("button", "holdbtn"); hb.type = "button";
      hb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
      hb.setAttribute("aria-label", "Start hold timer for set " + (s + 1));
      hb.onclick = function () {
        var secs = num(rp.value) || num(rp.placeholder) || 30, sides = /side/i.test(ex.reps);
        if (!rp.value) { rp.value = fmt(secs); data[s][1] = rp.value; save(); }
        var phases = [{ label: "Get ready", secs: 5 }, { label: sides ? "Hold: first side" : "Hold", secs: secs }];
        if (sides) phases.push({ label: "Switch sides", secs: 5 }, { label: "Hold: second side", secs: secs });
        startHold(phases, function () { if (!data[s][2]) markDone(true); });
      };
      row.appendChild(stepper(rp, 5, 5, "seconds")); row.appendChild(hb);
    } else {
      row.appendChild(stepper(kg, inc(ex), 0, "kg")); row.appendChild(stepper(rp, 1, 0, "reps"));
    }
    row.appendChild(tk); card.appendChild(row);
  })(s);

  // Add or remove a set for this session only.
  var adj = el("div", "setadj");
  var minus = el("button", "adjbtn", "\u2212 Set"); minus.type = "button"; minus.disabled = n <= 1;
  minus.setAttribute("aria-label", "Remove last set of " + ex.name);
  var plus = el("button", "adjbtn", "+ Set"); plus.type = "button"; plus.disabled = n >= 12;
  plus.setAttribute("aria-label", "Add a set to " + ex.name);
  function setN(v) {
    if (!state.setCounts) state.setCounts = {};
    var k = w + "|" + ex.id;
    if (v === planned) delete state.setCounts[k]; else state.setCounts[k] = v;
    if (data.length > v) data.length = v;
    save(); card.replaceWith(exCard(ex, w)); updateProgress();
  }
  plus.onclick = function () { setN(n + 1); };
  minus.onclick = function () {
    var lastSet = data[n - 1], hasData = lastSet && (lastSet[0] !== "" || lastSet[1] !== "" || lastSet[2]);
    if (hasData && !minus.classList.contains("confirm")) {
      minus.classList.add("confirm"); minus.textContent = "Remove set " + n + "?";
      setTimeout(function () { if (minus.isConnected) { minus.classList.remove("confirm"); minus.textContent = "\u2212 Set"; } }, 3000);
      return;
    }
    setN(n - 1);
  };
  adj.appendChild(minus); adj.appendChild(plus);
  card.appendChild(adj);
  return card;
}

function field(label, value, cls, onchange, mode) {
  var lb = el("label", cls); lb.appendChild(document.createTextNode(label));
  var i = el("input"); i.type = "text"; i.value = value; i.autocomplete = "off"; if (mode) i.inputMode = mode;
  i.oninput = function () { onchange(i.value); save(); };
  lb.appendChild(i); return lb;
}

function renderEdit(main, d) {
  main.appendChild(el("div", "hint", "Changes apply to every week. Your logged sets stay with each exercise when you rename it. Add kg is how much the app suggests adding once you hit the top of the rep range on every set."));
  var dayCard = el("section", "ex"), ded = el("div", "ed");
  ded.appendChild(field("Session name", d.name, "", function (v) { d.name = v || "Day"; renderTabs(); }));
  ded.appendChild(field("Focus", d.focus, "", function (v) { d.focus = v; }));
  var dl = el("label"); dl.appendChild(document.createTextNode("Day"));
  var sel = document.createElement("select"); sel.style.cssText = "height:44px;border-radius:10px;border:1px solid var(--line);background:var(--field);color:var(--ink);font-size:16px;padding:0 8px";
  DAYS.forEach(function (n, i) { var o = el("option", null, n); o.value = i; if (i === d.day) o.selected = true; sel.appendChild(o); });
  sel.onchange = function () { d.day = +sel.value; save(); renderTabs(); };
  dl.appendChild(sel); ded.appendChild(dl);
  dayCard.appendChild(ded); main.appendChild(dayCard);

  d.ex.forEach(function (ex, i) {
    var card = el("section", "ex"), ed = el("div", "ed four");
    ed.appendChild(field("Exercise", ex.name, "full", function (v) { ex.name = v; }));
    ed.appendChild(field("Sets", String(ex.sets), "", function (v) { ex.sets = parseInt(v, 10) || 1; }, "numeric"));
    ed.appendChild(field("Reps", ex.reps, "", function (v) { ex.reps = v; }));
    ed.appendChild(field("Rest", ex.rest, "", function (v) { ex.rest = v; }));
    ed.appendChild(field("Add kg", String(inc(ex)), "", function (v) { ex.inc = parseFloat(v.replace(",", ".")) || 2.5; }, "decimal"));
    ed.appendChild(field("Form note", ex.note || "", "full", function (v) { ex.note = v; }));
    card.appendChild(ed);
    var act = el("div", "ed-actions");
    var up = el("button", null, "Move up"); up.type = "button"; up.disabled = i === 0;
    up.onclick = function () { d.ex.splice(i - 1, 0, d.ex.splice(i, 1)[0]); save(); renderMain(); };
    var dn = el("button", null, "Move down"); dn.type = "button"; dn.disabled = i === d.ex.length - 1;
    dn.onclick = function () { d.ex.splice(i + 1, 0, d.ex.splice(i, 1)[0]); save(); renderMain(); };
    var del = el("button", "del", "Remove"); del.type = "button";
    del.onclick = function () {
      if (!del.classList.contains("confirm")) { del.classList.add("confirm"); del.textContent = "Tap to confirm"; return; }
      d.ex.splice(i, 1); save(); renderMain();
    };
    act.appendChild(up); act.appendChild(dn); act.appendChild(del); card.appendChild(act);
    main.appendChild(card);
  });
  var add = el("button", "add", "+ Add exercise"); add.type = "button";
  add.onclick = function () { d.ex.push({ id: uid(), name: "New exercise", sets: 3, reps: "8-12", rest: "90s" }); save(); renderMain(); };
  main.appendChild(add);

  // Sessions: add another, or remove this one. Logged sets are kept either way.
  var sess = el("div", "ed-actions sessacts");
  var addS = el("button", null, "+ Add session"); addS.type = "button"; addS.disabled = state.plan.length >= Logic.MAX_SESSIONS;
  addS.onclick = function () {
    var n = state.plan.length + 1;
    state.plan.push({ key: "s" + uid(), name: "Day " + n, day: (d.day + 1) % 7, focus: "", ex: [] });
    view.day = state.plan.length - 1; save(); renderTabs(); renderMain(); window.scrollTo(0, 0);
  };
  var rmS = el("button", "del", "Remove this session"); rmS.type = "button"; rmS.disabled = state.plan.length <= 1;
  rmS.onclick = function () {
    if (!rmS.classList.contains("confirm")) { rmS.classList.add("confirm"); rmS.textContent = "Tap again to remove " + d.name; return; }
    state.plan.splice(view.day, 1); view.day = Math.max(0, view.day - 1); view.fi = null;
    save(); renderTabs(); renderMain(); window.scrollTo(0, 0);
  };
  sess.appendChild(addS); sess.appendChild(rmS); main.appendChild(sess);
}
