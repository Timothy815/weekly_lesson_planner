"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type Day = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
type Slot = "slot1" | "slot2" | "slot3";
type Category = "Opening" | "Reading" | "Discussion" | "Instruction" | "Lab" | "Python" | "Reflection" | "Assessment";
type Segment = { id: string; title: string; minutes: number; notes: string; category: Category; completed: boolean };
type WeekMeta = {
  topic: string; centralQuestion: string; certificationObjectives: string; article: string;
  video: string; mentalModel: string; pythonConnection: string; primaryLab: string;
  evidence: string; synthesisQuestion: string; misconceptions: string; scaffolding: string; extension: string;
};
type Planner = {
  schemaVersion: 1;
  weekOf: string;
  activeDays: Day[];
  meta: WeekMeta;
  schedules: Record<Slot, Record<Day, Segment[]>>;
};

const STORAGE_KEY = "cybersecurity-weekly-planner-v1";
const days: Day[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const slots: Slot[] = ["slot1", "slot2", "slot3"];
const dayName: Record<Day, string> = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday" };
const slotName: Record<Slot, string> = { slot1: "1st Slot", slot2: "2nd Slot", slot3: "3rd Slot" };
const categories: Category[] = ["Opening", "Reading", "Discussion", "Instruction", "Lab", "Python", "Reflection", "Assessment"];
const dayInfo: Record<Day, { focus: string; outcome: string; product: string }> = {
  monday: { focus: "Concept & Context", outcome: "Build an initial conceptual model and identify important questions.", product: "Initial mental model, short activity result, and one meaningful question." },
  tuesday: { focus: "Mechanisms & Guided Practice", outcome: "Explain how the system or process works and begin guided practice.", product: "Guided-practice evidence and a revised technical explanation." },
  wednesday: { focus: "Python & Computational Thinking", outcome: "Use programming to model, analyze, or automate part of the weekly topic.", product: "Working code, test evidence, and a documented next step." },
  thursday: { focus: "Extended Cybersecurity Lab", outcome: "Apply the concept, gather evidence, troubleshoot, and document results.", product: "Lab evidence, an evidence-based explanation, and unresolved problems." },
  friday: { focus: "Synthesis & Certification", outcome: "Connect the week’s ideas, analyze errors, and demonstrate understanding.", product: "Corrected certification practice and a weekly learning reflection." },
};

type Seed = [string, number, string, Category];
const routine: Record<Day, Seed[]> = {
  monday: [
    ["Arrival task and weekly question", 5, "Display one accessible question or scenario. Take attendance while students begin.", "Opening"],
    ["Independent or partner article reading", 8, "Mark one important idea, one confusing point, and one question.", "Reading"],
    ["Article discussion", 14, "Discuss central ideas and bridge them to the technical topic.", "Discussion"],
    ["Overview video", 8, "Provide a shared visual introduction to the week’s subject.", "Instruction"],
    ["Interactive mini-lesson", 18, "Introduce essential vocabulary, the basic system model, and why it matters.", "Instruction"],
    ["Activity or lab briefing", 5, "Explain the objective, rules, deliverable, and stopping point.", "Lab"],
    ["Guided application", 20, "Complete a short analysis, demonstration, classification task, or guided exercise.", "Lab"],
    ["Mental-model checkpoint", 9, "Explain the process to a partner or AI tutor and identify a gap.", "Reflection"],
    ["Exit ticket and cleanup", 3, "Record the strongest current understanding and one remaining question.", "Assessment"],
  ],
  tuesday: [
    ["Retrieval warm-up", 6, "Reconstruct Monday’s main model without notes.", "Opening"],
    ["Short reading, diagram, or case excerpt", 8, "Introduce the day’s technical question with a concise source.", "Reading"],
    ["Discussion and misconception check", 10, "Compare explanations and expose common misunderstandings.", "Discussion"],
    ["Overview video or demonstration", 8, "Show the process before describing its details.", "Instruction"],
    ["Technical mini-lesson", 18, "Explain the mechanism, certification terminology, and cause-and-effect relationships.", "Instruction"],
    ["Guided-lab briefing", 6, "Review the goal, environment, boundaries, evidence, and submission requirements.", "Lab"],
    ["Guided lab or structured practice", 23, "Follow a scaffolded process while recording observations.", "Lab"],
    ["AI tutor or partner debrief", 8, "Explain what happened and revise an inaccurate part of the model.", "Reflection"],
    ["Exit ticket", 3, "Answer one certification-style or causal question.", "Assessment"],
  ],
  wednesday: [
    ["Computational warm-up", 5, "Use a prediction, trace, pattern, binary problem, or code-reading question.", "Opening"],
    ["Cybersecurity problem scenario", 7, "Introduce the problem the program will help solve.", "Reading"],
    ["Problem decomposition discussion", 8, "Identify inputs, processes, outputs, rules, and possible errors.", "Discussion"],
    ["Instructor modeling", 12, "Demonstrate only the new programming idea and first portion of the solution.", "Python"],
    ["Student coding workshop", 43, "Design, code, test, debug, and improve the program using checkpoints.", "Python"],
    ["Testing and peer explanation", 8, "Test edge cases and explain one important section of code.", "Python"],
    ["Cybersecurity connection", 4, "State what the program reveals, automates, or models.", "Reflection"],
    ["Save, submit, and exit ticket", 3, "Record current program status and the next needed step.", "Assessment"],
  ],
  thursday: [
    ["Lab readiness check", 5, "Verify required files, systems, accounts, and prior work.", "Opening"],
    ["Lab background reading", 7, "Read the scenario, client request, incident description, or technical context.", "Reading"],
    ["Prediction and planning", 8, "Predict results, identify risks, and outline first steps.", "Discussion"],
    ["Demonstration and safety briefing", 7, "Model the critical step and confirm authorization, boundaries, evidence, and recovery.", "Instruction"],
    ["Extended lab investigation", 45, "Configure, observe, test, troubleshoot, and document.", "Lab"],
    ["Evidence review", 8, "Check screenshots, logs, commands, measurements, and observations for completeness.", "Lab"],
    ["Mental-model revision", 7, "Explain why the result occurred and compare it with the prediction.", "Reflection"],
    ["Save state and cleanup", 3, "Preserve work so the investigation can continue.", "Assessment"],
  ],
  friday: [
    ["Weekly retrieval challenge", 8, "Recall and connect major ideas without immediately consulting notes.", "Opening"],
    ["Short article, incident, or ethical scenario", 10, "Introduce a consequence, tradeoff, or real-world application.", "Reading"],
    ["Socratic or whole-class discussion", 14, "Evaluate decisions, evidence, competing priorities, and misconceptions.", "Discussion"],
    ["Weekly synthesis lesson", 15, "Connect vocabulary, mechanisms, lab evidence, and defensive purpose.", "Instruction"],
    ["Certification-style practice", 18, "Answer a small, focused set of questions independently.", "Assessment"],
    ["Error analysis and discussion", 13, "Analyze plausible distractors and the misunderstanding behind each one.", "Discussion"],
    ["Completion, remediation, or extension", 7, "Finish an essential item, correct a misconception, or attempt a challenge.", "Instruction"],
    ["Weekly reflection", 5, "Describe what changed in the mental model and what needs further practice.", "Reflection"],
  ],
};

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
function currentMonday() {
  const date = new Date();
  const weekday = date.getDay();
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return date.toISOString().slice(0, 10);
}
function freshSchedule(): Record<Day, Segment[]> {
  return Object.fromEntries(days.map((day) => [day, routine[day].map(([title, minutes, notes, category]) => ({ id: uid(), title, minutes, notes, category, completed: false }))])) as Record<Day, Segment[]>;
}
function defaultPlanner(): Planner {
  const meta = Object.fromEntries(["topic", "centralQuestion", "certificationObjectives", "article", "video", "mentalModel", "pythonConnection", "primaryLab", "evidence", "synthesisQuestion", "misconceptions", "scaffolding", "extension"].map((key) => [key, ""])) as WeekMeta;
  return { schemaVersion: 1, weekOf: currentMonday(), activeDays: [...days], meta, schedules: { slot1: freshSchedule(), slot2: freshSchedule(), slot3: freshSchedule() } };
}
function isPlanner(value: unknown): value is Planner {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Planner>;
  return candidate.schemaVersion === 1
    && typeof candidate.weekOf === "string"
    && Array.isArray(candidate.activeDays)
    && candidate.activeDays.length > 0
    && candidate.activeDays.every((day) => days.includes(day))
    && !!candidate.meta
    && Object.values(candidate.meta).every((value) => typeof value === "string")
    && !!candidate.schedules
    && slots.every((slot) => days.every((day) => Array.isArray(candidate.schedules?.[slot]?.[day])));
}
function range(start: number, duration: number) {
  const clock = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  return `${clock(start)}–${clock(start + duration)}`;
}
function dateForDay(weekOf: string, day: Day) {
  const date = new Date(`${weekOf}T12:00:00`);
  date.setDate(date.getDate() + days.indexOf(day));
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Home() {
  const [planner, setPlanner] = useState<Planner>(() => defaultPlanner());
  const [activeSlot, setActiveSlot] = useState<Slot>("slot1");
  const [editing, setEditing] = useState<{ slot: Slot; day: Day; id: string } | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [daysOpen, setDaysOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveLabel, setSaveLabel] = useState("Local copy ready");
  const [notice, setNotice] = useState("");
  const [printMode, setPrintMode] = useState<"none" | "weekly" | "daily">("none");
  const [printDay, setPrintDay] = useState<Day>("monday");
  const importInput = useRef<HTMLInputElement>(null);
  const dragSource = useRef<{ slot: Slot; day: Day; id: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isPlanner(parsed)) setPlanner(parsed);
      }
    } catch {
      setNotice("The saved copy could not be read, so the routine template was opened instead.");
    } finally { setHydrated(true); }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveLabel("Saving…");
    const timer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(planner));
      setSaveLabel(`Saved locally · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [planner, hydrated]);

  useEffect(() => {
    const finish = () => { setPrintMode("none"); document.title = "Cybersecurity Weekly Lesson Planner"; };
    window.addEventListener("afterprint", finish);
    return () => window.removeEventListener("afterprint", finish);
  }, []);

  const schedule = planner.schedules[activeSlot];
  const activeDays = days.filter((day) => planner.activeDays.includes(day));
  const segments = activeDays.flatMap((day) => schedule[day]);
  const completed = segments.filter((item) => item.completed).length;
  const totalMinutes = segments.reduce((sum, item) => sum + item.minutes, 0);
  const progress = segments.length ? Math.round(completed / segments.length * 100) : 0;
  const selected = editing ? planner.schedules[editing.slot][editing.day].find((item) => item.id === editing.id) ?? null : null;
  const weekLabel = useMemo(() => {
    const date = new Date(`${planner.weekOf}T12:00:00`);
    return Number.isNaN(date.getTime()) ? "Unscheduled week" : `Week of ${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
  }, [planner.weekOf]);

  function updateMeta(key: keyof WeekMeta, value: string) {
    setPlanner((current) => ({ ...current, meta: { ...current.meta, [key]: value } }));
  }
  function updateSegment(day: Day, id: string, patch: Partial<Segment>, slot = activeSlot) {
    setPlanner((current) => ({ ...current, schedules: { ...current.schedules, [slot]: { ...current.schedules[slot], [day]: current.schedules[slot][day].map((item) => item.id === id ? { ...item, ...patch } : item) } } }));
  }
  function addSegment(day: Day) {
    const item: Segment = { id: uid(), title: "New segment", minutes: 10, notes: "Add the purpose, materials, or stopping point.", category: "Instruction", completed: false };
    setPlanner((current) => ({ ...current, schedules: { ...current.schedules, [activeSlot]: { ...current.schedules[activeSlot], [day]: [...current.schedules[activeSlot][day], item] } } }));
    setEditing({ slot: activeSlot, day, id: item.id });
  }
  function deleteSegment() {
    if (!editing || !selected || !confirm(`Delete “${selected.title}”?`)) return;
    setPlanner((current) => ({ ...current, schedules: { ...current.schedules, [editing.slot]: { ...current.schedules[editing.slot], [editing.day]: current.schedules[editing.slot][editing.day].filter((item) => item.id !== editing.id) } } }));
    setEditing(null);
  }
  function moveSegment(source: { slot: Slot; day: Day; id: string }, targetDay: Day, targetIndex: number) {
    if (source.slot !== activeSlot) return;
    setPlanner((current) => {
      const currentSchedule = current.schedules[activeSlot];
      const moving = currentSchedule[source.day].find((item) => item.id === source.id);
      if (!moving) return current;
      const sourceList = currentSchedule[source.day].filter((item) => item.id !== source.id);
      const targetList = source.day === targetDay ? sourceList : [...currentSchedule[targetDay]];
      targetList.splice(Math.max(0, Math.min(targetIndex, targetList.length)), 0, moving);
      return { ...current, schedules: { ...current.schedules, [activeSlot]: { ...currentSchedule, [source.day]: source.day === targetDay ? targetList : sourceList, [targetDay]: targetList } } };
    });
  }
  function reorder(day: Day, id: string, direction: -1 | 1) {
    const index = schedule[day].findIndex((item) => item.id === id);
    const target = index + direction;
    if (index >= 0 && target >= 0 && target < schedule[day].length) moveSegment({ slot: activeSlot, day, id }, day, target);
  }
  function toggleDay(day: Day) {
    setPlanner((current) => {
      const active = current.activeDays.includes(day);
      if (active && current.activeDays.length === 1) { setNotice("Keep at least one school day in the week."); return current; }
      const next = active ? current.activeDays.filter((item) => item !== day) : [...current.activeDays, day];
      return { ...current, activeDays: days.filter((item) => next.includes(item)) };
    });
  }
  function copySlot(target: Slot) {
    if (!confirm(`Replace ${slotName[target]} with a copy of ${slotName[activeSlot]}?`)) return;
    const copy = Object.fromEntries(days.map((day) => [day, schedule[day].map((item) => ({ ...item, id: uid(), completed: false }))])) as Record<Day, Segment[]>;
    setPlanner((current) => ({ ...current, schedules: { ...current.schedules, [target]: copy } }));
    setNotice(`${slotName[activeSlot]} was copied to ${slotName[target]}.`);
  }
  function download(content: string, filename: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
  }
  function exportJson() {
    download(JSON.stringify(planner, null, 2), `cybersecurity-plan-${planner.weekOf || "undated"}.json`, "application/json");
    setNotice("Portable JSON copy downloaded.");
  }
  function exportMarkdown() {
    const lines = [`# Cybersecurity Weekly Plan — ${weekLabel}`, "", `**Weekly topic:** ${planner.meta.topic || "Not set"}`, `**Central question:** ${planner.meta.centralQuestion || "Not set"}`, ""];
    slots.forEach((slot) => {
      lines.push(`## ${slotName[slot]}`, "");
      activeDays.forEach((day) => {
        lines.push(`### ${dayName[day]} — ${dayInfo[day].focus}`, "");
        let elapsed = 0;
        planner.schedules[slot][day].forEach((item) => {
          const time = range(elapsed, item.minutes); elapsed += item.minutes;
          lines.push(`- [${item.completed ? "x" : " "}] **${time} · ${item.title}** (${item.minutes} min)`, `  - ${item.notes}`);
        });
        lines.push("");
      });
    });
    download(lines.join("\n"), `cybersecurity-plan-${planner.weekOf || "undated"}.md`, "text/markdown");
  }
  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isPlanner(parsed)) throw new Error("invalid");
      setPlanner(parsed); setEditing(null); setNotice(`Imported ${file.name}. It is now saved on this device.`);
    } catch { setNotice("That file is not a valid planner JSON export. No schedule was changed."); }
  }
  function printPlan(mode: "weekly" | "daily") {
    const targetDay = activeDays.includes(printDay) ? printDay : activeDays[0];
    if (mode === "daily") setPrintDay(targetDay);
    setPrintMode(mode);
    document.title = `${slotName[activeSlot]}-${mode === "daily" ? dayName[targetDay] : "Weekly"}-${planner.weekOf}`;
    window.setTimeout(() => window.print(), 80);
  }
  function restoreTemplate() {
    if (!confirm("Replace this entire week with a fresh routine template? Export JSON first if you may need this plan later.")) return;
    const fresh = defaultPlanner(); fresh.weekOf = planner.weekOf; setPlanner(fresh); setEditing(null); setNotice("The routine template was restored for all three slots.");
  }

  const metaFields: [keyof WeekMeta, string, string][] = [
    ["topic", "Weekly topic", "The topic connecting reading, instruction, code, and lab"],
    ["centralQuestion", "Central question", "What difficult question should students answer by Friday?"],
    ["certificationObjectives", "Certification objectives", "Security+ or AP Cybersecurity objectives"],
    ["article", "Article or case study", "Title, link, or local reference"],
    ["video", "Overview video", "Title, link, or viewing note"],
    ["mentalModel", "Key mental model", "The process or relationship students should explain"],
    ["pythonConnection", "Python connection", "What programming will model, analyze, or automate"],
    ["primaryLab", "Primary lab", "Investigation, environment, and stopping point"],
    ["evidence", "Required evidence or deliverable", "Screenshots, logs, code, explanation, or submission"],
    ["synthesisQuestion", "Friday synthesis question", "The question reconnecting the entire week"],
    ["misconceptions", "Likely misconceptions", "Ideas to surface and correct"],
    ["scaffolding", "Additional scaffolding", "Students, groups, supports, or checkpoints"],
    ["extension", "Extension opportunity", "A meaningful next challenge"],
  ];

  return <main className={`planner-app print-${printMode}`}>
    <header className="site-header screen-only">
      <a className="brand" href="#top"><span className="logo" aria-hidden="true">CS</span><span><strong>CYBER / PLANNER</strong><small>Weekly operations desk</small></span></a>
      <div className="save-state"><i />{saveLabel}</div>
    </header>

    <section className="planner-hero screen-only" id="top">
      <div><p className="eyebrow">Instructional operations // 90-minute blocks</p><h1>Shape the week.<br /><em>Keep the evidence.</em></h1><p>Arrange each class like a broadcast schedule: move segments, adjust airtime, mark what happened, and carry the plan anywhere.</p></div>
      <aside className="week-brief"><span>Current planning cycle</span><label>Week beginning<input type="date" value={planner.weekOf} onChange={(event) => setPlanner((current) => ({ ...current, weekOf: event.target.value }))} /></label><strong>{planner.meta.topic || "Weekly topic not set"}</strong><button type="button" onClick={() => setBriefOpen(true)}>Open weekly brief <b>→</b></button></aside>
    </section>

    <section className="control-deck screen-only" aria-label="Planner controls">
      <div className="slot-tabs" role="tablist">{slots.map((slot) => <button key={slot} role="tab" aria-selected={activeSlot === slot} className={activeSlot === slot ? "active" : ""} onClick={() => setActiveSlot(slot)}>{slotName[slot]}</button>)}</div>
      <div className="control-actions">
        <button type="button" onClick={() => setDaysOpen((open) => !open)}>School days <span>{activeDays.length}/5</span></button>
        <button type="button" onClick={() => setBriefOpen(true)}>Weekly brief</button>
        <button type="button" onClick={exportJson}>Export JSON</button>
        <button type="button" onClick={() => importInput.current?.click()}>Import JSON</button>
        <input ref={importInput} className="sr-only" type="file" accept="application/json,.json" onChange={importJson} />
        <details className="more-menu"><summary>More</summary><div>
          <button type="button" onClick={exportMarkdown}>Export readable Markdown</button>
          <button type="button" onClick={() => printPlan("weekly")}>Save weekly PDF</button>
          <label>Daily PDF day<select value={printDay} onChange={(event) => setPrintDay(event.target.value as Day)}>{activeDays.map((day) => <option key={day} value={day}>{dayName[day]}</option>)}</select></label>
          <button type="button" onClick={() => printPlan("daily")}>Save selected day PDF</button>
          {slots.filter((slot) => slot !== activeSlot).map((slot) => <button key={slot} type="button" onClick={() => copySlot(slot)}>Copy to {slotName[slot]}</button>)}
          <button type="button" className="danger" onClick={restoreTemplate}>Restore routine template</button>
        </div></details>
      </div>
      {daysOpen && <div className="day-picker"><span>Days in this school week</span>{days.map((day) => <label key={day}><input type="checkbox" checked={planner.activeDays.includes(day)} onChange={() => toggleDay(day)} />{dayName[day]}</label>)}</div>}
    </section>

    {notice && <div className="notice screen-only" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
    <section className="status-strip screen-only">
      <div><span>Active schedule</span><strong>{slotName[activeSlot]}</strong></div><div><span>Planned airtime</span><strong>{totalMinutes} minutes</strong></div><div><span>Segments complete</span><strong>{completed} / {segments.length}</strong></div><div className="progress-stat"><span>Weekly progress</span><strong>{progress}%</strong><i><b style={{ width: `${progress}%` }} /></i></div>
    </section>

    <div className="print-heading"><p>Cybersecurity Weekly Lesson Planner</p><h1>{planner.meta.topic || weekLabel}</h1><div><span>{weekLabel}</span><span>{slotName[activeSlot]}</span><span>{printMode === "daily" ? dayName[printDay] : `${activeDays.length}-day school week`}</span></div>{planner.meta.centralQuestion && <p className="print-question">Central question: {planner.meta.centralQuestion}</p>}</div>

    <section className="schedule-section">
      <div className="schedule-title screen-only"><div><p className="eyebrow">01 // Broadcast board</p><h2>{weekLabel}</h2></div><p>Drag a segment to another day or position. Use the arrow controls when working by keyboard or touch.</p></div>
      <div className={`schedule-board columns-${activeDays.length}`}>
        {activeDays.map((day) => {
          let elapsed = 0; const items = schedule[day]; const minutes = items.reduce((sum, item) => sum + item.minutes, 0);
          return <article className={`day-column ${printMode === "daily" && day === printDay ? "print-target" : ""}`} key={day} data-day={day} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragSource.current) moveSegment(dragSource.current, day, items.length); dragSource.current = null; }}>
            <header><div><span>{dateForDay(planner.weekOf, day)}</span><strong>{dayName[day]}</strong><small>{dayInfo[day].focus}</small></div><b className={minutes === 90 ? "on-time" : minutes > 90 ? "over" : "under"}>{minutes}<small>/90</small></b></header>
            <p className="day-outcome">{dayInfo[day].outcome}</p>
            <div className="segment-list">{items.map((item, index) => {
              const start = elapsed; elapsed += item.minutes;
              return <div className={`segment-card category-${item.category.toLowerCase()} ${item.completed ? "completed" : ""}`} draggable key={item.id} onDragStart={(event: DragEvent<HTMLDivElement>) => { dragSource.current = { slot: activeSlot, day, id: item.id }; event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (dragSource.current) moveSegment(dragSource.current, day, index); dragSource.current = null; }}>
                <div className="segment-time"><span>{range(start, item.minutes)}</span><b>{item.minutes}m</b></div>
                <div className="segment-main"><label className="complete-check"><input type="checkbox" checked={item.completed} onChange={(event) => updateSegment(day, item.id, { completed: event.target.checked })} /><span aria-hidden="true">✓</span><span className="sr-only">Mark {item.title} complete</span></label><button className="segment-copy" type="button" onClick={() => setEditing({ slot: activeSlot, day, id: item.id })}><small>{item.category}</small><strong>{item.title}</strong><span>{item.notes}</span></button><div className="card-movers screen-only"><button type="button" disabled={index === 0} onClick={() => reorder(day, item.id, -1)} aria-label="Move earlier">↑</button><button type="button" disabled={index === items.length - 1} onClick={() => reorder(day, item.id, 1)} aria-label="Move later">↓</button><button type="button" onClick={() => setEditing({ slot: activeSlot, day, id: item.id })} aria-label="Edit segment">•••</button></div></div>
              </div>;
            })}</div>
            <button className="add-segment screen-only" type="button" onClick={() => addSegment(day)}>＋ Add segment</button><footer><span>Daily product</span><p>{dayInfo[day].product}</p></footer>
          </article>;
        })}
      </div>
    </section>

    <section className="weekly-notes"><div><span>Certification objectives</span><p>{planner.meta.certificationObjectives || "Not specified."}</p></div><div><span>Required evidence</span><p>{planner.meta.evidence || "Not specified."}</p></div><div><span>Friday synthesis question</span><p>{planner.meta.synthesisQuestion || "Not specified."}</p></div><div><span>Likely misconceptions</span><p>{planner.meta.misconceptions || "Not specified."}</p></div></section>

    {briefOpen && <div className="modal-backdrop screen-only" onMouseDown={() => setBriefOpen(false)}><section className="drawer weekly-drawer" role="dialog" aria-modal="true" aria-labelledby="brief-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Planning dossier</p><h2 id="brief-title">Weekly brief</h2></div><button type="button" onClick={() => setBriefOpen(false)} aria-label="Close">×</button></div><div className="field-grid">{metaFields.map(([key, label, placeholder]) => <label key={key} className={key === "topic" || key === "centralQuestion" ? "wide" : ""}><span>{label}</span><textarea rows={key === "topic" ? 2 : 3} value={planner.meta[key]} placeholder={placeholder} onChange={(event) => updateMeta(key, event.target.value)} /></label>)}</div><div className="drawer-actions"><button className="primary" type="button" onClick={() => setBriefOpen(false)}>Done</button></div></section></div>}

    {editing && selected && <div className="modal-backdrop screen-only" onMouseDown={() => setEditing(null)}><section className="drawer segment-drawer" role="dialog" aria-modal="true" aria-labelledby="segment-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">{dayName[editing.day]} // {slotName[editing.slot]}</p><h2 id="segment-title">Edit segment</h2></div><button type="button" onClick={() => setEditing(null)} aria-label="Close">×</button></div><label><span>Activity title</span><input value={selected.title} onChange={(event) => updateSegment(editing.day, editing.id, { title: event.target.value }, editing.slot)} /></label><div className="split-fields"><label><span>Minutes</span><input type="number" min="1" max="180" value={selected.minutes} onChange={(event) => updateSegment(editing.day, editing.id, { minutes: Math.max(1, Number(event.target.value) || 1) }, editing.slot)} /></label><label><span>Category</span><select value={selected.category} onChange={(event) => updateSegment(editing.day, editing.id, { category: event.target.value as Category }, editing.slot)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div><label><span>Purpose and teacher notes</span><textarea rows={7} value={selected.notes} onChange={(event) => updateSegment(editing.day, editing.id, { notes: event.target.value }, editing.slot)} /></label><label className="completion-row"><input type="checkbox" checked={selected.completed} onChange={(event) => updateSegment(editing.day, editing.id, { completed: event.target.checked }, editing.slot)} />Completed as planned</label><div className="drawer-actions"><button className="danger" type="button" onClick={deleteSegment}>Delete</button><button className="primary" type="button" onClick={() => setEditing(null)}>Done</button></div></section></div>}
  </main>;
}
