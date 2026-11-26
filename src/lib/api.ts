import type { GameState } from "./game";

export type Role = "student" | "parent" | "educator";

export type TutorAppearance = {
  skin: string;
  hairColor: string;
  eyeColor: string;
  hairStyle: string;
  hairLength: string;
  outfit: string;
  effect: string;
  accessory: string;
  glasses: string;
  freckles: boolean;
  markings: boolean;
  fantasy: string;
};

export type User = {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  role: Role;
  isGuest: boolean;
  activeLearnerId: string | null;
};

export type Learner = {
  id: string;
  name: string;
  age: number | null;
  ageGroup: string | null;
  grade: string | null;
  language: string;
  country: string | null;
  curriculum: string | null;
  learnerType: string;
  tutorName: string;
  tutorPersonality: string;
  tutorCharacterId: string;
  tutorPreset: string;
  strictness: string;
  appearance: TutorAppearance;
  environment: string;
  autoEnvironment: boolean;
  voiceAccent: string;
  voiceVolume: number;
  voiceStyle: string;
  speakingRate: number;
  theme: string;
  dailyGoal: number;
  gamification: boolean;
  memoryEnabled: boolean;
  xp: number;
  streak: number;
  lastActiveDate: string | null;
  onboarded: boolean;
  guardianConsent: boolean;
  interests: string[];
  loves: string[];
  struggles: string[];
  styles: string[];
  lessonLength: "quick" | "standard" | "extended";
  activityPref: string;
  examplesFirst: boolean;
  hintsFirst: boolean;
  extraTime: boolean;
  voiceEnabled: boolean;
  uploadsEnabled: boolean;
  allowedSubjects: string[];
  level: string;
  levelLabel: string;
  notes: string | null;
};

export type Topic = { name: string; level: string };
export type Department = { name: string; level: string; topics: Topic[] };
export type Subject = {
  id: string;
  name: string;
  icon: string;
  color: string;
  group: string;
  blurb: string;
  optional?: boolean;
  departments: Department[];
};
export type Meta = {
  app: { name: string; tagline: string };
  ai: { enabled: boolean; model: string | null; baseUrl: string | null };
  subjects: Subject[];
  interests: { id: string; label: string; emoji: string }[];
  personalities: { id: string; name: string; blurb: string; emoji: string }[];
  tutors?: { id: string; name: string; gender?: string }[];
  voiceStyles: { id: string; name: string; hint: string }[];
  learningStyles: { id: string; label: string; emoji: string }[];
  lessonLengths: { id: string; label: string; minutes: number[]; blurb: string }[];
  ageGroups: { id: string; label: string; ages: string; tone: string }[];
  achievements: { code: string; name: string; icon: string; description: string }[];
  levels: Record<string, string>;
  totalTopics: number;
  library?: {
    books: number;
    topics: number;
    sections: { id: string; name: string; icon: string; blurb: string; color: string; ambient: string }[];
    chambers: { id: string; name: string; blurb: string; route: string; icon: string; level: number }[];
    statuses: { id: string; name: string; tone: string; blurb: string }[];
    catalog: { id: string; title: string; subtitle: string; section: string; icon: string; color: string; blurb: string; topicCount: number; chapterCount: number }[];
  };
};

export type LessonSection = {
  type: string;
  heading: string;
  body: string;
  bullets?: string[];
  steps?: string[];
  items?: string[];
  hint?: string;
};

export type Lesson = {
  id: string;
  subject: string;
  subjectName: string;
  topic: string;
  title: string;
  level: string;
  duration: number;
  bookId?: string | null;
  topicId?: string | null;
  objectives: string[];
  sections: LessonSection[];
  nextLesson: string | null;
  status: "in_progress" | "completed";
  progress: number;
  source: string;
  createdAt: number;
  updatedAt: number;
};

export type Question = {
  id: string;
  type: "multiple_choice" | "true_false" | "fill_blank" | "short_answer" | "written_response" | "matching" | "math";
  prompt: string;
  options?: string[];
  pairs?: { left: string; right: string }[];
  hint?: string;
};

export type Quiz = {
  id: string;
  subject: string;
  subjectName?: string;
  topic: string;
  title: string;
  level: string;
  bookId?: string | null;
  topicId?: string | null;
  questions: Question[];
  questionCount?: number;
  attempts?: number;
  best?: { score: number; total: number; created_at: number } | null;
  createdAt: number;
};

export type Conversation = { id: string; title: string; subject: string | null; updated_at: number; messages: number };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
  meta?: { source?: string; notice?: string | null } | null;
};

export type MemoryItem = { id: string; kind: string; content: string; created_at: number };
export type ProgressRow = { subject: string; mastery: number; minutes: number; lessons_done: number; updated_at: number };
export type ActivityRow = { kind: string; detail: string; xp: number; created_at: number };
export type Achievement = { code: string; name?: string; icon?: string; description?: string; earned?: boolean; earned_at?: number | null };
export type LibraryItem = { id: string; kind: string; title: string; body: string | null; subject: string | null; ref_id?: string | null; created_at: number };
export type Upload = { id: string; name: string; mime: string | null; size: number; summary: string | null; created_at: number; textFound?: boolean };
export type Flashcard = { id: string; front: string; back: string; subject: string | null; box: number; created_at: number };
export type ScheduleSession = { id: string; title: string; subject: string | null; subjectName?: string; startAt: string; minutes: number; note: string | null; done: boolean };
export type Assignment = { id: string; learner_id: string; kind: string; ref_id: string | null; title: string; due_at: string | null; status: string; created_at: number };

export type DashboardData = {
  learner: Learner;
  today: { minutes: number; goal: number; activities: number; xpEarned: number };
  progress: ProgressRow[];
  inProgress: Lesson[];
  achievements: Achievement[];
  upcoming: ScheduleSession[];
  recommended: { subject: string; subjectName: string; topic: string; level: string }[];
  challenge: { subject: string; text: string; hint: string };
  counts: { lessonsCompleted: number; quizAvg: number; minutesTotal: number };
  streak: number;
  environment?: string;
  game?: GameState;
  report?: DailyBrief;
  accountability?: {
    overdue: { id: string; title: string; due_at?: string; status?: string }[];
    dueSoon: { id: string; title: string; due_at?: string; status?: string }[];
    incomplete: { id: string; title: string; topic?: string; progress: number }[];
    missedSessions: { id: string; title: string; start_at: string }[];
    upcoming: { id: string; title: string; start_at: string }[];
    summary: string;
    hasItems: boolean;
  };
};

export type ReportCommitment = {
  key: string;
  kind: "goal" | "assignment" | "session";
  label: string;
  detail: string;
  done: boolean;
  tone: string;
};

export type ReportDay = {
  date: string;
  weekday: string;
  label: string;
  minutes: number;
  lessons: number;
  attempts: number;
  active: boolean;
  goalMet: boolean;
  future: boolean;
  isToday: boolean;
};

export type ReportSummary = {
  period: "daily" | "weekly";
  periodKey: string;
  anchor: string;
  label: string;
  rangeLabel: string;
  status: string;
  statusLabel: string;
  tone: string;
  minutes: number;
  target: number;
  lessons: number;
  attempts: number;
  accuracy: number | null;
  mastered: number;
  activeDays: number;
  pct: number;
};

export type LearningReport = {
  period: "daily" | "weekly";
  periodKey: string;
  anchor: string;
  label: string;
  range: { start: string; end: string; label: string; fullTarget: number; elapsedDays: number };
  status: string;
  statusLabel: string;
  tone: string;
  headline: string;
  summary: string;
  note: { author: string; text: string };
  goal: { minutes: number; target: number; fullTarget: number; pct: number; met: boolean; dailyGoal: number };
  metrics: {
    minutes: number;
    lessons: number;
    lessonMinutes: number;
    attempts: number;
    correct: number;
    questions: number;
    accuracy: number | null;
    xpEarned: number;
    activeDays: number;
    goalMetDays: number;
    mastered: number;
    alreadyMastered: number;
    masteredTotal: number;
    topicsStudied: number;
    assignmentsOpen: number;
    overdue: number;
    sessionsKept: number;
    sessionsMissed: number;
    streak: number;
  };
  days: ReportDay[];
  wins: string[];
  concerns: string[];
  nextSteps: { title: string; detail: string; to: string; tone?: string }[];
  commitments: ReportCommitment[];
  overdue: { id: string; title: string; due_at: string | null; status: string }[];
  dueInRange: { id: string; title: string; due_at: string | null; status: string }[];
  upcomingSessions: { id: string; title: string; start_at: string }[];
  mastered: string[];
  retained: string[];
  learner: { id: string; name: string; tutorName: string };
};

export type DailyBrief = {
  status: string;
  statusLabel: string;
  tone: string;
  headline: string;
  minutes: number;
  target: number;
  pct: number;
  nextStep: { title: string; detail: string; to: string; tone?: string } | null;
  openItems: number;
  overdue: number;
  missing: string[];
};

export type ReportOverview = {
  learner: { id: string; name: string; tutorName: string; dailyGoal: number };
  today: string;
  anchor: string;
  daily: LearningReport;
  weekly: LearningReport;
  history: { daily: ReportSummary[]; weekly: ReportSummary[] };
  openItems: number;
};

export type GradeResult = {
  id: string;
  type: string;
  prompt: string;
  given: string;
  open: boolean;
  graded: boolean;
  correct: boolean | null;
  expected: string;
  explanation: string;
  feedback: string;
  hint: string;
};

export type Rewards = { xp: number; streak: number; unlocked: { code: string; name: string; icon: string; description: string }[] } | null;

export type AdventureAreaId = "courtyard" | "library" | "study" | "classroom";
export type AdventureAppearance = {
  name: string;
  skin: string;
  hairStyle: "short" | "bob" | "braids" | "curly" | "long" | "bun";
  hairColor: string;
  outfit: "uniform" | "robes" | "casual";
  outfitColor: string;
  accessory: "none" | "glasses" | "circlet" | "scarf";
  freckles: boolean;
};
export type AdventureSettings = {
  sensitivity: number;
  invertY: boolean;
  motionReduction: boolean;
  cameraShake: boolean;
  speed: number;
  quality: "low" | "high";
};
export type AdventurePosition = { area: AdventureAreaId; x: number; z: number; yaw: number; pitch: number };
export type AdventureCharacter = {
  id: string;
  name: string;
  appearance: AdventureAppearance;
  createdAt?: number;
  updatedAt?: number;
};

export type AdventureProfile = {
  appearance: AdventureAppearance | null;
  characters: AdventureCharacter[];
  activeCharacterId: string | null;
  position: AdventurePosition | null;
  settings: AdventureSettings;
  discoveries: string[];
  worldTime: number | null;
  updatedAt: number | null;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(path: string, options: { method?: string; json?: unknown; body?: BodyInit; signal?: AbortSignal } = {}): Promise<T> {
  const { method = "GET", json, body, signal } = options;
  const headers: Record<string, string> = {};
  let payload = body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(json);
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: payload,
    credentials: "same-origin",
    signal,
  });
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : { error: await res.text() };
  if (!res.ok || !isJson) {
    let message = typeof (data as any)?.error === "string" ? (data as any).error.trim() : "";
    if (!message || message.startsWith("<") || !isJson) {
      message = res.status === 405
        ? "This action needs the Asterwood server, which isn't connected on this static site."
        : "The Asterwood server didn't answer. This static preview can't sign in.";
    }
    throw new ApiError(isJson ? res.status : 503, message);
  }
  return data as T;
}

export async function uploadFile(file: File, learnerId: string): Promise<{ upload: Upload }> {
  const form = new FormData();
  form.append("file", file);
  form.append("learnerId", learnerId);
  const res = await fetch(`/api/uploads?learnerId=${encodeURIComponent(learnerId)}`, {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data?.error || "Upload failed");
  return data;
}

export function getAdventure(): Promise<{ profile: AdventureProfile }> {
  return api("/adventure");
}

export function createAdventureCharacter(body: { name?: string; appearance: AdventureAppearance }): Promise<{ profile: AdventureProfile }> {
  return api("/adventure/characters", { method: "POST", json: body });
}

export function updateAdventureCharacter(
  id: string,
  body: { name?: string; appearance?: AdventureAppearance },
): Promise<{ profile: AdventureProfile }> {
  return api(`/adventure/characters/${id}`, { method: "PATCH", json: body });
}

export function activateAdventureCharacter(id: string): Promise<{ profile: AdventureProfile }> {
  return api(`/adventure/characters/${id}/activate`, { method: "POST" });
}

export function deleteAdventureCharacter(id: string): Promise<{ profile: AdventureProfile }> {
  return api(`/adventure/characters/${id}`, { method: "DELETE" });
}

export function saveAdventure(patch: {
  appearance?: AdventureAppearance | null;
  position?: AdventurePosition;
  settings?: AdventureSettings;
  discoveries?: string[];
  worldTime?: number;
}): Promise<{ profile: AdventureProfile }> {
  return api("/adventure", { method: "PATCH", json: patch });
}

export const subjectName = (id: string, subjects?: Subject[]) =>
  subjects?.find((s) => s.id === id)?.name || id;

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDate(iso: string | number | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
