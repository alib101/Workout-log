/* Split Log: the plan picker. Shown on first open (nothing saved yet) or from Backup > More options > Change plan. */
"use strict";

var setupPick = null, setupSessions = 3;

function renderSetup(main) {
  var intro = el("section", "setup-intro");
  intro.appendChild(el("h2", null, view.changing ? "Change your plan" : "Choose a plan"));
  intro.appendChild(el("p", null, view.changing
    ? "Your logged sets are kept. Exercises with the same ID in the new plan pick up their history; anything else starts fresh."
    : "Pick a starting point. You can rename, add, remove and reorder exercises at any time with Edit. Everything you log stays on this phone."));
  main.appendChild(intro);

  Logic.TEMPLATE_ORDER.forEach(function (id) {
    var t = Logic.TEMPLATES[id], picked = setupPick === id;
    var card = el("button", "tpl" + (picked ? " picked" : "")); card.type = "button";
    card.setAttribute("aria-pressed", picked ? "true" : "false");
    var top = el("div", "tpl-top");
    top.appendChild(el("span", "tpl-title", t.title));
    top.appendChild(el("span", "tpl-count", t.custom ? "You choose" : t.days.length + " sessions"));
    card.appendChild(top);
    card.appendChild(el("p", "tpl-blurb", t.blurb));
    if (!t.custom) card.appendChild(el("p", "tpl-days", t.days.map(function (d) { return d.name; }).join(" · ")));
    card.onclick = function () { setupPick = id; renderMain(); };
    main.appendChild(card);

    if (!picked) return;
    // Details for the chosen template, then the start button.
    var detail = el("section", "tpl-detail");
    if (t.custom) {
      detail.appendChild(el("p", "tpl-q", "How many sessions a week?"));
      var chips = el("div", "tpl-chips");
      for (var n = 2; n <= 6; n++) (function (n) {
        var c = el("button", "chip", String(n)); c.type = "button";
        c.setAttribute("aria-pressed", setupSessions === n ? "true" : "false");
        c.onclick = function () { setupSessions = n; renderMain(); };
        chips.appendChild(c);
      })(n);
      detail.appendChild(chips);
      detail.appendChild(el("p", "tpl-note", "You'll get empty sessions called Day 1, Day 2 and so on. Add exercises with Edit."));
    } else {
      t.days.forEach(function (d) {
        var box = el("details", "tpl-day");
        box.appendChild(el("summary", null, d.name + (d.focus ? ": " + d.focus : "")));
        var ul = el("ul");
        d.ex.forEach(function (e) { ul.appendChild(el("li", null, e[0] + "  " + e[1] + " × " + e[2])); });
        box.appendChild(ul); detail.appendChild(box);
      });
    }
    var go = el("button", "tpl-go", t.custom ? "Start with " + setupSessions + " empty sessions" : "Start with this plan"); go.type = "button";
    go.onclick = function () { applyPlan(id); };
    detail.appendChild(go);
    main.appendChild(detail);
  });

  var foot = el("div", "setup-foot");
  if (view.changing) {
    var cancel = el("button", "jump", "Keep my current plan"); cancel.type = "button";
    cancel.onclick = function () { view.setup = false; view.changing = false; setupPick = null; renderWeeks(); renderTabs(); renderMain(); };
    foot.appendChild(cancel);
  } else {
    foot.appendChild(el("p", null, "Moving from another phone?"));
    var restore = el("button", "jump", "Restore a backup file"); restore.type = "button";
    restore.onclick = function () { $("menu").hidden = false; $("menuBtn").setAttribute("aria-expanded", "true"); $("openFileBtn").click(); };
    foot.appendChild(restore);
  }
  main.appendChild(foot);
}

function applyPlan(id) {
  var plan = Logic.buildPlan(id, { sessions: setupSessions });
  if (view.changing) {
    state.plan = plan; state.planVersion = PLAN_VERSION;
  } else {
    state = blankState(plan);
  }
  save();
  view.setup = false; view.changing = false; setupPick = null; view.fi = null;
  view.week = 0; view.day = 0; view.section = "train";
  if (Logic.TEMPLATES[id].custom) view.edit = true;
  var nx = upNext(); view.week = nx.w; view.day = Math.min(nx.di, state.plan.length - 1);
  renderWeeks(); renderTabs(); renderMain(); window.scrollTo(0, 0);
}
