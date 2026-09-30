/* Split Log: start-up, section switch and update handling. Loaded last. */
"use strict";

Array.prototype.forEach.call($("nav").children, function (b) {
  b.onclick = function () {
    view.section = b.dataset.s; view.edit = false;
    try { localStorage.setItem("split-log-section", view.section); } catch (e) {}
    renderMain(); window.scrollTo(0, 0);
  };
});
$("appVer").textContent = APP_VERSION;
load(); renderWeeks(); renderTabs(); renderMain(); paintBackup();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
// Check for a newer version on every open and reload once when one is installed.
if ("serviceWorker" in navigator) {
  var hadController = !!navigator.serviceWorker.controller, reloaded = false;
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(function (reg) {
    reg.update().catch(function () {});
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") reg.update().catch(function () {}); });
  }).catch(function () {});
  // A new version only reloads the app when you're not mid-rest or typing, so nothing in progress is interrupted.
  var wantReload = false;
  var busy = function () {
    var a = document.activeElement;
    return !$("timer").hidden || (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA"));
  };
  var tryReload = function () { if (wantReload && !reloaded && !busy()) { reloaded = true; location.reload(); } };
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (!hadController) return;
    wantReload = true; tryReload();
  });
  setInterval(tryReload, 5000);
}
