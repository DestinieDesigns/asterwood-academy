/**
 * Daily and weekly accountability reports.
 *
 * A report is derived at read time from real records — completed lessons,
 * graded attempts, activity, mastery evidence, assignments and scheduled
 * sessions. Nothing here is estimated from clicks, and no report is stored,
 * so it can never disagree with the underlying learning data.
 *
 * Reports are deliberately blunt about commitments but never punitive: a
 * missed day is information, not a punishment, and the next step is always
 * something small and concrete.
 */
import { many, todayKey } from "./db.js";
import { assess, applyRetentionDecay } from "./progress.js";
import { findTopic, getBook } from "./library.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MINUTES_PER_ATTEMPT = 3;

const pad = (n) => String(n).padStart(2, "0");

function startOfKey(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

function keyOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftKey(key, days) {
  const date = new Date(startOfKey(key));
  date.setDate(date.getDate() + days);
  return keyOf(date);
}

function mondayOf(key) {
  const date = new Date(startOfKey(key));
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return keyOf(date);
}

function diffDays(fromKey, toKey) {
  return Math.round((startOfKey(toKey) - startOfKey(fromKey)) / 86400000);
}

function longDate(key) {
  return new Date(startOfKey(key)).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function shortDate(key) {
  return new Date(startOfKey(key)).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function rangeLabel(startKey, endKey) {
  return startKey === endKey ? longDate(startKey) : `${shortDate(startKey)} – ${shortDate(endKey)}`;
}

const DAILY_STATUS = {
  met: { label: "Goal met", tone: "teal" },
  partial: { label: "In progress", tone: "amber" },
  missed: { label: "Missed", tone: "pink" },
  open: { label: "Still open", tone: "muted" },
};

const WEEKLY_STATUS = {
  on_track: { label: "On track", tone: "teal" },
  needs_attention: { label: "Needs attention", tone: "amber" },
  behind: { label: "Behind", tone: "pink" },
  open: { label: "Not started", tone: "muted" },
};

function localNowKeyTotal() {
  const d = new Date();
  return `${keyOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function studyMinutes(lessons, attempts) {
  return lessons.reduce((n, l) => n + (Number(l.duration) || 0), 0) + attempts.length * MINUTES_PER_ATTEMPT;
}

/**
 * Build one report. `period` is "daily" or "weekly"; `requestedKey` is a
 * YYYY-MM-DD date inside the period, defaulting to today.
 */
export function buildReport(learner, period = "daily", requestedKey) {
  // Reports are a read surface like the dashboard: mastery that has gone stale
  // must lapse here too, so an idle learner's old mastery is never presented as
  // current to a parent who opens the overview first.
  applyRetentionDecay(learner.id);
  const weekly = period === "weekly";
  const today = todayKey();
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(String(requestedKey || "")) ? requestedKey : today;
  const startKey = weekly ? mondayOf(anchor) : anchor;
  const endKey = weekly ? shiftKey(startKey, 6) : startKey;
  const start = startOfKey(startKey);
  const end = startOfKey(shiftKey(endKey, 1));
  const countedEndKey = endKey < today ? endKey : today;
  const elapsedDays = weekly ? Math.max(0, diffDays(startKey, countedEndKey) + 1) : startKey <= today ? 1 : 0;
  const goal = Math.max(5, Number(learner.daily_goal) || 20);
  const target = goal * (weekly ? Math.max(1, elapsedDays) : 1);
  const fullTarget = weekly ? goal * 7 : goal;

  const lessons = many(
    "SELECT id, title, subject, topic, duration, updated_at FROM lessons WHERE learner_id = ? AND status = 'completed' AND updated_at >= ? AND updated_at < ? ORDER BY updated_at ASC",
    learner.id, start, end,
  );
  const attempts = many(
    "SELECT a.id, a.score, a.total, a.created_at, q.title, q.subject, q.topic FROM attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE a.learner_id = ? AND a.created_at >= ? AND a.created_at < ? ORDER BY a.created_at ASC",
    learner.id, start, end,
  );
  const activity = many(
    "SELECT kind, detail, xp, created_at FROM activity WHERE learner_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at ASC",
    learner.id, start, end,
  );
  const mastery = many("SELECT * FROM topic_mastery WHERE learner_id = ?", learner.id);
  // Mastery is credited only to the period it was earned in. A topic that was
  // already mastered and was merely practised again is retention, not new
  // mastery, so it goes in its own bucket. Rows with no earned date are legacy
  // mastery: they can be reported as already mastered, never as newly earned.
  const masteredRows = mastery.filter((row) => assess(row).status === "mastered");
  const masteredInRange = masteredRows.filter((row) => (row.mastered_at || 0) >= start && (row.mastered_at || 0) < end);
  const retainedInRange = masteredRows.filter(
    (row) => (!row.mastered_at || row.mastered_at < start) && (row.last_studied_at || 0) >= start && (row.last_studied_at || 0) < end,
  );
  const touchedInRange = mastery.filter((row) => (row.last_studied_at || 0) >= start && (row.last_studied_at || 0) < end);

  // Commitments are current state, not period state: they are why a report
  // exists. Completed assignments have no completion timestamp, so we never
  // claim a period count for them.
  const assignments = many(
    "SELECT id, kind, title, due_at, status FROM assignments WHERE learner_id = ? ORDER BY COALESCE(due_at, '9999') ASC",
    learner.id,
  );
  const openAssignments = assignments.filter((a) => a.status === "assigned");
  const overdue = openAssignments.filter((a) => a.due_at && a.due_at < today);
  const dueInRange = openAssignments.filter((a) => a.due_at && a.due_at >= startKey && a.due_at <= endKey);

  const localNow = localNowKeyTotal();
  const sessions = many("SELECT id, title, start_at, minutes, done FROM schedule WHERE learner_id = ?", learner.id);
  const sessionsInRange = sessions.filter((s) => {
    const dayPart = String(s.start_at || "").slice(0, 10);
    return dayPart >= startKey && dayPart <= endKey;
  });
  const sessionsKept = sessionsInRange.filter((s) => s.done);
  const missedSessions = sessions.filter((s) => !s.done && s.start_at < localNow);
  const upcomingSessions = sessions.filter((s) => !s.done && s.start_at >= localNow).slice(0, 3);

  const minutes = studyMinutes(lessons, attempts);
  const correct = attempts.reduce((n, a) => n + (Number(a.score) || 0), 0);
  const questions = attempts.reduce((n, a) => n + (Number(a.total) || 0), 0);
  const accuracy = questions ? Math.round((correct / questions) * 100) : null;
  const xpEarned = activity.reduce((n, a) => n + (Number(a.xp) || 0), 0);
  const activeDays = new Set(activity.map((a) => new Date(a.created_at).toDateString())).size;
  const masteredNames = masteredInRange.map((row) => masteryName(row)).filter(Boolean);
  const retainedNames = retainedInRange.map((row) => masteryName(row)).filter(Boolean);
  const nearMissed = mastery.filter((row) => {
    const result = assess(row);
    return result.status === "developing" && !(row.written_evidence > 0);
  });
  const lapsed = mastery.filter((row) => row.decayed_at);
  const lapsedNames = lapsed.map((row) => masteryName(row)).filter(Boolean);

  const days = [];
  const dayCount = weekly ? 7 : 1;
  for (let i = 0; i < dayCount; i++) {
    const key = shiftKey(startKey, i);
    const dayStart = startOfKey(key);
    const dayEnd = startOfKey(shiftKey(key, 1));
    const dayLessons = lessons.filter((l) => l.updated_at >= dayStart && l.updated_at < dayEnd);
    const dayAttempts = attempts.filter((a) => a.created_at >= dayStart && a.created_at < dayEnd);
    const dayActivity = activity.filter((a) => a.created_at >= dayStart && a.created_at < dayEnd);
    const dayMinutes = studyMinutes(dayLessons, dayAttempts);
    days.push({
      date: key,
      weekday: WEEKDAYS[new Date(dayStart).getDay()],
      label: shortDate(key),
      minutes: dayMinutes,
      lessons: dayLessons.length,
      attempts: dayAttempts.length,
      active: dayActivity.length > 0,
      goalMet: dayMinutes >= goal,
      future: key > today,
      isToday: key === today,
    });
  }
  const goalMetDays = days.filter((d) => !d.future && d.goalMet).length;

  const goalPct = target ? Math.min(100, Math.round((minutes / target) * 100)) : 0;

  let status;
  let statusMap;
  if (weekly) {
    statusMap = WEEKLY_STATUS;
    if (!elapsedDays) status = "open";
    else if (overdue.length) status = "needs_attention";
    else if (goalPct >= 70 && (goalMetDays >= 4 || activeDays >= 5)) status = "on_track";
    else if (goalPct >= 35 || activeDays >= 2) status = "needs_attention";
    else status = "behind";
  } else {
    statusMap = DAILY_STATUS;
    const studied = lessons.length + attempts.length > 0;
    const showedUp = activity.length > 0;
    if (!studied && !showedUp) status = startKey < today ? "missed" : "open";
    else if (minutes >= goal) status = "met";
    else status = "partial";
  }

  const firstName = String(learner.name || "Your learner").split(" ")[0];
  const tutorName = learner.tutor_name || "Aster";
  const lessonMinutes = lessons.reduce((n, l) => n + (Number(l.duration) || 0), 0);

  const headline = weekly
    ? status === "on_track"
      ? `${firstName} is on track this week.`
      : status === "needs_attention"
        ? `${firstName} needs a nudge this week.`
        : status === "behind"
          ? `${firstName} has fallen behind this week.`
          : "This week is still open."
    : status === "met"
      ? `${firstName} met the daily goal.`
      : status === "partial"
        ? `${firstName} is ${Math.max(1, goal - minutes)} minutes short of the goal.`
        : status === "missed"
          ? `No study was recorded on this day.`
          : "Today's report is still open.";

  const summaryParts = [];
  summaryParts.push(
    `${lessons.length} lesson${lessons.length === 1 ? "" : "s"} completed${lessonMinutes ? ` (${lessonMinutes} min)` : ""}`,
  );
  summaryParts.push(`${attempts.length} assessment${attempts.length === 1 ? "" : "s"}${accuracy != null ? ` at ${accuracy}%` : ""}`);
  if (masteredNames.length) summaryParts.push(`${masteredNames.length} topic${masteredNames.length === 1 ? "" : "s"} newly mastered`);
  if (weekly) summaryParts.push(`${activeDays} active day${activeDays === 1 ? "" : "s"} of ${Math.max(1, elapsedDays)} so far`);
  const summary = `${summaryParts.join(", ")}. ${minutes} of ${target} minutes recorded.`;

  const note =
    status === "met" || status === "on_track"
      ? `${firstName} did the work. That is the only evidence that counts — keep the same gentle pace.`
      : status === "partial" || status === "needs_attention"
        ? `${firstName} showed up, but the commitment is not finished yet. A short, honest session now is worth more than a long one later.`
        : status === "missed" || status === "behind"
          ? `This is information, not a punishment. Pick one small thing — ten minutes counts — and put it on the schedule today.`
          : `${firstName} still has the day ahead. One lesson or one practice set is enough to make this report honest.`;

  const wins = [];
  if (lessons.length) wins.push(`Completed ${lessons.length} lesson${lessons.length === 1 ? "" : "s"}${lessonMinutes ? ` for ${lessonMinutes} minutes` : ""}.`);
  if (attempts.length) wins.push(`Answered ${questions} assessment question${questions === 1 ? "" : "s"}${accuracy != null ? ` with ${accuracy}% correct` : ""}.`);
  for (const name of masteredNames.slice(0, 3)) wins.push(`Reached Mastered on ${name}, including graded written evidence.`);
  if (weekly && goalMetDays >= 2) wins.push(`Met the daily goal on ${goalMetDays} day${goalMetDays === 1 ? "" : "s"}.`);
  if (!weekly && status === "met") wins.push(`Reached the ${goal}-minute daily goal.`);
  if (sessionsKept.length) wins.push(`Kept ${sessionsKept.length} scheduled session${sessionsKept.length === 1 ? "" : "s"}.`);
  if (!lessons.length && !attempts.length && days.some((d) => d.active)) wins.push("Opened Asterwood and did some learning work.");
  if (retainedNames.length) wins.push(`Practised ${retainedNames.length} topic${retainedNames.length === 1 ? "" : "s"} already mastered — retention, not new mastery${retainedNames.length <= 3 ? ` (${retainedNames.join(", ")})` : ""}.`);
  if (!wins.length) wins.push("A blank report is a clean start, not a verdict.");

  const concerns = [];
  if (overdue.length) concerns.push(`${overdue.length} overdue assignment${overdue.length === 1 ? "" : "s"}: ${overdue.slice(0, 3).map((a) => a.title).join("; ")}.`);
  if (missedSessions.length) concerns.push(`${missedSessions.length} scheduled session${missedSessions.length === 1 ? "" : "s"} passed without a check-in.`);
  if (weekly && elapsedDays >= 3 && activeDays <= 1) concerns.push(`Only ${activeDays} active day${activeDays === 1 ? "" : "s"} in ${elapsedDays} days so far.`);
  if (accuracy != null && accuracy < 85 && attempts.length >= 2) concerns.push(`Assessment accuracy is ${accuracy}%, below the 85% mastery mark.`);
  if (nearMissed.length) {
    const names = nearMissed.slice(0, 2).map((row) => masteryName(row) || "a topic").join(", ");
    concerns.push(`${names} still need${nearMissed.length === 1 ? "s" : ""} a graded written explanation before it can count as Mastered.`);
  }
  if (lapsedNames.length) {
    concerns.push(`Mastery lapsed on ${lapsedNames.slice(0, 2).join(", ")} after a month without study. The evidence is kept; a fresh graded pass re-earns it.`);
  }
  if (!weekly && status === "partial") concerns.push(`The daily goal is ${goal - minutes} minute${goal - minutes === 1 ? "" : "s"} away.`);
  if (weekly && status === "behind") concerns.push(`Study time is ${goalPct}% of the pace needed for this week.`);

  const nextSteps = [];
  if (overdue.length) {
    nextSteps.push({ title: "Clear the overdue work first", detail: overdue[0].title, to: "/family", tone: "urgent" });
  }
  const nextLesson = many(
    "SELECT id, title FROM lessons WHERE learner_id = ? AND status = 'in_progress' ORDER BY updated_at DESC LIMIT 1",
    learner.id,
  )[0];
  if (nextLesson) nextSteps.push({ title: `Finish "${nextLesson.title}"`, detail: "It is already half-done; finishing is the cheapest win available.", to: `/lessons/${nextLesson.id}` });
  if (nearMissed.length) {
    nextSteps.push({
      title: "Explain one topic in your own words",
      detail: `${masteryName(nearMissed[0]) || "A developing topic"} is waiting on a written explanation that is graded correct.`,
      to: nearMissed[0].book_id ? `/world/${nearMissed[0].book_id}?topic=${encodeURIComponent(nearMissed[0].topic_id)}` : "/world",
    });
  }
  if (lapsed.length) {
    nextSteps.push({
      title: `Re-earn ${lapsedNames[0] || "a lapsed topic"}`,
      detail: "Mastery lapsed after a month without study. One graded lesson or assessment restores it.",
      to: lapsed[0].book_id ? `/world/${lapsed[0].book_id}?topic=${encodeURIComponent(lapsed[0].topic_id)}` : "/world",
    });
  }
  if (!nextLesson && (status === "partial" || status === "missed" || status === "behind" || status === "needs_attention")) {
    nextSteps.push({ title: `Book ${Math.min(20, Math.max(10, goal))} minutes today`, detail: "A scheduled session is a promise you make to yourself.", to: "/schedule" });
  }
  if (!nextSteps.length) nextSteps.push({ title: "Choose the next page", detail: "Open the Library and pick a topic that looks interesting.", to: "/world" });

  const commitments = [];
  commitments.push({
    key: "goal",
    kind: "goal",
    label: weekly ? `${goal}-minute daily goal, ${goalMetDays} of ${Math.max(1, elapsedDays)} days met` : `${goal}-minute study goal`,
    detail: `${minutes} of ${target} minutes recorded`,
    done: minutes >= target,
    tone: minutes >= target ? "teal" : "amber",
  });
  for (const a of openAssignments.slice(0, 4)) {
    const isOverdue = Boolean(a.due_at && a.due_at < today);
    commitments.push({
      key: `assignment-${a.id}`,
      kind: "assignment",
      label: a.title,
      detail: a.due_at ? `${isOverdue ? "Was due" : "Due"} ${longDate(a.due_at.slice(0, 10))}` : "No due date — still counts as open work",
      done: false,
      tone: isOverdue ? "pink" : a.due_at && a.due_at <= shiftKey(today, 3) ? "amber" : "muted",
    });
  }
  for (const s of sessionsInRange.slice(0, 4)) {
    const day = String(s.start_at || "").slice(0, 10);
    const missed = !s.done && s.start_at < localNow;
    commitments.push({
      key: `session-${s.id}`,
      kind: "session",
      label: s.title,
      detail: `${missed ? "Missed" : s.done ? "Kept" : "Planned"} · ${day ? longDate(day) : ""}`,
      done: Boolean(s.done),
      tone: missed ? "pink" : s.done ? "teal" : "muted",
    });
  }

  return {
    period: weekly ? "weekly" : "daily",
    periodKey: startKey,
    anchor,
    label: weekly ? "This week" : startKey === today ? "Today" : longDate(startKey),
    range: { start: startKey, end: endKey, label: rangeLabel(startKey, endKey), fullTarget, elapsedDays },
    status,
    statusLabel: statusMap[status]?.label || "",
    tone: statusMap[status]?.tone || "muted",
    headline,
    summary,
    note: { author: tutorName, text: note },
    goal: { minutes, target, fullTarget, pct: goalPct, met: minutes >= target, dailyGoal: goal },
    metrics: {
      minutes,
      lessons: lessons.length,
      lessonMinutes,
      attempts: attempts.length,
      correct,
      questions,
      accuracy,
      xpEarned,
      activeDays,
      goalMetDays,
      mastered: masteredInRange.length,
      alreadyMastered: retainedInRange.length,
      masteredTotal: masteredRows.length,
      topicsStudied: touchedInRange.length,
      assignmentsOpen: openAssignments.length,
      overdue: overdue.length,
      sessionsKept: sessionsKept.length,
      sessionsMissed: missedSessions.length,
      streak: learner.streak || 0,
    },
    days,
    wins,
    concerns,
    nextSteps: nextSteps.slice(0, 3),
    commitments,
    overdue,
    dueInRange,
    upcomingSessions,
    mastered: masteredNames,
    retained: retainedNames,
    learner: { id: learner.id, name: learner.name, tutorName },
  };
}

function masteryName(row) {
  const ref = findTopic(row.topic_id);
  if (!ref) return prettyTopic(row.topic_id);
  const book = ref.book?.title || getBook(row.book_id)?.title;
  return book ? `${ref.topic.name} (${book})` : ref.topic.name;
}

function prettyTopic(topicId) {
  const text = String(topicId || "").split(":").pop() || "";
  return text
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "a topic";
}

function compact(report) {
  return {
    period: report.period,
    periodKey: report.periodKey,
    anchor: report.anchor,
    label: report.label,
    rangeLabel: report.range.label,
    status: report.status,
    statusLabel: report.statusLabel,
    tone: report.tone,
    minutes: report.metrics.minutes,
    target: report.goal.target,
    lessons: report.metrics.lessons,
    attempts: report.metrics.attempts,
    accuracy: report.metrics.accuracy,
    mastered: report.metrics.mastered,
    activeDays: report.metrics.activeDays,
    pct: report.goal.pct,
  };
}

/** Everything the Reports page needs in one request. */
export function reportOverview(learner, requestedKey) {
  const today = todayKey();
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(String(requestedKey || "")) ? requestedKey : today;
  const daily = buildReport(learner, "daily", anchor);
  const weekly = buildReport(learner, "weekly", anchor);

  const dailyHistory = [];
  for (let i = 6; i >= 0; i--) dailyHistory.push(compact(buildReport(learner, "daily", shiftKey(anchor, -i))));

  const thisWeek = mondayOf(anchor);
  const weeklyHistory = [];
  for (let i = 5; i >= 0; i--) weeklyHistory.push(compact(buildReport(learner, "weekly", shiftKey(thisWeek, -7 * i))));

  return {
    learner: { id: learner.id, name: learner.name, tutorName: learner.tutor_name || "Aster", dailyGoal: Math.max(5, Number(learner.daily_goal) || 20) },
    today,
    anchor,
    daily,
    weekly,
    history: { daily: dailyHistory, weekly: weeklyHistory },
    openItems: daily.commitments.filter((c) => !c.done).length,
  };
}

/** Short version used by the dashboard so accountability is always visible. */
export function dailyBrief(learner) {
  const report = buildReport(learner, "daily");
  return {
    status: report.status,
    statusLabel: report.statusLabel,
    tone: report.tone,
    headline: report.headline,
    minutes: report.metrics.minutes,
    target: report.goal.target,
    pct: report.goal.pct,
    nextStep: report.nextSteps[0] || null,
    openItems: report.commitments.filter((c) => !c.done).length,
    overdue: report.metrics.overdue,
    missing: report.concerns.slice(0, 2),
  };
}
