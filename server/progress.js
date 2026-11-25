/**
 * Topic mastery.
 *
 * Mastery is evidence-based: lessons completed, practice accuracy, the number
 * of assessed activities and whether the learner has explained or applied the
 * idea. Opening a book or starting a lesson alone never produces "mastered".
 * Rows are per learner, per book topic.
 */
import { many, now, one, run, uid } from "./db.js";
import { BOOKS, allBooks, getBook, findTopic, topicByText, SECTIONS } from "./library.js";

export const MASTERY_STATUSES = [
  { id: "not_started", name: "Not started", tone: "neutral", blurb: "No study recorded yet. The page is waiting." },
  { id: "learning", name: "Learning", tone: "blue", blurb: "The lesson has begun and the fundamentals are in progress." },
  { id: "practicing", name: "Practicing", tone: "violet", blurb: "Practice is underway and accuracy is being tested." },
  { id: "developing", name: "Developing", tone: "gold", blurb: "Understanding is growing. One more strong assessment will confirm it." },
  { id: "mastered", name: "Mastered", tone: "green", blurb: "Demonstrated through lessons, assessment accuracy and application." },
];

export const MASTERY_MAP = Object.fromEntries(MASTERY_STATUSES.map((s) => [s.id, s]));

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function blankRow(learnerId, bookId, topicId) {
  return {
    id: null,
    learner_id: learnerId,
    book_id: bookId,
    topic_id: topicId,
    lessons_started: 0,
    lessons_completed: 0,
    activities: 0,
    accuracy_sum: 0,
    accuracy_count: 0,
    application: 0,
    written_evidence: 0,
    mastered_at: null,
    decayed_at: null,
    first_studied_at: null,
    last_studied_at: null,
    updated_at: null,
    status: "not_started",
    progress: 0,
  };
}

/** Turn raw evidence into a status, percentage and honest assessment. */
export function assess(row) {
  if (!row) {
    return {
      status: "not_started",
      progress: 0,
      accuracy: null,
      activities: 0,
      lessons: 0,
      assessment: MASTERY_STATUSES[0].blurb,
      lastStudiedAt: null,
    };
  }
  const started = (row.lessons_started || 0) + (row.lessons_completed || 0) + (row.activities || 0) > 0;
  if (!started) {
    return {
      status: "not_started",
      progress: 0,
      accuracy: null,
      activities: row.activities || 0,
      lessons: row.lessons_completed || 0,
      assessment: MASTERY_STATUSES[0].blurb,
      lastStudiedAt: row.last_studied_at || null,
    };
  }
  const accuracy = row.accuracy_count ? Math.round(row.accuracy_sum / row.accuracy_count) : null;
  // A lapsed topic keeps its evidence but is not currently mastered. It stays
  // lapsed until a fresh lesson completion or assessment clears the flag.
  if (row.decayed_at) {
    return {
      status: "developing",
      progress: 84,
      accuracy,
      activities: row.activities || 0,
      lessons: row.lessons_completed || 0,
      writtenEvidence: row.written_evidence || 0,
      masteredAt: null,
      assessment: "Mastery lapsed after a month without a fresh pass. One graded lesson or assessment will earn it again.",
      lastStudiedAt: row.last_studied_at || null,
      firstStudiedAt: row.first_studied_at || null,
    };
  }
  let progress =
    (row.lessons_completed ? 30 : 0) +
    Math.min(20, (row.activities || 0) * 4) +
    (row.accuracy_count ? Math.round((accuracy || 0) * 0.4) : 0) +
    (row.written_evidence ? 10 : 0);
  progress = clamp(progress, 1, 100);

  const masteryEarned =
    (row.lessons_completed || 0) >= 1 &&
    (row.accuracy_count || 0) >= 2 &&
    (accuracy || 0) >= 85 &&
    (row.written_evidence || 0) > 0 &&
    (row.activities || 0) >= 3 &&
    progress >= 85;

  if (!masteryEarned) progress = Math.min(progress, 84);
  else progress = Math.max(progress, 85);

  const status = masteryEarned
    ? "mastered"
    : progress >= 65
      ? "developing"
      : progress >= 40
        ? "practicing"
        : "learning";

  const assessment =
    status === "mastered"
      ? `Mastered with ${accuracy}% across ${row.accuracy_count} assessments and a written explanation that was graded correct. Revisit after a month to keep it.`
      : status === "developing"
        ? "Close. Score 85%+ on a second assessment and write a clear explanation that is graded correct."
        : status === "practicing"
          ? accuracy != null
            ? `Practice accuracy is ${accuracy}%. Try a mixed quiz and explain the method aloud before the next attempt.`
            : "Complete a practice set to test the idea, then explain it without notes."
          : "The fundamentals are underway. Finish the lesson and try the practice questions.";

  return {
    status,
    progress,
    accuracy,
    activities: row.activities || 0,
    lessons: row.lessons_completed || 0,
    writtenEvidence: row.written_evidence || 0,
    masteredAt: row.mastered_at || null,
    assessment,
    lastStudiedAt: row.last_studied_at || null,
    firstStudiedAt: row.first_studied_at || null,
  };
}

export function masteryKey(bookId, topicId) {
  return `${bookId}::${topicId}`;
}

function readRow(learnerId, bookId, topicId) {
  return one("SELECT * FROM topic_mastery WHERE learner_id = ? AND book_id = ? AND topic_id = ?", learnerId, bookId, topicId);
}

/**
 * The moment mastery is earned, stored once and kept across later practice.
 * Losing mastery clears it so re-earning gets a fresh date. Rows mastered
 * before this timestamp existed stay unset: their real date is unknown, so they
 * must never be credited to a later period.
 */
function earnedMasteryAt(row, result) {
  if (result.status !== "mastered") return null;
  if (row.mastered_at) return row.mastered_at;
  if (row.status === "mastered") return null;
  return now();
}

function writeAssessment(learnerId, bookId, topicId) {
  const row = readRow(learnerId, bookId, topicId);
  if (!row) return null;
  const result = assess(row);
  const masteredAt = earnedMasteryAt(row, result);
  run(
    "UPDATE topic_mastery SET status = ?, progress = ?, mastered_at = ?, decayed_at = ?, updated_at = ? WHERE id = ?",
    result.status,
    result.progress,
    masteredAt,
    row.decayed_at || null,
    now(),
    row.id,
  );
  return { ...row, ...result, mastered_at: masteredAt };
}

function ensureRow(learnerId, bookId, topicId) {
  let row = readRow(learnerId, bookId, topicId);
  if (row) return row;
  const id = uid();
  const ts = now();
  run(
    `INSERT INTO topic_mastery
      (id, learner_id, book_id, topic_id, lessons_started, lessons_completed, activities, accuracy_sum, accuracy_count, application, first_studied_at, last_studied_at, status, progress, updated_at)
     VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?, ?, 'not_started', 0, ?)`,
    id, learnerId, bookId, topicId, ts, ts, ts,
  );
  return readRow(learnerId, bookId, topicId);
}

export function resolveBookTopic(bookId, topicId, text) {
  if (bookId && topicId) {
    const found = findTopic(topicId);
    if (found && (!bookId || found.book.id === bookId)) return found;
  }
  if (text) return topicByText(text);
  return null;
}

/** A lesson exists for this topic. That is "learning", not mastery. */
export function creditTopicStart(learnerId, bookId, topicId) {
  if (!learnerId || !bookId || !topicId || !findTopic(topicId)) return null;
  ensureRow(learnerId, bookId, topicId);
  run(
    "UPDATE topic_mastery SET lessons_started = lessons_started + 1, last_studied_at = ?, updated_at = ? WHERE learner_id = ? AND book_id = ? AND topic_id = ?",
    now(), now(), learnerId, bookId, topicId,
  );
  return writeAssessment(learnerId, bookId, topicId);
}

export function creditLessonCompletion(learnerId, lesson) {
  const ref = resolveBookTopic(lesson.book_id, lesson.topic_id, lesson.topic || lesson.title);
  if (!ref) return null;
  ensureRow(learnerId, ref.book.id, ref.topic.id);
  run(
    `UPDATE topic_mastery SET lessons_completed = lessons_completed + 1, activities = activities + 1, decayed_at = NULL,
       last_studied_at = ?, updated_at = ? WHERE learner_id = ? AND book_id = ? AND topic_id = ?`,
    now(), now(), learnerId, ref.book.id, ref.topic.id,
  );
  return { ...writeAssessment(learnerId, ref.book.id, ref.topic.id), book: ref.book, topic: ref.topic };
}

export function creditQuizAttempt(learnerId, quiz, pct, writtenExplanation) {
  const ref = resolveBookTopic(quiz.book_id, quiz.topic_id, quiz.topic || quiz.title);
  if (!ref) return null;
  ensureRow(learnerId, ref.book.id, ref.topic.id);
  const score = Math.max(0, Math.min(100, Number(pct) || 0));
  run(
    `UPDATE topic_mastery SET activities = activities + 1, accuracy_sum = accuracy_sum + ?, accuracy_count = accuracy_count + 1,
       written_evidence = written_evidence + ?, decayed_at = NULL, last_studied_at = ?, updated_at = ?
     WHERE learner_id = ? AND book_id = ? AND topic_id = ?`,
    score, writtenExplanation ? 1 : 0, now(), now(), learnerId, ref.book.id, ref.topic.id,
  );
  return { ...writeAssessment(learnerId, ref.book.id, ref.topic.id), book: ref.book, topic: ref.topic };
}

/** Expire mastery that has not been revisited in a while, so it can be re-earned. */
export function applyRetentionDecay(learnerId) {
  const cutoff = now() - 1000 * 60 * 60 * 24 * 30;
  const stale = many(
    "SELECT * FROM topic_mastery WHERE learner_id = ? AND status = 'mastered' AND last_studied_at IS NOT NULL AND last_studied_at < ?",
    learnerId, cutoff,
  );
  for (const row of stale) {
    run(
      "UPDATE topic_mastery SET status = 'developing', progress = 84, mastered_at = NULL, decayed_at = ?, updated_at = ? WHERE id = ?",
      now(), now(), row.id,
    );
  }
}

export function masteryRows(learnerId) {
  applyRetentionDecay(learnerId);
  return many("SELECT * FROM topic_mastery WHERE learner_id = ? ORDER BY updated_at DESC", learnerId);
}

function mapRows(rows) {
  const map = new Map();
  for (const row of rows) map.set(masteryKey(row.book_id, row.topic_id), row);
  return map;
}

function decorateTopic(book, topic, row) {
  const result = assess(row);
  return {
    id: topic.id,
    name: topic.name,
    blurb: topic.blurb,
    chapterId: topic.chapterId,
    chapterTitle: topic.chapterTitle,
    status: result.status,
    statusName: MASTERY_MAP[result.status]?.name || "Not started",
    progress: result.progress,
    accuracy: result.accuracy,
    activities: result.activities,
    lessons: result.lessons,
    writtenEvidence: result.writtenEvidence || 0,
    masteredAt: result.masteredAt,
    assessment: result.assessment,
    lastStudiedAt: result.lastStudiedAt,
    bookId: book.id,
  };
}

export function bookWithProgress(learner, book, rows = masteryRows(learner.id), bookmarks = []) {
  const map = mapRows(rows);
  const chapters = book.chapters.map((chapter) => {
    const topics = chapter.topics.map((t) => decorateTopic(book, t, map.get(masteryKey(book.id, t.id))));
    const avg = topics.length ? Math.round(topics.reduce((n, t) => n + t.progress, 0) / topics.length) : 0;
    return {
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      progress: avg,
      mastered: topics.filter((t) => t.status === "mastered").length,
      topics,
    };
  });
  const topics = chapters.flatMap((c) => c.topics);
  const total = topics.length || 1;
  const progress = Math.round(topics.reduce((n, t) => n + t.progress, 0) / total);
  const counts = MASTERY_STATUSES.reduce((acc, s) => ({ ...acc, [s.id]: topics.filter((t) => t.status === s.id).length }), {});
  const mine = bookmarks
    .filter((b) => b.book_id === book.id)
    .map((b) => ({
      id: b.id,
      bookId: b.book_id,
      topicId: b.topic_id,
      topicName: b.topic_id ? findTopic(b.topic_id)?.topic.name || null : null,
      page: b.page,
      label: b.label,
      createdAt: b.created_at,
    }));
  return {
    id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    section: book.section,
    subject: book.subject,
    icon: book.icon,
    color: book.color,
    blurb: book.blurb,
    chapterCount: chapters.length,
    topicCount: topics.length,
    chapters,
    progress,
    counts,
    started: topics.some((t) => t.status !== "not_started"),
    completed: counts.mastered === topics.length && topics.length > 0,
    bookmarks: mine,
  };
}

export function libraryOverview(learner, books = allBooks()) {
  const rows = masteryRows(learner.id);
  const map = mapRows(rows);
  const bookmarks = many("SELECT id, book_id, topic_id, page, label, created_at FROM bookmarks WHERE learner_id = ? ORDER BY created_at DESC", learner.id);
  const decorated = books.map((book) => bookWithProgress(learner, book, rows, bookmarks));
  const byId = Object.fromEntries(decorated.map((b) => [b.id, b]));
  const totals = decorated.reduce(
    (acc, book) => {
      acc.topics += book.topicCount;
      acc.mastered += book.counts.mastered;
      acc.developing += book.counts.developing;
      acc.practicing += book.counts.practicing;
      acc.learning += book.counts.learning;
      if (book.started) acc.startedBooks += 1;
      return acc;
    },
    { topics: 0, mastered: 0, developing: 0, practicing: 0, learning: 0, startedBooks: 0 },
  );
  const sections = SECTIONS.map((section) => {
    const sectionBooks = decorated.filter((b) => b.section === section.id);
    return {
      ...section,
      books: sectionBooks,
      progress: sectionBooks.length ? Math.round(sectionBooks.reduce((n, b) => n + b.progress, 0) / sectionBooks.length) : 0,
      mastered: sectionBooks.reduce((n, b) => n + b.counts.mastered, 0),
      touched: sectionBooks.some((b) => b.started),
    };
  });
  const recent = rows
    .filter((r) => (r.lessons_completed || 0) + (r.activities || 0) > 0)
    .slice(0, 6)
    .map((r) => {
      const ref = findTopic(r.topic_id);
      const result = assess(r);
      return {
        bookId: r.book_id,
        bookTitle: ref?.book.title || getBook(r.book_id)?.title || r.book_id,
        topicId: r.topic_id,
        topicName: ref?.topic.name || "Topic",
        status: result.status,
        statusName: MASTERY_MAP[result.status]?.name,
        progress: result.progress,
        lastStudiedAt: result.lastStudiedAt,
      };
    });
  const bookmarksAll = bookmarks.map((b) => {
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
  return { books: decorated, byId, sections, totals, recent, bookmarks: bookmarksAll, statuses: MASTERY_STATUSES };
}

export function topicDetail(learnerId, bookId, topicId) {
  const ref = findTopic(topicId);
  if (!ref) return null;
  const row = readRow(learnerId, bookId, topicId);
  return {
    book: { id: ref.book.id, title: ref.book.title, color: ref.book.color, icon: ref.book.icon },
    chapter: { id: ref.chapter.id, title: ref.chapter.title },
    topic: ref.topic.name,
    blurb: ref.topic.blurb,
    ...assess(row),
    statusName: MASTERY_MAP[assess(row).status]?.name,
  };
}

const CONNECTIONS = {
  space: { to: "math", text: "Orbital motion is ratios and trigonometry in disguise. A little maths makes the sky readable." },
  math: { to: "space", text: "The maths you practised is the language astronomers use to measure distance and time." },
  finance: { to: "math", text: "Compound interest is a growth pattern; percentages make it visible." },
  business: { to: "finance", text: "A business survives on the ledger. Finance turns enthusiasm into decisions." },
  computing: { to: "math", text: "Every algorithm is logic and counting at speed." },
  gardening: { to: "science", text: "Soil, water and light are a living experiment you can taste." },
  art: { to: "math", text: "Perspective is geometry; colour harmony is ratio and contrast." },
  music: { to: "math", text: "Rhythm is fractions you can hear. Harmony is ratio." },
  geography: { to: "earth", text: "Maps describe what plate tectonics and weather made." },
  history: { to: "civics", text: "Today's institutions are yesterday's arguments still running." },
  bible: { to: "history", text: "Context is a form of respect: history makes the text clearer." },
  languages: { to: "reading", text: "Every new language strengthens the grammar you already use." },
  health: { to: "science", text: "The body is the biology lesson you live in." },
  sports: { to: "health", text: "Training is applied physiology; rest is part of the programme." },
  psychology: { to: "reading", text: "Stories are experiments in other minds." },
  civics: { to: "history", text: "Rights were argued for; knowing how makes them easier to defend." },
  earth: { to: "science", text: "The planet is a chemistry lab with a very long experiment running." },
  reading: { to: "languages", text: "The more languages you meet, the more flexible your own becomes." },
  life: { to: "finance", text: "Practical skills and a budget are the same project: a life that works." },
};

export function connectionFor(bookId) {
  const conn = CONNECTIONS[bookId];
  if (!conn) return null;
  const target = getBook(conn.to);
  return target ? { bookId: target.id, title: target.title, text: conn.text } : null;
}

export function recommendations(learner, limit = 4) {
  const rows = masteryRows(learner.id);
  const map = mapRows(rows);
  const parseList = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return [];
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  };
  const interests = [...parseList(learner.interests), ...parseList(learner.loves)]
    .map((s) => String(s).trim().toLowerCase())
    .filter((s) => s.length >= 3);
  const stopWords = new Set(["with", "from", "that", "this", "study", "learning", "skills", "and", "the"]);
  const terms = [...new Set(interests.flatMap((i) => i.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !stopWords.has(w))))];
  const picks = [];
  const seen = new Set();

  const add = (book, topic, reason) => {
    const key = `${book.id}:${topic.id}`;
    if (seen.has(key) || picks.length >= limit) return;
    seen.add(key);
    const row = map.get(masteryKey(book.id, topic.id));
    const result = assess(row);
    picks.push({
      bookId: book.id,
      bookTitle: book.title,
      bookIcon: book.icon,
      bookColor: book.color,
      section: book.section,
      topicId: topic.id,
      topicName: topic.name,
      chapterTitle: topic.chapterTitle,
      status: result.status,
      statusName: MASTERY_MAP[result.status]?.name,
      progress: result.progress,
      reason,
    });
  };

  // 1. Finish what is nearly there, but only as an invitation.
  const near = rows
    .filter((r) => r.status === "developing" || r.status === "practicing")
    .sort((a, b) => (b.progress || 0) - (a.progress || 0));
  for (const row of near) {
    const ref = findTopic(row.topic_id);
    if (ref) add(ref.book, ref.topic, "You were close here — one more strong pass could settle it.");
  }

  // 2. Interests, then a continuation of any started book.
  for (const book of allBooks()) {
    if (picks.length >= limit) break;
    const haystack = `${book.title} ${book.blurb} ${book.topics.map((t) => t.name).join(" ")}`.toLowerCase();
    const match = terms.find((term) => haystack.includes(term));
    if (!match) continue;
    const topic = book.topics.find((t) => assess(map.get(masteryKey(book.id, t.id))).status === "not_started");
    if (topic) add(book, topic, `This shelf touches something you already enjoy: ${match}.`);
  }
  for (const book of allBooks()) {
    if (picks.length >= limit) break;
    const hasStarted = book.topics.some((t) => assess(map.get(masteryKey(book.id, t.id))).status !== "not_started");
    if (!hasStarted) continue;
    const topic = book.topics.find((t) => assess(map.get(masteryKey(book.id, t.id))).status === "not_started");
    if (topic) add(book, topic, "The next page in a book you have already opened.");
  }
  // 3. A genuinely new shelf.
  for (const book of allBooks()) {
    if (picks.length >= limit) break;
    if (book.topics.some((t) => assess(map.get(masteryKey(book.id, t.id))).status !== "not_started")) continue;
    add(book, book.topics[0], "A new shelf, unexplored. No obligation — just an open door.");
  }
  return picks;
}

const COMPANION_LINES = [
  "The Library rearranges itself around curiosity. Follow the shelf that keeps catching your eye.",
  "You do not have to read in a straight line here. Wander, then come back and tell me what you noticed.",
  "Knowledge compounds. One honest page today is worth more than a perfect plan tomorrow.",
  "If a book feels heavy, we can split it into smaller rooms. That is what I am for.",
  "The quietest shelves often hold the ideas that stay with you longest.",
  "You are allowed to read ahead. You are also allowed to reread. Both count.",
];

export function companion(learner, limit = 3) {
  const picks = recommendations(learner, limit);
  const rowCount = one("SELECT COUNT(*) AS c FROM topic_mastery WHERE learner_id = ?", learner.id)?.c || 0;
  const line = COMPANION_LINES[(rowCount + String(learner.id).charCodeAt(0)) % COMPANION_LINES.length];
  const connection = picks[0] ? connectionFor(picks[0].bookId) : connectionFor("math");
  return {
    name: learner.tutor_name || "Aster",
    line,
    connection,
    recommendations: picks,
  };
}

export function sectionsTouched(learnerId) {
  const rows = many("SELECT DISTINCT book_id FROM topic_mastery WHERE learner_id = ?", learnerId);
  const sections = new Set();
  for (const row of rows) {
    const book = getBook(row.book_id);
    if (book) sections.add(book.section);
  }
  return sections;
}

export function masteryStats(learnerId) {
  const rows = masteryRows(learnerId);
  const counts = { not_started: 0, learning: 0, practicing: 0, developing: 0, mastered: 0 };
  for (const row of rows) {
    const status = assess(row).status;
    counts[status] = (counts[status] || 0) + 1;
  }
  const started = rows.filter((r) => assess(r).status !== "not_started").length;
  return {
    touched: started,
    counts,
    mastered: counts.mastered,
    inProgress: counts.learning + counts.practicing + counts.developing,
    sections: sectionsTouched(learnerId).size,
  };
}
