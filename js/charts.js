/* Split Log: per-exercise progress chart. */
"use strict";

// Per-week figures for the progress chart.
var MODES = {
  top: { label: "Top weight", unit: "kg", about: "The heaviest weight you lifted each week." },
  e1rm: { label: "Est. 1RM", unit: "kg", about: "An estimate of the most you could lift for one rep, from your best set: weight × (1 + reps ÷ 30). It's always higher than the weight you actually lifted." },
  vol: { label: "Volume", unit: "kg", about: "Total weight moved: weight × reps, added up across every set." }
};
var chartMode = "top";
try { var cm = localStorage.getItem("split-log-chartmode"); if (MODES[cm]) chartMode = cm; } catch (e) {}

function weekStats(id) { return Logic.weekStats(state.log, id); }


function chartSvg(stats, key) {
  var W = 320, H = 150, L = 38, R = 14, T = 18, B = 22;
  var pts = [];
  stats.forEach(function (s, w) { if (s[key] != null) pts.push({ w: w, v: s[key] }); });
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + MODES[key].label + ' by week">';
  var xs = function (w) { return L + (W - L - R) * w / (WEEKS.length - 1); };
  if (!pts.length) {
    svg += '<text class="empty" x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle">Log a set with weight and reps to start the chart</text>';
  } else {
    var vals = pts.map(function (p) { return p.v; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var range = hi - lo || Math.max(hi * 0.1, 1);
    lo = Math.max(0, lo - range * 0.25); hi = hi + range * 0.25;
    var u = Math.pow(10, Math.floor(Math.log10(hi - lo)));
    if ((hi - lo) / u < 3) u /= 2;
    lo = Math.floor(lo / u) * u; hi = Math.ceil(hi / u) * u; if (hi === lo) hi = lo + u;
    var ys = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
    [lo, (lo + hi) / 2, hi].forEach(function (g) {
      var y = ys(g).toFixed(1);
      svg += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/>';
      svg += '<text class="ax" x="' + (L - 6) + '" y="' + (+y + 3) + '" text-anchor="end">' + niceLabel(g) + '</text>';
    });
    if (pts.length > 1) {
      var d = pts.map(function (p, i) { return (i ? "L" : "M") + xs(p.w).toFixed(1) + " " + ys(p.v).toFixed(1); }).join(" ");
      svg += '<path class="area" d="' + d + ' L' + xs(pts[pts.length - 1].w).toFixed(1) + ' ' + (H - B) + ' L' + xs(pts[0].w).toFixed(1) + ' ' + (H - B) + ' Z"/>';
      svg += '<path class="line" d="' + d + '"/>';
    }
    pts.forEach(function (p, i) {
      var x = xs(p.w).toFixed(1), y = ys(p.v).toFixed(1), last = i === pts.length - 1;
      svg += '<circle class="dot' + (last ? ' last' : '') + '" cx="' + x + '" cy="' + y + '" r="4"/>';
      svg += '<text class="val" x="' + x + '" y="' + (y - 9) + '" text-anchor="middle">' + niceLabel(p.v) + '</text>';
    });
  }
  WEEKS.forEach(function (lab, w) {
    svg += '<text class="ax" x="' + xs(w).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + (w === DELOAD ? "DL" : "W" + (w + 1)) + '</text>';
  });
  return svg + '</svg>';
}

function chartBlock(ex) {
  var stats = weekStats(ex.id), box = el("div", "chart");
  var seg = el("div", "seg"); seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "What the chart shows");
  Object.keys(MODES).forEach(function (k) {
    var b = el("button", null, MODES[k].label); b.type = "button";
    b.setAttribute("aria-pressed", k === chartMode ? "true" : "false");
    b.onclick = function () {
      chartMode = k; try { localStorage.setItem("split-log-chartmode", k); } catch (e) {}
      box.replaceWith(chartBlock(ex));
    };
    seg.appendChild(b);
  });
  box.appendChild(seg);
  var pic = el("div"); pic.innerHTML = chartSvg(stats, chartMode); box.appendChild(pic);

  var first = null, last = null, bestTop = null;
  stats.forEach(function (s, w) {
    if (s.top != null && (bestTop == null || s.top > bestTop.top || (s.top === bestTop.top && s.topReps > bestTop.topReps))) bestTop = s;
    if (w === DELOAD || s[chartMode] == null) return;
    if (first == null) first = s[chartMode]; last = s[chartMode];
  });
  var cap = el("div", "chart-cap");
  if (bestTop) { var h = el("span"); h.appendChild(document.createTextNode("Best set ")); h.appendChild(el("b", null, fmt(bestTop.top) + " kg × " + fmt(bestTop.topReps))); cap.appendChild(h); }
  if (first != null && last !== first) {
    var a = el("span"); a.appendChild(document.createTextNode("Since first week "));
    a.appendChild(el("b", null, (last >= first ? "+" : "−") + niceLabel(Math.abs(last - first)) + " kg")); cap.appendChild(a);
  }
  box.appendChild(cap);
  box.appendChild(el("div", "chart-about", MODES[chartMode].about));
  return box;
}
