"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type Day = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
type Slot = "slot1" | "slot2" | "slot3";
type Category = "Opening" | "Reading" | "Discussion" | "Instruction" | "Lab" | "Python" | "Reflection" | "Assessment";
type ResourceLink = { label: string; url: string };
type Segment = { id: string; title: string; minutes: number; notes: string; category: Category; completed: boolean; resources: ResourceLink[] };
type DayDetails = { focus: string; outcome: string; product: string };
type TeachingRecord = {
  finishedAt: string;
  reflection: string;
  resumeNote: string;
  plannedObjective: string;
  plannedDetails: DayDetails;
  plannedSegments: Segment[];
  rolledForward: { segmentIds: string[]; destination: Day | "next-week" };
};
type WeekMeta = {
  topic: string; centralQuestion: string; certificationObjectives: string; article: string;
  video: string; mentalModel: string; pythonConnection: string; primaryLab: string;
  evidence: string; synthesisQuestion: string; misconceptions: string; scaffolding: string; extension: string;
};
type LibraryActivity = { id: string; kind: "activity"; name: string; createdAt: string; segment: Segment };
type LibraryDay = { id: string; kind: "day"; name: string; createdAt: string; objective: string; details: DayDetails; segments: Segment[] };
type LibraryWeek = {
  id: string; kind: "week"; name: string; createdAt: string; activeDays: Day[]; meta: WeekMeta;
  schedules: Record<Slot, Record<Day, Segment[]>>;
  dailyObjectives: Record<Slot, Record<Day, string>>;
  dailyDetails: Record<Slot, Record<Day, DayDetails>>;
};
type LibraryItem = LibraryActivity | LibraryDay | LibraryWeek;
type Planner = {
  schemaVersion: 1;
  weekOf: string;
  activeDays: Day[];
  meta: WeekMeta;
  schedules: Record<Slot, Record<Day, Segment[]>>;
  dailyObjectives: Record<Slot, Record<Day, string>>;
  dailyDetails: Record<Slot, Record<Day, DayDetails>>;
  teachingRecords: Record<Slot, Partial<Record<Day, TeachingRecord>>>;
  library: LibraryItem[];
  slotStartTimes: Record<Slot, string>;
};
type ImportCandidate = {
  filename: string;
  kind: "ai" | "backup";
  weekOf?: string;
  meta?: Partial<WeekMeta>;
  sourceSlots: Slot[];
  schedules: Partial<Record<Slot, Partial<Record<Day, Segment[]>>>>;
  objectives: Partial<Record<Slot, Partial<Record<Day, string>>>>;
  details: Partial<Record<Slot, Partial<Record<Day, DayDetails>>>>;
  backup?: Planner;
};
type ArchiveDocument = { format: "weekly-lesson-planner-archive"; version: 1; title?: string; archivedAt: string; planner: Planner };
type ArchiveEntry = ArchiveDocument & { title: string; filename: string };
type ArchiveStatus = "unsupported" | "disconnected" | "permission" | "connected" | "working" | "error";
type PlannerUpdate = Planner | ((current: Planner) => Planner);
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
function freshDetails(): Record<Day, DayDetails> {
  return Object.fromEntries(days.map((day) => [day, { focus: dayInfo[day].focus, outcome: dayInfo[day].outcome, product: dayInfo[day].product }])) as Record<Day, DayDetails>;
}
function blankMeta(): WeekMeta {
  return Object.fromEntries(["topic", "centralQuestion", "certificationObjectives", "article", "video", "mentalModel", "pythonConnection", "primaryLab", "evidence", "synthesisQuestion", "misconceptions", "scaffolding", "extension"].map((key) => [key, ""])) as WeekMeta;
}
function defaultPlanner(): Planner {
  return {
    schemaVersion: 1,
    weekOf: currentMonday(),
    activeDays: [...days],
    meta: blankMeta(),
    schedules: { slot1: freshSchedule(), slot2: freshSchedule(), slot3: freshSchedule() },
    dailyObjectives: { slot1: freshObjectives(), slot2: freshObjectives(), slot3: freshObjectives() },
    dailyDetails: { slot1: freshDetails(), slot2: freshDetails(), slot3: freshDetails() },
    teachingRecords: { slot1: {}, slot2: {}, slot3: {} },
    library: [],
    slotStartTimes: { slot1: "", slot2: "", slot3: "" },
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
    && (!candidate.dailyObjectives || slots.every((slot) => days.every((day) => typeof candidate.dailyObjectives?.[slot]?.[day] === "string")))
    && (!candidate.dailyDetails || slots.every((slot) => days.every((day) => typeof candidate.dailyDetails?.[slot]?.[day]?.focus === "string" && typeof candidate.dailyDetails?.[slot]?.[day]?.outcome === "string")))
    && (!candidate.teachingRecords || slots.every((slot) => candidate.teachingRecords?.[slot] && typeof candidate.teachingRecords[slot] === "object"))
    && (!candidate.library || Array.isArray(candidate.library))
    && (!candidate.slotStartTimes || slots.every((slot) => typeof candidate.slotStartTimes?.[slot] === "string"));
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
function normalizeTeachingRecord(value: unknown, day: Day): TeachingRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TeachingRecord>;
  if (typeof candidate.finishedAt !== "string") return null;
  const destination = candidate.rolledForward?.destination;
  return {
    finishedAt: candidate.finishedAt,
    reflection: typeof candidate.reflection === "string" ? candidate.reflection : "",
    resumeNote: typeof candidate.resumeNote === "string" ? candidate.resumeNote : "",
    plannedObjective: typeof candidate.plannedObjective === "string" ? candidate.plannedObjective : "",
    plannedDetails: {
      focus: typeof candidate.plannedDetails?.focus === "string" ? candidate.plannedDetails.focus : dayInfo[day].focus,
      outcome: typeof candidate.plannedDetails?.outcome === "string" ? candidate.plannedDetails.outcome : dayInfo[day].outcome,
      product: typeof candidate.plannedDetails?.product === "string" ? candidate.plannedDetails.product : dayInfo[day].product,
    },
    plannedSegments: Array.isArray(candidate.plannedSegments) ? candidate.plannedSegments.map(normalizeSegment) : [],
    rolledForward: {
      segmentIds: Array.isArray(candidate.rolledForward?.segmentIds) ? candidate.rolledForward.segmentIds.filter((id): id is string => typeof id === "string") : [],
      destination: destination === "next-week" || days.includes(destination as Day) ? destination as Day | "next-week" : "next-week",
    },
  };
}
function normalizeLibraryItem(value: unknown): LibraryItem | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LibraryItem> & Record<string, unknown>;
  if (typeof candidate.id !== "string" || typeof candidate.name !== "string" || typeof candidate.createdAt !== "string") return null;
  const base = { id: candidate.id, name: candidate.name, createdAt: candidate.createdAt };
  if (candidate.kind === "activity") {
    return { ...base, kind: "activity", segment: { ...normalizeSegment(candidate.segment), completed: false } };
  }
  if (candidate.kind === "day") {
    const details = candidate.details as Partial<DayDetails> | undefined;
    return {
      ...base,
      kind: "day",
      objective: typeof candidate.objective === "string" ? candidate.objective : "",
      details: { focus: typeof details?.focus === "string" ? details.focus : "Daily focus", outcome: typeof details?.outcome === "string" ? details.outcome : "", product: typeof details?.product === "string" ? details.product : "" },
      segments: Array.isArray(candidate.segments) ? candidate.segments.map((item) => ({ ...normalizeSegment(item), completed: false })) : [],
    };
  }
  if (candidate.kind === "week") {
    const sourceSchedules = candidate.schedules as LibraryWeek["schedules"] | undefined;
    if (!sourceSchedules || !slots.every((slot) => days.every((day) => Array.isArray(sourceSchedules[slot]?.[day])))) return null;
    const sourceObjectives = candidate.dailyObjectives as Partial<LibraryWeek["dailyObjectives"]> | undefined;
    const sourceDetails = candidate.dailyDetails as Partial<LibraryWeek["dailyDetails"]> | undefined;
    const activeDays = Array.isArray(candidate.activeDays) ? days.filter((day) => candidate.activeDays?.includes(day)) : [...days];
    return {
      ...base,
      kind: "week",
      activeDays: activeDays.length ? activeDays : [...days],
      meta: { ...blankMeta(), ...normalizeMeta(candidate.meta) },
      schedules: Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(days.map((day) => [day, sourceSchedules[slot][day].map((item) => ({ ...normalizeSegment(item), completed: false }))]))])) as LibraryWeek["schedules"],
      dailyObjectives: Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(days.map((day) => [day, typeof sourceObjectives?.[slot]?.[day] === "string" ? sourceObjectives[slot]![day] : ""]))])) as LibraryWeek["dailyObjectives"],
      dailyDetails: Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(days.map((day) => [day, {
        focus: typeof sourceDetails?.[slot]?.[day]?.focus === "string" ? sourceDetails[slot]![day].focus : dayInfo[day].focus,
        outcome: typeof sourceDetails?.[slot]?.[day]?.outcome === "string" ? sourceDetails[slot]![day].outcome : dayInfo[day].outcome,
        product: typeof sourceDetails?.[slot]?.[day]?.product === "string" ? sourceDetails[slot]![day].product : dayInfo[day].product,
      }]))])) as LibraryWeek["dailyDetails"],
    };
  }
  return null;
}
function normalizePlanner(input: unknown): Planner {
  const value = input as Omit<Planner, "dailyObjectives" | "dailyDetails" | "teachingRecords" | "library" | "slotStartTimes"> & { dailyObjectives?: Planner["dailyObjectives"]; dailyDetails?: Planner["dailyDetails"]; teachingRecords?: Planner["teachingRecords"]; library?: unknown[]; slotStartTimes?: Partial<Record<Slot, string>> };
  return {
    ...value,
    schedules: Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(days.map((day) => [day, value.schedules[slot][day].map(normalizeSegment)]))])) as Planner["schedules"],
    dailyObjectives: Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(days.map((day) => [day, value.dailyObjectives?.[slot]?.[day] ?? ""]))])) as Planner["dailyObjectives"],
    dailyDetails: Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(days.map((day) => [day, {
      focus: value.dailyDetails?.[slot]?.[day]?.focus ?? dayInfo[day].focus,
      outcome: value.dailyDetails?.[slot]?.[day]?.outcome ?? dayInfo[day].outcome,
      product: value.dailyDetails?.[slot]?.[day]?.product ?? dayInfo[day].product,
    }]))])) as Planner["dailyDetails"],
    teachingRecords: Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(days.flatMap((day) => {
      const record = normalizeTeachingRecord(value.teachingRecords?.[slot]?.[day], day);
      return record ? [[day, record]] : [];
    }))])) as Planner["teachingRecords"],
    library: Array.isArray(value.library) ? value.library.flatMap((item) => {
      const normalized = normalizeLibraryItem(item);
      return normalized ? [normalized] : [];
    }) : [],
    slotStartTimes: Object.fromEntries(slots.map((slot) => [slot, typeof value.slotStartTimes?.[slot] === "string" ? value.slotStartTimes[slot] : ""])) as Planner["slotStartTimes"],
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
function archiveFilename(planner: Planner, archivedAt: string, title: string) {
  const topic = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || planner.meta.topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "lesson-plan";
  const timestamp = archivedAt.replace(/[:.]/g, "-");
  return `${planner.weekOf || "undated"}--${topic}--${timestamp}.lesson-plan.json`;
}
function defaultArchiveTitle(planner: Planner) {
  return planner.meta.topic.trim() || `Week of ${planner.weekOf || "undated"}`;
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
  const source = value as { weekOf?: unknown; weeklyBrief?: unknown; days?: unknown; day?: unknown; dayHeader?: unknown; desiredOutcome?: unknown; suggestedOutcome?: unknown; dailyProduct?: unknown; learningObjective?: unknown; segments?: unknown };
  const rawDays: Partial<Record<Day, unknown>> = {};
  if (source.days && typeof source.days === "object") {
    days.forEach((day) => { if (day in (source.days as object)) rawDays[day] = (source.days as Partial<Record<Day, unknown>>)[day]; });
  } else if (typeof source.day === "string" && days.includes(source.day as Day)) {
    rawDays[source.day as Day] = { dayHeader: source.dayHeader, desiredOutcome: source.desiredOutcome, suggestedOutcome: source.suggestedOutcome, dailyProduct: source.dailyProduct, learningObjective: source.learningObjective, segments: source.segments };
  }
  const schedule: Partial<Record<Day, Segment[]>> = {};
  const objectives: Partial<Record<Day, string>> = {};
  const details: Partial<Record<Day, DayDetails>> = {};
  days.forEach((day) => {
    const raw = rawDays[day];
    if (!raw || typeof raw !== "object") return;
    const dayPlan = raw as { dayHeader?: unknown; desiredOutcome?: unknown; suggestedOutcome?: unknown; dailyProduct?: unknown; learningObjective?: unknown; segments?: unknown };
    if (!Array.isArray(dayPlan.segments)) return;
    const imported = dayPlan.segments.flatMap((segment) => {
      if (!segment || typeof segment !== "object") return [];
      const item = segment as Partial<Segment>;
      if (typeof item.title !== "string" || !item.title.trim()) return [];
      return [{ ...normalizeSegment(item), id: uid(), completed: false }];
    });
    schedule[day] = imported;
    objectives[day] = typeof dayPlan.learningObjective === "string" ? dayPlan.learningObjective : "";
    details[day] = {
      focus: typeof dayPlan.dayHeader === "string" ? dayPlan.dayHeader : dayInfo[day].focus,
      outcome: typeof dayPlan.desiredOutcome === "string" ? dayPlan.desiredOutcome : typeof dayPlan.suggestedOutcome === "string" ? dayPlan.suggestedOutcome : dayInfo[day].outcome,
      product: typeof dayPlan.dailyProduct === "string" ? dayPlan.dailyProduct : dayInfo[day].product,
    };
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
    details: { slot1: details },
  };
}
function range(start: number, duration: number, slotStart = "") {
  const match = /^(\d{2}):(\d{2})$/.exec(slotStart);
  if (!match) {
    const relativeClock = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
    return `${relativeClock(start)}–${relativeClock(start + duration)}`;
  }
  const base = Number(match[1]) * 60 + Number(match[2]);
  const clock = (minutes: number) => {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const hour = Math.floor(normalized / 60);
    return { text: `${hour % 12 || 12}:${String(normalized % 60).padStart(2, "0")}`, period: hour < 12 ? "AM" : "PM" };
  };
  const from = clock(base + start); const to = clock(base + start + duration);
  return from.period === to.period ? `${from.text}–${to.text} ${to.period}` : `${from.text} ${from.period}–${to.text} ${to.period}`;
}
function displaySlotWindow(value: string) {
  return value ? range(0, 90, value) : "";
}
function displaySlotEnd(value: string) {
  return value ? displaySlotWindow(value).split("–")[1] : "";
}
function dateForDay(weekOf: string, day: Day) {
  const date = new Date(`${weekOf}T12:00:00`);
  date.setDate(date.getDate() + days.indexOf(day));
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function isoDateForDay(weekOf: string, day: Day) {
  const date = new Date(`${weekOf}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days.indexOf(day));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dateNumber = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dateNumber}`;
}
function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dateNumber = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dateNumber}`;
}
function shiftWeek(weekOf: string, amount = 1) {
  const date = new Date(`${weekOf}T12:00:00`);
  if (Number.isNaN(date.getTime())) return currentMonday();
  date.setDate(date.getDate() + amount * 7);
  return date.toISOString().slice(0, 10);
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
  const [printMode, setPrintMode] = useState<"none" | "weekly" | "daily" | "summary">("none");
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
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 });
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishDay, setFinishDay] = useState<Day>("monday");
  const [finishSelected, setFinishSelected] = useState<string[]>([]);
  const [finishDestination, setFinishDestination] = useState<Day | "next-week">("next-week");
  const [finishReflection, setFinishReflection] = useState("");
  const [finishResumeNote, setFinishResumeNote] = useState("");
  const [nextWeekOpen, setNextWeekOpen] = useState(false);
  const [nextWeekMode, setNextWeekMode] = useState<"unfinished" | "copy" | "fresh">("unfinished");
  const [carryWeeklyBrief, setCarryWeeklyBrief] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<"all" | LibraryItem["kind"]>("all");
  const [libraryTargetSlot, setLibraryTargetSlot] = useState<Slot>("slot1");
  const [libraryTargetDay, setLibraryTargetDay] = useState<Day>("monday");
  const [slotTimesOpen, setSlotTimesOpen] = useState(false);
  const [archiveTitle, setArchiveTitle] = useState("");
  const [clockNow, setClockNow] = useState(() => new Date());
  const [soundCuesEnabled, setSoundCuesEnabled] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const dragSource = useRef<{ slot: Slot; day: Day; id: string } | null>(null);
  const dayDragSource = useRef<Day | null>(null);
  const undoHistory = useRef<Planner[]>([]);
  const redoHistory = useRef<Planner[]>([]);
  const audioContext = useRef<AudioContext | null>(null);
  const lastPacingPhase = useRef("");
  const lastPacingContext = useRef("");

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
    if (viewMode !== "day" || (appMode !== "display" && !presenting)) return;
    const tick = () => setClockNow(new Date());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [appMode, presenting, viewMode]);

  useEffect(() => () => { void audioContext.current?.close(); }, []);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (!command) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoPlanner(); else undoPlanner();
      } else if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoPlanner();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [planner]);

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
  const finishItems = planner.schedules[activeSlot][finishDay].filter((item) => !item.completed);
  const finishLaterDays = activeDays.slice(activeDays.indexOf(finishDay) + 1);
  const finishRecord = planner.teachingRecords[activeSlot][finishDay];
  const unfinishedWeekCount = slots.reduce((count, slot) => count + activeDays.reduce((dayCount, day) => dayCount + planner.schedules[slot][day].filter((item) => !item.completed).length, 0), 0);
  const libraryQuery = librarySearch.trim().toLowerCase();
  const filteredLibrary = planner.library.filter((item) => {
    if (libraryFilter !== "all" && item.kind !== libraryFilter) return false;
    if (!libraryQuery) return true;
    const searchable = item.kind === "activity" ? `${item.name} ${item.segment.title} ${item.segment.notes} ${item.segment.category}`
      : item.kind === "day" ? `${item.name} ${item.objective} ${item.details.focus} ${item.details.outcome} ${item.segments.map((segment) => `${segment.title} ${segment.notes}`).join(" ")}`
      : `${item.name} ${item.meta.topic} ${item.meta.centralQuestion} ${item.meta.certificationObjectives}`;
    return searchable.toLowerCase().includes(libraryQuery);
  });
  const pacingDay = activeDays.includes(selectedDay) ? selectedDay : activeDays[0];
  const pacingStart = planner.slotStartTimes[activeSlot];
  const pacingDateMatches = isoDateForDay(planner.weekOf, pacingDay) === localIsoDate(clockNow);
  const pacingStartMatch = /^(\d{2}):(\d{2})$/.exec(pacingStart);
  const pacingOffset = pacingDateMatches && pacingStartMatch
    ? clockNow.getHours() * 60 + clockNow.getMinutes() + clockNow.getSeconds() / 60 - (Number(pacingStartMatch[1]) * 60 + Number(pacingStartMatch[2]))
    : null;
  let pacingElapsed = 0;
  const liveSegmentId = displayMode && viewMode === "day" && pacingOffset !== null
    ? planner.schedules[activeSlot][pacingDay].find((item) => {
      const isLive = pacingOffset >= pacingElapsed && pacingOffset < pacingElapsed + item.minutes;
      pacingElapsed += item.minutes;
      return isLive;
    })?.id ?? null
    : null;
  const pacingTotal = planner.schedules[activeSlot][pacingDay].reduce((total, item) => total + item.minutes, 0);
  const pacingPhase = pacingOffset === null ? "inactive" : pacingOffset < 0 ? "before" : pacingOffset >= pacingTotal ? "after" : `activity:${liveSegmentId}`;
  const pacingContext = `${activeSlot}:${pacingDay}:${pacingStart}`;

  useEffect(() => {
    if (lastPacingContext.current !== pacingContext) {
      lastPacingContext.current = pacingContext;
      lastPacingPhase.current = pacingPhase;
      return;
    }
    if (lastPacingPhase.current && lastPacingPhase.current !== pacingPhase && soundCuesEnabled && pacingPhase.startsWith("activity:")) playTransitionTone();
    lastPacingPhase.current = pacingPhase;
  }, [pacingContext, pacingPhase, soundCuesEnabled]);
  const weekLabel = useMemo(() => {
    const date = new Date(`${planner.weekOf}T12:00:00`);
    return Number.isNaN(date.getTime()) ? "Unscheduled week" : `Week of ${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
  }, [planner.weekOf]);

  function changePlanner(update: PlannerUpdate) {
    const next = typeof update === "function" ? update(planner) : update;
    if (next === planner) return;
    undoHistory.current = [...undoHistory.current, planner].slice(-100);
    redoHistory.current = [];
    setPlanner(next);
    setHistoryState({ undo: undoHistory.current.length, redo: 0 });
  }
  function undoPlanner() {
    const previous = undoHistory.current.at(-1);
    if (!previous) return;
    undoHistory.current = undoHistory.current.slice(0, -1);
    redoHistory.current = [planner, ...redoHistory.current].slice(0, 100);
    setPlanner(previous);
    setEditing(null);
    setHistoryState({ undo: undoHistory.current.length, redo: redoHistory.current.length });
    setNotice("Undid the last planner change.");
  }
  function redoPlanner() {
    const next = redoHistory.current[0];
    if (!next) return;
    redoHistory.current = redoHistory.current.slice(1);
    undoHistory.current = [...undoHistory.current, planner].slice(-100);
    setPlanner(next);
    setEditing(null);
    setHistoryState({ undo: undoHistory.current.length, redo: redoHistory.current.length });
    setNotice("Redid the planner change.");
  }

  function updateMeta(key: keyof WeekMeta, value: string) {
    changePlanner((current) => ({ ...current, meta: { ...current.meta, [key]: value } }));
  }
  function updateSlotStartTime(slot: Slot, value: string) {
    changePlanner((current) => ({ ...current, slotStartTimes: { ...current.slotStartTimes, [slot]: value } }));
  }
  function clearSlotStartTimes() {
    changePlanner((current) => ({ ...current, slotStartTimes: { slot1: "", slot2: "", slot3: "" } }));
  }
  function playTransitionTone(confirmation = false) {
    const context = audioContext.current;
    if (!context || context.state !== "running") return;
    const start = context.currentTime;
    const notes = confirmation ? [660, 880] : [784, 988];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = start + index * 0.16;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.13);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.14);
    });
  }
  async function toggleSoundCues() {
    if (soundCuesEnabled) {
      setSoundCuesEnabled(false);
      setNotice("Activity transition sounds are off.");
      return;
    }
    try {
      audioContext.current ??= new AudioContext();
      await audioContext.current.resume();
      setSoundCuesEnabled(true);
      playTransitionTone(true);
      setNotice("Activity transition sounds are on for this session.");
    } catch {
      setNotice("The browser could not enable sound cues. Check its audio permissions and try again.");
    }
  }
  function openArchiveManager() {
    setArchiveTitle(planner.meta.topic.trim() || `Week of ${planner.weekOf || "undated"}`);
    setArchiveOpen(true);
  }
  function updateObjective(day: Day, value: string, slot = activeSlot) {
    changePlanner((current) => ({ ...current, dailyObjectives: { ...current.dailyObjectives, [slot]: { ...current.dailyObjectives[slot], [day]: value } } }));
  }
  function updateDayDetails(day: Day, patch: Partial<DayDetails>, slot = activeSlot) {
    changePlanner((current) => ({ ...current, dailyDetails: { ...current.dailyDetails, [slot]: { ...current.dailyDetails[slot], [day]: { ...current.dailyDetails[slot][day], ...patch } } } }));
  }
  function updateSegment(day: Day, id: string, patch: Partial<Segment>, slot = activeSlot) {
    changePlanner((current) => ({ ...current, schedules: { ...current.schedules, [slot]: { ...current.schedules[slot], [day]: current.schedules[slot][day].map((item) => item.id === id ? { ...item, ...patch } : item) } } }));
  }
  function addSegment(day: Day) {
    const item: Segment = { id: uid(), title: "New segment", minutes: 10, notes: "Add the purpose, materials, or stopping point.", category: "Instruction", completed: false, resources: [] };
    changePlanner((current) => ({ ...current, schedules: { ...current.schedules, [activeSlot]: { ...current.schedules[activeSlot], [day]: [...current.schedules[activeSlot][day], item] } } }));
    setEditing({ slot: activeSlot, day, id: item.id });
  }
  function deleteSegment() {
    if (!editing || !selected || !confirm(`Delete “${selected.title}”?`)) return;
    changePlanner((current) => ({ ...current, schedules: { ...current.schedules, [editing.slot]: { ...current.schedules[editing.slot], [editing.day]: current.schedules[editing.slot][editing.day].filter((item) => item.id !== editing.id) } } }));
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
  function openLibraryManager() {
    const targetDay = activeDays.includes(selectedDay) ? selectedDay : activeDays[0];
    setLibraryTargetSlot(activeSlot);
    setLibraryTargetDay(targetDay);
    setLibraryOpen(true);
  }
  function saveSelectedActivityToLibrary() {
    if (!selected) return;
    const item: LibraryActivity = {
      id: uid(), kind: "activity", name: selected.title || "Untitled activity", createdAt: new Date().toISOString(),
      segment: { ...selected, id: uid(), completed: false, resources: selected.resources.map((resource) => ({ ...resource })) },
    };
    changePlanner((current) => ({ ...current, library: [item, ...current.library] }));
    setNotice(`Saved “${item.name}” to the activity library.`);
  }
  function saveCurrentDayToLibrary(sourceDay?: Day, sourceSlot = activeSlot) {
    const day = sourceDay ?? (activeDays.includes(selectedDay) ? selectedDay : activeDays[0]);
    const details = planner.dailyDetails[sourceSlot][day];
    const item: LibraryDay = {
      id: uid(), kind: "day", name: `${details.focus || dayName[day]} · ${slotName[sourceSlot]}`, createdAt: new Date().toISOString(),
      objective: planner.dailyObjectives[sourceSlot][day], details: { ...details },
      segments: planner.schedules[sourceSlot][day].map((segment) => ({ ...segment, id: uid(), completed: false, resources: segment.resources.map((resource) => ({ ...resource })) })),
    };
    changePlanner((current) => ({ ...current, library: [item, ...current.library] }));
    setNotice(`Saved the ${dayName[day]} plan to the reusable library.`);
  }
  function saveCurrentWeekToLibrary() {
    const item: LibraryWeek = {
      id: uid(), kind: "week", name: planner.meta.topic || weekLabel, createdAt: new Date().toISOString(), activeDays: [...planner.activeDays], meta: { ...planner.meta },
      schedules: Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(days.map((day) => [day, planner.schedules[slot][day].map((segment) => ({ ...segment, id: uid(), completed: false, resources: segment.resources.map((resource) => ({ ...resource })) }))]))])) as LibraryWeek["schedules"],
      dailyObjectives: structuredClone(planner.dailyObjectives), dailyDetails: structuredClone(planner.dailyDetails),
    };
    changePlanner((current) => ({ ...current, library: [item, ...current.library] }));
    setNotice(`Saved “${item.name}” as a reusable week structure.`);
  }
  function useLibraryItem(item: LibraryItem) {
    if (item.kind === "activity") {
      const segment = { ...item.segment, id: uid(), completed: false, resources: item.segment.resources.map((resource) => ({ ...resource })) };
      changePlanner((current) => ({ ...current, schedules: { ...current.schedules, [libraryTargetSlot]: { ...current.schedules[libraryTargetSlot], [libraryTargetDay]: [...current.schedules[libraryTargetSlot][libraryTargetDay], segment] } } }));
      setActiveSlot(libraryTargetSlot);
      setSelectedDay(libraryTargetDay);
      setNotice(`Added “${item.name}” to ${dayName[libraryTargetDay]} in ${slotName[libraryTargetSlot]}.`);
      return;
    }
    if (item.kind === "day") {
      if (!confirm(`Replace ${dayName[libraryTargetDay]} in ${slotName[libraryTargetSlot]} with the saved day “${item.name}”?`)) return;
      changePlanner((current) => {
        const records = { ...current.teachingRecords[libraryTargetSlot] };
        delete records[libraryTargetDay];
        return {
          ...current,
          schedules: { ...current.schedules, [libraryTargetSlot]: { ...current.schedules[libraryTargetSlot], [libraryTargetDay]: item.segments.map((segment) => ({ ...segment, id: uid(), completed: false, resources: segment.resources.map((resource) => ({ ...resource })) })) } },
          dailyObjectives: { ...current.dailyObjectives, [libraryTargetSlot]: { ...current.dailyObjectives[libraryTargetSlot], [libraryTargetDay]: item.objective } },
          dailyDetails: { ...current.dailyDetails, [libraryTargetSlot]: { ...current.dailyDetails[libraryTargetSlot], [libraryTargetDay]: { ...item.details } } },
          teachingRecords: { ...current.teachingRecords, [libraryTargetSlot]: records },
        };
      });
      setActiveSlot(libraryTargetSlot);
      showDay(libraryTargetDay);
      setLibraryOpen(false);
      setNotice(`Applied “${item.name}” to ${dayName[libraryTargetDay]} in ${slotName[libraryTargetSlot]}.`);
      return;
    }
    if (!confirm(`Replace the current week’s brief and all three class schedules with “${item.name}”?\n\nThe current calendar date and reusable library will be preserved.`)) return;
    changePlanner((current) => ({
      ...current,
      activeDays: [...item.activeDays], meta: { ...item.meta },
      schedules: Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(days.map((day) => [day, item.schedules[slot][day].map((segment) => ({ ...segment, id: uid(), completed: false, resources: segment.resources.map((resource) => ({ ...resource })) }))]))])) as Planner["schedules"],
      dailyObjectives: structuredClone(item.dailyObjectives), dailyDetails: structuredClone(item.dailyDetails), teachingRecords: { slot1: {}, slot2: {}, slot3: {} },
    }));
    setSelectedDay(item.activeDays[0]);
    setPrintDay(item.activeDays[0]);
    setViewMode("week");
    setLibraryOpen(false);
    setNotice(`Applied the reusable week “${item.name}”.`);
  }
  function deleteLibraryItem(item: LibraryItem) {
    if (!confirm(`Delete “${item.name}” from the reusable library?`)) return;
    changePlanner((current) => ({ ...current, library: current.library.filter((candidate) => candidate.id !== item.id) }));
    setNotice(`Removed “${item.name}” from the reusable library. Undo is available.`);
  }
  function renameLibraryItem(item: LibraryItem) {
    const name = prompt("Name this reusable library item:", item.name)?.trim();
    if (!name || name === item.name) return;
    changePlanner((current) => ({ ...current, library: current.library.map((candidate) => candidate.id === item.id ? { ...candidate, name } : candidate) }));
    setNotice(`Renamed the library item to “${name}”.`);
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
    changePlanner((current) => {
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
    changePlanner((current) => {
      const currentSchedule = current.schedules[activeSlot];
      const currentObjectives = current.dailyObjectives[activeSlot];
      const currentDetails = current.dailyDetails[activeSlot];
      return {
        ...current,
        schedules: { ...current.schedules, [activeSlot]: { ...currentSchedule, [sourceDay]: currentSchedule[targetDay], [targetDay]: currentSchedule[sourceDay] } },
        dailyObjectives: { ...current.dailyObjectives, [activeSlot]: { ...currentObjectives, [sourceDay]: currentObjectives[targetDay], [targetDay]: currentObjectives[sourceDay] } },
        dailyDetails: { ...current.dailyDetails, [activeSlot]: { ...currentDetails, [sourceDay]: currentDetails[targetDay], [targetDay]: currentDetails[sourceDay] } },
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
  function openFinishDay(day = activeDays.includes(selectedDay) ? selectedDay : activeDays[0]) {
    const unfinished = planner.schedules[activeSlot][day].filter((item) => !item.completed).map((item) => item.id);
    const laterDays = activeDays.slice(activeDays.indexOf(day) + 1);
    const record = planner.teachingRecords[activeSlot][day];
    setFinishDay(day);
    setFinishSelected(unfinished);
    setFinishDestination(laterDays[0] ?? "next-week");
    setFinishReflection(record?.reflection ?? "");
    setFinishResumeNote(record?.resumeNote ?? "");
    setFinishOpen(true);
  }
  function changeFinishDay(day: Day) {
    const unfinished = planner.schedules[activeSlot][day].filter((item) => !item.completed).map((item) => item.id);
    const laterDays = activeDays.slice(activeDays.indexOf(day) + 1);
    const record = planner.teachingRecords[activeSlot][day];
    setFinishDay(day);
    setFinishSelected(unfinished);
    setFinishDestination(laterDays[0] ?? "next-week");
    setFinishReflection(record?.reflection ?? "");
    setFinishResumeNote(record?.resumeNote ?? "");
  }
  function toggleFinishSegment(id: string) {
    setFinishSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function finishAndRollForward() {
    const destination = finishDestination;
    const movedTitles = planner.schedules[activeSlot][finishDay].filter((item) => finishSelected.includes(item.id)).map((item) => item.title);
    changePlanner((current) => {
      const sourceItems = current.schedules[activeSlot][finishDay];
      const selectedItems = sourceItems.filter((item) => finishSelected.includes(item.id) && !item.completed);
      const existingRecord = current.teachingRecords[activeSlot][finishDay];
      const nextSchedule = { ...current.schedules[activeSlot] };
      if (destination !== "next-week" && selectedItems.length) {
        nextSchedule[finishDay] = sourceItems.filter((item) => !finishSelected.includes(item.id));
        nextSchedule[destination] = [...nextSchedule[destination], ...selectedItems];
      }
      const record: TeachingRecord = {
        finishedAt: new Date().toISOString(),
        reflection: finishReflection.trim(),
        resumeNote: finishResumeNote.trim(),
        plannedObjective: existingRecord?.plannedObjective ?? current.dailyObjectives[activeSlot][finishDay],
        plannedDetails: existingRecord?.plannedDetails ?? { ...current.dailyDetails[activeSlot][finishDay] },
        plannedSegments: existingRecord?.plannedSegments ?? sourceItems.map((item) => ({ ...item, resources: item.resources.map((resource) => ({ ...resource })) })),
        rolledForward: { segmentIds: selectedItems.map((item) => item.id), destination },
      };
      return {
        ...current,
        schedules: { ...current.schedules, [activeSlot]: nextSchedule },
        teachingRecords: { ...current.teachingRecords, [activeSlot]: { ...current.teachingRecords[activeSlot], [finishDay]: record } },
      };
    });
    setFinishOpen(false);
    const destinationLabel = destination === "next-week" ? "next week" : dayName[destination];
    setNotice(`${dayName[finishDay]} was recorded as finished${movedTitles.length ? `; ${movedTitles.length} unfinished activit${movedTitles.length === 1 ? "y was" : "ies were"} carried to ${destinationLabel}` : ""}.`);
  }
  function toggleDay(day: Day) {
    changePlanner((current) => {
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
    changePlanner((current) => ({ ...current, schedules: { ...current.schedules, [target]: copy }, dailyObjectives: { ...current.dailyObjectives, [target]: { ...current.dailyObjectives[activeSlot] } }, dailyDetails: { ...current.dailyDetails, [target]: structuredClone(current.dailyDetails[activeSlot]) } }));
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
            const normalized = normalizePlanner(parsed.planner);
            found.push({ ...parsed, title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : defaultArchiveTitle(normalized), planner: normalized, filename: child.name });
          } else if (isPlanner(parsed)) {
            const normalized = normalizePlanner(parsed);
            found.push({ format: "weekly-lesson-planner-archive", version: 1, title: defaultArchiveTitle(normalized), archivedAt: new Date(file.lastModified).toISOString(), planner: normalized, filename: child.name });
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
  async function savePlannerToArchive(source: Planner, announce = true, requestedTitle = "") {
    if (!archiveHandle) return false;
    setArchiveStatus("working");
    setArchiveMessage("Saving this week to Google Drive…");
    try {
      const archivedAt = new Date().toISOString();
      const title = requestedTitle.trim() || defaultArchiveTitle(source);
      const filename = archiveFilename(source, archivedAt, title);
      const document: ArchiveDocument = { format: "weekly-lesson-planner-archive", version: 1, title, archivedAt, planner: source };
      const fileHandle = await archiveHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(document, null, 2));
      await writable.close();
      await scanArchiveFolder(archiveHandle);
      if (announce) setNotice(`Archived “${title}” in “${archiveHandle.name}”.`);
      return true;
    } catch {
      setArchiveStatus("permission");
      setArchiveMessage("The week was not saved. Reconnect the archive folder and try again.");
      return false;
    }
  }
  async function archiveCurrentWeek() {
    if (!archiveHandle) { await connectArchiveFolder(); return; }
    await savePlannerToArchive(planner, true, archiveTitle);
  }
  async function startNextWeek() {
    if (!archiveHandle && !confirm("The Google Drive archive folder is not connected. Start the next week without creating a permanent archive first?\n\nYou can still use Undo during this open session.")) return;
    if (archiveHandle) {
      const saved = await savePlannerToArchive(planner, false);
      if (!saved) { setNotice("The next week was not started because the current week could not be archived."); return; }
    }
    const nextDate = shiftWeek(planner.weekOf);
    let next: Planner;
    if (nextWeekMode === "copy") {
      next = normalizePlanner(structuredClone(planner));
      next.weekOf = nextDate;
      next.schedules = Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(days.map((day) => [day, next.schedules[slot][day].map((item) => ({ ...item, id: uid(), completed: false }))]))])) as Planner["schedules"];
      next.teachingRecords = { slot1: {}, slot2: {}, slot3: {} };
    } else {
      next = defaultPlanner();
      next.weekOf = nextDate;
      next.activeDays = [...planner.activeDays];
      if (nextWeekMode === "unfinished") {
        const firstDay = next.activeDays[0];
        slots.forEach((slot) => {
          const unfinished = planner.activeDays.flatMap((day) => planner.schedules[slot][day].filter((item) => !item.completed));
          next.schedules[slot][firstDay] = [...unfinished.map((item) => ({ ...item, id: uid(), completed: false, resources: item.resources.map((resource) => ({ ...resource })) })), ...next.schedules[slot][firstDay]];
        });
      }
    }
    if (carryWeeklyBrief) next.meta = { ...planner.meta };
    else if (nextWeekMode === "copy") next.meta = { ...defaultPlanner().meta };
    next.library = structuredClone(planner.library);
    next.slotStartTimes = { ...planner.slotStartTimes };
    changePlanner(next);
    setSelectedDay(next.activeDays[0]);
    setPrintDay(next.activeDays[0]);
    setViewMode("week");
    setEditing(null);
    setNextWeekOpen(false);
    setNotice(`${archiveHandle ? "Archived the current week and started" : "Started"} the week of ${nextDate}. Undo is available if you need to return.`);
  }
  function restoreArchivedWeek(entry: ArchiveEntry) {
    if (!confirm(`Replace the current planner with the archived plan “${entry.title}”?\n\nThe current week will remain only if you archive or export it first.`)) return;
    const restored = normalizePlanner(entry.planner);
    if (slots.every((slot) => !restored.slotStartTimes[slot]) && slots.some((slot) => planner.slotStartTimes[slot])) restored.slotStartTimes = { ...planner.slotStartTimes };
    const currentIds = new Set(planner.library.map((item) => item.id));
    restored.library = [...planner.library, ...restored.library.filter((item) => !currentIds.has(item.id))];
    changePlanner(restored);
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
  async function renameArchivedWeek(entry: ArchiveEntry) {
    if (!archiveHandle) return;
    const title = prompt("Archive title:", entry.title)?.trim();
    if (!title || title === entry.title) return;
    try {
      const renamedFilename = archiveFilename(entry.planner, entry.archivedAt, title);
      const fileHandle = await archiveHandle.getFileHandle(renamedFilename, { create: true });
      const writable = await fileHandle.createWritable();
      const document: ArchiveDocument = { format: "weekly-lesson-planner-archive", version: 1, title, archivedAt: entry.archivedAt, planner: entry.planner };
      await writable.write(JSON.stringify(document, null, 2));
      await writable.close();
      if (renamedFilename !== entry.filename) await archiveHandle.removeEntry(entry.filename);
      await scanArchiveFolder(archiveHandle);
      setNotice(`Renamed the archive and its file to “${title}”.`);
    } catch {
      setArchiveStatus("error");
      setArchiveMessage("That archive title could not be changed. Reconnect the folder and try again.");
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
      dayHeader: planner.dailyDetails[activeSlot][activeDays.includes(selectedDay) ? selectedDay : activeDays[0]].focus,
      desiredOutcome: planner.dailyDetails[activeSlot][activeDays.includes(selectedDay) ? selectedDay : activeDays[0]].outcome,
      dailyProduct: planner.dailyDetails[activeSlot][activeDays.includes(selectedDay) ? selectedDay : activeDays[0]].product,
      learningObjective: "Students will be able to…",
      segments: [sampleSegment("Opening activity"), sampleSegment("Core learning activity"), sampleSegment("Exit ticket")],
    } : {
      ...shared,
      days: Object.fromEntries(days.map((day) => [day, { dayHeader: planner.dailyDetails[activeSlot][day].focus, desiredOutcome: planner.dailyDetails[activeSlot][day].outcome, dailyProduct: planner.dailyDetails[activeSlot][day].product, learningObjective: "Students will be able to…", segments: [sampleSegment(`${dayName[day]} opening`), sampleSegment(`${dayName[day]} core activity`), sampleSegment(`${dayName[day]} reflection`)] }])),
    };
    download(JSON.stringify(template, null, 2), `ai-${scope}-lesson-template.json`, "application/json");
    setNotice(`AI ${scope} template downloaded.`);
  }
  function exportMarkdown() {
    const lines = [`# Cybersecurity Weekly Plan — ${weekLabel}`, "", `**Weekly topic:** ${planner.meta.topic || "Not set"}`, `**Central question:** ${planner.meta.centralQuestion || "Not set"}`, ""];
    slots.forEach((slot) => {
      lines.push(`## ${slotName[slot]}${planner.slotStartTimes[slot] ? ` — ${displaySlotWindow(planner.slotStartTimes[slot])}` : ""}`, "");
      activeDays.forEach((day) => {
        lines.push(`### ${dayName[day]} — ${planner.dailyDetails[slot][day].focus}`, "");
        lines.push(`**Learning objective:** ${planner.dailyObjectives[slot][day] || "Not set"}`, "");
        lines.push(`**Desired outcome:** ${planner.dailyDetails[slot][day].outcome || "Not set"}`, "");
        lines.push(`**Daily product:** ${planner.dailyDetails[slot][day].product || "Not set"}`, "");
        let elapsed = 0;
        planner.schedules[slot][day].forEach((item) => {
          const time = range(elapsed, item.minutes, planner.slotStartTimes[slot]); elapsed += item.minutes;
          lines.push(`- [${item.completed ? "x" : " "}] **${time} · ${item.title}** (${item.minutes} min)`, `  - ${item.notes}`);
          item.resources.forEach((resource) => lines.push(`  - [${resource.label}](${safeHref(resource.url) || resource.url})`));
        });
        const record = planner.teachingRecords[slot][day];
        if (record) {
          lines.push("", `**Teaching record saved:** ${formatArchiveDate(record.finishedAt)}`);
          if (record.reflection) lines.push(`**Reflection:** ${record.reflection}`);
          if (record.resumeNote) lines.push(`**Resume point:** ${record.resumeNote}`);
        }
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
        const details = Object.fromEntries(slots.map((slot) => [slot, Object.fromEntries(backup.activeDays.map((day) => [day, backup.dailyDetails[slot][day]]))])) as ImportCandidate["details"];
        candidate = { filename: file.name, kind: "backup", weekOf: backup.weekOf, meta: backup.meta, sourceSlots: [...slots], schedules, objectives, details, backup };
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
      const backup = normalizePlanner(pendingImport.backup);
      if (slots.every((slot) => !backup.slotStartTimes[slot]) && slots.some((slot) => planner.slotStartTimes[slot])) backup.slotStartTimes = { ...planner.slotStartTimes };
      const currentIds = new Set(planner.library.map((item) => item.id));
      backup.library = [...planner.library, ...backup.library.filter((item) => !currentIds.has(item.id))];
      changePlanner(backup);
      setPendingImport(null);
      setEditing(null);
      setNotice(`Restored the complete backup from ${pendingImport.filename}.`);
      return;
    }
    if (!importDays.length) { setNotice("Select at least one day to import."); return; }
    changePlanner((current) => {
      const targetSchedule = { ...current.schedules[importTargetSlot] };
      const targetObjectives = { ...current.dailyObjectives[importTargetSlot] };
      const targetDetails = { ...current.dailyDetails[importTargetSlot] };
      importDays.forEach((day) => {
        const incoming = pendingImport.schedules[importSourceSlot]?.[day];
        if (incoming) targetSchedule[day] = incoming.map((item) => ({ ...item, id: uid(), resources: item.resources.map((resource) => ({ ...resource })) }));
        targetObjectives[day] = pendingImport.objectives[importSourceSlot]?.[day] ?? "";
        targetDetails[day] = pendingImport.details[importSourceSlot]?.[day] ?? targetDetails[day];
      });
      return {
        ...current,
        weekOf: applyImportWeek && pendingImport.weekOf ? pendingImport.weekOf : current.weekOf,
        meta: applyImportMeta && pendingImport.meta ? { ...current.meta, ...pendingImport.meta } : current.meta,
        activeDays: days.filter((day) => current.activeDays.includes(day) || importDays.includes(day)),
        schedules: { ...current.schedules, [importTargetSlot]: targetSchedule },
        dailyObjectives: { ...current.dailyObjectives, [importTargetSlot]: targetObjectives },
        dailyDetails: { ...current.dailyDetails, [importTargetSlot]: targetDetails },
      };
    });
    setActiveSlot(importTargetSlot);
    if (importDays.length === 1) showDay(importDays[0]);
    setPendingImport(null);
    setEditing(null);
    setNotice(`Imported ${importDays.map((day) => dayName[day]).join(", ")} into ${slotName[importTargetSlot]}.`);
  }
  function printPlan(mode: "weekly" | "daily" | "summary") {
    const targetDay = activeDays.includes(printDay) ? printDay : activeDays[0];
    if (mode === "daily") setPrintDay(targetDay);
    setPrintMode(mode);
    document.title = `${slotName[activeSlot]}-${mode === "daily" ? dayName[targetDay] : mode === "summary" ? "Weekly-Summary" : "Weekly"}-${planner.weekOf}`;
    window.setTimeout(() => window.print(), 80);
  }
  function restoreTemplate() {
    if (!confirm("Replace this entire week with a fresh routine template? Export JSON first if you may need this plan later.")) return;
    const fresh = defaultPlanner(); fresh.weekOf = planner.weekOf; fresh.library = structuredClone(planner.library); fresh.slotStartTimes = { ...planner.slotStartTimes }; changePlanner(fresh); setEditing(null); setNotice("The routine template was restored for all three slots. Your reusable library and slot times were preserved.");
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
  const briefActivities = activeDays.flatMap((day) => planner.schedules[activeSlot][day]);
  const briefMinutes = briefActivities.reduce((total, item) => total + item.minutes, 0);
  const briefResourceCount = briefActivities.reduce((total, item) => total + item.resources.filter((resource) => safeHref(resource.url)).length, 0);
  const populatedContext = metaFields.filter(([key]) => key !== "topic" && key !== "centralQuestion" && planner.meta[key].trim());

  return <main className={`planner-app view-${viewMode} mode-${displayMode ? "display" : "edit"} ${presenting ? "projection-mode" : ""} print-${printMode}`}>
    <header className="site-header screen-only">
      <a className="brand" href="#top"><span className="logo" aria-hidden="true">CS</span><span><strong>CYBER / PLANNER</strong><small>Weekly operations desk</small></span></a>
      <div className="save-state"><i />{saveLabel}</div>
    </header>

    <section className="planner-hero screen-only" id="top">
      <div><p className="eyebrow">Instructional operations // 90-minute blocks</p><h1>Shape the week.<br /><em>Keep the evidence.</em></h1><p>Arrange each class like a broadcast schedule: move segments, adjust airtime, mark what happened, and carry the plan anywhere.</p></div>
      <aside className="week-brief"><span>Current planning cycle</span><label>Week beginning<input type="date" value={planner.weekOf} onChange={(event) => changePlanner((current) => ({ ...current, weekOf: event.target.value }))} /></label><strong>{planner.meta.topic || `${activeDays.length}-day lesson plan`}</strong><button type="button" onClick={() => setBriefOpen(true)}>Open weekly summary <b>→</b></button></aside>
    </section>

    <section className="control-deck screen-only" aria-label="Planner controls">
      <div className="slot-tabs" role="tablist">{slots.map((slot) => <button key={slot} role="tab" aria-selected={activeSlot === slot} className={activeSlot === slot ? "active" : ""} onClick={() => setActiveSlot(slot)}><span>{slotName[slot]}</span>{planner.slotStartTimes[slot] && <small>{displaySlotWindow(planner.slotStartTimes[slot])}</small>}</button>)}</div>
      <div className="control-actions">
        <div className="mode-toggle" aria-label="Planner mode">
          <button type="button" className={appMode === "edit" ? "active" : ""} aria-pressed={appMode === "edit"} onClick={() => changeAppMode("edit")}>Edit</button>
          <button type="button" className={appMode === "display" ? "active" : ""} aria-pressed={appMode === "display"} onClick={() => changeAppMode("display")}>Display</button>
        </div>
        <div className="history-actions" aria-label="Change history">
          <button type="button" disabled={!historyState.undo} onClick={undoPlanner} title="Undo last planner change (Ctrl/Command+Z)">↶ Undo</button>
          <button type="button" disabled={!historyState.redo} onClick={redoPlanner} title="Redo planner change (Ctrl/Command+Shift+Z)">↷ Redo</button>
        </div>
        <div className="view-toggle" aria-label="Schedule view">
          <button type="button" className={viewMode === "week" ? "active" : ""} aria-pressed={viewMode === "week"} onClick={() => setViewMode("week")}>Full week</button>
          <button type="button" className={viewMode === "day" ? "active" : ""} aria-pressed={viewMode === "day"} onClick={() => showDay(activeDays.includes(selectedDay) ? selectedDay : activeDays[0])}>Day view</button>
        </div>
        <button type="button" onClick={openArchiveManager}>Archive <span>{archiveEntries.length || ""}</span></button>
        <button type="button" onClick={openLibraryManager}>Library <span>{planner.library.length || ""}</span></button>
        {!displayMode && <><button type="button" onClick={() => setDaysOpen((open) => !open)}>School days <span>{activeDays.length}/5</span></button>
        <button className="finish-day-action" type="button" onClick={() => openFinishDay()}>Finish day</button>
        <button type="button" onClick={() => setNextWeekOpen(true)}>Start next week</button>
        <button type="button" onClick={() => setSlotTimesOpen(true)}>Slot times</button>
        <button type="button" onClick={() => setBriefOpen(true)}>Weekly summary</button>
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
      {displayMode && <button className={`sound-cue-action ${soundCuesEnabled ? "active" : ""}`} type="button" aria-pressed={soundCuesEnabled} disabled={!pacingStart} title={pacingStart ? "Play a gentle reminder when the next activity begins" : "Set this slot’s start time to use pacing cues"} onClick={toggleSoundCues}>♫ Cues {soundCuesEnabled ? "on" : "off"}</button>}
      <button className="projection-action" type="button" onClick={togglePresentation}>{presenting ? "Exit presentation" : "Enter full screen"}</button>
    </nav>}

    {notice && <div className="notice screen-only" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
    <section className="status-strip screen-only">
      <div><span>Active schedule</span><strong>{slotName[activeSlot]}{planner.slotStartTimes[activeSlot] ? ` · ${displaySlotWindow(planner.slotStartTimes[activeSlot])}` : ""}</strong></div><div><span>{viewMode === "day" ? `${dayName[visibleDays[0]]} airtime` : "Planned airtime"}</span><strong>{totalMinutes} minutes</strong></div><div><span>Segments complete</span><strong>{completed} / {segments.length}</strong></div><div className="progress-stat"><span>{viewMode === "day" ? "Daily progress" : "Weekly progress"}</span><strong>{progress}%</strong><i><b style={{ width: `${progress}%` }} /></i></div>
    </section>

    <div className="print-heading"><p>Cybersecurity Weekly Lesson Planner</p><h1>{planner.meta.topic || weekLabel}</h1><div><span>{weekLabel}</span><span>{slotName[activeSlot]}{planner.slotStartTimes[activeSlot] ? ` · ${displaySlotWindow(planner.slotStartTimes[activeSlot])}` : ""}</span><span>{printMode === "daily" ? dayName[printDay] : `${activeDays.length}-day school week`}</span></div>{planner.meta.centralQuestion && <p className="print-question">Central question: {planner.meta.centralQuestion}</p>}{printMode === "daily" && planner.dailyObjectives[activeSlot][printDay] && <p className="print-objective"><strong>Learning objective:</strong> {planner.dailyObjectives[activeSlot][printDay]}</p>}</div>

    <section className="print-weekly-summary">
      <header><p>Weekly lesson summary</p><h1>{planner.meta.topic || `${activeDays.length}-day learning plan`}</h1><div><span>{weekLabel}</span><span>{slotName[activeSlot]}{planner.slotStartTimes[activeSlot] ? ` · ${displaySlotWindow(planner.slotStartTimes[activeSlot])}` : ""}</span><span>{briefActivities.length} activities · {briefMinutes} minutes · {briefResourceCount} links</span></div>{planner.meta.centralQuestion && <p><strong>Central question:</strong> {planner.meta.centralQuestion}</p>}</header>
      {populatedContext.length > 0 && <section className="print-summary-context"><h2>Week-level context</h2><div>{populatedContext.map(([key, label]) => <article key={key}><strong>{label}</strong><p>{planner.meta[key]}</p></article>)}</div></section>}
      <section className="print-summary-days">{activeDays.map((day) => { const daySegments = planner.schedules[activeSlot][day]; let elapsed = 0; return <article className="print-summary-day" key={day}><header><div><span>{dateForDay(planner.weekOf, day)}</span><h2>{dayName[day]} — {planner.dailyDetails[activeSlot][day].focus || "Daily focus not yet set"}</h2></div><strong>{daySegments.reduce((total, item) => total + item.minutes, 0)} min</strong></header><div className="print-summary-targets"><p><strong>Learning objective:</strong> {planner.dailyObjectives[activeSlot][day] || "Not yet set."}</p><p><strong>Desired outcome:</strong> {planner.dailyDetails[activeSlot][day].outcome || "Not yet set."}</p><p><strong>Daily product:</strong> {planner.dailyDetails[activeSlot][day].product || "Not yet set."}</p></div><ol>{daySegments.map((item) => { const start = elapsed; elapsed += item.minutes; const resources = item.resources.flatMap((resource) => { const href = safeHref(resource.url); return href ? [{ ...resource, href }] : []; }); return <li key={item.id}><div><span>{range(start, item.minutes, planner.slotStartTimes[activeSlot])}</span><strong>{item.title}</strong><small>{item.category} · {item.minutes} min</small></div>{resources.length > 0 && <ul>{resources.map((resource, resourceIndex) => <li key={`${resource.href}-${resourceIndex}`}><span>{resource.label || "Resource"}:</span> {resource.href}</li>)}</ul>}</li>; })}</ol></article>; })}</section>
    </section>

    <section className="schedule-section">
      <div className="schedule-title screen-only"><div><p className="eyebrow">01 // {viewMode === "day" ? "Daily plan" : "Broadcast board"}</p><h2>{viewMode === "day" ? `${dayName[visibleDays[0]]}, ${dateForDay(planner.weekOf, visibleDays[0])}` : weekLabel}</h2></div><p>{displayMode ? "A polished classroom-ready view of the selected plan. Resource links remain available for quick access." : viewMode === "day" ? "Edit the objective and activities here. Drag an activity or the entire day onto a day tab to move the plan." : "Drag activities between days, or drag a day header onto another column to swap both complete day plans."}</p></div>
      <div className={`schedule-board columns-${displayDays.length} ${viewMode === "day" ? "daily-view-board" : ""}`}>
        {displayDays.map((day) => {
          let elapsed = 0; const items = schedule[day]; const minutes = items.reduce((sum, item) => sum + item.minutes, 0);
          return <article className={`day-column ${printMode === "daily" && day === printDay ? "print-target" : ""}`} key={day} data-day={day} onDragOver={(event) => { if (!displayMode) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); dropPlanOnDay(day); }}>
            <header draggable={!displayMode} title={!displayMode ? `Drag to swap the ${dayName[day]} plan with another day` : undefined} onDragStart={(event: DragEvent<HTMLElement>) => { if ((event.target as HTMLElement).closest("input, textarea")) { event.preventDefault(); return; } dayDragSource.current = day; dragSource.current = null; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", `day:${day}`); }} onDragEnd={() => { dayDragSource.current = null; }}><div><span>{dateForDay(planner.weekOf, day)}</span><strong>{dayName[day]}</strong>{displayMode || printMode !== "none" ? <small>{planner.dailyDetails[activeSlot][day].focus || "Daily focus not yet set"}</small> : <input className="day-focus-input" aria-label={`${dayName[day]} header`} draggable={false} value={planner.dailyDetails[activeSlot][day].focus} placeholder="Daily focus or theme" onChange={(event) => updateDayDetails(day, { focus: event.target.value })} />}{!displayMode && printMode === "none" && <i className="day-drag-hint">Edit header · Drag empty header space to swap days</i>}</div><b className={minutes === 90 ? "on-time" : minutes > 90 ? "over" : "under"}>{minutes}<small>/90</small></b></header>
            <div className={`objective-panel ${displayMode ? "objective-display" : ""}`}><label htmlFor={!displayMode ? `objective-${activeSlot}-${day}` : undefined}>Learning objective</label>{displayMode ? <div className="objective-copy">{planner.dailyObjectives[activeSlot][day] || "Learning objective not yet set."}</div> : <textarea id={`objective-${activeSlot}-${day}`} rows={viewMode === "day" ? 3 : 2} value={planner.dailyObjectives[activeSlot][day]} placeholder="Students will be able to…" onChange={(event) => updateObjective(day, event.target.value)} />}</div>
            <div className={`day-outcome ${displayMode || printMode !== "none" ? "outcome-display" : "outcome-edit"}`}><strong>Desired outcome</strong>{displayMode || printMode !== "none" ? <p>{planner.dailyDetails[activeSlot][day].outcome || "Desired outcome not yet set."}</p> : <textarea rows={viewMode === "day" ? 2 : 3} value={planner.dailyDetails[activeSlot][day].outcome} placeholder="Describe the understanding or result students should reach…" onChange={(event) => updateDayDetails(day, { outcome: event.target.value })} />}</div>
            {!displayMode && planner.teachingRecords[activeSlot][day] && <div className="teaching-record screen-only"><div><strong>✓ Day recorded</strong><span>{formatArchiveDate(planner.teachingRecords[activeSlot][day]!.finishedAt)}</span></div><button type="button" onClick={() => openFinishDay(day)}>Review / update</button></div>}
            <div className="segment-list">{items.map((item, index) => {
              const start = elapsed; elapsed += item.minutes;
              const isLiveActivity = displayMode && viewMode === "day" && item.id === liveSegmentId;
              const activityCopy = <><small>{item.category}</small><strong>{item.title}</strong><span>{item.notes}</span></>;
              return <div className={`segment-card category-${item.category.toLowerCase()} ${item.completed ? "completed" : ""} ${isLiveActivity ? "live-activity" : ""}`} draggable={!displayMode} key={item.id} onDragStart={(event: DragEvent<HTMLDivElement>) => { if (displayMode) return; dragSource.current = { slot: activeSlot, day, id: item.id }; dayDragSource.current = null; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", `activity:${item.id}`); }} onDragEnd={() => { dragSource.current = null; }} onDragOver={(event) => { if (!displayMode) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); dropPlanOnDay(day, index); }}>
                <div className="segment-time"><span>{range(start, item.minutes, planner.slotStartTimes[activeSlot])}</span>{isLiveActivity ? <em className="live-indicator">● Live now</em> : displayMode && item.completed ? <em>✓ Complete</em> : null}<b>{item.minutes}m</b></div>
                <div className="segment-main">{!displayMode && <label className="complete-check"><input type="checkbox" checked={item.completed} onChange={(event) => updateSegment(day, item.id, { completed: event.target.checked })} /><span aria-hidden="true">✓</span><span className="sr-only">Mark {item.title} complete</span></label>}{displayMode ? <div className="segment-copy segment-display-copy">{activityCopy}</div> : <button className="segment-copy" type="button" onClick={() => setEditing({ slot: activeSlot, day, id: item.id })}>{activityCopy}</button>}{!displayMode && <div className="card-movers screen-only"><button type="button" disabled={index === 0} onClick={() => reorder(day, item.id, -1)} aria-label="Move earlier">↑</button><button type="button" disabled={index === items.length - 1} onClick={() => reorder(day, item.id, 1)} aria-label="Move later">↓</button><button type="button" onClick={() => setEditing({ slot: activeSlot, day, id: item.id })} aria-label="Edit segment">•••</button></div>}{item.resources.some((resource) => safeHref(resource.url)) && <div className="segment-resources">{item.resources.map((resource, resourceIndex) => { const href = safeHref(resource.url); return href ? <a key={`${resource.url}-${resourceIndex}`} href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>↗ {resource.label || "Open resource"}</a> : null; })}</div>}</div>
              </div>;
            })}</div>
            {!displayMode && <div className="day-edit-actions screen-only"><button className="add-segment" type="button" onClick={() => addSegment(day)}>＋ Add segment</button><button type="button" onClick={() => saveCurrentDayToLibrary(day)}>Save day</button></div>}<footer className={displayMode || printMode !== "none" ? "product-display" : "product-edit"}><span>Daily product</span>{displayMode || printMode !== "none" ? <p>{planner.dailyDetails[activeSlot][day].product || "Daily product not yet set."}</p> : <textarea rows={viewMode === "day" ? 2 : 3} value={planner.dailyDetails[activeSlot][day].product} placeholder="Describe what students should produce or submit today…" onChange={(event) => updateDayDetails(day, { product: event.target.value })} />}</footer>
          </article>;
        })}
      </div>
    </section>

    <section className="weekly-notes"><div><span>Certification objectives</span><p>{planner.meta.certificationObjectives || "Not specified."}</p></div><div><span>Required evidence</span><p>{planner.meta.evidence || "Not specified."}</p></div><div><span>Friday synthesis question</span><p>{planner.meta.synthesisQuestion || "Not specified."}</p></div><div><span>Likely misconceptions</span><p>{planner.meta.misconceptions || "Not specified."}</p></div></section>

    {slotTimesOpen && <div className="modal-backdrop slot-times-backdrop screen-only" onMouseDown={() => setSlotTimesOpen(false)}><section className="drawer slot-times-drawer" role="dialog" aria-modal="true" aria-labelledby="slot-times-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Bell schedule // 90-minute projections</p><h2 id="slot-times-title">Slot times</h2></div><button type="button" onClick={() => setSlotTimesOpen(false)} aria-label="Close">×</button></div><p className="slot-times-summary">Set each start time. The projected end is calculated automatically at 90 minutes, while activity cards continue to reflect the actual accumulated plan.</p><div className="slot-time-fields">{slots.map((slot) => <label key={slot}><span>{slotName[slot]}</span><div><small>Start time</small><input type="time" value={planner.slotStartTimes[slot]} onChange={(event) => updateSlotStartTime(slot, event.target.value)} /></div><div className="projected-end"><small>Projected end</small><output>{displaySlotEnd(planner.slotStartTimes[slot]) || "—"}</output></div></label>)}</div><div className="drawer-actions"><button type="button" onClick={clearSlotStartTimes}>Clear times</button><button className="primary" type="button" onClick={() => setSlotTimesOpen(false)}>Done</button></div></section></div>}

    {libraryOpen && <div className="modal-backdrop library-backdrop screen-only" onMouseDown={() => setLibraryOpen(false)}><section className="drawer library-drawer" role="dialog" aria-modal="true" aria-labelledby="library-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Reusable teaching assets // {planner.library.length} saved</p><h2 id="library-title">Lesson library</h2></div><button type="button" onClick={() => setLibraryOpen(false)} aria-label="Close">×</button></div>
      <section className="library-target"><div><label><span>Target class</span><select value={libraryTargetSlot} onChange={(event) => setLibraryTargetSlot(event.target.value as Slot)}>{slots.map((slot) => <option key={slot} value={slot}>{slotName[slot]}</option>)}</select></label><label><span>Target day</span><select value={libraryTargetDay} onChange={(event) => setLibraryTargetDay(event.target.value as Day)}>{activeDays.map((day) => <option key={day} value={day}>{dayName[day]}</option>)}</select></label></div><p>Activities are added to this target. Saved days replace this target after confirmation.</p></section>
      <div className="library-save-actions"><button type="button" onClick={() => saveCurrentDayToLibrary(libraryTargetDay, libraryTargetSlot)}>＋ Save target day</button><button type="button" onClick={saveCurrentWeekToLibrary}>＋ Save current week</button><span>Save an individual activity from its editor.</span></div>
      <div className="library-tools"><label><span className="sr-only">Search library</span><input type="search" value={librarySearch} placeholder="Search titles, notes, topics, or categories…" onChange={(event) => setLibrarySearch(event.target.value)} /></label><div>{(["all", "activity", "day", "week"] as const).map((filter) => <button key={filter} type="button" className={libraryFilter === filter ? "active" : ""} onClick={() => setLibraryFilter(filter)}>{filter === "all" ? "All" : `${filter[0].toUpperCase()}${filter.slice(1)}s`}</button>)}</div></div>
      <div className="library-list">{filteredLibrary.length === 0 ? <div className="library-empty"><strong>{planner.library.length ? "No saved items match this search." : "Your reusable library is empty."}</strong><p>Save an activity from its editor, save a day from its column, or capture the complete current week above.</p></div> : filteredLibrary.map((item) => {
        const detail = item.kind === "activity" ? `${item.segment.minutes} min · ${item.segment.category} · ${item.segment.resources.length} link${item.segment.resources.length === 1 ? "" : "s"}` : item.kind === "day" ? `${item.segments.length} activities · ${item.segments.reduce((total, segment) => total + segment.minutes, 0)} min` : `${item.activeDays.length}-day week · ${slots.reduce((total, slot) => total + item.activeDays.reduce((count, day) => count + item.schedules[slot][day].length, 0), 0)} activities across 3 slots`;
        return <article className={`library-card kind-${item.kind}`} key={item.id}><div><span>{item.kind}</span><h3>{item.name}</h3><p>{detail}</p><small>Saved {formatArchiveDate(item.createdAt)}</small></div><div><button className="primary" type="button" onClick={() => useLibraryItem(item)}>{item.kind === "activity" ? "Add to day" : item.kind === "day" ? "Use this day" : "Use this week"}</button><button type="button" onClick={() => renameLibraryItem(item)}>Rename</button><button className="danger" type="button" onClick={() => deleteLibraryItem(item)}>Delete</button></div></article>;
      })}</div>
    </section></div>}

    {finishOpen && <div className="modal-backdrop workflow-backdrop screen-only" onMouseDown={() => setFinishOpen(false)}><section className="drawer workflow-drawer" role="dialog" aria-modal="true" aria-labelledby="finish-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">End-of-class workflow // {slotName[activeSlot]}</p><h2 id="finish-title">Finish the day</h2></div><button type="button" onClick={() => setFinishOpen(false)} aria-label="Close">×</button></div>
      <div className="workflow-routing"><label><span>Day to record</span><select value={finishDay} onChange={(event) => changeFinishDay(event.target.value as Day)}>{activeDays.map((day) => <option key={day} value={day}>{dayName[day]} · {dateForDay(planner.weekOf, day)}</option>)}</select></label><div><span>Completion</span><strong>{planner.schedules[activeSlot][finishDay].filter((item) => item.completed).length} of {planner.schedules[activeSlot][finishDay].length} activities marked complete</strong></div></div>
      {finishRecord && <section className="plan-actual-summary"><div><span>Planned</span><strong>{finishRecord.plannedSegments.length} activities</strong><small>{finishRecord.plannedSegments.reduce((total, item) => total + item.minutes, 0)} minutes</small></div><div><span>Actually completed</span><strong>{finishRecord.plannedSegments.filter((item) => item.completed).length} activities</strong><small>{finishRecord.plannedSegments.filter((item) => item.completed).reduce((total, item) => total + item.minutes, 0)} minutes</small></div><div><span>Rolled forward</span><strong>{finishRecord.rolledForward.segmentIds.length} activities</strong><small>To {finishRecord.rolledForward.destination === "next-week" ? "next week" : dayName[finishRecord.rolledForward.destination]}</small></div></section>}
      <fieldset className="rollover-list"><legend>Unfinished activities to carry forward</legend>{finishItems.length === 0 ? <p>Everything on this day is marked complete. You can still save reflection notes below.</p> : finishItems.map((item) => <label key={item.id}><input type="checkbox" checked={finishSelected.includes(item.id)} onChange={() => toggleFinishSegment(item.id)} /><span><strong>{item.title}</strong><small>{item.minutes} min · {item.category}</small></span></label>)}</fieldset>
      {finishItems.length > 0 && <label className="rollover-destination"><span>Carry selected activities to</span><select value={finishDestination} onChange={(event) => setFinishDestination(event.target.value as Day | "next-week")} >{finishLaterDays.map((day) => <option key={day} value={day}>{dayName[day]}</option>)}<option value="next-week">Hold for next week</option></select><small>Activities held for next week remain here as unfinished and will be available in the next-week workflow.</small></label>}
      <div className="workflow-notes"><label><span>What changed or worked well?</span><textarea rows={4} value={finishReflection} placeholder="A quick private teaching reflection…" onChange={(event) => setFinishReflection(event.target.value)} /></label><label><span>Where should we resume?</span><textarea rows={4} value={finishResumeNote} placeholder="Starting point, misconception, missing material, or follow-up…" onChange={(event) => setFinishResumeNote(event.target.value)} /></label></div>
      <div className="drawer-actions"><button type="button" onClick={() => setFinishOpen(false)}>Cancel</button><button className="primary" type="button" onClick={finishAndRollForward}>{planner.teachingRecords[activeSlot][finishDay] ? "Update teaching record" : "Finish & roll forward"}</button></div>
    </section></div>}

    {nextWeekOpen && <div className="modal-backdrop workflow-backdrop screen-only" onMouseDown={() => setNextWeekOpen(false)}><section className="drawer workflow-drawer next-week-drawer" role="dialog" aria-modal="true" aria-labelledby="next-week-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Weekly transition // {planner.weekOf} → {shiftWeek(planner.weekOf)}</p><h2 id="next-week-title">Archive & start next week</h2></div><button type="button" onClick={() => setNextWeekOpen(false)} aria-label="Close">×</button></div>
      <div className={`next-week-archive ${archiveHandle && archiveStatus === "connected" ? "ready" : "warning"}`}><strong>{archiveHandle && archiveStatus === "connected" ? `✓ “${archiveHandle.name}” is ready` : "Archive folder is not connected"}</strong><p>{archiveHandle && archiveStatus === "connected" ? "A permanent snapshot of the current week will be saved before anything changes." : "You may continue with confirmation, but the old week will only be recoverable with Undo during this open session unless you export it first."}</p></div>
      <fieldset className="next-week-options"><legend>How should the new week begin?</legend><label><input type="radio" name="next-week-mode" value="unfinished" checked={nextWeekMode === "unfinished"} onChange={() => setNextWeekMode("unfinished")} /><span><strong>Carry unfinished work</strong><small>Move all {unfinishedWeekCount} unfinished activities across the three class slots to the first school day, ahead of a fresh routine.</small></span></label><label><input type="radio" name="next-week-mode" value="copy" checked={nextWeekMode === "copy"} onChange={() => setNextWeekMode("copy")} /><span><strong>Copy this week’s structure</strong><small>Duplicate every day and activity, then clear completion marks and teaching records.</small></span></label><label><input type="radio" name="next-week-mode" value="fresh" checked={nextWeekMode === "fresh"} onChange={() => setNextWeekMode("fresh")} /><span><strong>Start with the routine template</strong><small>Begin clean while preserving this week’s selected school days.</small></span></label></fieldset>
      <label className="carry-brief"><input type="checkbox" checked={carryWeeklyBrief} onChange={(event) => setCarryWeeklyBrief(event.target.checked)} /><span><strong>Carry optional week-level context forward</strong><small>Keep the topic, central question, certification notes, lab context, and other manual notes.</small></span></label>
      <div className="drawer-actions"><button type="button" onClick={() => setNextWeekOpen(false)}>Cancel</button><button className="primary" type="button" disabled={archiveStatus === "working"} onClick={startNextWeek}>{archiveStatus === "working" ? "Archiving…" : archiveHandle ? "Archive & start week" : "Start week"}</button></div>
    </section></div>}

    {archiveOpen && <div className="modal-backdrop archive-backdrop screen-only" onMouseDown={() => setArchiveOpen(false)}><section className="drawer archive-drawer" role="dialog" aria-modal="true" aria-labelledby="archive-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Durable planning library // Google Drive</p><h2 id="archive-title">Week archive</h2></div><button type="button" onClick={() => setArchiveOpen(false)} aria-label="Close">×</button></div>
      <section className={`archive-connection status-${archiveStatus}`}><div><span>{archiveStatus === "connected" ? "Folder connected" : archiveStatus === "working" ? "Working" : archiveStatus === "permission" ? "Reconnect needed" : archiveStatus === "unsupported" ? "Browser fallback" : "Archive folder"}</span><strong>{archiveHandle?.name || "Weekly Lesson Planner Archive"}</strong><p aria-live="polite">{archiveStatus === "unsupported" ? "Folder access is unavailable in this browser. You can still download a portable JSON backup." : archiveMessage || "Choose the folder you created in Google Drive. No share link or permission change is needed."}</p></div><i aria-hidden="true">{archiveStatus === "connected" ? "✓" : archiveStatus === "working" ? "…" : "↗"}</i></section>
      <label className="archive-title-field"><span>Archive title</span><input value={archiveTitle} placeholder={`Week of ${planner.weekOf || "…"}`} onChange={(event) => setArchiveTitle(event.target.value)} /><small>This title appears in the archive list and is used in the saved filename.</small></label>
      <div className="archive-toolbar">{archiveStatus === "unsupported" ? <button className="primary" type="button" onClick={exportJson}>Download JSON backup</button> : <><button className="primary" type="button" disabled={archiveStatus === "working"} onClick={() => archiveHandle && archiveStatus === "connected" ? archiveCurrentWeek() : connectArchiveFolder(false)}>{archiveHandle && archiveStatus === "connected" ? "Archive current week" : archiveStatus === "permission" ? "Reconnect folder" : "Connect archive folder"}</button>{archiveHandle && <button type="button" disabled={archiveStatus === "working"} onClick={() => scanArchiveFolder()}>Refresh</button>}<button type="button" disabled={archiveStatus === "working"} onClick={() => connectArchiveFolder(true)}>{archiveHandle ? "Change folder" : "Choose folder"}</button></>}</div>
      <p className="archive-assurance">The archive files live in Google Drive. If browser storage is cleared, reconnect this same folder and the app will rebuild the list.</p>
      <div className="archive-list">{archiveEntries.length === 0 ? <div className="archive-empty"><strong>No archived weeks are listed yet.</strong><p>Connect the folder, add a title, then use <em>Archive current week</em> whenever you want a permanent snapshot.</p></div> : archiveEntries.map((entry) => <article className="archive-card" key={entry.filename}><div><span>{entry.planner.weekOf ? `Week of ${entry.planner.weekOf}` : "Undated week"}</span><h3>{entry.title}</h3><p>{entry.planner.activeDays.length} school day{entry.planner.activeDays.length === 1 ? "" : "s"} · Saved {formatArchiveDate(entry.archivedAt)}</p><small title={entry.filename}>{entry.filename}</small></div><div><button type="button" onClick={() => restoreArchivedWeek(entry)}>Restore</button><button type="button" onClick={() => renameArchivedWeek(entry)}>Rename</button><button className="danger" type="button" onClick={() => deleteArchivedWeek(entry)}>Delete</button></div></article>)}</div>
    </section></div>}

    {pendingImport && <div className="modal-backdrop import-backdrop screen-only" onMouseDown={() => setPendingImport(null)}><section className="drawer import-drawer" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">JSON import // Review before applying</p><h2 id="import-title">Choose what to import</h2></div><button type="button" onClick={() => setPendingImport(null)} aria-label="Close">×</button></div><p className="import-summary"><strong>{pendingImport.filename}</strong> contains {pendingImport.kind === "ai" ? "an AI-generated lesson plan" : "a complete planner backup"}. Only the choices below will be changed.</p>{pendingImport.backup && <label className="restore-choice"><input type="checkbox" checked={restoreFullBackup} onChange={(event) => setRestoreFullBackup(event.target.checked)} /><span><strong>Restore the complete backup</strong><small>Replace the week, optional week-level context, all school days, all three slots, and completion status.</small></span></label>}{!restoreFullBackup && <><div className="import-routing">{pendingImport.kind === "backup" && <label><span>Copy from</span><select value={importSourceSlot} onChange={(event) => changeImportSource(event.target.value as Slot)}>{pendingImport.sourceSlots.map((slot) => <option key={slot} value={slot}>{slotName[slot]}</option>)}</select></label>}<label><span>Import into</span><select value={importTargetSlot} onChange={(event) => setImportTargetSlot(event.target.value as Slot)}>{slots.map((slot) => <option key={slot} value={slot}>{slotName[slot]}</option>)}</select></label></div><fieldset className="import-days"><legend>Days to import</legend>{availableImportDays.map((day) => <label key={day}><input type="checkbox" checked={importDays.includes(day)} onChange={() => toggleImportDay(day)} /><span><strong>{dayName[day]}</strong><small>{pendingImport.schedules[importSourceSlot]?.[day]?.length ?? 0} activities</small></span></label>)}</fieldset><div className="import-options">{pendingImport.weekOf && <label><input type="checkbox" checked={applyImportWeek} onChange={(event) => setApplyImportWeek(event.target.checked)} />Use imported week date <strong>{pendingImport.weekOf}</strong></label>}{pendingImport.meta && <label><input type="checkbox" checked={applyImportMeta} onChange={(event) => setApplyImportMeta(event.target.checked)} />Apply optional week-level context</label>}</div></>}<div className="drawer-actions"><button type="button" onClick={() => setPendingImport(null)}>Cancel</button><button className="primary" type="button" disabled={!restoreFullBackup && importDays.length === 0} onClick={applySelectedImport}>{restoreFullBackup ? "Restore backup" : `Import ${importDays.length} day${importDays.length === 1 ? "" : "s"}`}</button></div></section></div>}

    {briefOpen && <div className="modal-backdrop weekly-summary-backdrop screen-only" onMouseDown={() => setBriefOpen(false)}><section className="drawer weekly-drawer" role="dialog" aria-modal="true" aria-labelledby="brief-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Generated from the current plan</p><h2 id="brief-title">Weekly summary</h2></div><button type="button" onClick={() => setBriefOpen(false)} aria-label="Close">×</button></div>
      <section className="brief-report-hero"><div><span>{weekLabel} · {slotName[activeSlot]}</span><h3>{planner.meta.topic || `${activeDays.length}-day learning plan`}</h3><p>{planner.meta.centralQuestion || "This report updates automatically from the objectives, outcomes, products, activities, and resources in the current plan."}</p></div><div className="brief-report-stats"><div><strong>{activeDays.length}</strong><span>Days</span></div><div><strong>{briefActivities.length}</strong><span>Activities</span></div><div><strong>{briefMinutes}</strong><span>Minutes</span></div><div><strong>{briefResourceCount}</strong><span>Links</span></div></div></section>
      {populatedContext.length > 0 && <section className="brief-context"><h3>Week-level context</h3><div>{populatedContext.map(([key, label]) => { const value = planner.meta[key]; const href = safeHref(value); return <article key={key}><span>{label}</span>{href ? <a href={href} target="_blank" rel="noreferrer">{value} ↗</a> : <p>{value}</p>}</article>; })}</div></section>}
      <section className="brief-days"><div className="brief-section-heading"><div><span>Live plan report</span><h3>Daily sequence</h3></div><p>Nothing below needs to be entered twice. Edit a day card and this summary changes with it.</p></div>{activeDays.map((day) => { const daySegments = planner.schedules[activeSlot][day]; return <article className="brief-day" key={day}><header><div><span>{dateForDay(planner.weekOf, day)}</span><h3>{dayName[day]}</h3><p>{planner.dailyDetails[activeSlot][day].focus || "Daily focus not yet set"}</p></div><strong>{daySegments.reduce((total, item) => total + item.minutes, 0)} min</strong></header><div className="brief-day-targets"><div><span>Learning objective</span><p>{planner.dailyObjectives[activeSlot][day] || "Not yet set."}</p></div><div><span>Desired outcome</span><p>{planner.dailyDetails[activeSlot][day].outcome || "Not yet set."}</p></div><div><span>Daily product</span><p>{planner.dailyDetails[activeSlot][day].product || "Not yet set."}</p></div></div><ol className="brief-activity-list">{daySegments.map((item, index) => { const start = daySegments.slice(0, index).reduce((total, segment) => total + segment.minutes, 0); const resources = item.resources.flatMap((resource) => { const href = safeHref(resource.url); return href ? [{ ...resource, href }] : []; }); return <li key={item.id}><div><span>{range(start, item.minutes, planner.slotStartTimes[activeSlot])}</span><strong>{item.title}</strong><small>{item.category} · {item.minutes} min</small></div>{resources.length > 0 && <nav aria-label={`${item.title} resources`}>{resources.map((resource, resourceIndex) => <a key={`${resource.href}-${resourceIndex}`} href={resource.href} target="_blank" rel="noreferrer">{resource.label || "Open resource"} ↗</a>)}</nav>}</li>; })}</ol></article>; })}</section>
      <details className="brief-editor"><summary><span><strong>Edit optional week-level context</strong><small>Topic, central question, certification notes, lab context, and other details. None are required for the report above.</small></span><b>＋</b></summary><div className="field-grid">{metaFields.map(([key, label, placeholder]) => <label key={key} className={key === "topic" || key === "centralQuestion" ? "wide" : ""}><span>{label}</span><textarea rows={key === "topic" ? 2 : 3} value={planner.meta[key]} placeholder={placeholder} onChange={(event) => updateMeta(key, event.target.value)} /></label>)}</div></details><div className="drawer-actions"><button type="button" onClick={() => printPlan("summary")}>Print / save PDF</button><button className="primary" type="button" onClick={() => setBriefOpen(false)}>Done</button></div></section></div>}

    {editing && selected && <div className="modal-backdrop screen-only" onMouseDown={() => setEditing(null)}><section className="drawer segment-drawer" role="dialog" aria-modal="true" aria-labelledby="segment-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">{dayName[editing.day]} // {slotName[editing.slot]}</p><h2 id="segment-title">Edit segment</h2></div><button type="button" onClick={() => setEditing(null)} aria-label="Close">×</button></div><label><span>Activity title</span><input value={selected.title} onChange={(event) => updateSegment(editing.day, editing.id, { title: event.target.value }, editing.slot)} /></label><div className="split-fields"><label><span>Minutes</span><input type="number" min="1" max="180" value={selected.minutes} onChange={(event) => updateSegment(editing.day, editing.id, { minutes: Math.max(1, Number(event.target.value) || 1) }, editing.slot)} /></label><label><span>Category</span><select value={selected.category} onChange={(event) => updateSegment(editing.day, editing.id, { category: event.target.value as Category }, editing.slot)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div><label><span>Purpose and teacher notes</span><textarea rows={7} value={selected.notes} onChange={(event) => updateSegment(editing.day, editing.id, { notes: event.target.value }, editing.slot)} /></label><label className="move-day-field"><span>Scheduled day</span><select value={editing.day} onChange={(event) => moveSelectedToDay(event.target.value as Day)}>{activeDays.map((day) => <option key={day} value={day}>{dayName[day]}</option>)}</select><small>Useful on touch devices when dragging is inconvenient.</small></label><section className="resource-editor"><div><span>Activity links</span><button type="button" onClick={addResource}>＋ Add link</button></div>{selected.resources.length === 0 && <p>Add websites, documents, videos, or other resources students can open from this card.</p>}{selected.resources.map((resource, index) => <div className="resource-row" key={index}><label><span>Link label</span><input value={resource.label} placeholder="Lab instructions" onChange={(event) => updateResource(index, { label: event.target.value })} /></label><label><span>Web address</span><input type="url" value={resource.url} placeholder="https://…" onChange={(event) => updateResource(index, { url: event.target.value })} /></label><button type="button" onClick={() => removeResource(index)} aria-label={`Remove ${resource.label || "link"}`}>×</button></div>)}</section><label className="completion-row"><input type="checkbox" checked={selected.completed} onChange={(event) => updateSegment(editing.day, editing.id, { completed: event.target.checked }, editing.slot)} />Completed as planned</label><div className="drawer-actions"><button className="danger" type="button" onClick={deleteSegment}>Delete</button><button type="button" onClick={saveSelectedActivityToLibrary}>Save to library</button><button className="primary" type="button" onClick={() => setEditing(null)}>Done</button></div></section></div>}
  </main>;
}
