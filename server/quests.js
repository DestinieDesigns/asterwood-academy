/**
 * Adventure progression: levels, daily/weekly commissions and long missions.
 *
 * Progress is derived from real learning records (completed lessons, quiz
 * accuracy, minutes and mastery evidence), not from clicks or screen time.
 * Quest rows only remember selection and whether a reward was claimed.
 */
import { many, now, one, run, uid, todayKey } from "./db.js";
import { allBooks, getBook } from "./library.js";
import { assess, masteryRows, sectionsTouched } from "./progress.js";

export const LEVELS = [
  { level: 1, title: "Seeker", xp: 0 },
  { level: 2, title: "Apprentice", xp: 80 },
  { level: 3, title: "Scholar", xp: 220 },
  { level: 4, title: "Adept", xp: 450 },
  { level: 5, title: "Lorekeeper", xp: 800 },
  { level: 6, title: "Archivist", xp: 1300 },
  { level: 7, title: "Sage", xp: 2000 },
  { level: 8, title: "Luminary", xp: 3000 },
  { level: 9, title: "Celestial Scholar", xp: 4500 },
];

export function levelInfo(xp) {
  const value = Math.max(0, Number(xp) || 0);
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (value >= LEVELS[i].xp) index = i;
  const current = LEVELS[index];
  const next = LEVELS[index + 1] || null;
  const into = value - current.xp;
  const span = next ? next.xp - current.xp : 1;
  return {
    level: current.level,
    title: current.title,
    xp: value,
    into,
    nextXp: next?.xp ?? null,
    nextTitle: next?.title ?? null,
    pct: next ? Math.min(100, Math.round((into / span) * 100)) : 100,
    toNext: next ? Math.max(0, next.xp - value) : 0,
  };
}

const DAILY_TEMPLATES = [
  { code: "d_lesson", title: "Turn one page", description: "Complete a lesson anywhere in the Library.", metric: "lessons_today", target: 1, xp: 20 },
  { code: "d_correct", title: "Five true answers", description: "Answer five practice questions correctly.", metric: "correct_today", target: 5, xp: 20 },
  { code: "d_minutes", title: "A focused half hour", description: "Spend 25 minutes in real study.", metric: "minutes_today", target: 25, xp: 25 },
  { code: "d_mastery", title: "Prove it", description: "Reach Mastered on a topic today.", metric: "mastered_today", target: 1, xp: 40 },
  { code: "d_books", title: "Follow a curiosity", description: "Study in two different books today.", metric: "books_today", target: 2, xp: 25 },
];

const WEEKLY_TEMPLATES = [
  { code: "w_lessons", title: "A chapter of your own", description: "Complete four lessons this week.", metric: "lessons_week", target: 4, xp: 60 },
  { code: "w_mastery", title: "Two ideas made yours", description: "Reach Mastered on two topics this week.", metric: "mastered_week", target: 2, xp: 100 },
  { code: "w_correct", title: "Twenty correct", description: "Answer twenty practice questions correctly this week.", metric: "correct_week", target: 20, xp: 80 },
  { code: "w_minutes", title: "Two quiet hours", description: "Study for 120 minutes across the week.", metric: "minutes_week", target: 120, xp: 100 },
  { code: "w_sections", title: "Cross the Library", description: "Study in three different sections this week.", metric: "sections_week", target: 3, xp: 90 },
];

const MISSION_TEMPLATES = [
  { code: "m_master_5", title: "Five lights lit", description: "Master five topics anywhere in the Library.", metric: "mastered_total", target: 5, xp: 150 },
  { code: "m_master_20", title: "A constellation of ideas", description: "Master twenty topics.", metric: "mastered_total", target: 20, xp: 400 },
  { code: "m_book", title: "Close one book", description: "Master every topic in a single book.", metric: "books_completed", target: 1, xp: 300 },
  { code: "m_sections", title: "The whole Library", description: "Study in all six sections.", metric: "sections_total", target: 6, xp: 200 },
  { code: "m_level_5", title: "Lorekeeper", description: "Reach level 5.", metric: "level", target: 5, xp: 250 },
  { code: "m_lessons_25", title: "Twenty-five pages", description: "Complete twenty-five lessons.", metric: "lessons_total", target: 25, xp: 300 },
];

function dayNumber() {
  const d = new Date();
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
}

function weekNumber() {
  return Math.floor(dayNumber() / 7);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function periodEnd(period) {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  if (period === "weekly") d.setDate(d.getDate() + (6 - ((d.getDay() + 6) % 7)));
  return d.getTime();
}

function rotate(list, seed, count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(list[(seed + i) % list.length]);
  return out;
}

function metricsFor(learner) {
  const today = startOfToday();
  const week = startOfWeek();
  const lessons = many(
    "SELECT * FROM lessons WHERE learner_id = ? AND status = 'completed'",
    learner.id,
  );
  const attempts = many("SELECT * FROM attempts WHERE learner_id = ?", learner.id);
  const mastery = masteryRows(learner.id);
  const rows = mastery.map((r) => ({ row: r, result: assess(r) }));

  const lessonsToday = lessons.filter((l) => l.updated_at >= today);
  const lessonsWeek = lessons.filter((l) => l.updated_at >= week);
  const attemptsToday = attempts.filter((a) => a.created_at >= today);
  const attemptsWeek = attempts.filter((a) => a.created_at >= week);
  // Only genuinely earned mastery counts. `updated_at` moves on every practice
  // attempt, so it would turn re-practising an old mastered topic into a new
  // completion of "Prove it".
  const masteredToday = rows.filter((r) => r.result.status === "mastered" && (r.row.mastered_at || 0) >= today);
  const masteredWeek = rows.filter((r) => r.result.status === "mastered" && (r.row.mastered_at || 0) >= week);
  const touchedToday = rows.filter((r) => (r.row.last_studied_at || 0) >= today);
  const touchedWeek = rows.filter((r) => (r.row.last_studied_at || 0) >= week);
  const bookIdsToday = new Set(touchedToday.map((r) => r.row.book_id));
  const sectionWeek = new Set(touchedWeek.map((r) => getBook(r.row.book_id)?.section).filter(Boolean));

  const masteredByBook = new Map();
  for (const r of rows) {
    if (r.result.status !== "mastered") continue;
    masteredByBook.set(r.row.book_id, (masteredByBook.get(r.row.book_id) || 0) + 1);
  }
  const booksCompleted = allBooks().filter((b) => (masteredByBook.get(b.id) || 0) >= b.topicCount).length;

  return {
    lessons_today: lessonsToday.length,
    lessons_week: lessonsWeek.length,
    lessons_total: lessons.length,
    correct_today: attemptsToday.reduce((n, a) => n + (a.score || 0), 0),
    correct_week: attemptsWeek.reduce((n, a) => n + (a.score || 0), 0),
    minutes_today: lessonsToday.reduce((n, l) => n + (l.duration || 0), 0) + attemptsToday.length * 3,
    minutes_week: lessonsWeek.reduce((n, l) => n + (l.duration || 0), 0) + attemptsWeek.length * 3,
    mastered_today: masteredToday.length,
    mastered_week: masteredWeek.length,
    mastered_total: rows.filter((r) => r.result.status === "mastered").length,
    books_today: bookIdsToday.size,
    sections_week: sectionWeek.size,
    sections_total: sectionsTouched(learner.id).size,
    books_completed: booksCompleted,
    level: levelInfo(learner.xp).level,
    streak: learner.streak || 0,
  };
}

function shapeTemplate(template, kind, periodKey, extra = {}) {
  return {
    templateCode: template.code,
    kind,
    periodKey,
    title: template.title,
    description: template.description,
    metric: template.metric,
    target: template.target,
    xp: template.xp,
    progress: 0,
    status: "active",
    claimedAt: null,
    expiresAt: periodEnd(kind === "daily" ? "daily" : "weekly"),
    ...extra,
  };
}

function ensureQuest(learnerId, template, kind, periodKey, extra) {
  const existing = one(
    "SELECT * FROM learner_quests WHERE learner_id = ? AND template_code = ? AND period_key = ?",
    learnerId, template.code, periodKey,
  );
  if (existing) return existing;
  const id = uid();
  const ts = now();
  run(
    `INSERT INTO learner_quests (id, learner_id, template_code, kind, period_key, title, description, metric, target, xp, progress, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?)`,
    id, learnerId, template.code, kind, periodKey, template.title, template.description,
    template.metric, template.target, template.xp, ts, ts,
  );
  return one("SELECT * FROM learner_quests WHERE id = ?", id);
}

/**
 * Ensure today's/weekly commissions exist and recompute every open quest from
 * real evidence. Returns the current board grouped by kind.
 */
export function refreshQuests(learner) {
  const dayKey = todayKey();
  const weekKey = `W${weekNumber()}`;
  const daily = rotate(DAILY_TEMPLATES, dayNumber(), 3);
  const weekly = rotate(WEEKLY_TEMPLATES, weekNumber(), 3);
  for (const t of daily) ensureQuest(learner.id, t, "daily", dayKey);
  for (const t of weekly) ensureQuest(learner.id, t, "weekly", weekKey);
  for (const t of MISSION_TEMPLATES) ensureQuest(learner.id, t, "mission", "long");

  const metrics = metricsFor(learner);
  const rows = many(
    "SELECT * FROM learner_quests WHERE learner_id = ? AND (period_key = ? OR period_key = ? OR period_key = 'long') ORDER BY kind ASC, created_at ASC",
    learner.id, dayKey, weekKey,
  );
  const shaped = rows.map((row) => {
    const progress = Math.min(row.target, metrics[row.metric] || 0);
    let status = row.status;
    if (status !== "claimed") status = progress >= row.target ? "completed" : "active";
    if (status !== row.status || progress !== row.progress) {
      run("UPDATE learner_quests SET progress = ?, status = ?, updated_at = ? WHERE id = ?", progress, status, now(), row.id);
    }
    return {
      id: row.id,
      templateCode: row.template_code,
      kind: row.kind,
      title: row.title,
      description: row.description,
      metric: row.metric,
      target: row.target,
      progress,
      xp: row.xp,
      status,
      claimedAt: row.claimed_at || null,
      expiresAt: row.expires_at || periodEnd(row.kind === "daily" ? "daily" : "weekly"),
      periodKey: row.period_key,
    };
  });
  const board = {
    daily: shaped.filter((q) => q.kind === "daily"),
    weekly: shaped.filter((q) => q.kind === "weekly"),
    missions: shaped.filter((q) => q.kind === "mission"),
  };
  return {
    ...board,
    metrics,
    counts: {
      dailyDone: board.daily.filter((q) => q.status !== "active").length,
      weeklyDone: board.weekly.filter((q) => q.status !== "active").length,
      missionsDone: board.missions.filter((q) => q.status === "claimed").length,
      claimable: shaped.filter((q) => q.status === "completed").length,
      claimed: many("SELECT COUNT(*) AS c FROM learner_quests WHERE learner_id = ? AND status = 'claimed'", learner.id)?.c || 0,
    },
    level: levelInfo(learner.xp),
  };
}

export function claimQuest(learner, questId) {
  refreshQuests(learner);
  const row = one("SELECT * FROM learner_quests WHERE id = ? AND learner_id = ?", questId, learner.id);
  if (!row) return { error: "Quest not found" };
  if (row.status === "claimed") return { error: "That reward has already been claimed." };
  if (row.status !== "completed") return { error: "This commission is not complete yet." };
  run("UPDATE learner_quests SET status = 'claimed', claimed_at = ?, updated_at = ? WHERE id = ?", now(), now(), row.id);
  return {
    xp: row.xp,
    title: row.title,
    quest: { ...row, status: "claimed", claimed_at: now() },
  };
}

export function questSummary(learner) {
  const board = refreshQuests(learner);
  return {
    ...board,
    current: [...board.daily.filter((q) => q.status === "active"), ...board.weekly.filter((q) => q.status === "active")][0]
      || board.daily[0]
      || board.missions.find((q) => q.status !== "claimed")
      || null,
  };
}
