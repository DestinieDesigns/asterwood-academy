import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { db, uid, now, one, many, run, parseJson, todayKey, dateKey } from "./db.js";
import {
  SUBJECTS,
  SUBJECT_MAP,
  INTERESTS,
  ACHIEVEMENTS,
  TUTOR_PERSONALITIES,
  VOICE_STYLES,
  LEARNING_STYLES,
  LESSON_LENGTHS,
  AGE_GROUPS,
  LEVEL_LABELS,
  DAILY_CHALLENGE_BANK,
  ageGroupForAge,
  levelForAge,
  allTopics,
  findSubjectByTopic,
} from "./curriculum.js";
import { aiStatus } from "./ai.js";
import {
  TUTORS,
  TUTOR_MAP,
  PERSONALITY_PRESETS,
  PRESET_MAP,
  STRICTNESS_LEVELS,
  STRICTNESS_MAP,
  ENVIRONMENTS,
  APPEARANCE_OPTIONS,
  defaultAppearance,
  parseAppearance,
  sanitizeAppearance,
  normalizePreset,
  normalizeStrictness,
  environmentFor,
  CHARACTER_LINES,
} from "./tutors.js";
import { KJV_PASSAGES, KJV_NOTE } from "./scripture.js";
import {
  SECTIONS,
  CHAMBERS,
  allBooks,
  registerCustomBooks,
  getBook,
  findTopic,
  BOOKS,
  TOTAL_TOPICS,
} from "./library.js";
import {
  MASTERY_STATUSES,
  MASTERY_MAP,
  libraryOverview,
  bookWithProgress,
  masteryRows,
  masteryStats,
  creditTopicStart,
  creditLessonCompletion,
  creditQuizAttempt,
  recommendations,
  companion,
  connectionFor,
  assess,
} from "./progress.js";
import { levelInfo, questSummary, claimQuest, refreshQuests } from "./quests.js";
import { reportOverview, dailyBrief } from "./reports.js";
import {
  tutorReply,
  generateLesson,
  generateQuiz,
  gradeAttempt,
  gradeLocally,
  analyzeDocument,
  studyGuideFromDocument,
  getAccountability,
  buildStudyPlan,
  extractMemories,
  learnerProfileText,
  evalExpression,
} from "./tutor.js";

/* ------------------------------------------------------------------ */
/*  Custom library content (CMS)                                       */
/* ------------------------------------------------------------------ */

function safeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function normalizeCustomBook(payload, forcedId) {
  const title = String(payload.title || "").trim().slice(0, 100);
  if (!title) throw new HttpError(400, "A book needs a title");
  const section = SECTIONS.some((s) => s.id === payload.section) ? payload.section : "foundations";
  const subject = SUBJECT_MAP[payload.subject] ? payload.subject : "math";
  const baseId = forcedId || `custom-${safeSlug(title)}`;
  const taken = !forcedId && (BOOKS.some((b) => b.id === baseId) || Boolean(one("SELECT 1 AS x FROM custom_books WHERE id = ?", baseId)));
  const id = BOOKS.some((b) => b.id === baseId) || taken ? `${baseId}-${Date.now().toString(36)}` : baseId;
  const chaptersRaw = Array.isArray(payload.chapters) && payload.chapters.length ? payload.chapters : [{ title: "Chapter 1", topics: [] }];
  const chapters = chaptersRaw.slice(0, 20).map((chapter, ci) => ({
    id: `${id}-ch-${ci + 1}`,
    title: String(chapter.title || `Chapter ${ci + 1}`).slice(0, 120),
    topics: (Array.isArray(chapter.topics) ? chapter.topics : []).slice(0, 40).map((t) => ({
      name: String(typeof t === "string" ? t : t.name || "").trim().slice(0, 120),
      blurb: String(typeof t === "string" ? "" : t.blurb || "").slice(0, 400),
    })).filter((t) => t.name),
  }));
  return {
    id,
    title,
    subtitle: String(payload.subtitle || "A custom volume").slice(0, 120),
    section,
    subject,
    icon: String(payload.icon || "📕").slice(0, 8),
    color: /^#[0-9a-f]{6}$/i.test(payload.color || "") ? payload.color : "#8a6cd6",
    blurb: String(payload.blurb || "A custom volume awaiting review.").slice(0, 500),
    official: false,
    chapters: chapters.map((c) => ({ ...c, topics: c.topics.map((t) => ({ ...t, blurb: t.blurb || `A reviewed topic in ${title}.` })) })),
  };
}

function loadCustomBooks() {
  const rows = many("SELECT data FROM custom_books WHERE status = 'published'");
  registerCustomBooks(rows.map((r) => parseJson(r.data, null)).filter(Boolean));
}

loadCustomBooks();

function bookCard(book) {
  return {
    id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    section: book.section,
    subject: book.subject,
    icon: book.icon,
    color: book.color,
    blurb: book.blurb,
    official: book.official !== false,
    chapterCount: book.chapterCount,
    topicCount: book.topicCount,
    progress: book.progress || 0,
    counts: book.counts || {},
    started: Boolean(book.started),
    completed: Boolean(book.completed),
    bookmarkCount: (book.bookmarks || []).length,
  };
}

function gameState(learner) {
  const level = levelInfo(learner.xp);
  const stats = masteryStats(learner.id);
  const quests = questSummary(learner);
  const companionInfo = companion(learner, 3);
  const overview = libraryOverview(learner, allBooks());
  const earned = many("SELECT code, earned_at FROM achievements WHERE learner_id = ? ORDER BY earned_at DESC", learner.id);
  return {
    level,
    stats: { ...stats, sectionsStudied: stats.sections, totalTopics: overview.totals.topics, books: overview.books.length },
    quests,
    companion: companionInfo,
    library: {
      totals: overview.totals,
      sections: overview.sections.map((s) => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
        blurb: s.blurb,
        color: s.color,
        progress: s.progress,
        mastered: s.mastered,
        touched: s.touched,
        books: s.books.map(bookCard),
      })),
      recent: overview.recent,
      books: overview.books.map(bookCard),
    },
    chambers: CHAMBERS.map((chamber) => ({ ...chamber, unlocked: level.level >= chamber.level })),
    achievements: earned.map((a) => ({ ...a, ...(ACHIEVEMENTS.find((x) => x.code === a.code) || {}) })),
    statuses: MASTERY_STATUSES,
  };
}

const PORT = Number(process.env.PLUMI_PORT || 3001);
const DATA_DIR = path.join(import.meta.dir, "..", "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DIST_DIR = path.join(import.meta.dir, "..", "dist");
mkdirSync(UPLOAD_DIR, { recursive: true });

const SESSION_COOKIE = "plumi_session";
const SESSION_DAYS = 30;

/* ------------------------------------------------------------------ */
/*  HTTP helpers                                                       */
/* ------------------------------------------------------------------ */

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function send(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

function fail(status, message, extra = {}) {
  return send({ error: message, ...extra }, status);
}

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "no-referrer",
};

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function sessionCookie(token, maxAge = SESSION_DAYS * 86400) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = String(stored).split(":");
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const expires = now() + SESSION_DAYS * 86400000;
  run("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", token, userId, expires, now());
  return token;
}

function userFromRequest(req) {
  const cookies = parseCookies(req.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = one("SELECT * FROM sessions WHERE token = ?", token);
  if (!session || session.expires_at < now()) return null;
  const user = one("SELECT id, email, username, name, role, active_learner_id, guardian_email, created_at FROM users WHERE id = ?", session.user_id);
  return user || null;
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email || null, username: user.username || null, name: user.name, role: user.role, activeLearnerId: user.active_learner_id };
}

function learnersFor(user) {
  if (!user) return [];
  return many("SELECT * FROM learners WHERE owner_user_id = ? ORDER BY created_at ASC", user.id);
}

function activeLearner(user) {
  if (!user) return null;
  const list = learnersFor(user);
  if (!list.length) return null;
  const active = user.active_learner_id ? list.find((l) => l.id === user.active_learner_id) : null;
  return active || list[0];
}

function requireLearner(user, learnerId) {
  if (!user) throw new HttpError(401, "Please sign in to continue");
  const id = learnerId || user?.active_learner_id;
  const learner = id ? one("SELECT * FROM learners WHERE id = ?", id) : activeLearner(user);
  if (!learner) throw new HttpError(404, "No learner profile found");
  if (learner.owner_user_id !== user.id) throw new HttpError(403, "You do not have access to this learner profile");
  return learner;
}

function shapeLearner(learner) {
  if (!learner) return null;
  return {
    id: learner.id,
    name: learner.name,
    age: learner.age,
    ageGroup: learner.age_group,
    grade: learner.grade,
    language: learner.language,
    country: learner.country,
    curriculum: learner.curriculum,
    learnerType: learner.learner_type,
    tutorName: learner.tutor_name,
    tutorPersonality: learner.tutor_personality,
    tutorCharacterId: learner.tutor_character_id || "auren",
    tutorPreset: normalizePreset(learner.tutor_preset || learner.tutor_personality, learner.tutor_character_id),
    strictness: normalizeStrictness(learner.strictness, normalizePreset(learner.tutor_preset || learner.tutor_personality, learner.tutor_character_id)),
    appearance: parseAppearance(learner.appearance, learner.tutor_character_id),
    environment: learner.environment || "auto",
    autoEnvironment: learner.auto_environment !== 0,
    voiceAccent: learner.voice_accent || "auto",
    voiceVolume: learner.voice_volume == null ? 1 : learner.voice_volume,
    voiceStyle: learner.voice_style,
    speakingRate: learner.speaking_rate,
    theme: learner.theme,
    dailyGoal: learner.daily_goal,
    gamification: Boolean(learner.gamification),
    memoryEnabled: Boolean(learner.memory_enabled),
    xp: learner.xp,
    streak: learner.streak,
    lastActiveDate: learner.last_active_date,
    onboarded: Boolean(learner.onboarded),
    guardianConsent: Boolean(learner.guardian_consent),
    interests: parseJson(learner.interests, []),
    loves: parseJson(learner.loves, []),
    struggles: parseJson(learner.struggles, []),
    styles: parseJson(learner.styles, []),
    lessonLength: learner.lesson_length,
    activityPref: learner.activity_pref,
    examplesFirst: Boolean(learner.examples_first),
    hintsFirst: Boolean(learner.hints_first),
    extraTime: Boolean(learner.extra_time),
    voiceEnabled: Boolean(learner.voice_enabled),
    uploadsEnabled: Boolean(learner.uploads_enabled),
    allowedSubjects: parseJson(learner.allowed_subjects, []),
    level: levelForAge(learner.age),
    levelLabel: LEVEL_LABELS[levelForAge(learner.age)],
    notes: learner.notes,
  };
}

/* ------------------------------------------------------------------ */
/*  Progress, XP and achievements                                      */
/* ------------------------------------------------------------------ */

const XP = {
  chat: 2,
  lesson_complete: 25,
  quiz_attempt: 12,
  quiz_perfect: 20,
  library: 3,
  flashcard: 2,
  challenge: 10,
  plan: 5,
};

function touchStreak(learner) {
  const today = todayKey();
  if (learner.last_active_date === today) return learner.streak || 0;
  const yesterday = todayKey(new Date(Date.now() - 86400000));
  const next = learner.last_active_date === yesterday ? (learner.streak || 0) + 1 : 1;
  run("UPDATE learners SET streak = ?, last_active_date = ? WHERE id = ?", next, today, learner.id);
  learner.streak = next;
  learner.last_active_date = today;
  return next;
}

function grantAchievement(learnerId, code) {
  const exists = one("SELECT 1 AS x FROM achievements WHERE learner_id = ? AND code = ?", learnerId, code);
  if (exists) return null;
  run("INSERT INTO achievements (learner_id, code, earned_at) VALUES (?, ?, ?)", learnerId, code, now());
  const def = ACHIEVEMENTS.find((a) => a.code === code);
  return def || null;
}

function checkAchievements(learner) {
  const earned = [];
  const lessonsDone = one("SELECT COUNT(*) AS c FROM lessons WHERE learner_id = ? AND status = 'completed'", learner.id)?.c || 0;
  if (lessonsDone >= 1) earned.push("first_lesson");
  const bySubject = (subject) =>
    one("SELECT COUNT(*) AS c FROM lessons WHERE learner_id = ? AND status = 'completed' AND subject = ?", learner.id, subject)?.c || 0;
  if (bySubject("math") >= 3) earned.push("math_explorer");
  if (bySubject("reading") >= 3) earned.push("reading_champion");
  if (bySubject("science") >= 3) earned.push("science_detective");
  if (bySubject("social") >= 3) earned.push("history_explorer");
  if (bySubject("bible") >= 3) earned.push("bible_scholar");
  const cards = one("SELECT COUNT(*) AS c FROM flashcards WHERE learner_id = ?", learner.id)?.c || 0;
  if (cards >= 10) earned.push("vocabulary_builder");
  const saved = one("SELECT COUNT(*) AS c FROM library WHERE learner_id = ?", learner.id)?.c || 0;
  if (saved >= 5) earned.push("bookworm");
  const bestAttempt = one("SELECT MAX(CASE WHEN total > 0 THEN CAST(score AS REAL) / total ELSE 0 END) AS p FROM attempts WHERE learner_id = ?", learner.id)?.p || 0;
  if (bestAttempt >= 0.8) earned.push("quiz_ace");
  if (bestAttempt >= 0.999) earned.push("perfect_score");
  if ((learner.streak || 0) >= 7) earned.push("streak_7");
  if ((learner.xp || 0) >= 100) earned.push("xp_100");
  if ((learner.xp || 0) >= 500) earned.push("xp_500");
  const asked = one("SELECT COUNT(*) AS c FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.learner_id = ? AND m.role = 'user'", learner.id)?.c || 0;
  if (asked >= 10) earned.push("curious_mind");

  const mastered = one("SELECT COUNT(*) AS c FROM topic_mastery WHERE learner_id = ? AND status = 'mastered'", learner.id)?.c || 0;
  if (mastered >= 1) earned.push("first_mastery");
  if (mastered >= 5) earned.push("five_mastered");
  const studiedSections = new Set(many("SELECT DISTINCT book_id FROM topic_mastery WHERE learner_id = ?", learner.id).map((r) => getBook(r.book_id)?.section).filter(Boolean));
  if (studiedSections.size >= 3) earned.push("library_explorer");
  const claimedQuests = one("SELECT COUNT(*) AS c FROM learner_quests WHERE learner_id = ? AND status = 'claimed'", learner.id)?.c || 0;
  if (claimedQuests >= 1) earned.push("quest_first");
  if (claimedQuests >= 10) earned.push("quest_ten");
  if (levelInfo(learner.xp).level >= 5) earned.push("lorekeeper");

  const newly = [];
  for (const code of earned) {
    const def = grantAchievement(learner.id, code);
    if (def) newly.push(def);
  }
  return newly;
}

function recordActivity(learner, kind, detail, xp = 0, subject = null, minutes = 0) {
  const fresh = one("SELECT * FROM learners WHERE id = ?", learner.id);
  touchStreak(fresh);
  if (xp) run("UPDATE learners SET xp = xp + ? WHERE id = ?", xp, learner.id);
  run("INSERT INTO activity (id, learner_id, kind, detail, xp, created_at) VALUES (?, ?, ?, ?, ?, ?)", uid(), learner.id, kind, detail || "", xp, now());
  if (subject && SUBJECT_MAP[subject]) {
    const existing = one("SELECT * FROM subject_progress WHERE learner_id = ? AND subject = ?", learner.id, subject);
    if (existing) {
      run(
        "UPDATE subject_progress SET mastery = ?, minutes = minutes + ?, lessons_done = lessons_done + ?, updated_at = ? WHERE learner_id = ? AND subject = ?",
        Math.min(100, existing.mastery + (kind === "lesson_completed" ? 6 : 2)),
        minutes,
        kind === "lesson_completed" ? 1 : 0,
        now(),
        learner.id,
        subject,
      );
    } else {
      run(
        "INSERT INTO subject_progress (learner_id, subject, mastery, minutes, lessons_done, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        learner.id,
        subject,
        kind === "lesson_completed" ? 8 : 3,
        minutes,
        kind === "lesson_completed" ? 1 : 0,
        now(),
      );
    }
  }
  const updated = one("SELECT * FROM learners WHERE id = ?", learner.id);
  const unlocked = checkAchievements(updated);
  return { xp: updated.xp, streak: updated.streak, unlocked };
}

function challengeFor(learner) {
  const seed = Number(todayKey().replace(/-/g, "")) + String(learner.id).charCodeAt(0);
  const allowed = parseJson(learner.allowed_subjects, []);
  const bank = DAILY_CHALLENGE_BANK.filter((c) => !allowed.length || allowed.includes(c.subject));
  const list = bank.length ? bank : DAILY_CHALLENGE_BANK;
  return list[Math.abs(seed) % list.length];
}

/* ------------------------------------------------------------------ */
/*  Uploads & documents                                                */
/* ------------------------------------------------------------------ */

function extractPdfText(buffer) {
  try {
    const raw = new TextDecoder("latin1").decode(buffer);
    const chunks = [];
    const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let m;
    while ((m = streamRe.exec(raw))) {
      const body = m[1];
      let decoded = null;
      try {
        const bytes = Uint8Array.from(body, (c) => c.charCodeAt(0) & 0xff);
        decoded = new TextDecoder("latin1").decode(Bun.inflateSync(bytes));
      } catch {
        try {
          const bytes = Uint8Array.from(body, (c) => c.charCodeAt(0) & 0xff);
          decoded = new TextDecoder("latin1").decode(Bun.inflateRawSync(bytes));
        } catch {
          decoded = body;
        }
      }
      if (decoded && /(BT|\bTj\b|\bTJ\b)/.test(decoded)) chunks.push(decoded);
    }
    const text = [];
    for (const chunk of chunks) {
      const textRe = /\((?:\\.|[^\\()])*\)/g;
      const pieces = chunk.match(textRe) || [];
      for (const piece of pieces) {
        const clean = piece
          .slice(1, -1)
          .replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: "\n", r: "", t: "", b: "", f: "", "(": "(", ")": ")", "\\": "\\" }[c] ?? c))
          .replace(/\\[0-7]{1,3}/g, " ");
        if (clean.trim()) text.push(clean);
      }
      if (text.length && !/\n/.test(text[text.length - 1])) text.push("\n");
    }
    return text.join(" ").replace(/\s+/g, " ").replace(/ ([.,;:!?])/g, "$1").trim();
  } catch {
    return "";
  }
}

function decodeUpload(name, mime, buffer) {
  const lower = name.toLowerCase();
  const textLike =
    mime?.startsWith("text/") ||
    /\.(txt|md|markdown|csv|json|html?|xml|rtf|tex)$/.test(lower);
  if (textLike) return new TextDecoder().decode(buffer).slice(0, 200000);
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return extractPdfText(buffer);
  if (/\.(docx?|pptx?|xlsx?)$/.test(lower)) {
    // zipped modern Office formats: pull readable runs out of word/document.xml or ppt slides
    try {
      const raw = new TextDecoder("latin1").decode(buffer);
      const match = raw.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || raw.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
      if (match) return match.map((t) => t.replace(/<[^>]+>/g, "")).join(" ").slice(0, 200000);
    } catch {}
    return "";
  }
  return "";
}

/* ------------------------------------------------------------------ */
/*  Route table                                                        */
/* ------------------------------------------------------------------ */

const routes = [];
function route(method, pattern, handler) {
  const parts = pattern.split("/").filter(Boolean);
  routes.push({ method, parts, handler });
}

function matchRoute(method, segments) {
  for (const r of routes) {
    if (r.method !== method) continue;
    if (r.parts.length !== segments.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < r.parts.length; i++) {
      const p = r.parts[i];
      if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(segments[i]);
      else if (p !== segments[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Public metadata                                                    */
/* ------------------------------------------------------------------ */

route("GET", "/api/meta", async () => {
  return send({
    app: { name: "Asterwood Academy", tagline: "A school that grows with you" },
    ai: aiStatus(),
    subjects: SUBJECTS,
    interests: INTERESTS,
    personalities: PERSONALITY_PRESETS.map((p) => ({ id: p.id, name: p.name, blurb: p.blurb, emoji: p.emoji })),
    tutors: TUTORS.map(({ palette, style, ...rest }) => rest),
    strictnessLevels: STRICTNESS_LEVELS,
    environments: ENVIRONMENTS,
    appearanceOptions: APPEARANCE_OPTIONS,
    voiceStyles: VOICE_STYLES,
    learningStyles: LEARNING_STYLES,
    lessonLengths: LESSON_LENGTHS,
    ageGroups: AGE_GROUPS,
    achievements: ACHIEVEMENTS,
    levels: LEVEL_LABELS,
    totalTopics: allTopics().length,
    library: {
      books: allBooks().length,
      topics: TOTAL_TOPICS,
      sections: SECTIONS,
      chambers: CHAMBERS,
      statuses: MASTERY_STATUSES,
      catalog: allBooks().map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        section: b.section,
        icon: b.icon,
        color: b.color,
        blurb: b.blurb,
        topicCount: b.topicCount,
        chapterCount: b.chapterCount,
      })),
    },
  });
});

route("GET", "/api/health", async () => send({ ok: true, ai: aiStatus().enabled, time: now() }));

route("GET", "/api/tutors", async () => {
  return send({
    tutors: TUTORS,
    presets: PERSONALITY_PRESETS,
    strictnessLevels: STRICTNESS_LEVELS,
    environments: ENVIRONMENTS,
    appearanceOptions: APPEARANCE_OPTIONS,
  });
});

route("POST", "/api/learners/:id/tutor", async ({ user, params, body }) => {
  const learner = requireLearner(user, params.id);
  const characterId = TUTOR_MAP[body.characterId] ? body.characterId : learner.tutor_character_id || "auren";
  const character = TUTOR_MAP[characterId];
  const presetId = normalizePreset(body.tutorPreset || body.preset || learner.tutor_preset, characterId);
  const strictness = normalizeStrictness(body.strictness || learner.strictness, presetId);
  const appearance = body.appearance
    ? sanitizeAppearance(body.appearance, characterId)
    : body.characterId && body.characterId !== learner.tutor_character_id
      ? defaultAppearance(characterId)
      : parseAppearance(learner.appearance, characterId);
  const name = String(body.tutorName || (body.characterId && body.characterId !== learner.tutor_character_id ? character.name : learner.tutor_name || character.name)).trim().slice(0, 30) || character.name;
  const environment = body.environment && (body.environment === "auto" || ENVIRONMENTS.some((e) => e.id === body.environment)) ? body.environment : learner.environment || "auto";
  const accent = String(body.voiceAccent || learner.voice_accent || "auto").slice(0, 30);
  const volume = Math.max(0, Math.min(1, Number(body.voiceVolume ?? learner.voice_volume ?? 1)));

  run(
    `UPDATE learners SET tutor_character_id = ?, tutor_preset = ?, tutor_personality = ?, strictness = ?, appearance = ?,
       tutor_name = ?, environment = ?, auto_environment = ?, voice_accent = ?, voice_volume = ?, voice_style = ? WHERE id = ?`,
    characterId,
    presetId,
    presetId,
    strictness,
    JSON.stringify(appearance),
    name,
    environment,
    body.autoEnvironment === undefined ? learner.auto_environment : body.autoEnvironment ? 1 : 0,
    accent,
    volume,
    body.voiceStyle || PRESET_MAP[presetId]?.voiceStyle || learner.voice_style || character.voice.style,
    learner.id,
  );
  if (body.tutorName || body.characterId) {
    addMemoryRow(learner.id, "preference", `Chose ${character.name} as their tutor (${PRESET_MAP[presetId]?.name}, ${STRICTNESS_MAP[strictness]?.name} pacing).`);
  }
  const updated = one("SELECT * FROM learners WHERE id = ?", learner.id);
  return send({ learner: shapeLearner(updated), character });
});

route("GET", "/api/learners/:id/appearances", async ({ user, params }) => {
  const learner = requireLearner(user, params.id);
  return send({
    appearances: many("SELECT id, name, character_id, appearance, created_at FROM tutor_appearances WHERE learner_id = ? ORDER BY created_at DESC", learner.id).map((row) => ({
      ...row,
      appearance: parseAppearance(row.appearance, row.character_id),
    })),
  });
});

route("POST", "/api/learners/:id/appearances", async ({ user, params, body }) => {
  const learner = requireLearner(user, params.id);
  const characterId = TUTOR_MAP[body.characterId] ? body.characterId : learner.tutor_character_id || "auren";
  const count = one("SELECT COUNT(*) AS c FROM tutor_appearances WHERE learner_id = ?", learner.id)?.c || 0;
  if (count >= 20) throw new HttpError(400, "You can keep up to 20 saved looks. Delete one to make room.");
  const id = uid();
  run(
    "INSERT INTO tutor_appearances (id, learner_id, name, character_id, appearance, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    learner.id,
    String(body.name || "My look").slice(0, 60),
    characterId,
    JSON.stringify(sanitizeAppearance(body.appearance, characterId)),
    now(),
  );
  return send({ appearance: { id, name: body.name || "My look", character_id: characterId, appearance: sanitizeAppearance(body.appearance, characterId) } }, 201);
});

route("POST", "/api/appearances/:id/apply", async ({ user, params }) => {
  const row = one("SELECT * FROM tutor_appearances WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Saved look not found");
  const learner = requireLearner(user, row.learner_id);
  run("UPDATE learners SET tutor_character_id = ?, appearance = ? WHERE id = ?", row.character_id, row.appearance, learner.id);
  return send({ learner: shapeLearner(one("SELECT * FROM learners WHERE id = ?", learner.id)) });
});

route("DELETE", "/api/appearances/:id", async ({ user, params }) => {
  const row = one("SELECT * FROM tutor_appearances WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Saved look not found");
  requireLearner(user, row.learner_id);
  run("DELETE FROM tutor_appearances WHERE id = ?", row.id);
  return send({ ok: true });
});

route("GET", "/api/assignments", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  return send({
    assignments: many("SELECT * FROM assignments WHERE learner_id = ? ORDER BY COALESCE(due_at, '9999') ASC", learner.id),
  });
});

/* ------------------------------------------------------------------ */
/*  Auth routes                                                        */
/* ------------------------------------------------------------------ */

const loginAttempts = new Map();
function rateLimit(key, limit = 12, windowMs = 60000) {
  const nowTs = Date.now();
  const entry = loginAttempts.get(key) || { count: 0, reset: nowTs + windowMs };
  if (nowTs > entry.reset) { entry.count = 0; entry.reset = nowTs + windowMs; }
  entry.count += 1;
  loginAttempts.set(key, entry);
  return entry.count <= limit;
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,23}$/;

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function usernameIsTaken(username) {
  return Boolean(one("SELECT 1 AS x FROM users WHERE username = ?", username));
}

/** Give older email-only clients a readable username without asking for one. */
function deriveUsername(email) {
  const raw = String(email || "").split("@")[0].toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9._-]/g, "").replace(/^[^a-z0-9]+/, "");
  const stem = (cleaned.length >= 3 ? cleaned : `${cleaned || "learner"}learner`).slice(0, 24);
  let candidate = stem;
  let suffix = 1;
  while (usernameIsTaken(candidate)) {
    const tail = String(suffix++);
    candidate = `${stem.slice(0, 24 - tail.length)}${tail}`;
  }
  return candidate;
}

route("POST", "/api/auth/signup", async ({ req, body }) => {
  const email = String(body.email || "").trim().toLowerCase() || null;
  const requestedUsername = normalizeUsername(body.username);
  const password = String(body.password || "");
  const role = ["student", "parent", "educator"].includes(body.role) ? body.role : "student";
  const name = String(body.name || "").trim().slice(0, 60);
  if (!email && !requestedUsername) throw new HttpError(400, "Choose a username or enter an email");
  if (email && !EMAIL_PATTERN.test(email)) throw new HttpError(400, "Please enter a valid email address");
  if (requestedUsername && !USERNAME_PATTERN.test(requestedUsername)) {
    throw new HttpError(400, "Usernames are 3–24 characters and use letters, numbers, dots, dashes or underscores");
  }
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (requestedUsername && usernameIsTaken(requestedUsername)) throw new HttpError(409, "That username is already taken");
  if (email && one("SELECT 1 AS x FROM users WHERE email = ?", email)) throw new HttpError(409, "An account with that email already exists");
  if (role !== "student" && !name) throw new HttpError(400, "Please tell us your name");

  const username = requestedUsername || deriveUsername(email);
  const userId = uid();
  try {
    run(
      "INSERT INTO users (id, email, username, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      userId, email, username, name || null, hashPassword(password), role, now(),
    );
  } catch (error) {
    if (String(error?.message || "").includes("UNIQUE")) throw new HttpError(409, "That username or email is already in use");
    throw error;
  }

  let learnerId = null;
  if (role === "student") {
    learnerId = uid();
    const age = Number(body.age) || null;
    const group = age ? ageGroupForAge(age) : null;
    run(
      `INSERT INTO learners (id, owner_user_id, name, age, age_group, tutor_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      learnerId,
      userId,
      name || username,
      age,
      group?.id || null,
      "Aster",
      now(),
    );
    run("UPDATE users SET active_learner_id = ? WHERE id = ?", learnerId, userId);
  }

  const token = createSession(userId);
  const user = one("SELECT id, email, username, name, role, active_learner_id FROM users WHERE id = ?", userId);
  return send(
    { user: publicUser(user), learners: learnersFor(user).map(shapeLearner), aiEnabled: aiStatus().enabled },
    201,
    { "Set-Cookie": sessionCookie(token) },
  );
});

route("POST", "/api/auth/login", async ({ req, body }) => {
  const identifier = String(body.identifier || body.email || body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!identifier) throw new HttpError(400, "Enter your username or email");
  if (!rateLimit(`login:${identifier}`, 10, 60000)) throw new HttpError(429, "Too many attempts. Please wait a minute and try again.");
  const user = one("SELECT * FROM users WHERE email = ? OR username = ?", identifier, identifier);
  if (!user || !verifyPassword(password, user.password_hash)) throw new HttpError(401, "Username/email or password is incorrect");
  const token = createSession(user.id);
  return send(
    { user: publicUser(user), learners: learnersFor(user).map(shapeLearner) },
    200,
    { "Set-Cookie": sessionCookie(token) },
  );
});

route("POST", "/api/auth/logout", async ({ req }) => {
  const cookies = parseCookies(req.headers.get("cookie"));
  if (cookies[SESSION_COOKIE]) run("DELETE FROM sessions WHERE token = ?", cookies[SESSION_COOKIE]);
  return send({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
});

route("GET", "/api/auth/me", async ({ user }) => {
  if (!user) return send({ user: null, learners: [] });
  return send({ user: publicUser(user), learners: learnersFor(user).map(shapeLearner) });
});

route("POST", "/api/auth/active", async ({ user, body }) => {
  if (!user) throw new HttpError(401, "Please sign in");
  const learner = requireLearner(user, body.learnerId);
  run("UPDATE users SET active_learner_id = ? WHERE id = ?", learner.id, user.id);
  return send({ learner: shapeLearner(learner) });
});

route("PATCH", "/api/auth/password", async ({ user, body }) => {
  if (!user) throw new HttpError(401, "Please sign in");
  const full = one("SELECT * FROM users WHERE id = ?", user.id);
  if (!verifyPassword(String(body.currentPassword || ""), full.password_hash)) throw new HttpError(400, "Current password is incorrect");
  if (String(body.newPassword || "").length < 8) throw new HttpError(400, "New password must be at least 8 characters");
  run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(body.newPassword), user.id);
  run("DELETE FROM sessions WHERE user_id = ?", user.id);
  return send({ ok: true, message: "Password updated. Please sign in again." });
});

/* ------------------------------------------------------------------ */
/*  Learners                                                           */
/* ------------------------------------------------------------------ */

const LEARNER_FIELD_MAP = {
  name: "name",
  age: "age",
  birthdate: "birthdate",
  grade: "grade",
  language: "language",
  country: "country",
  curriculum: "curriculum",
  learnerType: "learner_type",
  tutorName: "tutor_name",
  tutorPersonality: "tutor_personality",
  tutorPreset: "tutor_preset",
  strictness: "strictness",
  environment: "environment",
  voiceAccent: "voice_accent",
  voiceVolume: "voice_volume",
  autoEnvironment: "auto_environment",
  tutorCharacterId: "tutor_character_id",
  voiceStyle: "voice_style",
  speakingRate: "speaking_rate",
  theme: "theme",
  dailyGoal: "daily_goal",
  gamification: "gamification",
  memoryEnabled: "memory_enabled",
  examplesFirst: "examples_first",
  hintsFirst: "hints_first",
  extraTime: "extra_time",
  lessonLength: "lesson_length",
  activityPref: "activity_pref",
  notes: "notes",
  voiceEnabled: "voice_enabled",
  uploadsEnabled: "uploads_enabled",
  onboarded: "onboarded",
  guardianConsent: "guardian_consent",
};

const JSON_FIELDS = { interests: "interests", loves: "loves", struggles: "struggles", styles: "styles", allowedSubjects: "allowed_subjects" };

function applyLearnerFields(learnerId, body) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(LEARNER_FIELD_MAP)) {
    if (body[key] === undefined) continue;
    let value = body[key];
    if (typeof value === "boolean") value = value ? 1 : 0;
    sets.push(`${column} = ?`);
    values.push(value);
  }
  for (const [key, column] of Object.entries(JSON_FIELDS)) {
    if (body[key] === undefined) continue;
    sets.push(`${column} = ?`);
    values.push(JSON.stringify(Array.isArray(body[key]) ? body[key] : []));
  }
  if (body.age !== undefined) {
    const age = Number(body.age) || null;
    sets.push("age_group = ?");
    values.push(age ? ageGroupForAge(age).id : null);
  }
  if (body.appearance && typeof body.appearance === "object") {
    const current = one("SELECT tutor_character_id FROM learners WHERE id = ?", learnerId);
    const characterId = TUTOR_MAP[body.tutorCharacterId] ? body.tutorCharacterId : current?.tutor_character_id || "auren";
    sets.push("appearance = ?");
    values.push(JSON.stringify(sanitizeAppearance(body.appearance, characterId)));
  }
  if (body.tutorPreset && PRESET_MAP[body.tutorPreset]) {
    sets.push("tutor_personality = ?");
    values.push(body.tutorPreset);
  }
  if (!sets.length) return;
  values.push(learnerId);
  run(`UPDATE learners SET ${sets.join(", ")} WHERE id = ?`, ...values);
}

route("GET", "/api/learners", async ({ user }) => {
  if (!user) throw new HttpError(401, "Please sign in");
  return send({ learners: learnersFor(user).map(shapeLearner) });
});

route("POST", "/api/learners", async ({ user, body }) => {
  if (!user) throw new HttpError(401, "Please sign in");
  if (user.role === "student") throw new HttpError(403, "Only parent and educator accounts can add learner profiles");
  const name = String(body.name || "").trim().slice(0, 60);
  if (!name) throw new HttpError(400, "Please enter the learner's name");
  const id = uid();
  const age = Number(body.age) || null;
  run("INSERT INTO learners (id, owner_user_id, name, created_at) VALUES (?, ?, ?, ?)", id, user.id, name, now());
  applyLearnerFields(id, { ...body, onboarded: body.onboarded ? 1 : 0 });
  if (age) run("UPDATE learners SET age = ?, age_group = ? WHERE id = ?", age, ageGroupForAge(age).id, id);
  const learner = one("SELECT * FROM learners WHERE id = ?", id);
  if (!one("SELECT active_learner_id FROM users WHERE id = ? AND active_learner_id IS NOT NULL", user.id)) {
    run("UPDATE users SET active_learner_id = ? WHERE id = ?", id, user.id);
  }
  return send({ learner: shapeLearner(learner) }, 201);
});

route("GET", "/api/learners/:id/profile", async ({ user, params }) => {
  const learner = requireLearner(user, params.id);
  const memory = parseJson("[]", []);
  const memoryRows = many("SELECT id, kind, content, created_at FROM memory WHERE learner_id = ? ORDER BY created_at DESC", learner.id);
  const progress = many("SELECT * FROM subject_progress WHERE learner_id = ? ORDER BY mastery DESC", learner.id);
  const achievements = many("SELECT code, earned_at FROM achievements WHERE learner_id = ? ORDER BY earned_at DESC", learner.id);
  const activity = many("SELECT kind, detail, xp, created_at FROM activity WHERE learner_id = ? ORDER BY created_at DESC LIMIT 12", learner.id);
  const counts = {
    lessons: one("SELECT COUNT(*) AS c FROM lessons WHERE learner_id = ?", learner.id)?.c || 0,
    lessonsCompleted: one("SELECT COUNT(*) AS c FROM lessons WHERE learner_id = ? AND status = 'completed'", learner.id)?.c || 0,
    quizzes: one("SELECT COUNT(*) AS c FROM attempts WHERE learner_id = ?", learner.id)?.c || 0,
    flashcards: one("SELECT COUNT(*) AS c FROM flashcards WHERE learner_id = ?", learner.id)?.c || 0,
    library: one("SELECT COUNT(*) AS c FROM library WHERE learner_id = ?", learner.id)?.c || 0,
    minutes: one("SELECT COALESCE(SUM(minutes),0) AS c FROM subject_progress WHERE learner_id = ?", learner.id)?.c || 0,
  };
  return send({
    learner: shapeLearner(learner),
    memory: memoryRows,
    progress,
    achievements: achievements.map((a) => ({ ...a, ...(ACHIEVEMENTS.find((x) => x.code === a.code) || {}) })),
    activity,
    counts,
    profileText: learnerProfileText(learner),
    allowedSubjects: parseJson(learner.allowed_subjects, []),
  });
});

route("PATCH", "/api/learners/:id", async ({ user, params, body }) => {
  const learner = requireLearner(user, params.id);
  applyLearnerFields(learner.id, body);
  const updated = one("SELECT * FROM learners WHERE id = ?", learner.id);
  return send({ learner: shapeLearner(updated) });
});

route("POST", "/api/learners/:id/onboarding", async ({ user, params, body }) => {
  const learner = requireLearner(user, params.id);
  const payload = { ...body, onboarded: 1 };
  if (body.age !== undefined && body.age !== null && body.age !== "") {
    const age = Number(body.age);
    if (!Number.isFinite(age) || age < 3 || age > 120) throw new HttpError(400, "Please enter an age between 3 and 120");
    payload.age = age;
    payload.guardianConsent = age < 13 ? 1 : body.guardianConsent;
  }
  applyLearnerFields(learner.id, payload);
  if (!body.tutorName) applyLearnerFields(learner.id, { tutorName: learner.tutor_name || TUTOR_MAP[body.tutorCharacterId]?.name || "Aster" });
  if (body.tutorCharacterId || body.tutorPreset || body.tutorPersonality) {
    const characterId = TUTOR_MAP[body.tutorCharacterId] ? body.tutorCharacterId : learner.tutor_character_id || "auren";
    const presetId = normalizePreset(body.tutorPreset || body.tutorPersonality, characterId);
    run(
      "UPDATE learners SET tutor_character_id = ?, tutor_preset = ?, tutor_personality = ?, strictness = ?, appearance = COALESCE(?, appearance), voice_style = ? WHERE id = ?",
      characterId,
      presetId,
      presetId,
      normalizeStrictness(body.strictness, presetId),
      body.appearance && typeof body.appearance === "object" ? JSON.stringify(sanitizeAppearance(body.appearance, characterId)) : null,
      body.voiceStyle || PRESET_MAP[presetId]?.voiceStyle || "friendly",
      learner.id,
    );
  }

  // Seed the tutor's memory from onboarding answers so lessons feel personal right away.
  const fresh = one("SELECT * FROM learners WHERE id = ?", learner.id);
  if (fresh.memory_enabled) {
    if (fresh.age) addMemoryRow(fresh.id, "fact", `Age ${fresh.age} (${ageGroupForAge(fresh.age).label}).`);
    for (const i of parseJson(fresh.interests, [])) addMemoryRow(fresh.id, "interest", `Loves ${i}`);
    for (const s of parseJson(fresh.struggles, [])) addMemoryRow(fresh.id, "struggle", `Finds ${s} difficult`);
    for (const l of parseJson(fresh.styles, [])) addMemoryRow(fresh.id, "preference", `Learns best ${l}`);
    if (fresh.lesson_length) addMemoryRow(fresh.id, "preference", `Prefers ${fresh.lesson_length} lessons`);
    if (fresh.activity_pref) addMemoryRow(fresh.id, "preference", `Enjoys ${fresh.activity_pref}`);
  }
  recordActivity(fresh, "onboarding", "Set up their learning profile", 10);
  return send({ learner: shapeLearner(one("SELECT * FROM learners WHERE id = ?", fresh.id)) });
});

route("DELETE", "/api/learners/:id", async ({ user, params }) => {
  const learner = requireLearner(user, params.id);
  if (learnersFor(user).length <= 1) throw new HttpError(400, "You need at least one learner profile on this account");
  run("DELETE FROM learners WHERE id = ?", learner.id);
  if (user.active_learner_id === learner.id) {
    const nextLearner = learnersFor(user)[0];
    run("UPDATE users SET active_learner_id = ? WHERE id = ?", nextLearner?.id || null, user.id);
  }
  return send({ ok: true });
});

/* ------------------------------------------------------------------ */
/*  Memory                                                             */
/* ------------------------------------------------------------------ */

function addMemoryRow(learnerId, kind, content) {
  if (!content) return;
  const exists = one("SELECT 1 AS x FROM memory WHERE learner_id = ? AND content = ?", learnerId, content);
  if (exists) return;
  run("INSERT INTO memory (id, learner_id, kind, content, created_at) VALUES (?, ?, ?, ?, ?)", uid(), learnerId, kind, String(content).slice(0, 300), now());
}

route("GET", "/api/learners/:id/memory", async ({ user, params }) => {
  const learner = requireLearner(user, params.id);
  return send({ memory: many("SELECT id, kind, content, created_at FROM memory WHERE learner_id = ? ORDER BY created_at DESC", learner.id) });
});

route("POST", "/api/learners/:id/memory", async ({ user, params, body }) => {
  const learner = requireLearner(user, params.id);
  const content = String(body.content || "").trim();
  if (!content) throw new HttpError(400, "Please write what you'd like the tutor to remember");
  addMemoryRow(learner.id, ["fact", "preference", "interest", "goal", "struggle"].includes(body.kind) ? body.kind : "fact", content);
  return send({ memory: many("SELECT id, kind, content, created_at FROM memory WHERE learner_id = ? ORDER BY created_at DESC", learner.id) });
});

route("PATCH", "/api/memory/:id", async ({ user, params, body }) => {
  const row = one("SELECT * FROM memory WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "That memory was not found");
  requireLearner(user, row.learner_id);
  const content = String(body.content || "").trim();
  if (!content) throw new HttpError(400, "Memory can't be empty — delete it instead if it's wrong.");
  run("UPDATE memory SET content = ? WHERE id = ?", content.slice(0, 300), row.id);
  return send({ memory: many("SELECT id, kind, content, created_at FROM memory WHERE learner_id = ? ORDER BY created_at DESC", row.learner_id) });
});

route("DELETE", "/api/memory/:id", async ({ user, params }) => {
  const row = one("SELECT * FROM memory WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "That memory was not found");
  requireLearner(user, row.learner_id);
  run("DELETE FROM memory WHERE id = ?", row.id);
  return send({ ok: true });
});

route("POST", "/api/learners/:id/reset-memory", async ({ user, params }) => {
  const learner = requireLearner(user, params.id);
  run("DELETE FROM memory WHERE learner_id = ?", learner.id);
  return send({ ok: true });
});

route("POST", "/api/learners/:id/reset-history", async ({ user, params }) => {
  const learner = requireLearner(user, params.id);
  for (const table of ["lessons", "quizzes", "attempts", "flashcards", "library", "activity", "subject_progress", "achievements", "memory", "conversations"]) {
    const column = table === "conversations" ? "learner_id" : "learner_id";
    run(`DELETE FROM ${table} WHERE ${column} = ?`, learner.id);
  }
  run("DELETE FROM assignments WHERE learner_id = ?", learner.id);
  run("UPDATE learners SET xp = 0, streak = 0, last_active_date = NULL WHERE id = ?", learner.id);
  return send({ ok: true });
});

/* ------------------------------------------------------------------ */
/*  Tutor chat                                                         */
/* ------------------------------------------------------------------ */

route("GET", "/api/tutor/conversations", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  const rows = many(
    `SELECT c.id, c.title, c.subject, c.updated_at,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messages
     FROM conversations c WHERE c.learner_id = ? ORDER BY c.updated_at DESC LIMIT 50`,
    learner.id,
  );
  return send({ conversations: rows });
});

route("POST", "/api/tutor/conversations", async ({ user, learnerId, body }) => {
  const learner = requireLearner(user, learnerId);
  const id = uid();
  run(
    "INSERT INTO conversations (id, learner_id, title, subject, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    learner.id,
    String(body.title || "New conversation").slice(0, 80),
    body.subject || null,
    now(),
    now(),
  );
  return send({ conversation: { id, title: body.title || "New conversation", subject: body.subject || null } }, 201);
});

route("GET", "/api/tutor/conversations/:id", async ({ user, params }) => {
  const conv = one("SELECT * FROM conversations WHERE id = ?", params.id);
  if (!conv) throw new HttpError(404, "Conversation not found");
  requireLearner(user, conv.learner_id);
  const messages = many("SELECT id, role, content, meta, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC", conv.id);
  return send({ conversation: conv, messages: messages.map((m) => ({ ...m, meta: parseJson(m.meta, null) })) });
});

route("DELETE", "/api/tutor/conversations/:id", async ({ user, params }) => {
  const conv = one("SELECT * FROM conversations WHERE id = ?", params.id);
  if (!conv) throw new HttpError(404, "Conversation not found");
  requireLearner(user, conv.learner_id);
  run("DELETE FROM conversations WHERE id = ?", conv.id);
  return send({ ok: true });
});

const BLOCKED_PATTERNS = [
  /sexual(ly)? (explicit|content|roleplay).*child/i,
  /how to (make|build) (a )?(bomb|explosive|poison|weapon)/i,
  /kill (my|your)self|self[- ]harm instructions/i,
];

route("POST", "/api/tutor/chat", async ({ user, body, learnerId }) => {
  const learner = requireLearner(user, body.learnerId || learnerId);
  const message = String(body.message || "").trim();
  if (!message) throw new HttpError(400, "Please type a message");
  if (message.length > 4000) throw new HttpError(400, "That message is too long — try breaking it into smaller questions");

  if (BLOCKED_PATTERNS.some((re) => re.test(message))) {
    return send({
      blocked: true,
      reply: "I can't help with that. If something is troubling you, please talk to a parent, guardian, teacher or another trusted adult — they can help in ways I can't. I'm here for learning whenever you're ready.",
      conversationId: body.conversationId || null,
    });
  }

  let conversationId = body.conversationId;
  let conversation = conversationId ? one("SELECT * FROM conversations WHERE id = ?", conversationId) : null;
  if (conversation) requireLearner(user, conversation.learner_id);
  if (!conversation) {
    conversationId = uid();
    const title = message.slice(0, 60);
    run(
      "INSERT INTO conversations (id, learner_id, title, subject, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      conversationId,
      learner.id,
      title,
      body.subject || null,
      now(),
      now(),
    );
    conversation = one("SELECT * FROM conversations WHERE id = ?", conversationId);
  }

  const history = many("SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC", conversation.id).slice(-14);
  run("INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)", uid(), conversation.id, message, now());

  const freshLearner = one("SELECT * FROM learners WHERE id = ?", learner.id);
  const result = await tutorReply({
    learner: freshLearner.memory_enabled ? freshLearner : { ...freshLearner, memory_enabled: 0 },
    history,
    message,
    subject: body.subject || conversation.subject,
  });

  run(
    "INSERT INTO messages (id, conversation_id, role, content, meta, created_at) VALUES (?, ?, 'assistant', ?, ?, ?)",
    uid(),
    conversation.id,
    result.text,
    JSON.stringify({ source: result.source, notice: result.notice || null }),
    now(),
  );
  run("UPDATE conversations SET updated_at = ?, subject = COALESCE(?, subject) WHERE id = ?", now(), body.subject || null, conversation.id);
  if (conversation.title === "New conversation" || history.length === 0) {
    run("UPDATE conversations SET title = ? WHERE id = ?", message.slice(0, 60), conversation.id);
  }

  if (freshLearner.memory_enabled) {
    for (const mem of extractMemories(message)) addMemoryRow(learner.id, mem.kind, mem.content);
  }
  const rewards = recordActivity(freshLearner, "chat", "Asked a question", XP.chat);

  return send({
    conversationId: conversation.id,
    reply: result.text,
    source: result.source,
    notice: result.notice || null,
    rewards,
  });
});

/* ------------------------------------------------------------------ */
/*  Lessons                                                            */
/* ------------------------------------------------------------------ */

function shapeLesson(row) {
  return {
    id: row.id,
    subject: row.subject,
    subjectName: SUBJECT_MAP[row.subject]?.name || row.subject,
    topic: row.topic,
    title: row.title,
    level: row.level,
    duration: row.duration,
    bookId: row.book_id || null,
    topicId: row.topic_id || null,
    objectives: parseJson(row.objectives, []),
    sections: parseJson(row.sections, []),
    nextLesson: row.next_lesson,
    status: row.status,
    progress: row.progress,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

route("POST", "/api/lessons/generate", async ({ user, body }) => {
  const learner = requireLearner(user, body.learnerId);
  const allowed = parseJson(learner.allowed_subjects, []);
  if (allowed.length && !allowed.includes(body.subject)) throw new HttpError(403, "This subject is not enabled for this profile. A parent or educator can change that in the dashboard.");
  const durationByPref = { quick: 10, standard: 20, extended: 40 };
  const duration = Number(body.duration) || durationByPref[learner.lesson_length] || 20;
  const libraryRef = body.topicId ? findTopic(String(body.topicId)) : null;
  if (body.topicId && !libraryRef) throw new HttpError(400, "That Library topic could not be found");
  if (body.bookId && !getBook(String(body.bookId))) throw new HttpError(400, "That Library book could not be found");
  const subject = libraryRef ? libraryRef.book.subject : SUBJECT_MAP[body.subject] ? body.subject : findSubjectByTopic(body.topic)?.subject.id || "math";
  const topic = String(body.topic || libraryRef?.topic.name || "").slice(0, 120);
  const generated = await generateLesson({
    learner,
    subject,
    topic,
    level: body.level || levelForAge(learner.age),
    duration,
    extraNote: body.extraNote,
  });
  const id = uid();
  run(
    `INSERT INTO lessons (id, learner_id, subject, topic, title, level, duration, objectives, sections, next_lesson, status, progress, source, book_id, topic_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', 0, ?, ?, ?, ?, ?)`,
    id,
    learner.id,
    subject,
    generated.topic,
    generated.title,
    generated.level,
    generated.duration,
    JSON.stringify(generated.objectives),
    JSON.stringify(generated.sections),
    generated.nextLesson || null,
    generated.source,
    libraryRef?.book.id || body.bookId || null,
    libraryRef?.topic.id || body.topicId || null,
    now(),
    now(),
  );
  if (libraryRef) creditTopicStart(learner.id, libraryRef.book.id, libraryRef.topic.id);
  const lesson = one("SELECT * FROM lessons WHERE id = ?", id);
  return send({ lesson: shapeLesson(lesson) }, 201);
});

route("GET", "/api/lessons", async ({ user, learnerId, query }) => {
  const learner = requireLearner(user, learnerId);
  const rows = many(
    "SELECT * FROM lessons WHERE learner_id = ? ORDER BY updated_at DESC LIMIT 100",
    learner.id,
  );
  return send({ lessons: rows.map(shapeLesson).filter((l) => !query.status || l.status === query.status) });
});

route("GET", "/api/lessons/:id", async ({ user, params }) => {
  const row = one("SELECT * FROM lessons WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Lesson not found");
  requireLearner(user, row.learner_id);
  return send({ lesson: shapeLesson(row) });
});

route("PATCH", "/api/lessons/:id", async ({ user, params, body }) => {
  const row = one("SELECT * FROM lessons WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Lesson not found");
  const learner = requireLearner(user, row.learner_id);
  const progress = body.progress !== undefined ? Math.max(0, Math.min(100, Number(body.progress) || 0)) : row.progress;
  const status = body.status || row.status;
  const completing = status === "completed" && row.status !== "completed";
  run("UPDATE lessons SET progress = ?, status = ?, updated_at = ? WHERE id = ?", progress, status, now(), row.id);
  let rewards = null;
  let mastery = null;
  if (completing) {
    mastery = creditLessonCompletion(learner.id, row);
    rewards = recordActivity(learner, "lesson_completed", `Completed "${row.title}"`, XP.lesson_complete, row.subject, row.duration);
    addMemoryRow(learner.id, "progress", `Completed a ${SUBJECT_MAP[row.subject]?.name || row.subject} lesson on ${row.topic || row.title}.`);
    if (row.next_lesson) addMemoryRow(learner.id, "goal", `Next step: ${row.next_lesson}`);
    run("UPDATE assignments SET status = 'completed' WHERE kind = 'lesson' AND ref_id = ?", row.id);
  }
  return send({ lesson: shapeLesson(one("SELECT * FROM lessons WHERE id = ?", row.id)), rewards, mastery });
});

route("DELETE", "/api/lessons/:id", async ({ user, params }) => {
  const row = one("SELECT * FROM lessons WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Lesson not found");
  requireLearner(user, row.learner_id);
  run("DELETE FROM lessons WHERE id = ?", row.id);
  return send({ ok: true });
});

route("POST", "/api/lessons/:id/save", async ({ user, params }) => {
  const row = one("SELECT * FROM lessons WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Lesson not found");
  const learner = requireLearner(user, row.learner_id);
  const existing = one("SELECT id FROM library WHERE learner_id = ? AND kind = 'lesson' AND ref_id = ?", learner.id, row.id);
  if (!existing) {
    run(
      "INSERT INTO library (id, learner_id, kind, title, body, subject, ref_id, created_at) VALUES (?, ?, 'lesson', ?, ?, ?, ?, ?)",
      uid(), learner.id, row.title,
      `**Objectives**\n${parseJson(row.objectives, []).map((o) => `- ${o}`).join("\n")}\n\n**Lesson summary**\n${parseJson(row.sections, []).filter((s) => s.type === "summary").map((s) => s.body).join("\n\n") || "See the full lesson in My Lessons."}`,
      row.subject, row.id, now(),
    );
    recordActivity(learner, "library", `Saved "${row.title}" to library`, XP.library, row.subject);
  }
  return send({ ok: true });
});

route("GET", "/api/lessons-recommended", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  const interests = parseJson(learner.interests, []);
  const recentSubjects = many("SELECT DISTINCT subject FROM subject_progress WHERE learner_id = ? ORDER BY updated_at DESC LIMIT 3", learner.id).map((r) => r.subject);
  const level = levelForAge(learner.age);
  const pool = allTopics().filter((t) => ["early", "foundation", "elementary", "middle", "high", "college"].indexOf(t.level) <= ["early", "foundation", "elementary", "middle", "high", "college"].indexOf(level));
  const recommended = [];
  for (const subjectId of recentSubjects.length ? recentSubjects : ["math", "reading", "science"]) {
    const candidates = pool.filter((t) => t.subjectId === subjectId);
    const pick = candidates[(learner.xp || 0 + subjectId.length) % Math.max(1, candidates.length)];
    if (pick) recommended.push({ subject: subjectId, subjectName: SUBJECT_MAP[subjectId]?.name, topic: pick.topic, level: pick.level, reason: recentSubjects.includes(subjectId) ? "Keep your momentum going" : "A good place to start" });
  }
  return send({ recommended, interests });
});

/* ------------------------------------------------------------------ */
/*  Quizzes                                                            */
/* ------------------------------------------------------------------ */

function shapeQuiz(row) {
  return {
    id: row.id,
    subject: row.subject,
    subjectName: SUBJECT_MAP[row.subject]?.name || row.subject,
    topic: row.topic,
    title: row.title,
    level: row.level,
    bookId: row.book_id || null,
    topicId: row.topic_id || null,
    questions: parseJson(row.questions, []),
    createdAt: row.created_at,
  };
}

route("POST", "/api/quizzes/generate", async ({ user, body }) => {
  const learner = requireLearner(user, body.learnerId);
  const allowed = parseJson(learner.allowed_subjects, []);
  if (allowed.length && !allowed.includes(body.subject)) throw new HttpError(403, "This subject is not enabled for this profile");
  const libraryRef = body.topicId ? findTopic(String(body.topicId)) : null;
  if (body.topicId && !libraryRef) throw new HttpError(400, "That Library topic could not be found");
  const subject = libraryRef ? libraryRef.book.subject : SUBJECT_MAP[body.subject] ? body.subject : findSubjectByTopic(body.topic)?.subject.id || "math";
  const generated = await generateQuiz({
    learner,
    subject,
    topic: body.topic,
    level: body.level || levelForAge(learner.age),
    count: body.count,
    types: body.types,
    extraNote: body.extraNote,
  });
  const id = uid();
  run(
    "INSERT INTO quizzes (id, learner_id, subject, topic, title, level, questions, created_by, book_id, topic_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id, learner.id, subject, generated.topic, generated.title, generated.level,
    JSON.stringify(generated.questions), user.id, libraryRef?.book.id || body.bookId || null,
    libraryRef?.topic.id || body.topicId || null, now(),
  );
  if (body.assignmentTitle) {
    run(
      "INSERT INTO assignments (id, learner_id, by_user_id, kind, ref_id, title, due_at, status, created_at) VALUES (?, ?, ?, 'quiz', ?, ?, ?, 'assigned', ?)",
      uid(), learner.id, user.id, id, `${body.assignmentTitle}`, body.dueAt || null, now(),
    );
  }
  return send({ quiz: shapeQuiz(one("SELECT * FROM quizzes WHERE id = ?", id)) }, 201);
});

route("GET", "/api/quizzes", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  const rows = many("SELECT * FROM quizzes WHERE learner_id = ? ORDER BY created_at DESC LIMIT 100", learner.id);
  const attempts = many("SELECT quiz_id, score, total, created_at FROM attempts WHERE learner_id = ? ORDER BY created_at DESC", learner.id);
  return send({
    quizzes: rows.map((r) => ({
      ...shapeQuiz(r),
      questionCount: parseJson(r.questions, []).length,
      best: attempts.filter((a) => a.quiz_id === r.id).sort((a, b) => b.score / Math.max(1, b.total) - a.score / Math.max(1, a.total))[0] || null,
      attempts: attempts.filter((a) => a.quiz_id === r.id).length,
    })),
  });
});

route("GET", "/api/quizzes/:id", async ({ user, params }) => {
  const row = one("SELECT * FROM quizzes WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Quiz not found");
  requireLearner(user, row.learner_id);
  const quiz = shapeQuiz(row);
  quiz.questions = quiz.questions.map((q) => ({ ...q, answer: undefined, keywords: undefined }));
  return send({ quiz });
});

route("POST", "/api/quizzes/:id/check", async ({ user, params, body }) => {
  const row = one("SELECT * FROM quizzes WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Quiz not found");
  requireLearner(user, row.learner_id);
  const questions = parseJson(row.questions, []);
  const question = questions.find((q) => q.id === body.questionId);
  if (!question) throw new HttpError(404, "Question not found");
  const open = ["short_answer", "written_response"].includes(question.type);
  if (open) return send({ open: true, explanation: "Your answer is saved — your tutor will review the full response when you submit." });
  const correct = gradeLocally(question, body.answer, row.topic);
  return send({
    correct,
    explanation: question.explanation,
    hint: correct ? null : question.hint,
    answer: correct ? null : question.answer,
  });
});

route("POST", "/api/quizzes/:id/attempt", async ({ user, params, body }) => {
  const row = one("SELECT * FROM quizzes WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Quiz not found");
  const learner = requireLearner(user, row.learner_id);
  const quiz = { ...shapeQuiz(row) };
  quiz.questions = parseJson(row.questions, []);
  const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
  const graded = await gradeAttempt({ learner, quiz, answers });
  const attemptId = uid();
  run(
    "INSERT INTO attempts (id, quiz_id, learner_id, answers, score, total, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    attemptId, quiz.id, learner.id, JSON.stringify(answers), graded.score, graded.total, graded.summary, now(),
  );
  // Only a written explanation that was actually graded correct counts as application evidence.
  const written = graded.application;
  const mastery = creditQuizAttempt(learner.id, row, graded.pct, Boolean(written));
  const xp = XP.quiz_attempt + (graded.pct === 100 ? XP.quiz_perfect : 0);
  const rewards = recordActivity(learner, "quiz", `Scored ${graded.score}/${graded.total} on ${quiz.title}`, xp, quiz.subject);
  if (graded.pct < 60) addMemoryRow(learner.id, "struggle", `Needs practice: ${quiz.topic || quiz.title} (scored ${graded.pct}%)`);
  else addMemoryRow(learner.id, "strength", `Did well on ${quiz.topic || quiz.title} (${graded.pct}%)`);
  run("UPDATE assignments SET status = 'completed' WHERE kind = 'quiz' AND ref_id = ?", quiz.id);
  return send({ attemptId, score: graded.score, total: graded.total, pct: graded.pct, results: graded.results, summary: graded.summary, written, rewards, mastery });
});

route("POST", "/api/quizzes/:id/flashcards", async ({ user, params }) => {
  const row = one("SELECT * FROM quizzes WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Quiz not found");
  const learner = requireLearner(user, row.learner_id);
  const questions = parseJson(row.questions, []);
  let added = 0;
  for (const q of questions) {
    if (!q.prompt || !q.answer) continue;
    run("INSERT INTO flashcards (id, learner_id, front, back, subject, created_at) VALUES (?, ?, ?, ?, ?, ?)", uid(), learner.id, q.prompt, q.answer, row.subject, now());
    added += 1;
  }
  if (added) recordActivity(learner, "flashcards", `Made ${added} flashcards from ${row.title}`, added * XP.flashcard, row.subject);
  return send({ added });
});

/* ------------------------------------------------------------------ */
/*  Flashcards                                                         */
/* ------------------------------------------------------------------ */

route("GET", "/api/flashcards", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  return send({ flashcards: many("SELECT * FROM flashcards WHERE learner_id = ? ORDER BY created_at DESC", learner.id) });
});

route("POST", "/api/flashcards", async ({ user, body }) => {
  const learner = requireLearner(user, body.learnerId);
  const front = String(body.front || "").trim();
  const back = String(body.back || "").trim();
  if (!front || !back) throw new HttpError(400, "A flashcard needs both a front and a back");
  const id = uid();
  run("INSERT INTO flashcards (id, learner_id, front, back, subject, created_at) VALUES (?, ?, ?, ?, ?, ?)", id, learner.id, front.slice(0, 500), back.slice(0, 2000), body.subject || null, now());
  recordActivity(learner, "flashcards", "Added a flashcard", XP.flashcard, body.subject || null);
  return send({ flashcard: one("SELECT * FROM flashcards WHERE id = ?", id) }, 201);
});

route("PATCH", "/api/flashcards/:id", async ({ user, params, body }) => {
  const card = one("SELECT * FROM flashcards WHERE id = ?", params.id);
  if (!card) throw new HttpError(404, "Flashcard not found");
  requireLearner(user, card.learner_id);
  run("UPDATE flashcards SET box = ? WHERE id = ?", Math.max(0, Number(body.box) || 0), card.id);
  return send({ ok: true });
});

route("DELETE", "/api/flashcards/:id", async ({ user, params }) => {
  const card = one("SELECT * FROM flashcards WHERE id = ?", params.id);
  if (!card) throw new HttpError(404, "Flashcard not found");
  requireLearner(user, card.learner_id);
  run("DELETE FROM flashcards WHERE id = ?", card.id);
  return send({ ok: true });
});

/* ------------------------------------------------------------------ */
/*  Library                                                            */
/* ------------------------------------------------------------------ */

route("GET", "/api/library", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  const items = many("SELECT id, kind, title, body, subject, ref_id, created_at FROM library WHERE learner_id = ? ORDER BY created_at DESC", learner.id);
  const uploads = many("SELECT id, name, mime, size, summary, created_at FROM uploads WHERE learner_id = ? ORDER BY created_at DESC", learner.id);
  return send({ items, uploads });
});

route("POST", "/api/library", async ({ user, body }) => {
  const learner = requireLearner(user, body.learnerId);
  const title = String(body.title || "").trim();
  if (!title) throw new HttpError(400, "Please give this item a title");
  const id = uid();
  run(
    "INSERT INTO library (id, learner_id, kind, title, body, subject, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id, learner.id, ["note", "question", "lesson", "study_guide", "vocabulary", "bookmark", "explanation"].includes(body.kind) ? body.kind : "note",
    title.slice(0, 200), String(body.body || "").slice(0, 20000), body.subject || null, body.refId || null, now(),
  );
  recordActivity(learner, "library", `Saved "${title.slice(0, 60)}"`, XP.library, body.subject || null);
  return send({ item: one("SELECT * FROM library WHERE id = ?", id) }, 201);
});

route("PATCH", "/api/library/:id", async ({ user, params, body }) => {
  const item = one("SELECT * FROM library WHERE id = ?", params.id);
  if (!item) throw new HttpError(404, "Item not found");
  requireLearner(user, item.learner_id);
  run("UPDATE library SET title = COALESCE(?, title), body = COALESCE(?, body) WHERE id = ?", body.title || null, body.body ?? null, item.id);
  return send({ item: one("SELECT * FROM library WHERE id = ?", item.id) });
});

route("DELETE", "/api/library/:id", async ({ user, params }) => {
  const item = one("SELECT * FROM library WHERE id = ?", params.id);
  if (!item) throw new HttpError(404, "Item not found");
  requireLearner(user, item.learner_id);
  run("DELETE FROM library WHERE id = ?", item.id);
  return send({ ok: true });
});

/* ------------------------------------------------------------------ */
/*  Uploads                                                            */
/* ------------------------------------------------------------------ */

route("POST", "/api/uploads", async ({ req, user }) => {
  const learner = requireLearner(user, null);
  if (!learner.uploads_enabled) throw new HttpError(403, "Uploads are turned off for this profile. A parent or educator can enable them in settings.");
  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "Please choose a file to upload");
  if (file.size > 15 * 1024 * 1024) throw new HttpError(400, "Files must be under 15 MB");
  const safeName = String(file.name || "upload").replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const storedName = `${uid()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  writeFileSync(path.join(UPLOAD_DIR, storedName), buffer);
  const text = decodeUpload(safeName, file.type, buffer);
  const analysis = await analyzeDocument({ learner, fileName: safeName, text });
  const id = uid();
  run(
    "INSERT INTO uploads (id, learner_id, name, mime, size, path, text, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id, learner.id, safeName, file.type || "application/octet-stream", file.size, storedName, text.slice(0, 200000), analysis.summary, now(),
  );
  recordActivity(learner, "upload", `Uploaded "${safeName}"`, XP.library);
  return send({
    upload: { id, name: safeName, mime: file.type, size: file.size, summary: analysis.summary, textFound: Boolean(text.trim()) },
  }, 201);
});

route("POST", "/api/uploads/:id/study-guide", async ({ user, params }) => {
  const upload = one("SELECT * FROM uploads WHERE id = ?", params.id);
  if (!upload) throw new HttpError(404, "Upload not found");
  const learner = requireLearner(user, upload.learner_id);
  if (!upload.text || !upload.text.trim()) throw new HttpError(400, "There is no readable text in that file. Try a text-based PDF or paste the content as a note.");
  const guide = await studyGuideFromDocument({ learner, title: upload.name, text: upload.text });
  const id = uid();
  run(
    "INSERT INTO library (id, learner_id, kind, title, body, subject, ref_id, created_at) VALUES (?, ?, 'study_guide', ?, ?, NULL, ?, ?)",
    id, learner.id, `Study guide: ${upload.name}`.slice(0, 200), guide, upload.id, now(),
  );
  return send({ item: one("SELECT * FROM library WHERE id = ?", id) });
});

route("GET", "/api/uploads/:id", async ({ user, params }) => {
  const upload = one("SELECT * FROM uploads WHERE id = ?", params.id);
  if (!upload) throw new HttpError(404, "Upload not found");
  requireLearner(user, upload.learner_id);
  return send({ upload: { id: upload.id, name: upload.name, mime: upload.mime, size: upload.size, summary: upload.summary, text: upload.text?.slice(0, 40000) || "" } });
});

route("DELETE", "/api/uploads/:id", async ({ user, params }) => {
  const upload = one("SELECT * FROM uploads WHERE id = ?", params.id);
  if (!upload) throw new HttpError(404, "Upload not found");
  requireLearner(user, upload.learner_id);
  if (upload.path) {
    try { unlinkSync(path.join(UPLOAD_DIR, upload.path)); } catch {}
  }
  run("DELETE FROM uploads WHERE id = ?", upload.id);
  return send({ ok: true });
});

/* ------------------------------------------------------------------ */
/*  Progress, achievements, challenge                                  */
/* ------------------------------------------------------------------ */

route("GET", "/api/progress", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  const progress = many("SELECT * FROM subject_progress WHERE learner_id = ? ORDER BY mastery DESC", learner.id);
  const achievements = many("SELECT code, earned_at FROM achievements WHERE learner_id = ? ORDER BY earned_at DESC", learner.id)
    .map((a) => ({ ...a, ...(ACHIEVEMENTS.find((x) => x.code === a.code) || {}) }));
  const activity = many("SELECT kind, detail, xp, created_at FROM activity WHERE learner_id = ? ORDER BY created_at DESC LIMIT 20", learner.id);
  const days = new Set(many("SELECT created_at FROM activity WHERE learner_id = ?", learner.id).map((a) => dateKey(a.created_at)));
  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const key = todayKey(new Date(Date.now() - i * 86400000));
    last14.push({ date: key, active: days.has(key) });
  }
  const attempts = many("SELECT a.score, a.total, a.created_at, q.title, q.subject FROM attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE a.learner_id = ? ORDER BY a.created_at DESC LIMIT 10", learner.id);
  const lessons = many("SELECT title, subject, status, progress, updated_at FROM lessons WHERE learner_id = ? ORDER BY updated_at DESC LIMIT 8", learner.id);
  const counts = {
    lessonsCompleted: one("SELECT COUNT(*) AS c FROM lessons WHERE learner_id = ? AND status = 'completed'", learner.id)?.c || 0,
    quizzesTaken: attempts.length,
    minutes: one("SELECT COALESCE(SUM(minutes),0) AS c FROM subject_progress WHERE learner_id = ?", learner.id)?.c || 0,
    flashcards: one("SELECT COUNT(*) AS c FROM flashcards WHERE learner_id = ?", learner.id)?.c || 0,
    library: one("SELECT COUNT(*) AS c FROM library WHERE learner_id = ?", learner.id)?.c || 0,
    avgScore: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score / Math.max(1, a.total), 0) / attempts.length * 100) : 0,
  };
  return send({ learner: shapeLearner(learner), progress, achievements, activity, last14, attempts, lessons, counts, todayMinutes: 0 });
});

route("GET", "/api/dashboard", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  const today = todayKey();
  const todaysActivity = many("SELECT * FROM activity WHERE learner_id = ? AND created_at >= ?", learner.id, new Date(`${today}T00:00:00`).getTime());
  const minutesToday = one(
    "SELECT COALESCE(SUM(duration),0) AS c FROM lessons WHERE learner_id = ? AND status = 'completed' AND updated_at >= ?",
    learner.id, new Date(`${today}T00:00:00`).getTime(),
  )?.c || 0;
  const progress = many("SELECT * FROM subject_progress WHERE learner_id = ? ORDER BY updated_at DESC LIMIT 6", learner.id);
  const inProgress = many("SELECT * FROM lessons WHERE learner_id = ? AND status = 'in_progress' ORDER BY updated_at DESC LIMIT 4", learner.id).map(shapeLesson);
  const recent = many("SELECT code, earned_at FROM achievements WHERE learner_id = ? ORDER BY earned_at DESC LIMIT 4", learner.id)
    .map((a) => ({ ...a, ...(ACHIEVEMENTS.find((x) => x.code === a.code) || {}) }));
  const upcoming = many("SELECT * FROM schedule WHERE learner_id = ? AND done = 0 AND start_at >= ? ORDER BY start_at ASC LIMIT 4", learner.id, today).map(shapeSchedule);
  const recommended = [];
  const pool = allTopics();
  const level = levelForAge(learner.age);
  const allowed = parseJson(learner.allowed_subjects, []);
  const subjectsToShow = allowed.length ? allowed : (progress.length ? progress.map((p) => p.subject) : ["math", "reading", "science"]);
  for (const subjectId of subjectsToShow.slice(0, 3)) {
    const candidates = pool.filter((t) => t.subjectId === subjectId && ["early", "foundation", "elementary", "middle", "high", "college"].indexOf(t.level) <= ["early", "foundation", "elementary", "middle", "high", "college"].indexOf(level));
    const item = candidates[(hashString(learner.id) + candidates.length) % Math.max(1, candidates.length)] || candidates[0];
    if (item) recommended.push({ subject: subjectId, subjectName: SUBJECT_MAP[subjectId]?.name, topic: item.topic, level: item.level });
  }
  const counts = {
    lessonsCompleted: one("SELECT COUNT(*) AS c FROM lessons WHERE learner_id = ? AND status = 'completed'", learner.id)?.c || 0,
    quizAvg: (() => {
      const row = one("SELECT AVG(CASE WHEN total > 0 THEN CAST(score AS REAL)/total ELSE 0 END) AS v FROM attempts WHERE learner_id = ?", learner.id);
      return row?.v ? Math.round(row.v * 100) : 0;
    })(),
    minutesTotal: one("SELECT COALESCE(SUM(minutes),0) AS c FROM subject_progress WHERE learner_id = ?", learner.id)?.c || 0,
  };
  const accountability = getAccountability(learner.id);
  const game = gameState(learner);
  const report = dailyBrief(learner);
  const focusSubject = progress[0]?.subject || parseJson(learner.allowed_subjects, [])[0] || "math";
  const resolvedEnvironment = learner.auto_environment === 0 && learner.environment && learner.environment !== "auto"
    ? learner.environment
    : environmentFor(focusSubject, "");
  return send({
    learner: shapeLearner(learner),
    accountability,
    report,
    environment: resolvedEnvironment,
    today: { minutes: minutesToday, goal: learner.daily_goal, activities: todaysActivity.length, xpEarned: todaysActivity.reduce((s, a) => s + (a.xp || 0), 0) },
    progress,
    inProgress,
    achievements: recent,
    upcoming,
    recommended,
    challenge: (({ subject, text, hint }) => ({ subject, text, hint }))(challengeFor(learner)),
    counts,
    streak: learner.streak || 0,
    game,
  });
});

route("GET", "/api/reports", async ({ user, learnerId, query }) => {
  const learner = requireLearner(user, learnerId);
  return send(reportOverview(learner, query.date));
});

function hashString(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) | 0;
  return Math.abs(h);
}

route("POST", "/api/challenge/check", async ({ user, body }) => {
  const learner = requireLearner(user, body.learnerId);
  const challenge = challengeFor(learner);
  const given = String(body.answer || "").trim().toLowerCase().replace(/[.,!?]/g, "");
  const expected = String(challenge.answer).toLowerCase().replace(/[.,!?]/g, "");
  const numericGiven = Number(given.replace(/[^0-9.\-]/g, ""));
  const numericExpected = Number(expected.replace(/[^0-9.\-]/g, ""));
  const correct =
    given === expected ||
    (Number.isFinite(numericGiven) && Number.isFinite(numericExpected) && Math.abs(numericGiven - numericExpected) < 1e-6) ||
    given.includes(expected);
  let rewards = null;
  if (correct) rewards = recordActivity(learner, "challenge", "Solved the daily challenge", XP.challenge, challenge.subject);
  return send({ correct, answer: correct ? challenge.answer : undefined, hint: challenge.hint, rewards });
});

route("GET", "/api/achievements", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  const earned = new Set(many("SELECT code FROM achievements WHERE learner_id = ?", learner.id).map((r) => r.code));
  return send({
    achievements: ACHIEVEMENTS.map((a) => ({ ...a, earned: earned.has(a.code), earnedAt: one("SELECT earned_at FROM achievements WHERE learner_id = ? AND code = ?", learner.id, a.code)?.earned_at || null })),
    xp: learner.xp,
    streak: learner.streak,
  });
});

/* ------------------------------------------------------------------ */
/*  Schedule                                                           */
/* ------------------------------------------------------------------ */

function shapeSchedule(row) {
  return { id: row.id, title: row.title, subject: row.subject, subjectName: SUBJECT_MAP[row.subject]?.name || row.subject, startAt: row.start_at, minutes: row.minutes, note: row.note, done: Boolean(row.done) };
}

route("GET", "/api/schedule", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  const sessions = many("SELECT * FROM schedule WHERE learner_id = ? ORDER BY start_at ASC", learner.id).map(shapeSchedule);
  return send({ sessions });
});

route("POST", "/api/schedule", async ({ user, body }) => {
  const learner = requireLearner(user, body.learnerId);
  const title = String(body.title || "").trim();
  const startAt = String(body.startAt || "").trim();
  if (!title) throw new HttpError(400, "Give your study session a title");
  if (!/^\d{4}-\d{2}-\d{2}/.test(startAt)) throw new HttpError(400, "Please choose a date and time");
  const id = uid();
  run(
    "INSERT INTO schedule (id, learner_id, title, subject, start_at, minutes, note, done) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
    id, learner.id, title.slice(0, 120), body.subject || null, startAt, Math.max(5, Number(body.minutes) || 20), String(body.note || "").slice(0, 500),
  );
  return send({ session: shapeSchedule(one("SELECT * FROM schedule WHERE id = ?", id)) }, 201);
});

route("PATCH", "/api/schedule/:id", async ({ user, params, body }) => {
  const row = one("SELECT * FROM schedule WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Study session not found");
  requireLearner(user, row.learner_id);
  run("UPDATE schedule SET done = ? WHERE id = ?", body.done ? 1 : 0, row.id);
  return send({ session: shapeSchedule(one("SELECT * FROM schedule WHERE id = ?", row.id)) });
});

route("DELETE", "/api/schedule/:id", async ({ user, params }) => {
  const row = one("SELECT * FROM schedule WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Study session not found");
  requireLearner(user, row.learner_id);
  run("DELETE FROM schedule WHERE id = ?", row.id);
  return send({ ok: true });
});

/* ------------------------------------------------------------------ */
/*  Study plan                                                         */
/* ------------------------------------------------------------------ */

route("POST", "/api/study-plan", async ({ user, body }) => {
  const learner = requireLearner(user, body.learnerId);
  const plan = await buildStudyPlan({ learner, goal: String(body.goal || "Get stronger in this subject"), subject: body.subject, weeks: Math.min(12, Number(body.weeks) || 4) });
  recordActivity(learner, "plan", `Created a study plan: ${plan.title}`, XP.plan, body.subject || null);
  return send({ plan });
});

/* ------------------------------------------------------------------ */
/*  The Great Library, quests and adventure state                      */
/* ------------------------------------------------------------------ */

function bookmarkList(learnerId) {
  return many("SELECT * FROM bookmarks WHERE learner_id = ? ORDER BY created_at DESC", learnerId).map((b) => {
    const ref = b.topic_id ? findTopic(b.topic_id) : null;
    return {
      id: b.id,
      bookId: b.book_id,
      bookTitle: getBook(b.book_id)?.title || b.book_id,
      topicId: b.topic_id,
      topicName: ref?.topic.name || null,
      page: b.page,
      label: b.label,
      createdAt: b.created_at,
    };
  });
}

route("GET", "/api/world", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  const overview = libraryOverview(learner, allBooks());
  const level = levelInfo(learner.xp);
  return send({
    books: overview.books.map(bookCard),
    sections: overview.sections.map((section) => ({ ...section, books: section.books.map(bookCard) })),
    totals: overview.totals,
    recent: overview.recent,
    bookmarks: overview.bookmarks,
    statuses: MASTERY_STATUSES,
    stats: masteryStats(learner.id),
    level,
    chambers: CHAMBERS.map((chamber) => ({ ...chamber, unlocked: level.level >= chamber.level })),
  });
});

route("GET", "/api/library/requests", async ({ user, query }) => {
  if (!user) throw new HttpError(401, "Please sign in to continue");
  const staff = ["parent", "educator"].includes(user.role);
  if (query.all && staff) {
    // Educators curate the whole catalogue; a parent sees only their own family's requests.
    return send({
      requests: user.role === "educator"
        ? many("SELECT * FROM content_requests ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 100")
        : many("SELECT * FROM content_requests WHERE user_id = ? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 100", user.id),
    });
  }
  return send({ requests: many("SELECT * FROM content_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", user.id) });
});

function canEditVolume(user, row) {
  return user.role === "educator" || row.created_by === user.id;
}

route("GET", "/api/library/books", async ({ user }) => {
  if (!user || !["parent", "educator"].includes(user.role)) throw new HttpError(403, "Only a parent or educator can open the curator's desk");
  const rows = many("SELECT * FROM custom_books ORDER BY created_at DESC");
  return send({
    books: rows.map((row) => {
      const data = parseJson(row.data, {});
      return {
        id: row.id,
        title: data.title || row.title,
        subtitle: data.subtitle || "",
        section: data.section || "foundations",
        subject: data.subject || "math",
        icon: data.icon || "📕",
        color: data.color || "#8a6cd6",
        blurb: data.blurb || "",
        status: row.status,
        owned: row.created_by === user.id,
        topicCount: (data.chapters || []).reduce((n, c) => n + (c.topics || []).length, 0),
        chapterCount: (data.chapters || []).length,
        chapters: (data.chapters || []).map((c) => ({ id: c.id, title: c.title, topicCount: (c.topics || []).length })),
        createdAt: row.created_at,
      };
    }),
  });
});

route("POST", "/api/library/requests", async ({ user, body }) => {
  if (!user) throw new HttpError(401, "Please sign in to continue");
  const learner = body.learnerId ? requireLearner(user, body.learnerId) : null;
  const title = String(body.title || "").trim().slice(0, 140);
  if (!title) throw new HttpError(400, "Tell us what subject or topic you would like added");
  const kind = ["book", "chapter", "topic", "language"].includes(body.kind) ? body.kind : "topic";
  const id = uid();
  run(
    "INSERT INTO content_requests (id, user_id, learner_id, kind, title, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)",
    id, user.id, learner?.id || null, kind, title, String(body.details || "").slice(0, 2000), now(),
  );
  return send({ request: one("SELECT * FROM content_requests WHERE id = ?", id) }, 201);
});

route("PATCH", "/api/library/requests/:id", async ({ user, params, body }) => {
  if (!user || !["parent", "educator"].includes(user.role)) throw new HttpError(403, "Only a parent or educator can review content requests");
  const row = one("SELECT * FROM content_requests WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Request not found");
  if (user.role === "parent" && row.user_id !== user.id) throw new HttpError(403, "That request belongs to another family");
  const status = ["pending", "approved", "declined"].includes(body.status) ? body.status : "pending";
  run("UPDATE content_requests SET status = ? WHERE id = ?", status, row.id);
  return send({ request: one("SELECT * FROM content_requests WHERE id = ?", row.id) });
});

route("GET", "/api/bookmarks", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  return send({ bookmarks: bookmarkList(learner.id) });
});

route("POST", "/api/bookmarks", async ({ user, body }) => {
  const learner = requireLearner(user, body.learnerId);
  const bookId = String(body.bookId || "");
  if (!getBook(bookId)) throw new HttpError(404, "Book not found");
  const topicId = body.topicId ? String(body.topicId) : null;
  if (topicId && !findTopic(topicId)) throw new HttpError(404, "Topic not found");
  const page = Math.max(1, Number(body.page) || 1);
  const existing = one(
    "SELECT id FROM bookmarks WHERE learner_id = ? AND book_id = ? AND COALESCE(topic_id, '') = ? AND page = ?",
    learner.id, bookId, topicId || "", page,
  );
  if (existing) {
    run("DELETE FROM bookmarks WHERE id = ?", existing.id);
    return send({ bookmarked: false, bookmarks: bookmarkList(learner.id) });
  }
  run(
    "INSERT INTO bookmarks (id, learner_id, book_id, topic_id, page, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    uid(), learner.id, bookId, topicId, page, String(body.label || "").slice(0, 140), now(),
  );
  return send({ bookmarked: true, bookmarks: bookmarkList(learner.id) }, 201);
});

route("POST", "/api/library/books", async ({ user, body }) => {
  if (!user || !["parent", "educator"].includes(user.role)) throw new HttpError(403, "Only a parent or educator can add reviewed library volumes");
  const data = normalizeCustomBook(body);
  run(
    "INSERT INTO custom_books (id, title, data, status, created_by, created_at) VALUES (?, ?, ?, 'published', ?, ?)",
    data.id, data.title, JSON.stringify(data), user.id, now(),
  );
  loadCustomBooks();
  const book = getBook(data.id);
  return send({ book: bookCard(book) }, 201);
});

route("PATCH", "/api/library/books/:id", async ({ user, params, body }) => {
  if (!user || !["parent", "educator"].includes(user.role)) throw new HttpError(403, "Only a parent or educator can edit library volumes");
  const row = one("SELECT * FROM custom_books WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "That volume is part of the reviewed core collection and cannot be overwritten");
  if (!canEditVolume(user, row)) throw new HttpError(403, "That volume was published by another curator");
  const current = parseJson(row.data, {});
  const data = normalizeCustomBook({ ...current, ...body, chapters: body.chapters || current.chapters }, current.id);
  run("UPDATE custom_books SET title = ?, data = ? WHERE id = ?", data.title, JSON.stringify(data), row.id);
  loadCustomBooks();
  return send({ book: bookCard(getBook(row.id)) });
});

route("DELETE", "/api/library/books/:id", async ({ user, params }) => {
  if (!user || !["parent", "educator"].includes(user.role)) throw new HttpError(403, "Only a parent or educator can remove library volumes");
  const row = one("SELECT * FROM custom_books WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Custom volume not found");
  if (!canEditVolume(user, row)) throw new HttpError(403, "That volume was published by another curator");
  run("DELETE FROM custom_books WHERE id = ?", row.id);
  loadCustomBooks();
  return send({ ok: true });
});

route("POST", "/api/library/books/:id/chapters", async ({ user, params, body }) => {
  if (!user || !["parent", "educator"].includes(user.role)) throw new HttpError(403, "Only a parent or educator can edit library volumes");
  const row = one("SELECT * FROM custom_books WHERE id = ?", params.id);
  if (!row) throw new HttpError(400, "Add chapters to a custom volume; the reviewed core is versioned separately");
  if (!canEditVolume(user, row)) throw new HttpError(403, "That volume was published by another curator");
  const current = parseJson(row.data, {});
  const data = normalizeCustomBook({ ...current, chapters: [...(current.chapters || []), { title: body.title || "New chapter", topics: [] }] }, current.id);
  run("UPDATE custom_books SET data = ? WHERE id = ?", JSON.stringify(data), row.id);
  loadCustomBooks();
  return send({ book: bookCard(getBook(row.id)) }, 201);
});

route("POST", "/api/library/books/:id/chapters/:chapterId/topics", async ({ user, params, body }) => {
  if (!user || !["parent", "educator"].includes(user.role)) throw new HttpError(403, "Only a parent or educator can edit library volumes");
  const row = one("SELECT * FROM custom_books WHERE id = ?", params.id);
  if (!row) throw new HttpError(400, "Add topics to a custom volume; the reviewed core is versioned separately");
  if (!canEditVolume(user, row)) throw new HttpError(403, "That volume was published by another curator");
  const name = String(body.name || "").trim();
  if (!name) throw new HttpError(400, "A topic needs a name");
  const current = parseJson(row.data, {});
  const chapters = (current.chapters || []).map((chapter, index) => {
    const matches = chapter.id === params.chapterId || String(index + 1) === String(params.chapterId) || chapter.title === params.chapterId;
    return matches ? { ...chapter, topics: [...(chapter.topics || []), { name, blurb: String(body.blurb || "").slice(0, 400) }] } : chapter;
  });
  const data = normalizeCustomBook({ ...current, chapters }, current.id);
  run("UPDATE custom_books SET data = ? WHERE id = ?", JSON.stringify(data), row.id);
  loadCustomBooks();
  return send({ book: bookCard(getBook(row.id)) }, 201);
});

route("GET", "/api/library/:bookId", async ({ user, params, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  const book = getBook(params.bookId);
  if (!book) throw new HttpError(404, "That book is not on any shelf yet");
  const marks = many("SELECT * FROM bookmarks WHERE learner_id = ? AND book_id = ?", learner.id, book.id);
  const detailed = bookWithProgress(learner, book, undefined, marks);
  return send({
    book: detailed,
    statuses: MASTERY_STATUSES,
    level: levelInfo(learner.xp),
    connection: connectionFor(book.id),
    recommendations: recommendations(learner, 2),
  });
});

route("GET", "/api/scripture", async () => {
  return send({ translation: "King James Version (Authorized Version, 1611)", publicDomain: true, note: KJV_NOTE, passages: KJV_PASSAGES });
});

route("GET", "/api/quests", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  return send({ quests: questSummary(learner), level: levelInfo(learner.xp), statuses: MASTERY_STATUSES });
});

route("POST", "/api/quests/:id/claim", async ({ user, params, body }) => {
  const learner = requireLearner(user, body.learnerId || user.active_learner_id);
  const result = claimQuest(learner, params.id);
  if (result.error) throw new HttpError(400, result.error);
  const fresh = one("SELECT * FROM learners WHERE id = ?", learner.id);
  const rewards = recordActivity(fresh, "quest", `Claimed quest: ${result.title}`, result.xp);
  const updated = one("SELECT * FROM learners WHERE id = ?", learner.id);
  return send({ quests: questSummary(updated), rewards, xp: updated.xp, level: levelInfo(updated.xp) });
});

route("GET", "/api/game", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  return send({ game: gameState(learner), learner: shapeLearner(learner) });
});

/* ------------------------------------------------------------------ */
/*  Adventure world (first-person academy)                             */
/* ------------------------------------------------------------------ */

const ADVENTURE_AREAS = ["courtyard", "library", "study", "classroom"];

/**
 * Walkable bounds per area, mirroring the engine's own limits. A saved point
 * outside these bounds is replaced by the area's entrance instead of being
 * clamped into an unreachable position.
 */
const ADVENTURE_AREA_BOUNDS = {
  courtyard: { minX: -70, maxX: 70, minZ: -70, maxZ: 70 },
  library: { minX: 385.4, maxX: 414.6, minZ: -12.6, maxZ: 12.6 },
  study: { minX: -5.6, maxX: 5.6, minZ: 394.4, maxZ: 405.6 },
  classroom: { minX: 790.5, maxX: 809.5, minZ: -7.1, maxZ: 7.1 },
};
const ADVENTURE_AREA_SPAWNS = {
  courtyard: { x: 0, z: 42, yaw: 0, pitch: 0 },
  library: { x: 400, z: 9, yaw: 0, pitch: 0 },
  study: { x: 0, z: 396.6, yaw: 0, pitch: 0 },
  classroom: { x: 800, z: 5, yaw: 0, pitch: 0 },
};
const ADVENTURE_DEFAULT_APPEARANCE = {
  name: "",
  skin: "#e8b894",
  hairStyle: "short",
  hairColor: "#3b2a20",
  outfit: "uniform",
  outfitColor: "#5b4b9e",
  accessory: "none",
  freckles: false,
};
const ADVENTURE_DEFAULT_SETTINGS = {
  sensitivity: 1,
  invertY: false,
  motionReduction: false,
  cameraShake: true,
  speed: 1,
  quality: "high",
};

function cleanColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
}

function cleanAdventureAppearance(raw, base) {
  const input = raw && typeof raw === "object" ? raw : {};
  const fallback = base || ADVENTURE_DEFAULT_APPEARANCE;
  return {
    name: typeof input.name === "string" ? input.name.trim().slice(0, 30) : fallback.name,
    skin: cleanColor(input.skin, fallback.skin),
    hairStyle: ["short", "bob", "braids", "curly", "long", "bun"].includes(input.hairStyle) ? input.hairStyle : fallback.hairStyle,
    hairColor: cleanColor(input.hairColor, fallback.hairColor),
    outfit: ["uniform", "robes", "casual"].includes(input.outfit) ? input.outfit : fallback.outfit,
    outfitColor: cleanColor(input.outfitColor, fallback.outfitColor),
    accessory: ["none", "glasses", "circlet", "scarf"].includes(input.accessory) ? input.accessory : fallback.accessory,
    freckles: input.freckles === undefined ? Boolean(fallback.freckles) : Boolean(input.freckles),
  };
}

function cleanAdventureSettings(raw, base) {
  const input = raw && typeof raw === "object" ? raw : {};
  const fallback = base || ADVENTURE_DEFAULT_SETTINGS;
  const clamp = (value, min, max, alt) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : alt;
  };
  return {
    sensitivity: clamp(input.sensitivity, 0.25, 3, fallback.sensitivity),
    invertY: input.invertY === undefined ? Boolean(fallback.invertY) : Boolean(input.invertY),
    motionReduction: input.motionReduction === undefined ? Boolean(fallback.motionReduction) : Boolean(input.motionReduction),
    cameraShake: input.cameraShake === undefined ? Boolean(fallback.cameraShake) : Boolean(input.cameraShake),
    speed: clamp(input.speed, 0.6, 1.8, fallback.speed),
    quality: input.quality === "low" || input.quality === "high" ? input.quality : fallback.quality,
  };
}

function cleanAdventurePosition(raw, base) {
  if (!raw || typeof raw !== "object") return base || null;
  const area = ADVENTURE_AREAS.includes(raw.area) ? raw.area : base?.area || "courtyard";
  const clamp = (value, min, max, alt) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : alt;
  };
  const bounds = ADVENTURE_AREA_BOUNDS[area];
  const x = clamp(raw.x, -1200, 1200, base?.x ?? 0);
  const z = clamp(raw.z, -1200, 1200, base?.z ?? 0);
  const yaw = clamp(raw.yaw, -Math.PI * 4, Math.PI * 4, base?.yaw ?? 0);
  const pitch = clamp(raw.pitch, -1.45, 1.45, base?.pitch ?? 0);
  // The engine's bounds are the hard limit, so allow the full rectangle (plus
  // rounding tolerance). Anything outside it — including the old ±600 clamp
  // of the classroom at x=800 — respawns at that area's entrance instead.
  const tolerance = 0.01;
  const walkable =
    x >= bounds.minX - tolerance && x <= bounds.maxX + tolerance &&
    z >= bounds.minZ - tolerance && z <= bounds.maxZ + tolerance;
  if (!walkable) return { area, ...ADVENTURE_AREA_SPAWNS[area] };
  return { area, x, z, yaw, pitch };
}

const MAX_ADVENTURE_CHARACTERS = 4;

function adventureCharacterList(learnerId) {
  return many("SELECT * FROM adventure_characters WHERE learner_id = ? ORDER BY created_at ASC", learnerId).map((row) => ({
    id: row.id,
    name: row.name || "",
    appearance: cleanAdventureAppearance(parseJson(row.appearance, {}), ADVENTURE_DEFAULT_APPEARANCE),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function adoptLegacyAdventureLook(learnerId, row) {
  if (!row?.appearance || adventureCharacterList(learnerId).length) return;
  const appearance = cleanAdventureAppearance(parseJson(row.appearance, {}));
  appearance.name = appearance.name || "First look";
  const id = uid();
  run(
    "INSERT INTO adventure_characters (id, learner_id, name, appearance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    learnerId,
    appearance.name,
    JSON.stringify(appearance),
    now(),
    now(),
  );
  run("UPDATE adventure_profiles SET active_character_id = ?, appearance = ? WHERE learner_id = ?", id, JSON.stringify(appearance), learnerId);
}

function saveAdventureIdentity(learnerId, appearance, activeCharacterId) {
  const row = one("SELECT * FROM adventure_profiles WHERE learner_id = ?", learnerId);
  run(
    `INSERT INTO adventure_profiles (learner_id, appearance, position, settings, discoveries, world_time, active_character_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(learner_id) DO UPDATE SET appearance = excluded.appearance,
       active_character_id = excluded.active_character_id, updated_at = excluded.updated_at`,
    learnerId,
    appearance ? JSON.stringify(appearance) : null,
    row?.position ?? null,
    row?.settings ?? JSON.stringify(ADVENTURE_DEFAULT_SETTINGS),
    row?.discoveries ?? "[]",
    row?.world_time ?? null,
    activeCharacterId || null,
    now(),
  );
}

function adventureProfile(learnerId) {
  let row = one("SELECT * FROM adventure_profiles WHERE learner_id = ?", learnerId);
  if (!row) {
    return {
      appearance: null,
      characters: [],
      activeCharacterId: null,
      position: null,
      settings: { ...ADVENTURE_DEFAULT_SETTINGS },
      discoveries: [],
      worldTime: null,
      updatedAt: null,
    };
  }
  adoptLegacyAdventureLook(learnerId, row);
  if (row.active_character_id == null) row = one("SELECT * FROM adventure_profiles WHERE learner_id = ?", learnerId);
  return {
    appearance: row.appearance ? cleanAdventureAppearance(parseJson(row.appearance, {})) : null,
    characters: adventureCharacterList(learnerId),
    activeCharacterId: row.active_character_id || null,
    position: row.position ? cleanAdventurePosition(parseJson(row.position, null), null) : null,
    settings: cleanAdventureSettings(parseJson(row.settings, {})),
    discoveries: parseJson(row.discoveries, []).filter((x) => typeof x === "string").slice(0, 200),
    worldTime: row.world_time == null ? null : Number(row.world_time),
    updatedAt: row.updated_at || null,
  };
}

route("GET", "/api/adventure", async ({ user, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  return send({ profile: adventureProfile(learner.id) });
});

route("PATCH", "/api/adventure", async ({ user, body, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  const current = adventureProfile(learner.id);
  const appearance = body.appearance === null
    ? null
    : body.appearance === undefined
      ? current.appearance
      : cleanAdventureAppearance(body.appearance, current.appearance || ADVENTURE_DEFAULT_APPEARANCE);
  const settings = body.settings === undefined ? current.settings : cleanAdventureSettings(body.settings, current.settings);
  const position = body.position === undefined ? current.position : cleanAdventurePosition(body.position, current.position);
  const discoveries = body.discoveries === undefined
    ? current.discoveries
    : (Array.isArray(body.discoveries) ? body.discoveries : []).filter((x) => typeof x === "string").map((x) => x.slice(0, 120)).slice(0, 200);
  const worldTime = body.worldTime === undefined
    ? current.worldTime
    : Number.isFinite(Number(body.worldTime))
      ? Math.max(0, Math.min(100000, Number(body.worldTime)))
      : current.worldTime;
  run(
    `INSERT INTO adventure_profiles (learner_id, appearance, position, settings, discoveries, world_time, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(learner_id) DO UPDATE SET appearance = excluded.appearance, position = excluded.position,
       settings = excluded.settings, discoveries = excluded.discoveries, world_time = excluded.world_time,
       updated_at = excluded.updated_at`,
    learner.id,
    appearance ? JSON.stringify(appearance) : null,
    position ? JSON.stringify(position) : null,
    JSON.stringify(settings),
    JSON.stringify(discoveries),
    worldTime,
    now(),
  );
  return send({ profile: adventureProfile(learner.id) });
});

route("POST", "/api/adventure/characters", async ({ user, body, learnerId }) => {
  const learner = requireLearner(user, learnerId);
  const existing = adventureCharacterList(learner.id);
  if (existing.length >= MAX_ADVENTURE_CHARACTERS) {
    throw new HttpError(400, `You can keep ${MAX_ADVENTURE_CHARACTERS} characters. Delete one to make room for a new look.`);
  }
  const appearance = cleanAdventureAppearance(body.appearance || {}, ADVENTURE_DEFAULT_APPEARANCE);
  const name = String(body.name ?? appearance.name ?? "").trim().slice(0, 30);
  appearance.name = name;
  const id = uid();
  run(
    "INSERT INTO adventure_characters (id, learner_id, name, appearance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    learner.id,
    name,
    JSON.stringify(appearance),
    now(),
    now(),
  );
  saveAdventureIdentity(learner.id, appearance, id);
  addMemoryRow(learner.id, "preference", `Created a character called ${name || "their scholar"}.`);
  return send({ profile: adventureProfile(learner.id) }, 201);
});

route("PATCH", "/api/adventure/characters/:id", async ({ user, params, body }) => {
  const row = one("SELECT * FROM adventure_characters WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Character not found");
  const learner = requireLearner(user, row.learner_id);
  const current = cleanAdventureAppearance(parseJson(row.appearance, {}), ADVENTURE_DEFAULT_APPEARANCE);
  const appearance = body.appearance === undefined ? current : cleanAdventureAppearance(body.appearance, current);
  const name = body.name === undefined ? current.name : String(body.name).trim().slice(0, 30);
  appearance.name = name;
  run(
    "UPDATE adventure_characters SET name = ?, appearance = ?, updated_at = ? WHERE id = ?",
    name,
    JSON.stringify(appearance),
    now(),
    row.id,
  );
  const profileRow = one("SELECT active_character_id FROM adventure_profiles WHERE learner_id = ?", learner.id);
  if (!profileRow?.active_character_id || profileRow.active_character_id === row.id) {
    saveAdventureIdentity(learner.id, appearance, row.id);
  }
  return send({ profile: adventureProfile(learner.id) });
});

route("POST", "/api/adventure/characters/:id/activate", async ({ user, params }) => {
  const row = one("SELECT * FROM adventure_characters WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Character not found");
  const learner = requireLearner(user, row.learner_id);
  const appearance = cleanAdventureAppearance(parseJson(row.appearance, {}), ADVENTURE_DEFAULT_APPEARANCE);
  saveAdventureIdentity(learner.id, appearance, row.id);
  return send({ profile: adventureProfile(learner.id) });
});

route("DELETE", "/api/adventure/characters/:id", async ({ user, params }) => {
  const row = one("SELECT * FROM adventure_characters WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Character not found");
  const learner = requireLearner(user, row.learner_id);
  run("DELETE FROM adventure_characters WHERE id = ?", row.id);
  const remaining = adventureCharacterList(learner.id);
  const profileRow = one("SELECT active_character_id FROM adventure_profiles WHERE learner_id = ?", learner.id);
  if (profileRow?.active_character_id === row.id) {
    const next = remaining[remaining.length - 1] || null;
    saveAdventureIdentity(learner.id, next?.appearance || null, next?.id || null);
  }
  return send({ profile: adventureProfile(learner.id) });
});

/* ------------------------------------------------------------------ */
/*  Family & educator                                                  */
/* ------------------------------------------------------------------ */

route("GET", "/api/family/overview", async ({ user }) => {
  if (!user) throw new HttpError(401, "Please sign in");
  if (!["parent", "educator"].includes(user.role)) throw new HttpError(403, "This area is for parent and educator accounts");
  const learners = learnersFor(user).map((l) => {
    const progress = many("SELECT subject, mastery FROM subject_progress WHERE learner_id = ? ORDER BY mastery ASC", l.id);
    const weakest = progress.slice(0, 2).map((p) => SUBJECT_MAP[p.subject]?.name || p.subject);
    const attempts = many("SELECT AVG(CASE WHEN total > 0 THEN CAST(score AS REAL)/total ELSE 0 END) AS v, COUNT(*) AS c FROM attempts WHERE learner_id = ?", l.id)[0];
    return {
      ...shapeLearner(l),
      lessonsCompleted: one("SELECT COUNT(*) AS c FROM lessons WHERE learner_id = ? AND status = 'completed'", l.id)?.c || 0,
      lessonsInProgress: one("SELECT COUNT(*) AS c FROM lessons WHERE learner_id = ? AND status = 'in_progress'", l.id)?.c || 0,
      quizzes: attempts?.c || 0,
      avgScore: attempts?.v ? Math.round(attempts.v * 100) : 0,
      weakest,
      recentLessons: many("SELECT title, subject, status, updated_at FROM lessons WHERE learner_id = ? ORDER BY updated_at DESC LIMIT 4", l.id),
      recentAchievements: many("SELECT code, earned_at FROM achievements WHERE learner_id = ? ORDER BY earned_at DESC LIMIT 3", l.id).map((a) => ({ ...a, ...(ACHIEVEMENTS.find((x) => x.code === a.code) || {}) })),
      assignments: many("SELECT * FROM assignments WHERE learner_id = ? ORDER BY created_at DESC LIMIT 10", l.id),
      report: dailyBrief(l),
    };
  });
  const groups = many("SELECT * FROM groups WHERE owner_user_id = ? ORDER BY created_at ASC", user.id).map((g) => ({
    ...g,
    members: many("SELECT learner_id FROM group_members WHERE group_id = ?", g.id).map((m) => m.learner_id),
  }));
  return send({ learners, groups, role: user.role });
});

route("POST", "/api/family/groups", async ({ user, body }) => {
  if (!user || !["parent", "educator"].includes(user.role)) throw new HttpError(403, "This area is for parent and educator accounts");
  const name = String(body.name || "").trim();
  if (!name) throw new HttpError(400, "Give the group a name");
  const id = uid();
  run("INSERT INTO groups (id, owner_user_id, name, created_at) VALUES (?, ?, ?, ?)", id, user.id, name.slice(0, 80), now());
  for (const learnerId of Array.isArray(body.memberIds) ? body.memberIds : []) {
    const learner = one("SELECT * FROM learners WHERE id = ?", learnerId);
    if (learner?.owner_user_id === user.id) run("INSERT OR IGNORE INTO group_members (group_id, learner_id) VALUES (?, ?)", id, learnerId);
  }
  return send({ group: { id, name, members: many("SELECT learner_id FROM group_members WHERE group_id = ?", id).map((m) => m.learner_id) } }, 201);
});

route("POST", "/api/family/groups/:id/members", async ({ user, params, body }) => {
  const group = one("SELECT * FROM groups WHERE id = ?", params.id);
  if (!group || group.owner_user_id !== user.id) throw new HttpError(404, "Group not found");
  const learner = one("SELECT * FROM learners WHERE id = ?", body.learnerId);
  if (!learner || learner.owner_user_id !== user.id) throw new HttpError(404, "Learner not found");
  if (body.remove) run("DELETE FROM group_members WHERE group_id = ? AND learner_id = ?", group.id, learner.id);
  else run("INSERT OR IGNORE INTO group_members (group_id, learner_id) VALUES (?, ?)", group.id, learner.id);
  return send({ ok: true });
});

route("POST", "/api/family/assign", async ({ user, body }) => {
  if (!user || !["parent", "educator"].includes(user.role)) throw new HttpError(403, "This area is for parent and educator accounts");
  const learner = requireLearner(user, body.learnerId);
  const kind = body.kind === "quiz" ? "quiz" : "lesson";
  const refId = body.refId || null;
  if (kind === "lesson" && refId) {
    const lesson = one("SELECT * FROM lessons WHERE id = ?", refId);
    if (!lesson || lesson.learner_id !== learner.id) throw new HttpError(404, "Lesson not found");
  }
  if (kind === "quiz" && refId) {
    const quiz = one("SELECT * FROM quizzes WHERE id = ?", refId);
    if (!quiz || quiz.learner_id !== learner.id) throw new HttpError(404, "Quiz not found");
  }
  const id = uid();
  run(
    "INSERT INTO assignments (id, learner_id, by_user_id, kind, ref_id, title, due_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'assigned', ?)",
    id, learner.id, user.id, kind, refId, String(body.title || "Assigned practice").slice(0, 160), body.dueAt || null, now(),
  );
  return send({ assignment: one("SELECT * FROM assignments WHERE id = ?", id) }, 201);
});

route("PATCH", "/api/family/assignments/:id", async ({ user, params, body }) => {
  const row = one("SELECT * FROM assignments WHERE id = ?", params.id);
  if (!row) throw new HttpError(404, "Assignment not found");
  requireLearner(user, row.learner_id);
  run("UPDATE assignments SET status = ? WHERE id = ?", String(body.status || "assigned"), row.id);
  return send({ ok: true });
});

route("PATCH", "/api/family/learners/:id/controls", async ({ user, params, body }) => {
  if (!user || !["parent", "educator"].includes(user.role)) throw new HttpError(403, "This area is for parent and educator accounts");
  const learner = requireLearner(user, params.id);
  const fields = {};
  if (Array.isArray(body.allowedSubjects)) fields.allowedSubjects = body.allowedSubjects.filter((s) => SUBJECT_MAP[s]);
  if (body.voiceEnabled !== undefined) fields.voiceEnabled = Boolean(body.voiceEnabled);
  if (body.uploadsEnabled !== undefined) fields.uploadsEnabled = Boolean(body.uploadsEnabled);
  if (body.memoryEnabled !== undefined) fields.memoryEnabled = Boolean(body.memoryEnabled);
  if (body.gamification !== undefined) fields.gamification = Boolean(body.gamification);
  if (body.dailyGoal !== undefined) fields.dailyGoal = Math.max(5, Math.min(180, Number(body.dailyGoal) || 20));
  if (body.guardianConsent !== undefined) fields.guardianConsent = Boolean(body.guardianConsent);
  applyLearnerFields(learner.id, fields);
  return send({ learner: shapeLearner(one("SELECT * FROM learners WHERE id = ?", learner.id)) });
});

/* ------------------------------------------------------------------ */
/*  Static assets                                                      */
/* ------------------------------------------------------------------ */

async function serveStatic(req, pathname) {
  if (pathname.startsWith("/uploads/")) {
    const name = path.basename(pathname);
    const upload = one("SELECT * FROM uploads WHERE path = ?", name);
    if (!upload) return new Response("Not found", { status: 404 });
    const file = Bun.file(path.join(UPLOAD_DIR, name));
    if (!(await file.exists())) return new Response("Not found", { status: 404 });
    return new Response(file, { headers: { "Cache-Control": "private, max-age=3600" } });
  }
  if (!existsSync(DIST_DIR)) {
    return new Response(
      "Asterwood Academy API is running. Start the web app with `bun run dev`, or build with `bun run build` first.",
      { status: 200, headers: { "Content-Type": "text/plain" } },
    );
  }
  let filePath = path.join(DIST_DIR, pathname);
  if (!filePath.startsWith(DIST_DIR)) return new Response("Forbidden", { status: 403 });
  let file = Bun.file(filePath);
  if (pathname === "/" || !(await file.exists())) {
    file = Bun.file(path.join(DIST_DIR, "index.html"));
  }
  const isHtml = file.name.endsWith(".html");
  return new Response(file, {
    headers: {
      ...securityHeaders,
      "Cache-Control": isHtml ? "no-cache" : "public, max-age=31536000, immutable",
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Dispatcher                                                         */
/* ------------------------------------------------------------------ */

const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  maxRequestBodySize: 20 * 1024 * 1024,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (!pathname.startsWith("/api/")) {
      if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, pathname);
      return new Response("Not found", { status: 404 });
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE" } });
    }

    const segments = pathname.split("/").filter(Boolean);
    const matched = matchRoute(req.method, segments);
    if (!matched) return fail(404, `No route for ${req.method} ${pathname}`);

    let body = {};
    if (["POST", "PATCH", "PUT"].includes(req.method)) {
      const contentType = req.headers.get("content-type") || "";
      if (!contentType.includes("multipart/form-data")) {
        try {
          const text = await req.text();
          body = text ? JSON.parse(text) : {};
        } catch {
          return fail(400, "Invalid JSON in request body");
        }
      }
    }

    const user = userFromRequest(req);
    try {
      const result = await matched.route.handler({
        req,
        url,
        params: matched.params,
        query: Object.fromEntries(url.searchParams),
        body,
        user,
        learnerId: url.searchParams.get("learnerId") || body.learnerId,
      });
      if (result instanceof Response) {
        for (const [k, v] of Object.entries(securityHeaders)) result.headers.set(k, v);
        return result;
      }
      return send(result);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message, err.extra);
      console.error(`[api] ${req.method} ${pathname} failed:`, err);
      return fail(500, "Something went wrong on our side. Please try again.");
    }
  },
});

console.log(`Asterwood Academy API listening on http://127.0.0.1:${server.port}  (AI: ${aiStatus().enabled ? aiStatus().model : "built-in curriculum"})`);
