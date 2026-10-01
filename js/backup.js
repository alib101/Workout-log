/* Split Log: backup, restore and plan reset (the Backup menu). */
"use strict";

// backup menu
var msg = $("menuMsg"), LAST_KEY = "split-log-lastbackup", pendingRestore = null;
var loggedCount = Logic.loggedCount, parseBackup = Logic.parseBackup;
function lastBackup() { try { return +localStorage.getItem(LAST_KEY) || 0; } catch (e) { return 0; } }
function setLastBackup() { try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch (e) {} paintBackup(); }
function paintBackup() {
  var t = lastBackup(), days = t ? Math.floor((Date.now() - t) / 864e5) : null;
  $("lastBackup").textContent = t
    ? "Last backup: " + (days === 0 ? "today" : days === 1 ? "yesterday" : days + " days ago") + ". Your log is stored on this phone only."
    : "No backup saved yet. Your log is stored on this phone only.";
  $("dueDot").hidden = !(loggedCount(state) > 0 && (days == null || days >= 7));
}
function stamp() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
$("menuBtn").onclick = function () {
  var m = $("menu"); m.hidden = !m.hidden; this.setAttribute("aria-expanded", String(!m.hidden)); msg.textContent = ""; paintBackup();
};
$("saveFileBtn").onclick = function () {
  var name = "split-log-backup.json"; // same name every time, so saving to the same folder replaces the last one
  var body = JSON.stringify({ app: "five-day-split", savedAt: new Date().toISOString(), data: state });
  var file = null;
  try { file = new File([body], name, { type: "application/json" }); } catch (e) {}
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).then(function () {
      setLastBackup(); msg.textContent = "Backup saved as " + name + ". If Files asked, choosing Replace swaps out your previous backup.";
    }, function (err) {
      msg.textContent = err && err.name === "AbortError" ? "No backup saved. Tap Save backup file and choose Save to Files." : "Couldn't open the share sheet. Try again, or use Copy backup as text under More options.";
    });
    return;
  }
  try {
    var url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
    var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    setLastBackup(); msg.textContent = "Backup downloaded as " + name + ". On iPhone it goes to Downloads in the Files app.";
  } catch (e) { msg.textContent = "This browser can't save files. Use Copy backup as text under More options."; }
};
function askRestore(b) {
  pendingRestore = b.state;
  var when = b.savedAt && !isNaN(b.savedAt) ? "saved " + b.savedAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "with no date";
  $("confirmTxt").textContent = "Backup " + when + ", with " + (function (n) { return n === 1 ? "1 set" : n + " sets"; })(loggedCount(b.state)) + " logged. Restoring replaces everything on this phone, including your exercise list.";
  $("confirmBox").hidden = false; msg.textContent = "";
}
$("openFileBtn").onclick = function () { $("restoreFile").value = ""; $("restoreFile").click(); };
$("restoreFile").onchange = function () {
  var f = this.files && this.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try { askRestore(parseBackup(String(r.result))); }
    catch (e) { $("confirmBox").hidden = true; msg.textContent = "That file isn't a backup from this app. Pick the file named split-log-backup.json."; }
  };
  r.onerror = function () { msg.textContent = "Couldn't read that file. Try picking it again."; };
  r.readAsText(f);
};
$("confirmRestore").onclick = function () {
  if (!pendingRestore) return;
  state = pendingRestore; pendingRestore = null; save();
  view.setup = false; view.changing = false; view.fi = null;
  var nx = upNext(); view.week = nx.w; view.day = Math.min(nx.di, state.plan.length - 1);
  $("confirmBox").hidden = true; renderWeeks(); renderTabs(); renderMain(); paintBackup();
  msg.textContent = "Backup restored.";
};
$("cancelRestore").onclick = function () { pendingRestore = null; $("confirmBox").hidden = true; msg.textContent = "Nothing changed."; };
$("copyBtn").onclick = function () {
  var txt = JSON.stringify(state);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function () { setLastBackup(); msg.textContent = "Backup copied. Paste it into Notes."; },
      function () { $("restoreTxt").value = txt; $("restoreTxt").select(); msg.textContent = "Select all in the box and copy it."; });
  } else { $("restoreTxt").value = txt; $("restoreTxt").select(); msg.textContent = "Select all in the box and copy it."; }
};
$("restoreBtn").onclick = function () {
  try { askRestore(parseBackup($("restoreTxt").value)); $("restoreTxt").value = ""; }
  catch (e) { msg.textContent = "That text isn't a backup from this app. Paste the whole backup and try again."; }
};
$("resetBtn").onclick = function () {
  var b = this;
  if (!b.classList.contains("confirm")) { b.classList.add("confirm"); b.textContent = "Tap again to clear sets"; return; }
  state.log = {}; save(); b.classList.remove("confirm"); b.textContent = "Clear all logged sets";
  renderMain(); paintBackup(); msg.textContent = "Logged sets cleared. Your exercises are kept.";
};
$("changePlanBtn").onclick = function () {
  var b = this;
  if (!b.classList.contains("confirm")) { b.classList.add("confirm"); b.textContent = "Tap again to choose a new plan"; return; }
  b.classList.remove("confirm"); b.textContent = "Change plan";
  view.setup = true; view.changing = true; view.edit = false;
  $("menu").hidden = true; $("menuBtn").setAttribute("aria-expanded", "false");
  renderMain(); window.scrollTo(0, 0);
};
