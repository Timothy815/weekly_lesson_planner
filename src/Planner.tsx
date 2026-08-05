"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type Day = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
type Slot = "slot1" | "slot2" | "slot3";
type Category = "Opening" | "Reading" | "Discussion" | "Instruction" | "Lab" | "Python" | "Reflection" | "Assessment";
type ResourceLink = { label: string; url: string };
type Segment = { id: string; title: string; minutes: number; notes: string; category: Category; completed: boolean; resources: ResourceLink[] };
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
  dailyObjectives: Record<Slot, Record<Day, string>>;
};
type ImportCandidate = {
  filename: string;
  kind: "ai" | "backup";
  weekOf?: string;
  meta?: Partial<WeekMeta>;
  sourceSlots: Slot[];
  schedules: Partial<Record<Slot, Partial<Record<Day, Segment[]>>>>;
  objectives: Partial<Record<Slot, Partial<Record<Day, string>>>>;
  backup?: Planner;
};
type ArchiveDocument = { format: "weekly-lesson-planner-archive"; version: 1; archivedAt: string; planner: Planner };
type ArchiveEntry = ArchiveDocument & { filename: string };
type ArchiveStatus = "unsupported" | "disconnected" | "permission" | "connected" | "working" | "error";
type DirectoryPermissionHandle = FileSystemDirectoryHandle & {
  queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
};
type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  values: () => AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
};
type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
};

const STORAGE_KEY = "cybersecurity-weekly-planner-v1";
const ARCHIVE_DB = "weekly-lesson-planner-archive-v1";
const ARCHIVE_STORE = "connections";
const ARCHIVE_HANDLE_KEY = "archive-folder";
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
  return Object.fromEntries(days.map((day) => [day, routine[day].map(([title, minutes, notes, category]) => ({ id: uid(), title, minutes, notes, category, completed: false, resources: [] as ResourceLink[] }))])) as Record<Day, Segment[]>;
}
function freshObjectives(): Record<Day, string> {
  return Object.fromEntries(days.map((day) => [day, ""])) as Record<Day, string>;
}
function defaultPlanner(): Planner {
  const meta = Object.fromEntries(["topic", "centralQuestion", "certificationObjectives", "article", "video", "mentalModel", "pythonConnection", "primaryLab", "evidence", "synthesisQuestion", "misconceptions", "scaffolding", "extension"].map((key) => [key, ""])) as WeekMeta;
  return {
    schemaVersion: 1,
    weekOf: currentMonday(),
    activeDays: [...days],
    meta,
    schedules: { slot1: freshSchedule(), slot2: freshSchedule(), slot3: freshSchedule() },
    dailyObjectives: { slot1: freshObjectives(), slot2: freshObjectives(), slot3: freshObjectives() },
  };
}
function isPlanner(value: unknown): boolean {
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
    && slots.every((slot) => days.every((day) => Array.isArray(candidate.schedules?.[slot]?.[day])))
    && (!candidate.dailyObjectives || slots.every((slot) => days.every((day) => typeof candidate.dailyObjectives?.[slot]?.[day] === "string")));
}
function normalizeResources(value: unknown): ResourceLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((resource) => {
    if (!resource || typeof resource !== "object") return [];
    const candidate = resource as Partial<ResourceLink>;
    if (typeof candidate.url !== "string" || !candidate.url.trim()) return [];
    return [{ label: typeof candidate.label === "string" && candidate.label.trim() ? candidate.label.trim() : "Open resource", url: candidate.url.trim() }];
  });
}
function normalizeSegment(value: unknown): Segment {
  const candidate = value && typeof value === "object" ? value as Partial<Segment> : {};
  return {
    id: typeof candidate.id === "string" ? candidate.id : uid(),
    title: typeof candidate.title === "string" ? candidate.title : "Untitled activity",
    minutes: typeof candidate.minutes === "number" && candidate.minutes > 0 ? candidate.minutes : 10,
    notes: typeof candidate.notes === "string" ? candidate.notes : "",
    category: categories.includes(candidate.category as Category) ? candidate.category as Category : "Instruction",
    completed: candidate.completed === true,
    resources: normalizeResources(candidate.resources),
  };
}
function normalizePlanner(input: unknown): Planner {
  const value = input as Omit<Planner, "dailyObjectives"> & { dailyObjectives?: Planner["dailyObjectives"] };
  return {
    ...value,
    schedules: Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(days.map((day) => [day, value.schedules[slot][day].map(normalizeSegment)]))])) as Planner["schedules"],
    dailyObjectives: Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(days.map((day) => [day, value.dailyObjectives?.[slot]?.[day] ?? ""]))])) as Planner["dailyObjectives"],
  };
}
function isArchiveDocument(value: unknown): value is ArchiveDocument {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ArchiveDocument>;
  return candidate.format === "weekly-lesson-planner-archive"
    && candidate.version === 1
    && typeof candidate.archivedAt === "string"
    && isPlanner(candidate.planner);
}
function openArchiveDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ARCHIVE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(ARCHIVE_STORE)) request.result.createObjectStore(ARCHIVE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function loadArchiveHandle(): Promise<FileSystemDirectoryHandle | null> {
  const database = await openArchiveDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(ARCHIVE_STORE).objectStore(ARCHIVE_STORE).get(ARCHIVE_HANDLE_KEY);
    request.onsuccess = () => { database.close(); resolve(request.result ?? null); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}
async function rememberArchiveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const database = await openArchiveDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ARCHIVE_STORE, "readwrite");
    transaction.objectStore(ARCHIVE_STORE).put(handle, ARCHIVE_HANDLE_KEY);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}
function archiveFilename(planner: Planner, archivedAt: string) {
  const topic = planner.meta.topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "lesson-plan";
  const timestamp = archivedAt.replace(/[:.]/g, "-");
  return `${planner.weekOf || "undated"}--${topic}--${timestamp}.lesson-plan.json`;
}
function formatArchiveDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
function safeHref(url: string) {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return "";
}
function normalizeMeta(value: unknown): Partial<WeekMeta> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const keys: (keyof WeekMeta)[] = ["topic", "centralQuestion", "certificationObjectives", "article", "video", "mentalModel", "pythonConnection", "primaryLab", "evidence", "synthesisQuestion", "misconceptions", "scaffolding", "extension"];
  const source = value as Partial<WeekMeta>;
  const entries = keys.flatMap((key) => typeof source[key] === "string" ? [[key, source[key]]] : []);
  return entries.length ? Object.fromEntries(entries) as Partial<WeekMeta> : undefined;
}
function parseAiImport(value: unknown, filename: string): ImportCandidate | null {
  if (!value || typeof value !== "object") return null;
  const source = value as { weekOf?: unknown; weeklyBrief?: unknown; days?: unknown; day?: unknown; learningObjective?: unknown; segments?: unknown };
  const rawDays: Partial<Record<Day, unknown>> = {};
  if (source.days && typeof source.days === "object") {
    days.forEach((day) => { if (day in (source.days as object)) rawDays[day] = (source.days as Partial<Record<Day, unknown>>)[day]; });
  } else if (typeof source.day === "string" && days.includes(source.day as Day)) {
    rawDays[source.day as Day] = { learningObjective: source.learningObjective, segments: source.segments };
  }
  const schedule: Partial<Record<Day, Segment[]>> = {};
  const objectives: Partial<Record<Day, string>> = {};
  days.forEach((day) => {
    const raw = rawDays[day];
    if (!raw || typeof raw !== "object") return;
    const dayPlan = raw as { learningObjective?: unknown; segments?: unknown };
    if (!Array.isArray(dayPlan.segments)) return;
    const imported = dayPlan.segments.flatMap((segment) => {
      if (!segment || typeof segment !== "object") return [];
      const item = segment as Partial<Segment>;
      if (typeof item.title !== "string" || !item.title.trim()) return [];
      return [{ ...normalizeSegment(item), id: uid(), completed: false }];
    });
    schedule[day] = imported;
    objectives[day] = typeof dayPlan.learningObjective === "string" ? dayPlan.learningObjective : "";
  });
  if (!days.some((day) => schedule[day])) return null;
  return {
    filename,
    kind: "ai",
    weekOf: typeof source.weekOf === "string" ? source.weekOf : undefined,
    meta: normalizeMeta(source.weeklyBrief),
    sourceSlots: ["slot1"],
    schedules: { slot1: schedule },
    objectives: { slot1: objectives },
  };
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
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [appMode, setAppMode] = useState<"edit" | "display">("edit");
  const [selectedDay, setSelectedDay] = useState<Day>("monday");
  const [presenting, setPresenting] = useState(false);
  const [editing, setEditing] = useState<{ slot: Slot; day: Day; id: string } | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [daysOpen, setDaysOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveLabel, setSaveLabel] = useState("Local copy ready");
  const [notice, setNotice] = useState("");
  const [printMode, setPrintMode] = useState<"none" | "weekly" | "daily">("none");
  const [printDay, setPrintDay] = useState<Day>("monday");
  const [pendingImport, setPendingImport] = useState<ImportCandidate | null>(null);
  const [importSourceSlot, setImportSourceSlot] = useState<Slot>("slot1");
  const [importTargetSlot, setImportTargetSlot] = useState<Slot>("slot1");
  const [importDays, setImportDays] = useState<Day[]>([]);
  const [applyImportWeek, setApplyImportWeek] = useState(true);
  const [applyImportMeta, setApplyImportMeta] = useState(true);
  const [restoreFullBackup, setRestoreFullBackup] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveHandle, setArchiveHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [archiveEntries, setArchiveEntries] = useState<ArchiveEntry[]>([]);
  const [archiveStatus, setArchiveStatus] = useState<ArchiveStatus>("disconnected");
  const [archiveMessage, setArchiveMessage] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const dragSource = useRef<{ slot: Slot; day: Day; id: string } | null>(null);
  const dayDragSource = useRef<Day | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isPlanner(parsed)) setPlanner(normalizePlanner(parsed));
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

  useEffect(() => {
    const syncPresentation = () => setPresenting(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncPresentation);
    return () => document.removeEventListener("fullscreenchange", syncPresentation);
  }, []);

  useEffect(() => {
    if (!(window as DirectoryPickerWindow).showDirectoryPicker || !window.indexedDB) {
      setArchiveStatus("unsupported");
      return;
    }
    let active = true;
    loadArchiveHandle().then(async (handle) => {
      if (!active || !handle) return;
      setArchiveHandle(handle);
      const permission = await (handle as DirectoryPermissionHandle).queryPermission?.({ mode: "readwrite" });
      if (!active) return;
      if (permission === "granted") await scanArchiveFolder(handle);
      else {
        setArchiveStatus("permission");
        setArchiveMessage(`Reconnect “${handle.name}” to read its saved weeks.`);
      }
    }).catch(() => {
      if (active) setArchiveStatus("disconnected");
    });
    return () => { active = false; };
  }, []);

  const schedule = planner.schedules[activeSlot];
  const displayMode = appMode === "display" || presenting;
  const activeDays = days.filter((day) => planner.activeDays.includes(day));
  const visibleDays = viewMode === "day" ? [activeDays.includes(selectedDay) ? selectedDay : activeDays[0]] : activeDays;
  const displayDays = printMode === "weekly" ? activeDays : visibleDays;
  const segments = visibleDays.flatMap((day) => schedule[day]);
  const completed = segments.filter((item) => item.completed).length;
  const totalMinutes = segments.reduce((sum, item) => sum + item.minutes, 0);
  const progress = segments.length ? Math.round(completed / segments.length * 100) : 0;
  const selected = editing ? planner.schedules[editing.slot][editing.day].find((item) => item.id === editing.id) ?? null : null;
  const availableImportDays = pendingImport ? days.filter((day) => pendingImport.schedules[importSourceSlot]?.[day]) : [];
  const weekLabel = useMemo(() => {
    const date = new Date(`${planner.weekOf}T12:00:00`);
    return Number.isNaN(date.getTime()) ? "Unscheduled week" : `Week of ${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
  }, [planner.weekOf]);

  function updateMeta(key: keyof WeekMeta, value: string) {
    setPlanner((current) => ({ ...current, meta: { ...current.meta, [key]: value } }));
  }
  function updateObjective(day: Day, value: string, slot = activeSlot) {
    setPlanner((current) => ({ ...current, dailyObjectives: { ...current.dailyObjectives, [slot]: { ...current.dailyObjectives[slot], [day]: value } } }));
  }
  function updateSegment(day: Day, id: string, patch: Partial<Segment>, slot = activeSlot) {
    setPlanner((current) => ({ ...current, schedules: { ...current.schedules, [slot]: { ...current.schedules[slot], [day]: current.schedules[slot][day].map((item) => item.id === id ? { ...item, ...patch } : item) } } }));
  }
  function addSegment(day: Day) {
    const item: Segment = { id: uid(), title: "New segment", minutes: 10, notes: "Add the purpose, materials, or stopping point.", category: "Instruction", completed: false, resources: [] };
    setPlanner((current) => ({ ...current, schedules: { ...current.schedules, [activeSlot]: { ...current.schedules[activeSlot], [day]: [...current.schedules[activeSlot][day], item] } } }));
    setEditing({ slot: activeSlot, day, id: item.id });
  }
  function deleteSegment() {
    if (!editing || !selected || !confirm(`Delete “${selected.title}”?`)) return;
    setPlanner((current) => ({ ...current, schedules: { ...current.schedules, [editing.slot]: { ...current.schedules[editing.slot], [editing.day]: current.schedules[editing.slot][editing.day].filter((item) => item.id !== editing.id) } } }));
    setEditing(null);
  }
  function addResource() {
    if (!editing || !selected) return;
    updateSegment(editing.day, editing.id, { resources: [...selected.resources, { label: "Resource", url: "" }] }, editing.slot);
  }
  function updateResource(index: number, patch: Partial<ResourceLink>) {
    if (!editing || !selected) return;
    updateSegment(editing.day, editing.id, { resources: selected.resources.map((resource, resourceIndex) => resourceIndex === index ? { ...resource, ...patch } : resource) }, editing.slot);
  }
  function removeResource(index: number) {
    if (!editing || !selected) return;
    updateSegment(editing.day, editing.id, { resources: selected.resources.filter((_, resourceIndex) => resourceIndex !== index) }, editing.slot);
  }
  function moveSelectedToDay(targetDay: Day) {
    if (!editing || !selected || targetDay === editing.day) return;
    const sourceDay = editing.day;
    moveSegment({ slot: editing.slot, day: sourceDay, id: editing.id }, targetDay, planner.schedules[editing.slot][targetDay].length);
    setEditing({ ...editing, day: targetDay });
    setNotice(`“${selected.title}” moved from ${dayName[sourceDay]} to ${dayName[targetDay]}.`);
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
  function swapDayPlans(sourceDay: Day, targetDay: Day) {
    if (sourceDay === targetDay) return;
    setPlanner((current) => {
      const currentSchedule = current.schedules[activeSlot];
      const currentObjectives = current.dailyObjectives[activeSlot];
      return {
        ...current,
        schedules: { ...current.schedules, [activeSlot]: { ...currentSchedule, [sourceDay]: currentSchedule[targetDay], [targetDay]: currentSchedule[sourceDay] } },
        dailyObjectives: { ...current.dailyObjectives, [activeSlot]: { ...currentObjectives, [sourceDay]: currentObjectives[targetDay], [targetDay]: currentObjectives[sourceDay] } },
      };
    });
    setNotice(`${dayName[sourceDay]} and ${dayName[targetDay]} plans were swapped in ${slotName[activeSlot]}.`);
  }
  function dropPlanOnDay(targetDay: Day, targetIndex = schedule[targetDay].length) {
    if (appMode !== "edit") return;
    if (dayDragSource.current) swapDayPlans(dayDragSource.current, targetDay);
    else if (dragSource.current) moveSegment(dragSource.current, targetDay, targetIndex);
    dayDragSource.current = null;
    dragSource.current = null;
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
  function showDay(day: Day) {
    setSelectedDay(day);
    setPrintDay(day);
    setViewMode("day");
  }
  function changeAppMode(mode: "edit" | "display") {
    setAppMode(mode);
    setEditing(null);
    setBriefOpen(false);
    setDaysOpen(false);
  }
  async function togglePresentation() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { setPresenting(true); await document.documentElement.requestFullscreen(); }
    } catch {
      setPresenting(false);
      setNotice("Full screen is unavailable in this browser. The daily layout is still ready to project.");
    }
  }
  function copySlot(target: Slot) {
    if (!confirm(`Replace ${slotName[target]} with a copy of ${slotName[activeSlot]}?`)) return;
    const copy = Object.fromEntries(days.map((day) => [day, schedule[day].map((item) => ({ ...item, id: uid(), completed: false }))])) as Record<Day, Segment[]>;
    setPlanner((current) => ({ ...current, schedules: { ...current.schedules, [target]: copy }, dailyObjectives: { ...current.dailyObjectives, [target]: { ...current.dailyObjectives[activeSlot] } } }));
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
  async function scanArchiveFolder(handle = archiveHandle) {
    if (!handle) return;
    setArchiveStatus("working");
    setArchiveMessage("Scanning the archive folder…");
    try {
      const found: ArchiveEntry[] = [];
      for await (const child of (handle as IterableDirectoryHandle).values()) {
        if (child.kind !== "file" || !child.name.endsWith(".json")) continue;
        try {
          const file = await child.getFile();
          const parsed: unknown = JSON.parse(await file.text());
          if (isArchiveDocument(parsed)) {
            found.push({ ...parsed, planner: normalizePlanner(parsed.planner), filename: child.name });
          } else if (isPlanner(parsed)) {
            found.push({ format: "weekly-lesson-planner-archive", version: 1, archivedAt: new Date(file.lastModified).toISOString(), planner: normalizePlanner(parsed), filename: child.name });
          }
        } catch {
          // Ignore unrelated or malformed JSON files in the selected directory.
        }
      }
      found.sort((left, right) => right.planner.weekOf.localeCompare(left.planner.weekOf) || right.archivedAt.localeCompare(left.archivedAt));
      setArchiveEntries(found);
      setArchiveStatus("connected");
      setArchiveMessage(found.length ? `${found.length} archived week${found.length === 1 ? "" : "s"} found in “${handle.name}”.` : `“${handle.name}” is connected and ready for its first archived week.`);
    } catch {
      setArchiveStatus("permission");
      setArchiveMessage(`Access to “${handle.name}” needs to be restored.`);
    }
  }
  async function connectArchiveFolder(forcePicker = false) {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) { setArchiveStatus("unsupported"); return; }
    try {
      let handle = !forcePicker ? archiveHandle : null;
      if (handle) {
        const permissionHandle = handle as DirectoryPermissionHandle;
        const currentPermission = await permissionHandle.queryPermission?.({ mode: "readwrite" });
        const permission = currentPermission === "granted" ? currentPermission : await permissionHandle.requestPermission?.({ mode: "readwrite" });
        if (permission !== "granted") handle = null;
      }
      if (!handle) handle = await picker({ id: "weekly-lesson-planner-archive", mode: "readwrite" });
      setArchiveHandle(handle);
      await rememberArchiveHandle(handle);
      await scanArchiveFolder(handle);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setArchiveStatus("error");
      setArchiveMessage("The folder could not be connected. Please try again and allow read/write access.");
    }
  }
  async function archiveCurrentWeek() {
    if (!archiveHandle) { await connectArchiveFolder(); return; }
    setArchiveStatus("working");
    setArchiveMessage("Saving this week to Google Drive…");
    try {
      const archivedAt = new Date().toISOString();
      const filename = archiveFilename(planner, archivedAt);
      const document: ArchiveDocument = { format: "weekly-lesson-planner-archive", version: 1, archivedAt, planner };
      const fileHandle = await archiveHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(document, null, 2));
      await writable.close();
      await scanArchiveFolder(archiveHandle);
      setNotice(`Archived ${weekLabel} in “${archiveHandle.name}”.`);
    } catch {
      setArchiveStatus("permission");
      setArchiveMessage("The week was not saved. Reconnect the archive folder and try again.");
    }
  }
  function restoreArchivedWeek(entry: ArchiveEntry) {
    const topic = entry.planner.meta.topic || `week of ${entry.planner.weekOf}`;
    if (!confirm(`Replace the current planner with the archived plan “${topic}”?\n\nThe current week will remain only if you archive or export it first.`)) return;
    const restored = normalizePlanner(entry.planner);
    setPlanner(restored);
    setSelectedDay(restored.activeDays[0]);
    setPrintDay(restored.activeDays[0]);
    setEditing(null);
    setArchiveOpen(false);
    setNotice(`Restored the archived plan for ${restored.weekOf || "an undated week"}.`);
  }
  async function deleteArchivedWeek(entry: ArchiveEntry) {
    if (!archiveHandle || !confirm(`Delete “${entry.filename}” from the archive folder?\n\nRecovery will depend on your Google Drive settings.`)) return;
    try {
      await archiveHandle.removeEntry(entry.filename);
      await scanArchiveFolder(archiveHandle);
      setNotice(`Removed ${entry.filename} from the archive folder.`);
    } catch {
      setArchiveStatus("error");
      setArchiveMessage("That archive file could not be deleted. Refresh the folder and try again.");
    }
  }
  function downloadAiTemplate(scope: "day" | "week") {
    const sampleSegment = (title: string) => ({
      title,
      minutes: 15,
      notes: "Explain the student task, teacher moves, materials, and evidence of learning.",
      category: "Instruction",
      resources: [{ label: "Optional resource", url: "https://example.com" }],
    });
    const shared = {
      $schema: "weekly-lesson-planner-ai-v1",
      _instructions: "Give this JSON to GPT, Claude, Gemini, or another AI. Ask it to replace the placeholder content while preserving the keys, valid JSON syntax, and allowed category names. Aim for 90 total minutes per day.",
      allowedCategories: categories,
      weekOf: planner.weekOf,
      weeklyBrief: { ...planner.meta },
    };
    const template = scope === "day" ? {
      ...shared,
      day: activeDays.includes(selectedDay) ? selectedDay : activeDays[0],
      learningObjective: "Students will be able to…",
      segments: [sampleSegment("Opening activity"), sampleSegment("Core learning activity"), sampleSegment("Exit ticket")],
    } : {
      ...shared,
      days: Object.fromEntries(days.map((day) => [day, { learningObjective: "Students will be able to…", segments: [sampleSegment(`${dayName[day]} opening`), sampleSegment(`${dayName[day]} core activity`), sampleSegment(`${dayName[day]} reflection`)] }])),
    };
    download(JSON.stringify(template, null, 2), `ai-${scope}-lesson-template.json`, "application/json");
    setNotice(`AI ${scope} template downloaded.`);
  }
  function exportMarkdown() {
    const lines = [`# Cybersecurity Weekly Plan — ${weekLabel}`, "", `**Weekly topic:** ${planner.meta.topic || "Not set"}`, `**Central question:** ${planner.meta.centralQuestion || "Not set"}`, ""];
    slots.forEach((slot) => {
      lines.push(`## ${slotName[slot]}`, "");
      activeDays.forEach((day) => {
        lines.push(`### ${dayName[day]} — ${dayInfo[day].focus}`, "");
        lines.push(`**Learning objective:** ${planner.dailyObjectives[slot][day] || "Not set"}`, "");
        let elapsed = 0;
        planner.schedules[slot][day].forEach((item) => {
          const time = range(elapsed, item.minutes); elapsed += item.minutes;
          lines.push(`- [${item.completed ? "x" : " "}] **${time} · ${item.title}** (${item.minutes} min)`, `  - ${item.notes}`);
          item.resources.forEach((resource) => lines.push(`  - [${resource.label}](${safeHref(resource.url) || resource.url})`));
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
      let candidate: ImportCandidate | null = null;
      if (isPlanner(parsed)) {
        const backup = normalizePlanner(parsed);
        const schedules = Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(backup.activeDays.map((day) => [day, backup.schedules[slot][day]]))])) as ImportCandidate["schedules"];
        const objectives = Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(backup.activeDays.map((day) => [day, backup.dailyObjectives[slot][day]]))])) as ImportCandidate["objectives"];
        candidate = { filename: file.name, kind: "backup", weekOf: backup.weekOf, meta: backup.meta, sourceSlots: [...slots], schedules, objectives, backup };
      } else candidate = parseAiImport(parsed, file.name);
      if (!candidate) throw new Error("invalid");
      const sourceSlot = candidate.sourceSlots.includes(activeSlot) ? activeSlot : candidate.sourceSlots[0];
      setPendingImport(candidate);
      setImportSourceSlot(sourceSlot);
      setImportTargetSlot(activeSlot);
      setImportDays(days.filter((day) => candidate?.schedules[sourceSlot]?.[day]));
      setApplyImportWeek(Boolean(candidate.weekOf));
      setApplyImportMeta(Boolean(candidate.meta));
      setRestoreFullBackup(false);
    } catch { setNotice("That file is not a valid planner or AI lesson-plan JSON file. No schedule was changed."); }
  }
  function changeImportSource(slot: Slot) {
    if (!pendingImport) return;
    setImportSourceSlot(slot);
    setImportDays(days.filter((day) => pendingImport.schedules[slot]?.[day]));
  }
  function toggleImportDay(day: Day) {
    setImportDays((current) => current.includes(day) ? current.filter((item) => item !== day) : days.filter((item) => item === day || current.includes(item)));
  }
  function applySelectedImport() {
    if (!pendingImport) return;
    if (restoreFullBackup && pendingImport.backup) {
      setPlanner(pendingImport.backup);
      setPendingImport(null);
      setEditing(null);
      setNotice(`Restored the complete backup from ${pendingImport.filename}.`);
      return;
    }
    if (!importDays.length) { setNotice("Select at least one day to import."); return; }
    setPlanner((current) => {
      const targetSchedule = { ...current.schedules[importTargetSlot] };
      const targetObjectives = { ...current.dailyObjectives[importTargetSlot] };
      importDays.forEach((day) => {
        const incoming = pendingImport.schedules[importSourceSlot]?.[day];
        if (incoming) targetSchedule[day] = incoming.map((item) => ({ ...item, id: uid(), resources: item.resources.map((resource) => ({ ...resource })) }));
        targetObjectives[day] = pendingImport.objectives[importSourceSlot]?.[day] ?? "";
      });
      return {
        ...current,
        weekOf: applyImportWeek && pendingImport.weekOf ? pendingImport.weekOf : current.weekOf,
        meta: applyImportMeta && pendingImport.meta ? { ...current.meta, ...pendingImport.meta } : current.meta,
        activeDays: days.filter((day) => current.activeDays.includes(day) || importDays.includes(day)),
        schedules: { ...current.schedules, [importTargetSlot]: targetSchedule },
        dailyObjectives: { ...current.dailyObjectives, [importTargetSlot]: targetObjectives },
      };
    });
    setActiveSlot(importTargetSlot);
    if (importDays.length === 1) showDay(importDays[0]);
    setPendingImport(null);
    setEditing(null);
    setNotice(`Imported ${importDays.map((day) => dayName[day]).join(", ")} into ${slotName[importTargetSlot]}.`);
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

  return <main className={`planner-app view-${viewMode} mode-${displayMode ? "display" : "edit"} ${presenting ? "projection-mode" : ""} print-${printMode}`}>
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
        <div className="mode-toggle" aria-label="Planner mode">
          <button type="button" className={appMode === "edit" ? "active" : ""} aria-pressed={appMode === "edit"} onClick={() => changeAppMode("edit")}>Edit</button>
          <button type="button" className={appMode === "display" ? "active" : ""} aria-pressed={appMode === "display"} onClick={() => changeAppMode("display")}>Display</button>
        </div>
        <div className="view-toggle" aria-label="Schedule view">
          <button type="button" className={viewMode === "week" ? "active" : ""} aria-pressed={viewMode === "week"} onClick={() => setViewMode("week")}>Full week</button>
          <button type="button" className={viewMode === "day" ? "active" : ""} aria-pressed={viewMode === "day"} onClick={() => showDay(activeDays.includes(selectedDay) ? selectedDay : activeDays[0])}>Day view</button>
        </div>
        <button type="button" onClick={() => setArchiveOpen(true)}>Archive <span>{archiveEntries.length || ""}</span></button>
        {!displayMode && <><button type="button" onClick={() => setDaysOpen((open) => !open)}>School days <span>{activeDays.length}/5</span></button>
        <button type="button" onClick={() => setBriefOpen(true)}>Weekly brief</button>
        <button type="button" onClick={exportJson}>Export JSON</button>
        <button type="button" onClick={() => importInput.current?.click()}>Import JSON</button>
        <input ref={importInput} className="sr-only" type="file" accept="application/json,.json" onChange={importJson} />
        <details className="more-menu"><summary>More</summary><div>
          <button type="button" onClick={exportMarkdown}>Export readable Markdown</button>
          <button type="button" onClick={() => downloadAiTemplate("day")}>Download AI day JSON template</button>
          <button type="button" onClick={() => downloadAiTemplate("week")}>Download AI week JSON template</button>
          <button type="button" onClick={() => printPlan("weekly")}>Save weekly PDF</button>
          <label>Daily PDF day<select value={printDay} onChange={(event) => setPrintDay(event.target.value as Day)}>{activeDays.map((day) => <option key={day} value={day}>{dayName[day]}</option>)}</select></label>
          <button type="button" onClick={() => printPlan("daily")}>Save selected day PDF</button>
          {slots.filter((slot) => slot !== activeSlot).map((slot) => <button key={slot} type="button" onClick={() => copySlot(slot)}>Copy to {slotName[slot]}</button>)}
          <button type="button" className="danger" onClick={restoreTemplate}>Restore routine template</button>
        </div></details></>}
      </div>
      {!displayMode && daysOpen && <div className="day-picker"><span>Days in this school week</span>{days.map((day) => <label key={day}><input type="checkbox" checked={planner.activeDays.includes(day)} onChange={() => toggleDay(day)} />{dayName[day]}</label>)}</div>}
    </section>

    {viewMode === "day" && <nav className="day-view-nav screen-only" aria-label="Choose day to display">
      <span>{displayMode ? "Present a day" : "Select or drop on a day"}</span>
      <div>{activeDays.map((day) => <button key={day} type="button" className={visibleDays[0] === day ? "active" : ""} aria-current={visibleDays[0] === day ? "page" : undefined} onClick={() => showDay(day)} onDragOver={(event) => { if (!displayMode) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); dropPlanOnDay(day); showDay(day); }}><small>{dateForDay(planner.weekOf, day)}</small>{dayName[day]}</button>)}</div>
      <button className="projection-action" type="button" onClick={togglePresentation}>{presenting ? "Exit presentation" : "Enter full screen"}</button>
    </nav>}

    {notice && <div className="notice screen-only" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
    <section className="status-strip screen-only">
      <div><span>Active schedule</span><strong>{slotName[activeSlot]}</strong></div><div><span>{viewMode === "day" ? `${dayName[visibleDays[0]]} airtime` : "Planned airtime"}</span><strong>{totalMinutes} minutes</strong></div><div><span>Segments complete</span><strong>{completed} / {segments.length}</strong></div><div className="progress-stat"><span>{viewMode === "day" ? "Daily progress" : "Weekly progress"}</span><strong>{progress}%</strong><i><b style={{ width: `${progress}%` }} /></i></div>
    </section>

    <div className="print-heading"><p>Cybersecurity Weekly Lesson Planner</p><h1>{planner.meta.topic || weekLabel}</h1><div><span>{weekLabel}</span><span>{slotName[activeSlot]}</span><span>{printMode === "daily" ? dayName[printDay] : `${activeDays.length}-day school week`}</span></div>{planner.meta.centralQuestion && <p className="print-question">Central question: {planner.meta.centralQuestion}</p>}{printMode === "daily" && planner.dailyObjectives[activeSlot][printDay] && <p className="print-objective"><strong>Learning objective:</strong> {planner.dailyObjectives[activeSlot][printDay]}</p>}</div>

    <section className="schedule-section">
      <div className="schedule-title screen-only"><div><p className="eyebrow">01 // {viewMode === "day" ? "Daily plan" : "Broadcast board"}</p><h2>{viewMode === "day" ? `${dayName[visibleDays[0]]}, ${dateForDay(planner.weekOf, visibleDays[0])}` : weekLabel}</h2></div><p>{displayMode ? "A polished classroom-ready view of the selected plan. Resource links remain available for quick access." : viewMode === "day" ? "Edit the objective and activities here. Drag an activity or the entire day onto a day tab to move the plan." : "Drag activities between days, or drag a day header onto another column to swap both complete day plans."}</p></div>
      <div className={`schedule-board columns-${displayDays.length} ${viewMode === "day" ? "daily-view-board" : ""}`}>
        {displayDays.map((day) => {
          let elapsed = 0; const items = schedule[day]; const minutes = items.reduce((sum, item) => sum + item.minutes, 0);
          return <article className={`day-column ${printMode === "daily" && day === printDay ? "print-target" : ""}`} key={day} data-day={day} onDragOver={(event) => { if (!displayMode) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); dropPlanOnDay(day); }}>
            <header draggable={!displayMode} title={!displayMode ? `Drag to swap the ${dayName[day]} plan with another day` : undefined} onDragStart={(event: DragEvent<HTMLElement>) => { dayDragSource.current = day; dragSource.current = null; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", `day:${day}`); }} onDragEnd={() => { dayDragSource.current = null; }}><div><span>{dateForDay(planner.weekOf, day)}</span><strong>{dayName[day]}</strong><small>{dayInfo[day].focus}</small>{!displayMode && <i className="day-drag-hint">⠿ Drag header to swap days</i>}</div><b className={minutes === 90 ? "on-time" : minutes > 90 ? "over" : "under"}>{minutes}<small>/90</small></b></header>
            <div className={`objective-panel ${displayMode ? "objective-display" : ""}`}><label htmlFor={!displayMode ? `objective-${activeSlot}-${day}` : undefined}>Learning objective</label>{displayMode ? <div className="objective-copy">{planner.dailyObjectives[activeSlot][day] || "Learning objective not yet set."}</div> : <textarea id={`objective-${activeSlot}-${day}`} rows={viewMode === "day" ? 3 : 2} value={planner.dailyObjectives[activeSlot][day]} placeholder="Students will be able to…" onChange={(event) => updateObjective(day, event.target.value)} />}</div>
            <p className="day-outcome"><strong>Suggested outcome</strong>{dayInfo[day].outcome}</p>
            <div className="segment-list">{items.map((item, index) => {
              const start = elapsed; elapsed += item.minutes;
              const activityCopy = <><small>{item.category}</small><strong>{item.title}</strong><span>{item.notes}</span></>;
              return <div className={`segment-card category-${item.category.toLowerCase()} ${item.completed ? "completed" : ""}`} draggable={!displayMode} key={item.id} onDragStart={(event: DragEvent<HTMLDivElement>) => { if (displayMode) return; dragSource.current = { slot: activeSlot, day, id: item.id }; dayDragSource.current = null; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", `activity:${item.id}`); }} onDragEnd={() => { dragSource.current = null; }} onDragOver={(event) => { if (!displayMode) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); dropPlanOnDay(day, index); }}>
                <div className="segment-time"><span>{range(start, item.minutes)}</span>{displayMode && item.completed && <em>✓ Complete</em>}<b>{item.minutes}m</b></div>
                <div className="segment-main">{!displayMode && <label className="complete-check"><input type="checkbox" checked={item.completed} onChange={(event) => updateSegment(day, item.id, { completed: event.target.checked })} /><span aria-hidden="true">✓</span><span className="sr-only">Mark {item.title} complete</span></label>}{displayMode ? <div className="segment-copy segment-display-copy">{activityCopy}</div> : <button className="segment-copy" type="button" onClick={() => setEditing({ slot: activeSlot, day, id: item.id })}>{activityCopy}</button>}{!displayMode && <div className="card-movers screen-only"><button type="button" disabled={index === 0} onClick={() => reorder(day, item.id, -1)} aria-label="Move earlier">↑</button><button type="button" disabled={index === items.length - 1} onClick={() => reorder(day, item.id, 1)} aria-label="Move later">↓</button><button type="button" onClick={() => setEditing({ slot: activeSlot, day, id: item.id })} aria-label="Edit segment">•••</button></div>}{item.resources.some((resource) => safeHref(resource.url)) && <div className="segment-resources">{item.resources.map((resource, resourceIndex) => { const href = safeHref(resource.url); return href ? <a key={`${resource.url}-${resourceIndex}`} href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>↗ {resource.label || "Open resource"}</a> : null; })}</div>}</div>
              </div>;
            })}</div>
            {!displayMode && <button className="add-segment screen-only" type="button" onClick={() => addSegment(day)}>＋ Add segment</button>}<footer><span>Daily product</span><p>{dayInfo[day].product}</p></footer>
          </article>;
        })}
      </div>
    </section>

    <section className="weekly-notes"><div><span>Certification objectives</span><p>{planner.meta.certificationObjectives || "Not specified."}</p></div><div><span>Required evidence</span><p>{planner.meta.evidence || "Not specified."}</p></div><div><span>Friday synthesis question</span><p>{planner.meta.synthesisQuestion || "Not specified."}</p></div><div><span>Likely misconceptions</span><p>{planner.meta.misconceptions || "Not specified."}</p></div></section>

    {archiveOpen && <div className="modal-backdrop archive-backdrop screen-only" onMouseDown={() => setArchiveOpen(false)}><section className="drawer archive-drawer" role="dialog" aria-modal="true" aria-labelledby="archive-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Durable planning library // Google Drive</p><h2 id="archive-title">Week archive</h2></div><button type="button" onClick={() => setArchiveOpen(false)} aria-label="Close">×</button></div>
      <section className={`archive-connection status-${archiveStatus}`}><div><span>{archiveStatus === "connected" ? "Folder connected" : archiveStatus === "working" ? "Working" : archiveStatus === "permission" ? "Reconnect needed" : archiveStatus === "unsupported" ? "Browser fallback" : "Archive folder"}</span><strong>{archiveHandle?.name || "Weekly Lesson Planner Archive"}</strong><p aria-live="polite">{archiveStatus === "unsupported" ? "Folder access is unavailable in this browser. You can still download a portable JSON backup." : archiveMessage || "Choose the folder you created in Google Drive. No share link or permission change is needed."}</p></div><i aria-hidden="true">{archiveStatus === "connected" ? "✓" : archiveStatus === "working" ? "…" : "↗"}</i></section>
      <div className="archive-toolbar">{archiveStatus === "unsupported" ? <button className="primary" type="button" onClick={exportJson}>Download JSON backup</button> : <><button className="primary" type="button" disabled={archiveStatus === "working"} onClick={() => archiveHandle && archiveStatus === "connected" ? archiveCurrentWeek() : connectArchiveFolder(false)}>{archiveHandle && archiveStatus === "connected" ? "Archive current week" : archiveStatus === "permission" ? "Reconnect folder" : "Connect archive folder"}</button>{archiveHandle && <button type="button" disabled={archiveStatus === "working"} onClick={() => scanArchiveFolder()}>Refresh</button>}<button type="button" disabled={archiveStatus === "working"} onClick={() => connectArchiveFolder(true)}>{archiveHandle ? "Change folder" : "Choose folder"}</button></>}</div>
      <p className="archive-assurance">The archive files live in Google Drive. If browser storage is cleared, reconnect this same folder and the app will rebuild the list.</p>
      <div className="archive-list">{archiveEntries.length === 0 ? <div className="archive-empty"><strong>No archived weeks are listed yet.</strong><p>Connect the folder, then use <em>Archive current week</em> whenever you want a permanent snapshot.</p></div> : archiveEntries.map((entry) => <article className="archive-card" key={entry.filename}><div><span>{entry.planner.weekOf ? `Week of ${entry.planner.weekOf}` : "Undated week"}</span><h3>{entry.planner.meta.topic || "Untitled lesson plan"}</h3><p>{entry.planner.activeDays.length} school day{entry.planner.activeDays.length === 1 ? "" : "s"} · Saved {formatArchiveDate(entry.archivedAt)}</p><small title={entry.filename}>{entry.filename}</small></div><div><button type="button" onClick={() => restoreArchivedWeek(entry)}>Restore</button><button className="danger" type="button" onClick={() => deleteArchivedWeek(entry)}>Delete</button></div></article>)}</div>
    </section></div>}

    {pendingImport && <div className="modal-backdrop import-backdrop screen-only" onMouseDown={() => setPendingImport(null)}><section className="drawer import-drawer" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">JSON import // Review before applying</p><h2 id="import-title">Choose what to import</h2></div><button type="button" onClick={() => setPendingImport(null)} aria-label="Close">×</button></div><p className="import-summary"><strong>{pendingImport.filename}</strong> contains {pendingImport.kind === "ai" ? "an AI-generated lesson plan" : "a complete planner backup"}. Only the choices below will be changed.</p>{pendingImport.backup && <label className="restore-choice"><input type="checkbox" checked={restoreFullBackup} onChange={(event) => setRestoreFullBackup(event.target.checked)} /><span><strong>Restore the complete backup</strong><small>Replace the week, weekly brief, all school days, all three slots, and completion status.</small></span></label>}{!restoreFullBackup && <><div className="import-routing">{pendingImport.kind === "backup" && <label><span>Copy from</span><select value={importSourceSlot} onChange={(event) => changeImportSource(event.target.value as Slot)}>{pendingImport.sourceSlots.map((slot) => <option key={slot} value={slot}>{slotName[slot]}</option>)}</select></label>}<label><span>Import into</span><select value={importTargetSlot} onChange={(event) => setImportTargetSlot(event.target.value as Slot)}>{slots.map((slot) => <option key={slot} value={slot}>{slotName[slot]}</option>)}</select></label></div><fieldset className="import-days"><legend>Days to import</legend>{availableImportDays.map((day) => <label key={day}><input type="checkbox" checked={importDays.includes(day)} onChange={() => toggleImportDay(day)} /><span><strong>{dayName[day]}</strong><small>{pendingImport.schedules[importSourceSlot]?.[day]?.length ?? 0} activities</small></span></label>)}</fieldset><div className="import-options">{pendingImport.weekOf && <label><input type="checkbox" checked={applyImportWeek} onChange={(event) => setApplyImportWeek(event.target.checked)} />Use imported week date <strong>{pendingImport.weekOf}</strong></label>}{pendingImport.meta && <label><input type="checkbox" checked={applyImportMeta} onChange={(event) => setApplyImportMeta(event.target.checked)} />Apply the imported weekly brief</label>}</div></>}<div className="drawer-actions"><button type="button" onClick={() => setPendingImport(null)}>Cancel</button><button className="primary" type="button" disabled={!restoreFullBackup && importDays.length === 0} onClick={applySelectedImport}>{restoreFullBackup ? "Restore backup" : `Import ${importDays.length} day${importDays.length === 1 ? "" : "s"}`}</button></div></section></div>}

    {briefOpen && <div className="modal-backdrop screen-only" onMouseDown={() => setBriefOpen(false)}><section className="drawer weekly-drawer" role="dialog" aria-modal="true" aria-labelledby="brief-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Planning dossier</p><h2 id="brief-title">Weekly brief</h2></div><button type="button" onClick={() => setBriefOpen(false)} aria-label="Close">×</button></div><div className="field-grid">{metaFields.map(([key, label, placeholder]) => <label key={key} className={key === "topic" || key === "centralQuestion" ? "wide" : ""}><span>{label}</span><textarea rows={key === "topic" ? 2 : 3} value={planner.meta[key]} placeholder={placeholder} onChange={(event) => updateMeta(key, event.target.value)} /></label>)}</div><div className="drawer-actions"><button className="primary" type="button" onClick={() => setBriefOpen(false)}>Done</button></div></section></div>}

    {editing && selected && <div className="modal-backdrop screen-only" onMouseDown={() => setEditing(null)}><section className="drawer segment-drawer" role="dialog" aria-modal="true" aria-labelledby="segment-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">{dayName[editing.day]} // {slotName[editing.slot]}</p><h2 id="segment-title">Edit segment</h2></div><button type="button" onClick={() => setEditing(null)} aria-label="Close">×</button></div><label><span>Activity title</span><input value={selected.title} onChange={(event) => updateSegment(editing.day, editing.id, { title: event.target.value }, editing.slot)} /></label><div className="split-fields"><label><span>Minutes</span><input type="number" min="1" max="180" value={selected.minutes} onChange={(event) => updateSegment(editing.day, editing.id, { minutes: Math.max(1, Number(event.target.value) || 1) }, editing.slot)} /></label><label><span>Category</span><select value={selected.category} onChange={(event) => updateSegment(editing.day, editing.id, { category: event.target.value as Category }, editing.slot)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div><label><span>Purpose and teacher notes</span><textarea rows={7} value={selected.notes} onChange={(event) => updateSegment(editing.day, editing.id, { notes: event.target.value }, editing.slot)} /></label><label className="move-day-field"><span>Scheduled day</span><select value={editing.day} onChange={(event) => moveSelectedToDay(event.target.value as Day)}>{activeDays.map((day) => <option key={day} value={day}>{dayName[day]}</option>)}</select><small>Useful on touch devices when dragging is inconvenient.</small></label><section className="resource-editor"><div><span>Activity links</span><button type="button" onClick={addResource}>＋ Add link</button></div>{selected.resources.length === 0 && <p>Add websites, documents, videos, or other resources students can open from this card.</p>}{selected.resources.map((resource, index) => <div className="resource-row" key={index}><label><span>Link label</span><input value={resource.label} placeholder="Lab instructions" onChange={(event) => updateResource(index, { label: event.target.value })} /></label><label><span>Web address</span><input type="url" value={resource.url} placeholder="https://…" onChange={(event) => updateResource(index, { url: event.target.value })} /></label><button type="button" onClick={() => removeResource(index)} aria-label={`Remove ${resource.label || "link"}`}>×</button></div>)}</section><label className="completion-row"><input type="checkbox" checked={selected.completed} onChange={(event) => updateSegment(editing.day, editing.id, { completed: event.target.checked }, editing.slot)} />Completed as planned</label><div className="drawer-actions"><button className="danger" type="button" onClick={deleteSegment}>Delete</button><button className="primary" type="button" onClick={() => setEditing(null)}>Done</button></div></section></div>}
  </main>;
}
