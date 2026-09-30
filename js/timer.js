/* Split Log: rest timer, hold timer, sound and keeping the screen awake. */
"use strict";

// rest timer with end-of-rest alert
var SETTINGS_KEY = "split-log-settings", settings = { sound: true };
try { var st = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null"); if (st) settings.sound = st.sound !== false; } catch (e) {}
var actx = null, wake = null, endAt = 0, tick = null, warned = false;

// iOS only allows sound after a tap, so the audio is unlocked when a set is ticked.
function unlockAudio() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
  } catch (e) {}
}
function tone(at, freq, len, vol) {
  var o = actx.createOscillator(), g = actx.createGain();
  o.type = "sine"; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g); g.connect(actx.destination); o.start(at); o.stop(at + len + 0.02);
}
function beep(final) {
  if (!settings.sound || !actx) return;
  try {
    var t = actx.currentTime + 0.02;
    if (final) { tone(t, 880, 0.18, 0.5); tone(t + 0.25, 880, 0.18, 0.5); tone(t + 0.5, 1320, 0.35, 0.5); }
    else tone(t, 660, 0.12, 0.3);
  } catch (e) {}
}
function keepAwake() {
  if (wake || !("wakeLock" in navigator)) return;
  navigator.wakeLock.request("screen").then(function (l) { wake = l; l.addEventListener("release", function () { wake = null; }); }).catch(function () {});
}
function letSleep() { if (wake) { wake.release().catch(function () {}); wake = null; } }

var hold = null; // { phases: [{label, secs}], i, onDone, count }
function paint() {
  var left = endAt - Date.now(), s = Math.max(0, Math.ceil(left / 1000));
  $("timerT").textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  if (hold) {
    $("timer").classList.remove("over"); $("timer").classList.add("holding");
    $("timerLbl").textContent = hold.phases[hold.i].label;
    if (left > 0 && left <= 3000 && hold.count !== s) { hold.count = s; beep(false); }
    if (left <= 0) {
      hold.i++; hold.count = null;
      if (hold.i < hold.phases.length) { endAt = Date.now() + hold.phases[hold.i].secs * 1000; paint(); return; }
      var done = hold.onDone; hold = null; $("timer").classList.remove("holding");
      clearInterval(tick); tick = null; beep(true);
      if (done) done();
    }
    return;
  }
  if (!warned && left <= 10000 && left > 0) { warned = true; beep(false); }
  var over = left <= 0; $("timer").classList.toggle("over", over); $("timerLbl").textContent = over ? "Go" : "Rest";
  if (over && tick) {
    clearInterval(tick); tick = null; beep(true);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    setTimeout(letSleep, 60000);
  }
}
function startHold(phases, onDone) {
  unlockAudio(); hold = { phases: phases, i: 0, onDone: onDone, count: null };
  endAt = Date.now() + phases[0].secs * 1000; $("timer").hidden = false;
  if (tick) clearInterval(tick); tick = setInterval(paint, 250); paint(); keepAwake();
}
function startRest(sec) {
  hold = null; $("timer").classList.remove("holding");
  endAt = Date.now() + sec * 1000; warned = sec <= 10; $("timer").hidden = false;
  if (tick) clearInterval(tick); tick = setInterval(paint, 250); paint(); keepAwake();
}
$("plus15").onclick = function () {
  unlockAudio(); endAt = Math.max(endAt, Date.now()) + 15000;
  if (endAt - Date.now() > 10000) warned = false;
  if (!tick) tick = setInterval(paint, 250); paint(); keepAwake();
};
$("skip").onclick = function () { hold = null; $("timer").classList.remove("holding"); if (tick) clearInterval(tick); tick = null; $("timer").hidden = true; letSleep(); };
function paintSound() {
  var b = $("sndBtn");
  b.setAttribute("aria-pressed", settings.sound ? "true" : "false");
  b.innerHTML = settings.sound
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9l6 6M22 9l-6 6"/></svg>';
}
$("sndBtn").onclick = function () {
  settings.sound = !settings.sound; paintSound(); unlockAudio();
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
  if (settings.sound) beep(false);
};
paintSound();
// Coming back to the app mid-rest: catch the timer up and re-take the wake lock.
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible" && !$("timer").hidden) {
    if (tick || endAt > Date.now()) keepAwake();
    if (actx && actx.state === "suspended") actx.resume().catch(function () {});
    paint();
  }
});
