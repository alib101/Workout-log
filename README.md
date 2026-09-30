# Split Log

A simple workout logger that runs in your phone's browser. No account, no ads, no sign-up.

**Open it:** https://alib101.github.io/Workout-log/

## Getting started on iPhone

1. Open the link above in **Safari**. Not the Claude app, and not a link opened from inside another app.
2. Tap the **•••** button next to the address bar, then **Share**, then **Add to Home Screen**. On older iOS, tap the Share icon (the square with an arrow) and scroll down.
3. Open it from your Home Screen and choose a plan: five-day back-friendly, five-day free weights, four-day upper/lower, three-day full body, or build your own.

It works offline once it has been opened once.

## What it does

- Log weight and reps for each set, with last week's numbers shown as suggestions.
- Suggests when to add weight: once you hit the top of the rep range on every set.
- Rest timer with a beep, and a hold timer for planks and other timed exercises.
- Focus mode: one exercise at a time, moving on automatically.
- Progress screen: weekly summary, sets per muscle group, personal bests and a training calendar.
- Edit any exercise, add your own, and keep machine setup notes (seat height, pin numbers).

## Your data

Everything you log is stored **on your phone only**. Nobody else can see it, including whoever shared the link with you.
Clearing Safari's website data, or iOS clearing space for an app you haven't opened in a long time, deletes it. Tap **Backup → Save backup file** every week or so and save it to iCloud Drive. The app reminds you when one is due.

## For developers

Plain HTML, CSS and JavaScript, with no build step. GitHub Pages serves the files as they are.

| File | What's in it |
|---|---|
| `index.html` | Page layout |
| `css/app.css` | All styles (light and dark) |
| `js/logic.js` | Pure logic with no screen code: plan templates, progression, stats, up-next rotation, backup checks. Unit-tested. |
| `js/state.js` | Saved data, loading and saving, shared helpers |
| `js/train.js` | Train screen: session tabs, exercise cards, focus mode, editing |
| `js/charts.js` | Per-exercise progress chart |
| `js/progress.js` | Progress screen |
| `js/setup.js` | Plan picker (first run and "Change plan") |
| `js/timer.js` | Rest and hold timers, sound, keeping the screen awake |
| `js/backup.js` | Backup and restore |
| `js/main.js` | Start-up and update handling |
| `sw.js` | Offline support. **Bump `VERSION` here and `APP_VERSION` in `js/state.js` on every change** so phones pick up the update. |

Run the tests with `npm test` (Node 18 or newer; nothing to install).

Saved data lives in `localStorage` under `split-log-v2`. Keep that key and the existing exercise ids (e.g. `v2push0`) stable, or people's logs won't line up.
