/* Split Log: the Progress screen. */
"use strict";

// ---------- Progress section ----------
function counted(x) { return x && (x[2] || (num(x[0]) != null && num(x[1]) != null)); }
function weekTotals(w) {
  var t = { sessions: 0, sets: 0, vol: 0, muscles: {} };
  state.plan.forEach(function (d) {
    var any = false;
    d.ex.forEach(function (ex) {
      var n = setCount(w, ex), p = peek(w, ex.id), m = muscleOf(ex.name);
      (p || []).slice(0, n).forEach(function (x) {
        if (!counted(x)) return;
        any = true; t.sets++;
        if (m) t.muscles[m] = (t.muscles[m] || 0) + 1;
        var kg = num(x[0]), r = num(x[1]);
        if (kg != null && r != null) t.vol += kg * r;
      });
    });
    if (any) t.sessions++;
  });
  return t;
}
function bestSets() {
  var out = [];
  state.plan.forEach(function (d) {
    d.ex.forEach(function (ex) {
      var best = null, firstW = null;
      WEEKS.forEach(function (_, w) {
        (peek(w, ex.id) || []).forEach(function (x) {
          var kg = num(x[0]), r = num(x[1]);
          if (kg == null || r == null || r <= 0) return;
          if (firstW == null) firstW = w;
          if (!best || kg > best.kg || (kg === best.kg && r > best.r)) best = { kg: kg, r: r, w: w };
        });
      });
      out.push({ ex: ex, day: d, best: best, isNew: !!best && best.w > firstW });
    });
  });
  return out;
}
function delta(now, before, unit) {
  if (!before) return "";
  var d = now - before;
  if (Math.abs(d) < 0.5) return "Same as last week";
  return (d > 0 ? "▲ " : "▼ ") + (unit === "%" ? Math.round(Math.abs(d) / before * 100) + "%" : niceLabel(Math.abs(d))) + " vs " + WEEKS[view.pweek - 1];
}
function pcard(title, sub) {
  var c = el("section", "pcard"), h = el("div", "phead");
  h.appendChild(el("h3", null, title)); if (sub) h.appendChild(el("span", "psub", sub));
  c.appendChild(h); return c;
}

function renderProgress(main) {
  if (view.pweek == null) {
    var nx = upNext(), latest = 0;
    WEEKS.forEach(function (_, w) { if (weekTotals(w).sets) latest = w; });
    view.pweek = Math.min(nx.w, Math.max(latest, 0));
    if (!weekTotals(view.pweek).sets && view.pweek > 0) view.pweek--;
  }
  var w = view.pweek, t = weekTotals(w), prev = w > 0 ? weekTotals(w - 1) : null;

  // Week picker
  var pick = el("div", "wpick");
  var back = el("button", "wbtn", "‹"); back.type = "button"; back.disabled = w === 0; back.setAttribute("aria-label", "Previous week");
  var fwd = el("button", "wbtn", "›"); fwd.type = "button"; fwd.disabled = w === WEEKS.length - 1; fwd.setAttribute("aria-label", "Next week");
  back.onclick = function () { view.pweek--; renderMain(); };
  fwd.onclick = function () { view.pweek++; renderMain(); };
  pick.appendChild(back); pick.appendChild(el("h2", null, w === DELOAD ? "Deload week" : "Week " + (w + 1))); pick.appendChild(fwd);
  main.appendChild(pick);

  // Summary tiles
  var sum = el("div", "tiles");
  [["Sessions", t.sessions + " / " + state.plan.length, prev ? (t.sessions === prev.sessions ? "Same as last week" : (t.sessions > prev.sessions ? "▲ " : "▼ ") + Math.abs(t.sessions - prev.sessions) + " vs " + WEEKS[w - 1]) : ""],
   ["Sets", String(t.sets), prev ? delta(t.sets, prev.sets) : ""],
   ["Volume", niceLabel(t.vol) + "|kg", prev ? delta(t.vol, prev.vol, "%") : ""]].forEach(function (x) {
    var tile = el("div", "tile"); tile.appendChild(el("span", "tlab", x[0]));
    var tv = el("span", "tval", x[1].split("|")[0]); if (x[1].indexOf("|") > 0) tv.appendChild(el("small", null, x[1].split("|")[1])); tile.appendChild(tv);
    tile.appendChild(el("span", "tdel", x[2] || (w === 0 ? "First week" : "Nothing logged " + WEEKS[w - 1])));
    sum.appendChild(tile);
  });
  main.appendChild(sum);
  if (!t.sets) main.appendChild(el("div", "banner", "Nothing logged for " + (w === DELOAD ? "the deload week" : "week " + (w + 1)) + " yet. Tick sets on the Train screen and they'll show here."));

  // Sets per muscle group
  var mc = pcard("Sets per muscle group", "This week");
  var max = 20; MUSCLES.forEach(function (m) { max = Math.max(max, t.muscles[m] || 0, prev ? prev.muscles[m] || 0 : 0); });
  var list = el("div", "mlist");
  MUSCLES.forEach(function (m) {
    var v = t.muscles[m] || 0, pv = prev ? prev.muscles[m] || 0 : null;
    var row = el("div", "mrow");
    row.appendChild(el("span", "mname", m));
    var track = el("div", "mtrack");
    if (m !== "Core") { var band = el("span", "mband"); band.style.left = (10 / max * 100) + "%"; band.style.width = (10 / max * 100) + "%"; track.appendChild(band); }
    var bar = el("span", "mbar"); bar.style.width = (v / max * 100) + "%"; if (!v) bar.hidden = true; track.appendChild(bar);
    if (pv != null && pv > 0) { var tick = el("span", "mprev"); tick.style.left = "calc(" + (pv / max * 100) + "% - 1px)"; track.appendChild(tick); }
    track.title = m + ": " + v + " sets" + (pv != null ? " (" + WEEKS[w - 1] + ": " + pv + ")" : "");
    row.appendChild(track);
    row.appendChild(el("span", "mval", String(v)));
    list.appendChild(row);
  });
  mc.appendChild(list);
  var key = el("div", "mkey");
  key.innerHTML = '<span><i class="k-band"></i>10–20 sets a week: a common target for muscle growth</span>' + (prev ? '<span><i class="k-prev"></i>' + WEEKS[w - 1] + '</span>' : '');
  mc.appendChild(key);
  main.appendChild(mc);

  // Personal bests
  var bc = pcard("Personal bests", "Heaviest set per exercise");
  var bests = bestSets(), shown = 0, curDay = null;
  bests.forEach(function (b) {
    if (!b.best) return;
    if (curDay !== b.day.key) { curDay = b.day.key; bc.appendChild(el("div", "bday", b.day.name)); }
    shown++;
    var row = el("button", "brow"); row.type = "button"; row.setAttribute("aria-expanded", "false");
    row.appendChild(el("span", "bname", b.ex.name));
    var r = el("span", "bval", fmt(b.best.kg) + " kg × " + fmt(b.best.r));
    r.appendChild(el("small", null, WEEKS[b.best.w] + (b.isNew && b.best.w === w ? " · new" : "")));
    row.appendChild(r);
    var host = el("div"); host.hidden = true;
    row.onclick = function () {
      var open = host.hidden; host.hidden = !open; row.setAttribute("aria-expanded", String(open));
      host.textContent = ""; if (open) host.appendChild(chartBlock(b.ex));
    };
    bc.appendChild(row); bc.appendChild(host);
  });
  var missing = bests.length - shown;
  if (!shown) bc.appendChild(el("p", "pnote", "Your best sets will appear here once you log weights and reps."));
  else if (missing) bc.appendChild(el("p", "pnote", missing + " exercise" + (missing === 1 ? " hasn't" : "s haven't") + " been logged yet. Tap an exercise to see its chart."));
  else bc.appendChild(el("p", "pnote", "Tap an exercise to see its chart."));
  main.appendChild(bc);

  // Training calendar
  var cc = pcard("Training days", "Last 10 weeks");
  var grid = el("div", "cal"), today = new Date(); today.setHours(0, 0, 0, 0);
  ["M", "T", "W", "T", "F", "S", "S"].forEach(function (d) { grid.appendChild(el("span", "cday", d)); });
  var dow = (today.getDay() + 6) % 7, start = new Date(today); start.setDate(start.getDate() - dow - 63);
  var trained = 0, last28 = 0;
  for (var i = 0; i < 70; i++) {
    var d = new Date(start); d.setDate(start.getDate() + i);
    var k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    var got = state.days[k], cell = el("span", "cell" + (got ? " on" : "") + (d.getTime() === today.getTime() ? " today" : "") + (d > today ? " future" : ""));
    cell.title = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) + (got ? ": " + got.map(function (key) { var nm = key; state.plan.forEach(function (p) { if (p.key === key) nm = p.name; }); return nm; }).join(", ") : "");
    if (got) { trained++; if ((today - d) / 864e5 < 28) last28++; }
    grid.appendChild(cell);
  }
  cc.appendChild(grid);
  cc.appendChild(el("p", "pnote", Object.keys(state.days).length
    ? last28 + " training day" + (last28 === 1 ? "" : "s") + " in the last 4 weeks. Tap a day to see what you trained."
    : "Dates are recorded from now on, so this fills in as you tick sets."));
  grid.addEventListener("click", function (e) { if (e.target.classList.contains("cell")) { var n = cc.querySelector(".pnote"); n.textContent = e.target.title || n.textContent; } });
  main.appendChild(cc);
}
