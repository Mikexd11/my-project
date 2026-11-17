(() => {
  "use strict";

  /* ---------- Constants ---------- */
  const STORE_KEY = "habits.v1";
  const COLORS = [
    ["saffron", "#F2B33D"], ["coral", "#F2766B"], ["mint", "#5FD3A6"],
    ["sky", "#6BB7F2"], ["lilac", "#B69CF2"], ["rose", "#F28FC2"],
  ];
  const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DAY_LETTER = ["M", "T", "W", "T", "F", "S", "S"];
  const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const WEEKS_SHOWN = 5;

  /* ---------- Date helpers (local time, Monday-first) ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateOf = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
  const dow = (k) => (dateOf(k).getDay() + 6) % 7;
  const todayKey = () => keyOf(new Date());
  const weekStart = (k) => addDays(k, -dow(k));

  /* ---------- State ---------- */
  let data = load();
  const ui = { date: todayKey(), area: null, weekOffset: 0, editing: null };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.habits)) return { log: {}, notes: {}, ...parsed };
      }
    } catch (e) { /* storage unavailable: fall through to seed */ }
    return seed();
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (e) { toast("Couldn't save. Browser storage is full or blocked."); }
  }

  function seed() {
    const t = todayKey();
    const start = addDays(t, -70);
    const habits = [
      { id: uid(), name: "Water", area: "Fitness", color: "mint", kind: "count", target: 8, unit: "glasses", days: [0, 1, 2, 3, 4, 5, 6], created: start },
      { id: uid(), name: "Gym", area: "Fitness", color: "coral", kind: "check", days: [0, 2, 4], created: start },
      { id: uid(), name: "Tigrinya 15 min", area: "Tigrinya", color: "saffron", kind: "check", days: [0, 1, 2, 3, 4, 5, 6], created: start },
      { id: uid(), name: "Read before bed", area: "School-ICT", color: "lilac", kind: "check", days: [0, 1, 2, 3, 6], created: start },
    ];
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const log = {};
    for (let k = start; k < t; k = addDays(k, 1)) {
      const day = {};
      const recent = dateOf(t) - dateOf(k) <= 7 * 864e5;
      if (rnd() < 0.85) day[habits[0].id] = rnd() < 0.55 ? 8 : 3 + Math.floor(rnd() * 5);
      if (habits[1].days.includes(dow(k)) && rnd() < 0.78) day[habits[1].id] = 1;
      if (recent || rnd() < 0.82) day[habits[2].id] = 1;
      if (habits[3].days.includes(dow(k)) && rnd() < 0.6) day[habits[3].id] = 1;
      log[k] = day;
    }
    log[t] = { [habits[0].id]: 2, [habits[2].id]: 1 };
    return { habits, log, notes: {} };
  }

  function uid() { return Math.random().toString(36).slice(2, 10); }

  /* ---------- Habit logic ---------- */
  const colorHex = (name) => (COLORS.find((c) => c[0] === name) || COLORS[0])[1];
  const goal = (h) => (h.kind === "count" ? h.target : 1);
  const value = (h, k) => (data.log[k] && data.log[k][h.id]) || 0;
  const isDone = (h, k) => value(h, k) >= goal(h);
  const scheduled = (h, k) => k >= h.created && h.days.includes(dow(k));
  const visible = () => data.habits.filter((h) => !ui.area || h.area === ui.area);

  function setValue(h, k, v) {
    const clamped = Math.max(0, Math.min(v, goal(h)));
    data.log[k] = data.log[k] || {};
    if (clamped) data.log[k][h.id] = clamped; else delete data.log[k][h.id];
    if (!Object.keys(data.log[k]).length) delete data.log[k];
    save();
  }

  // Run of scheduled days completed, ending at k. Today's unfinished slot doesn't break it.
  function streak(h, k) {
    let d = k, n = 0, guard = 0;
    if (d === todayKey() && scheduled(h, d) && !isDone(h, d)) d = addDays(d, -1);
    while (d >= h.created && guard++ < 1000) {
      if (scheduled(h, d)) { if (isDone(h, d)) n++; else break; }
      d = addDays(d, -1);
    }
    return n;
  }

  function rate(habits, end, days) {
    let due = 0, done = 0;
    const t = todayKey();
    for (let i = 0; i < days; i++) {
      const k = addDays(end, -i);
      if (k > t) continue;
      for (const h of habits) {
        if (!scheduled(h, k)) continue;
        if (k === t && !isDone(h, k)) continue;
        due++; if (isDone(h, k)) done++;
      }
    }
    return due ? Math.round((done / due) * 100) : null;
  }

  function scheduleText(h) {
    const d = [...h.days].sort();
    if (d.length === 7) return "Every day";
    if (d.join() === "0,1,2,3,4") return "Weekdays";
    if (d.join() === "5,6") return "Weekends";
    return d.map((i) => DAY_SHORT[i]).join(", ");
  }

  /* ---------- DOM helpers ---------- */
  const $ = (s) => document.querySelector(s);
  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [a, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (a === "class") n.className = v;
      else if (a === "style") n.style.cssText = v;
      else if (a.startsWith("on")) n.addEventListener(a.slice(2), v);
      else if (a === "html") n.innerHTML = v;
      else n.setAttribute(a, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(k));
    return n;
  }
  const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  /* ---------- Render ---------- */
  function render() {
    renderHeader();
    renderAreas();
    renderSummary();
    renderList();
    renderNote();
    renderWeave();
  }

  function renderHeader() {
    const k = ui.date, t = todayKey(), d = dateOf(k);
    const rel = k === t ? "Today" : k === addDays(t, -1) ? "Yesterday" : null;
    $("#weekday").textContent = DAY_LONG[dow(k)];
    const full = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    $("#fullDate").innerHTML = "";
    $("#fullDate").append(rel ? `${rel}, ${full}` : full);
    if (!rel) $("#fullDate").append(" ", el("span", { class: "past" }, "Looking back"));
    $("#nextDay").disabled = k >= t;
    $("#todayBtn").disabled = k === t;
    document.title = `${rel || DAY_SHORT[dow(k)] + " " + d.getDate()} · Habits`;
  }

  function renderAreas() {
    const areas = new Map();
    for (const h of data.habits) {
      const a = h.area || "No area";
      if (!areas.has(a)) areas.set(a, []);
      areas.get(a).push(h);
    }
    const list = $("#areaList");
    list.innerHTML = "";
    const item = (label, val, habits) => el("li", {},
      el("button", {
        class: "area-btn", type: "button", "aria-pressed": String(ui.area === val),
        onclick: () => { ui.area = val; render(); },
      },
      el("span", { class: "area-dots", "aria-hidden": "true" },
        habits.slice(0, 4).map((h) => el("i", { style: `background:${colorHex(h.color)}` }))),
      label,
      el("span", { class: "count" }, String(habits.length))));
    list.append(item("All habits", null, data.habits));
    for (const [a, hs] of [...areas].sort((x, y) => x[0].localeCompare(y[0]))) list.append(item(a, a, hs));
    if (ui.area && !areas.has(ui.area)) { ui.area = null; }

    const dl = $("#areaOptions"); dl.innerHTML = "";
    for (const a of areas.keys()) if (a !== "No area") dl.append(el("option", { value: a }));
  }

  function renderSummary() {
    const k = ui.date, hs = visible();
    const due = hs.filter((h) => scheduled(h, k));
    const done = due.filter((h) => isDone(h, k));
    const isToday = k === todayKey();

    let best = null;
    for (const h of hs) { const s = streak(h, k); if (!best || s > best.s) best = { h, s }; }

    // One plain sentence about the day
    const s = $("#sentence"); s.innerHTML = "";
    if (!hs.length) {
      s.append("Nothing to track yet. Add a habit to start your first thread.");
    } else if (!due.length) {
      s.append(isToday ? "Nothing is planned for today. " : "Nothing was planned for this day. ",
        el("span", { class: "muted" }, "Rest counts too."));
    } else if (done.length === due.length) {
      s.append(`All ${due.length} done${isToday ? " today" : ""}. `,
        el("span", { class: "muted" }, best && best.s > 1 ? `${best.h.name} is on a ${best.s}-day run.` : "Every thread holds."));
    } else {
      const left = due.filter((h) => !isDone(h, k)).map((h) => h.name);
      const leftTxt = left.length === 1 ? left[0] : left.length === 2 ? `${left[0]} and ${left[1]}` : `${left.length} habits`;
      s.append(`${done.length} of ${due.length} done. `,
        el("span", { class: "muted" }, `${leftTxt} ${left.length === 1 ? "is" : "are"} still open${isToday ? "" : " for this day"}.`));
    }

    const r7 = rate(hs, k, 7), r30 = rate(hs, k, 30);
    const fig = (dd, dt) => el("div", {}, el("dt", {}, dt), el("dd", {}, ...dd));
    const f = $("#figures"); f.innerHTML = "";
    f.append(
      fig([String(done.length), el("small", {}, `/ ${due.length}`)], isToday ? "Done today" : "Done that day"),
      fig([best ? String(best.s) : "0", el("small", {}, best && best.s === 1 ? "day" : "days")], best && best.s ? `Longest run, ${best.h.name}` : "Longest run"),
      fig([r7 == null ? "–" : String(r7), el("small", {}, "%")], "Last 7 days"),
      fig([r30 == null ? "–" : String(r30), el("small", {}, "%")], "Last 30 days"),
    );
  }

  function habitRow(h, k, active) {
    const c = colorHex(h.color);
    const v = value(h, k), done = isDone(h, k), s = streak(h, k);
    const future = k > todayKey();
    let control;

    if (h.kind === "count") {
      const circ = 2 * Math.PI * 17;
      control = el("div", { class: `count-ring${done ? " full" : ""}`, "aria-hidden": "true" },
        el("span", {}, String(v)));
      control.insertAdjacentHTML("afterbegin",
        `<svg viewBox="0 0 40 40"><circle class="track" cx="20" cy="20" r="17"/><circle class="fill" cx="20" cy="20" r="17" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - v / h.target)}"/></svg>`);
    } else {
      control = el("button", {
        class: "check", type: "button", "aria-pressed": String(done), disabled: future,
        "aria-label": `${h.name}: ${done ? "done" : "not done"}`, html: CHECK_SVG,
        onclick: () => { setValue(h, k, done ? 0 : 1); render(); },
      });
    }

    const meta = el("div", { class: "habit-meta" },
      h.kind === "count" ? el("span", {}, `${v} of ${h.target} ${h.unit || ""}`.trim()) : null,
      el("span", {}, scheduleText(h)),
      h.area ? el("span", {}, h.area) : null,
      el("span", { class: `run${s ? "" : " zero"}` }, s ? `${s}-day run` : "No run yet"));

    const body = el("div", { class: "habit-body" },
      el("button", { class: "habit-name", type: "button", title: "Edit habit", onclick: () => openDialog(h) }, h.name),
      meta,
      h.kind === "count" ? el("div", { class: "pips", "aria-hidden": "true" },
        Array.from({ length: h.target }, (_, i) => el("i", { class: i < v ? "on" : null }))) : null);

    const right = h.kind === "count" ? el("div", { class: "counter" },
      el("button", { type: "button", "aria-label": `One fewer ${h.unit || ""}`.trim(), disabled: future || v <= 0, onclick: () => { setValue(h, k, v - 1); render(); } }, "−"),
      el("span", { class: "sr-only", style: "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)" }, `${v} of ${h.target} ${h.unit || ""}`),
      el("button", { type: "button", "aria-label": `One more ${h.unit || ""}`.trim(), disabled: future || v >= h.target, onclick: () => { setValue(h, k, v + 1); render(); } }, "+"))
      : el("span");

    return el("li", { class: `habit${done ? " is-done" : ""}`, style: `--c:${c}`, "data-active": String(active) }, control, body, right);
  }

  function renderList() {
    const k = ui.date, hs = visible();
    const due = hs.filter((h) => scheduled(h, k));
    const rest = hs.filter((h) => !scheduled(h, k));
    const list = $("#habitList"); list.innerHTML = "";

    if (!data.habits.length) {
      list.append(el("li", { class: "empty" },
        el("strong", {}, "No habits yet"),
        "Pick one small thing you want to do most days.",
        el("div", {}, el("button", { class: "primary", type: "button", onclick: () => openDialog() }, "Add your first habit"))));
    } else if (!due.length) {
      list.append(el("li", { class: "empty" }, el("strong", {}, "A free day"), `Nothing ${ui.area ? `in ${ui.area} ` : ""}is planned for ${DAY_LONG[dow(k)]}.`));
    }
    due.forEach((h) => list.append(habitRow(h, k, true)));

    const wrap = $("#restWrap");
    wrap.hidden = !rest.length;
    $("#restSummary").textContent = `Not planned for ${DAY_LONG[dow(k)]} (${rest.length})`;
    const rl = $("#restList"); rl.innerHTML = "";
    rest.forEach((h) => rl.append(habitRow(h, k, false)));
  }

  let noteTimer;
  function renderNote() {
    const ta = $("#noteInput");
    if (document.activeElement !== ta) ta.value = data.notes[ui.date] || "";
    $("#noteStatus").textContent = data.notes[ui.date] ? "Saved" : "";
  }

  function renderWeave() {
    const hs = visible();
    const grid = $("#weave"); grid.innerHTML = "";
    const t = todayKey();
    const lastWeekStart = addDays(weekStart(ui.date), ui.weekOffset * 7);
    const first = addDays(lastWeekStart, -(WEEKS_SHOWN - 1) * 7);
    const days = Array.from({ length: WEEKS_SHOWN * 7 }, (_, i) => addDays(first, i));
    const end = days[days.length - 1];
    $("#nextWeeks").disabled = end >= t && ui.weekOffset >= 0;

    const fd = dateOf(first), ld = dateOf(end);
    const range = fd.getMonth() === ld.getMonth() ? MONTHS[fd.getMonth()] : `${MONTHS[fd.getMonth()].slice(0, 3)} – ${MONTHS[ld.getMonth()].slice(0, 3)}`;
    $("#weaveHead").textContent = `Five weeks, ${range} ${ld.getFullYear()}`;

    // header row
    grid.append(el("div", { class: "w-month", role: "columnheader" }, ""));
    for (const k of days) {
      grid.append(el("div", {
        class: ["w-head", dow(k) === 0 && "week-start", k === ui.date && "is-sel", k === t && "is-today"].filter(Boolean).join(" "),
        role: "columnheader",
      }, DAY_LETTER[dow(k)], el("b", {}, String(dateOf(k).getDate()))));
    }

    if (!hs.length) { grid.append(el("p", { class: "weave-empty", style: "grid-column:1/-1" }, "Threads appear here once you add a habit.")); return; }

    for (const h of hs) {
      const c = colorHex(h.color);
      grid.append(el("div", { class: "w-label", role: "rowheader" }, el("i", { style: `background:${c}` }), h.name));

      // state per day
      const st = days.map((k) => {
        if (k > t) return "future";
        if (!scheduled(h, k)) return "off";
        if (isDone(h, k)) return "done";
        if (k === t) return "pending";
        return value(h, k) > 0 ? "part" : "miss";
      });
      // neighbours for joining threads across unscheduled days
      const prevDone = (i) => { for (let j = i - 1; j >= 0; j--) { if (st[j] === "off") continue; return st[j] === "done"; } return isDoneBefore(h, days[0]); };
      const nextDone = (i) => { for (let j = i + 1; j < st.length; j++) { if (st[j] === "off") continue; return st[j] === "done"; } return false; };

      days.forEach((k, i) => {
        const s = st[i];
        const cls = ["w-cell", dow(k) === 0 && "week-start", k === ui.date && "is-sel"];
        if (s === "done") {
          cls.push("done");
          const adjL = i > 0 ? st[i - 1] : (isDoneBefore(h, days[0]) && scheduled(h, addDays(k, -1)) ? "done" : "off");
          const adjR = i < st.length - 1 ? st[i + 1] : null;
          if (adjL === "done") cls.push("jl"); else if (adjL === "off" && prevDone(i)) cls.push("bl");
          if (adjR === "done") cls.push("jr"); else if (adjR === "off" && nextDone(i)) cls.push("br");
        }
        else if (s === "off" && prevDone(i) && nextDone(i)) cls.push("bridge");
        else cls.push(s);
        const d = dateOf(k);
        const label = `${h.name}, ${DAY_SHORT[dow(k)]} ${d.getDate()} ${MONTHS[d.getMonth()]}: ${{ done: "done", part: `${value(h, k)} of ${goal(h)}`, miss: "missed", pending: "not done yet", off: "not planned", future: "upcoming" }[s]}`;
        grid.append(el("button", {
          class: cls.filter(Boolean).join(" "), type: "button", role: "gridcell",
          style: `--c:${c}`, "aria-label": label, title: label,
          disabled: s === "future" || s === "off",
          onclick: () => { setValue(h, k, isDone(h, k) ? 0 : goal(h)); ui.date = k; ui.weekOffset = 0; render(); },
        }));
      });
    }
  }
  // Whether the last scheduled day before `k` was done (so a thread entering the window joins left).
  function isDoneBefore(h, k) {
    let d = addDays(k, -1), guard = 0;
    while (d >= h.created && guard++ < 14) { if (scheduled(h, d)) return isDone(h, d); d = addDays(d, -1); }
    return false;
  }

  /* ---------- Dialog ---------- */
  const dlg = $("#habitDialog"), form = $("#habitForm");

  function buildDialogControls() {
    const sw = $("#swatches");
    COLORS.forEach(([name, hex]) => sw.append(el("label", { title: name },
      el("input", { type: "radio", name: "color", value: name, "aria-label": name }),
      el("span", { style: `--sw:${hex}` }))));
    const dp = $("#dayPicker");
    DAY_SHORT.forEach((d, i) => dp.append(el("label", {},
      el("input", { type: "checkbox", name: "days", value: String(i), "aria-label": DAY_LONG[i] }),
      el("span", { "aria-hidden": "true" }, DAY_LETTER[i]))));
    form.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
      const set = { all: [0, 1, 2, 3, 4, 5, 6], week: [0, 1, 2, 3, 4], mwf: [0, 2, 4] }[b.dataset.preset];
      form.querySelectorAll('[name="days"]').forEach((c) => { c.checked = set.includes(+c.value); });
    }));
    form.querySelectorAll('[name="kind"]').forEach((r) => r.addEventListener("change", syncKind));
  }
  const syncKind = () => { $("#countRow").hidden = form.kind.value !== "count"; };

  function openDialog(h = null) {
    ui.editing = h;
    form.reset();
    $("#formError").textContent = "";
    $("#dialogTitle").textContent = h ? "Edit habit" : "New habit";
    $("#saveHabit").textContent = h ? "Save changes" : "Add habit";
    $("#deleteHabit").hidden = !h;
    const used = new Set(data.habits.map((x) => x.color));
    const color = h ? h.color : (COLORS.find((c) => !used.has(c[0])) || COLORS[0])[0];
    form.name.value = h ? h.name : "";
    form.area.value = h ? h.area || "" : ui.area || "";
    form.querySelector(`[name="color"][value="${color}"]`).checked = true;
    form.querySelector(`[name="kind"][value="${h ? h.kind : "check"}"]`).checked = true;
    form.target.value = h && h.kind === "count" ? h.target : 8;
    form.unit.value = h && h.kind === "count" ? h.unit || "" : "glasses";
    const days = h ? h.days : [0, 1, 2, 3, 4, 5, 6];
    form.querySelectorAll('[name="days"]').forEach((c) => { c.checked = days.includes(+c.value); });
    syncKind();
    dlg.showModal();
    form.name.focus();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const days = [...form.querySelectorAll('[name="days"]:checked')].map((c) => +c.value);
    const kind = form.kind.value;
    const target = Math.round(+form.target.value);
    if (!name) return fail("Give the habit a name.", form.name);
    if (!days.length) return fail("Pick at least one day.");
    if (kind === "count" && !(target >= 2 && target <= 50)) return fail("Set a goal between 2 and 50.", form.target);

    const fields = { name, area: form.area.value.trim(), color: form.color.value, kind, days };
    if (kind === "count") Object.assign(fields, { target, unit: form.unit.value.trim() });
    if (ui.editing) {
      Object.assign(ui.editing, fields);
      if (kind === "check") { delete ui.editing.target; delete ui.editing.unit; }
      toast("Changes saved");
    } else {
      data.habits.push({ id: uid(), created: todayKey(), ...fields });
      toast(`Added ${name}`);
    }
    // clamp existing values to new goal
    for (const k in data.log) {
      for (const h of data.habits) if (data.log[k][h.id] > goal(h)) data.log[k][h.id] = goal(h);
    }
    save(); dlg.close(); render();
  });

  function fail(msg, field) { $("#formError").textContent = msg; if (field) field.focus(); }

  $("#cancelDialog").addEventListener("click", () => dlg.close());
  $("#deleteHabit").addEventListener("click", () => {
    const h = ui.editing; if (!h) return;
    const idx = data.habits.indexOf(h);
    const backup = JSON.stringify(data);
    data.habits.splice(idx, 1);
    for (const k in data.log) { delete data.log[k][h.id]; if (!Object.keys(data.log[k]).length) delete data.log[k]; }
    save(); dlg.close(); render();
    toast(`Deleted ${h.name}`, "Undo", () => { data = JSON.parse(backup); save(); render(); });
  });

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg, action, fn) {
    const t = $("#toast"); t.innerHTML = "";
    t.append(el("span", {}, msg));
    if (action) t.append(el("button", { type: "button", onclick: () => { fn(); t.classList.remove("show"); } }, action));
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), action ? 6000 : 2400);
  }

  /* ---------- Navigation & events ---------- */
  function go(k) { const t = todayKey(); ui.date = k > t ? t : k; ui.weekOffset = 0; render(); }

  $("#prevDay").addEventListener("click", () => go(addDays(ui.date, -1)));
  $("#nextDay").addEventListener("click", () => go(addDays(ui.date, 1)));
  $("#todayBtn").addEventListener("click", () => go(todayKey()));
  $("#newHabitBtn").addEventListener("click", () => openDialog());
  $("#prevWeeks").addEventListener("click", () => { ui.weekOffset -= WEEKS_SHOWN; renderWeave(); });
  $("#nextWeeks").addEventListener("click", () => { ui.weekOffset = Math.min(0, ui.weekOffset + WEEKS_SHOWN); renderWeave(); });

  $("#noteInput").addEventListener("input", (e) => {
    const k = ui.date, v = e.target.value;
    $("#noteStatus").textContent = "Saving…";
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      if (v.trim()) data.notes[k] = v; else delete data.notes[k];
      save();
      $("#noteStatus").textContent = v.trim() ? "Saved" : "";
    }, 400);
  });

  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (dlg.open || ["input", "textarea", "select"].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); go(addDays(ui.date, -1)); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(addDays(ui.date, 1)); }
    else if (e.key === "t" || e.key === "T") go(todayKey());
    else if (e.key === "n" || e.key === "N") { e.preventDefault(); openDialog(); }
  });

  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: `habits-${todayKey()}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Exported your habits");
  });

  $("#importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.habits)) throw new Error();
      data = { log: {}, notes: {}, ...parsed };
      save(); render(); toast(`Imported ${data.habits.length} habits`);
    } catch { toast("That file isn't a habits export."); }
    e.target.value = "";
  });

  // Roll over to the new day if the tab stays open past midnight.
  let lastToday = todayKey();
  setInterval(() => {
    const t = todayKey();
    if (t !== lastToday) { if (ui.date === lastToday) ui.date = t; lastToday = t; render(); }
  }, 60000);

  buildDialogControls();
  render();
})();
