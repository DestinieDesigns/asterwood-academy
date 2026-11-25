import { api } from "./api";

export type MasteryStatusId = "not_started" | "learning" | "practicing" | "developing" | "mastered";

export type StatusDef = {
  id: MasteryStatusId;
  name: string;
  tone: string;
  blurb: string;
};

export type TopicProgress = {
  id: string;
  name: string;
  blurb: string;
  chapterId: string;
  chapterTitle: string;
  bookId: string;
  status: MasteryStatusId;
  statusName: string;
  progress: number;
  accuracy: number | null;
  activities: number;
  lessons: number;
  assessment: string;
  lastStudiedAt: number | null;
};

export type ChapterProgress = {
  id: string;
  number: number;
  title: string;
  progress: number;
  mastered: number;
  topics: TopicProgress[];
};

export type BookMark = {
  id?: string;
  bookId: string;
  bookTitle?: string;
  topicId?: string | null;
  topicName?: string | null;
  page: number;
  label?: string;
  createdAt?: number;
};

export type BookSummary = {
  id: string;
  title: string;
  subtitle: string;
  section: string;
  subject: string;
  icon: string;
  color: string;
  blurb: string;
  chapterCount: number;
  topicCount: number;
  progress: number;
  counts: Partial<Record<MasteryStatusId, number>>;
  started: boolean;
  completed: boolean;
  official?: boolean;
  bookmarkCount?: number;
};

export type BookDetail = Omit<BookSummary, "bookmarkCount"> & {
  chapters: ChapterProgress[];
  bookmarks: BookMark[];
};

export type Section = {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  color: string;
  ambient: string;
  progress: number;
  mastered: number;
  touched: boolean;
  books: BookSummary[];
};

export type Chamber = {
  id: string;
  name: string;
  blurb: string;
  route: string;
  icon: string;
  level: number;
  unlocked: boolean;
};

export type LibraryData = {
  books: BookSummary[];
  sections: Section[];
  totals: { topics: number; mastered: number; developing: number; practicing: number; learning: number; startedBooks: number };
  recent: {
    bookId: string;
    bookTitle: string;
    topicId: string;
    topicName: string;
    status: MasteryStatusId;
    statusName: string;
    progress: number;
    lastStudiedAt: number | null;
  }[];
  bookmarks: BookMark[];
  statuses: StatusDef[];
  stats: { touched: number; mastered: number; inProgress: number; sections: number; counts: Record<string, number> };
  level: LevelInfo;
  chambers: Chamber[];
};

export type LevelInfo = {
  level: number;
  title: string;
  xp: number;
  into: number;
  nextXp: number | null;
  nextTitle: string | null;
  pct: number;
  toNext: number;
};

export type Quest = {
  id: string;
  templateCode: string;
  kind: "daily" | "weekly" | "mission";
  title: string;
  description: string;
  metric: string;
  target: number;
  progress: number;
  xp: number;
  status: "active" | "completed" | "claimed";
  claimedAt: number | null;
  expiresAt: number;
  periodKey: string;
};

export type QuestBoard = {
  daily: Quest[];
  weekly: Quest[];
  missions: Quest[];
  metrics: Record<string, number>;
  counts: { dailyDone: number; weeklyDone: number; missionsDone: number; claimable: number; claimed: number };
  level: LevelInfo;
  current?: Quest | null;
};

export type Companion = {
  name: string;
  line: string;
  connection: { bookId: string; title: string; text: string } | null;
  recommendations: {
    bookId: string;
    bookTitle: string;
    bookIcon: string;
    bookColor: string;
    section: string;
    topicId: string;
    topicName: string;
    chapterTitle: string;
    status: MasteryStatusId;
    statusName: string;
    progress: number;
    reason: string;
  }[];
};

export type GameState = {
  level: LevelInfo;
  stats: {
    touched: number;
    mastered: number;
    inProgress: number;
    sections: number;
    sectionsStudied: number;
    counts: Record<string, number>;
    totalTopics: number;
    books: number;
  };
  quests: QuestBoard;
  companion: Companion;
  library: {
    totals: LibraryData["totals"];
    sections: Section[];
    recent: LibraryData["recent"];
    books: BookSummary[];
  };
  chambers: Chamber[];
  achievements: { code: string; name?: string; icon?: string; description?: string; earned_at?: number }[];
  statuses: StatusDef[];
};

export type BookDetailResponse = {
  book: BookDetail;
  statuses: StatusDef[];
  level: LevelInfo;
  connection: { bookId: string; title: string; text: string } | null;
  recommendations: Companion["recommendations"];
};

export const STATUS_STYLES: Record<MasteryStatusId, { color: string; track: string; label: string }> = {
  not_started: { color: "#9aa0b4", track: "#e7e4ef", label: "Not started" },
  learning: { color: "#4d8de0", track: "#dceafb", label: "Learning" },
  practicing: { color: "#8a63e8", track: "#e9e0fb", label: "Practicing" },
  developing: { color: "#e0a22e", track: "#fbefd2", label: "Developing" },
  mastered: { color: "#2f9e6c", track: "#d9f3e5", label: "Mastered" },
};

export async function getLibrary(learnerId: string): Promise<LibraryData> {
  return api<LibraryData>(`/world?learnerId=${encodeURIComponent(learnerId)}`);
}

export async function getBook(learnerId: string, bookId: string): Promise<BookDetailResponse> {
  return api<BookDetailResponse>(`/library/${encodeURIComponent(bookId)}?learnerId=${encodeURIComponent(learnerId)}`);
}

export async function getQuests(learnerId: string): Promise<{ quests: QuestBoard; level: LevelInfo; statuses: StatusDef[] }> {
  return api(`/quests?learnerId=${encodeURIComponent(learnerId)}`);
}

export async function claimQuest(learnerId: string, questId: string): Promise<{ quests: QuestBoard; level: LevelInfo; xp: number; rewards: { xp: number; unlocked: { code: string; name: string; icon: string }[] } | null }> {
  return api(`/quests/${questId}/claim`, { method: "POST", json: { learnerId } });
}

export async function toggleBookmark(learnerId: string, bookId: string, opts: { topicId?: string | null; page?: number; label?: string } = {}): Promise<{ bookmarked: boolean; bookmarks: BookMark[] }> {
  return api("/bookmarks", { method: "POST", json: { learnerId, bookId, ...opts } });
}

export async function getGame(learnerId: string): Promise<{ game: GameState }> {
  return api(`/game?learnerId=${encodeURIComponent(learnerId)}`);
}

export async function requestContent(learnerId: string, payload: { title: string; details?: string; kind?: string }): Promise<{ request: unknown }> {
  return api("/library/requests", { method: "POST", json: { learnerId, ...payload } });
}

export function formatStudyDate(ts: number | null | undefined): string {
  if (!ts) return "Not studied yet";
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "Studied today";
  if (days === 1) return "Studied yesterday";
  if (days < 30) return `Studied ${days} days ago`;
  return `Last studied ${new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
