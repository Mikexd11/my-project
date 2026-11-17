# my-project

A calm habit tracker that runs in the browser. Check off habits each day, count up to goals like glasses of water, write a short note about the day, and watch your history as threads: unbroken runs of a habit join into one continuous line.

## Features

- **Daily list:** habits planned for the selected day, with a check button or a counter (for example 2 of 8 glasses).
- **Schedules:** every day, weekdays, or any set of days. A habit isn't counted on days it isn't planned.
- **Runs:** each habit shows its current run of completed planned days. An unfinished habit today doesn't break the run until the day is over.
- **Five-week threads:** a grid of the last five weeks. Click any past day to mark it.
- **Day notes:** a note for each day, saved as you type.
- **Areas:** group habits (Fitness, Tigrinya, School-ICT…) and filter by area.
- **Export and import:** back up your data as JSON.
- **Keyboard shortcuts:** `←` / `→` change the day, `T` jumps to today, `N` adds a new habit.

All data is stored in your browser's `localStorage`. Nothing is sent to a server.

## Run it

It's a static site with no build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

To publish it, turn on **GitHub Pages** in the repository settings (Settings → Pages → deploy from the `main` branch, root folder).

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page structure and the habit dialog |
| `styles.css` | Design tokens, layout and responsive styles |
| `app.js` | Data, run and rate calculations, rendering, storage |
