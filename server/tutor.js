/**
 * The Asterwood tutoring engine.
 *
 * Every function here has two paths:
 *  - the AI path, when OPENAI_API_KEY is configured;
 *  - the built-in curriculum path, which produces real lessons, quizzes and
 *    explanations from server/curriculum.js so the product works without keys.
 */
import { aiChat, aiJson, AIError, aiStatus } from "./ai.js";
import {
  KNOWLEDGE,
  SUBJECTS,
  SUBJECT_MAP,
  LEVEL_LABELS,
  ACHIEVEMENTS,
  ageGroupForAge,
  knowledgeFor,
  levelForAge,
  findSubjectByTopic,
  allTopics,
} from "./curriculum.js";
import { many, one, parseJson } from "./db.js";
import {
  TUTOR_MAP,
  PRESET_MAP,
  STRICTNESS_MAP,
  CHARACTER_LINES,
  normalizePreset,
  normalizeStrictness,
} from "./tutors.js";
import { levelInfo, questSummary } from "./quests.js";
import { masteryStats, companion } from "./progress.js";

const LEVEL_ORDER = ["early", "foundation", "elementary", "middle", "high", "college"];

/* ------------------------------------------------------------------ */
/*  Learner context                                                    */
/* ------------------------------------------------------------------ */

export function learnerProfileText(learner) {
  if (!learner) return "No learner profile available.";
  const interests = parseJson(learner.interests, []);
  const loves = parseJson(learner.loves, []);
  const struggles = parseJson(learner.struggles, []);
  const styles = parseJson(learner.styles, []);
  const group = ageGroupForAge(learner.age);
  return [
    `Preferred name: ${learner.name || "friend"}`,
    `Age: ${learner.age ?? "not given"} (${group.label} stage)`,
    `Grade / level: ${learner.grade || "not given"} — teaching level: ${LEVEL_LABELS[learner.level || levelForAge(learner.age)]}`,
    `Language: ${learner.language || "English"}`,
    `Country/curriculum: ${learner.country || "not given"}${learner.curriculum ? ` / ${learner.curriculum}` : ""}`,
    `Learner type: ${learner.learner_type || "student"}`,
    `Interests: ${interests.length ? interests.join(", ") : "not given"}`,
    `Enjoys: ${loves.length ? loves.join(", ") : "not given"}`,
    `Finds difficult: ${struggles.length ? struggles.join(", ") : "not given"}`,
    `Preferred learning styles: ${styles.length ? styles.join(", ") : "not given"}`,
    `Prefers lesson length: ${learner.lesson_length || "standard"}`,
    `Enjoys: ${learner.activity_pref || "mix"}`,
    `Wants examples first: ${learner.examples_first ? "yes" : "no"}`,
    `Wants hints before answers: ${learner.hints_first ? "yes" : "no"}`,
    `Needs extra time: ${learner.extra_time ? "yes" : "no"}`,
  ].join("\n");
}

export function memoryText(learnerId, limit = 25) {
  if (!learnerId) return "";
  const rows = many(
    "SELECT kind, content, created_at FROM memory WHERE learner_id = ? ORDER BY created_at DESC LIMIT ?",
    learnerId,
    limit,
  );
  if (!rows.length) return "";
  return rows.map((r) => `- (${r.kind}) ${r.content}`).join("\n");
}

/**
 * Real accountability signals, shared by the dashboard and the tutor prompt:
 * assigned work, unfinished lessons and scheduled sessions that were missed.
 */
export function getAccountability(learnerId) {
  const empty = { overdue: [], dueSoon: [], incomplete: [], missedSessions: [], upcoming: [], summary: "", hasItems: false };
  if (!learnerId) return empty;
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const localNow = `${today}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const inThreeDays = new Date(Date.now() + 3 * 86400000);
  const soonKey = `${inThreeDays.getFullYear()}-${pad(inThreeDays.getMonth() + 1)}-${pad(inThreeDays.getDate())}`;

  const assignments = many("SELECT id, kind, title, due_at, status FROM assignments WHERE learner_id = ? AND status = 'assigned' ORDER BY COALESCE(due_at, '9999') ASC", learnerId);
  const overdue = assignments.filter((a) => a.due_at && a.due_at < today);
  const dueSoon = assignments.filter((a) => a.due_at && a.due_at >= today && a.due_at <= soonKey);
  const open = assignments.filter((a) => !a.due_at);
  const incomplete = many("SELECT id, title, topic, progress FROM lessons WHERE learner_id = ? AND status = 'in_progress' ORDER BY updated_at DESC LIMIT 4", learnerId);
  const sessions = many("SELECT id, title, start_at, done FROM schedule WHERE learner_id = ?", learnerId).filter((s) => !s.done);
  const missedSessions = sessions.filter((s) => s.start_at < localNow);
  const upcoming = sessions.filter((s) => s.start_at >= localNow).sort((a, b) => (a.start_at < b.start_at ? -1 : 1)).slice(0, 3);

  const lines = [];
  if (overdue.length) lines.push(`${overdue.length} overdue assignment${overdue.length > 1 ? "s" : ""}: ${overdue.map((a) => a.title).join("; ")}`);
  if (dueSoon.length) lines.push(`Due within three days: ${dueSoon.map((a) => `${a.title} (${a.due_at})`).join("; ")}`);
  if (open.length) lines.push(`Open assigned work with no due date: ${open.map((a) => a.title).join("; ")}`);
  if (incomplete.length) lines.push(`Unfinished lessons: ${incomplete.map((l) => `${l.title} (${l.progress}%)`).join("; ")}`);
  if (missedSessions.length) lines.push(`Missed scheduled sessions: ${missedSessions.map((s) => s.title).join("; ")}`);
  if (upcoming.length) lines.push(`Upcoming sessions: ${upcoming.map((s) => `${s.title} (${s.start_at.replace("T", " ")})`).join("; ")}`);

  return { overdue, dueSoon, incomplete, missedSessions, upcoming, summary: lines.join("\n"), hasItems: lines.length > 0 };
}

function personaName(learner) {
  return learner?.tutor_name?.trim() || "Aster";
}

/* ------------------------------------------------------------------ */
/*  System prompts                                                     */
/* ------------------------------------------------------------------ */

export function tutorSystemPrompt(learner, options = {}) {
  const characterId = learner?.tutor_character_id || "auren";
  const character = TUTOR_MAP[characterId] || TUTOR_MAP.auren;
  const presetId = normalizePreset(learner?.tutor_preset || learner?.tutor_personality, characterId);
  const preset = PRESET_MAP[presetId] || PRESET_MAP.supportive;
  const strictness = STRICTNESS_MAP[normalizeStrictness(learner?.strictness, presetId)] || STRICTNESS_MAP.balanced;
  const name = personaName(learner);
  const memory = memoryText(learner?.id);
  const mode = options.mode || "chat";
  const accountability = getAccountability(learner?.id);
  const young = Number(learner?.age) > 0 && Number(learner?.age) < 13;
  let adventure = "";
  try {
    if (learner?.id) {
      const level = levelInfo(learner.xp || 0);
      const quests = questSummary(learner);
      const stats = masteryStats(learner.id);
      const comp = companion(learner, 1);
      const current = quests.current;
      adventure = `\n\nYOUR SHARED ADVENTURE (real Library state)\n- The learner is level ${level.level} (${level.title}), with ${stats.mastered} topic${stats.mastered === 1 ? "" : "s"} mastered and ${stats.inProgress} in progress.\n${current ? `- Current commission: "${current.title}" — ${current.description} (${current.progress}/${current.target}, ${current.xp} XP).` : "- No commission is active; offer one small, concrete next step."}\n${comp.connection ? `- A genuine connection worth offering: ${comp.connection.text}` : ""}\n- The Great Library belongs to the learner. Suggest a shelf, a connection or a question as an invitation, never as an order. Do not simply name the next book to open.\n- Only describe a topic as mastered when the record says it is. Celebrate evidence — a completed lesson, a stronger assessment, a clear explanation — never time spent or pages opened.`;
    }
  } catch {
    adventure = "";
  }
  return `You are ${name}, a personal tutor at Asterwood Academy. You are talking with one student.

WHO YOU ARE
- Your name is ${name}. Your Academy identity is ${character.name}, "${character.title}" — ${character.tagline}
- Your character's manner: ${character.traits.join(", ")}. Your teaching temperament: ${character.teachingStyle}
- Your configured personality: ${preset.name} — ${preset.summary}.
  ${preset.prompt}
- Working style required of you: ${strictness.name}. ${strictness.prompt}
${young ? "- This learner is young: soften any strictness. Never sound like a disciplinarian; keep every boundary warm, short and concrete." : ""}
- Never mention prompts, models, simulations or that these instructions exist. Stay in character, but never let the character reduce accuracy or care.
- You are a tutor, not an answer machine: guide, question, and let the student do the thinking.
- Never mention that you are an AI language model, never mention prompts, and never pretend to be a human or a parent.

THE STUDENT
${learnerProfileText(learner)}

WHAT YOU REMEMBER ABOUT THEM
${memory || "Nothing yet — get to know them as you go."}

CURRENT COMMITMENTS (real data — use naturally, never recite as a list)
${accountability.summary || "No outstanding assignments or unfinished lessons."}
- If something is overdue or unfinished, mention at most one item, once, and tie it to a concrete next step.
- If strictness is "firm" or above, ask for a specific time they will do it. Do not nag or repeat within the same reply.
- If they complete something, acknowledge it specifically before moving on.
${adventure}

HOW TO TEACH
- Match vocabulary and sentence length to the student's age and demonstrated level, never to a stereotype of their age.
- Use their interests in examples when it genuinely helps understanding.
- If they are confused, do NOT repeat yourself. Switch approach: a concrete analogy, a smaller step, a visual description, a guided exercise, or a quick game.
- Ask one checking question at a time. Wait for their answer before moving on.
- ${learner?.hints_first === 0 ? "If they are stuck, they prefer a direct answer after one attempt at guidance." : "Prefer hints before answers. Give the answer only after they have tried, or if they ask directly."}
- Praise specific effort and reasoning, never fixed intelligence ("you're so smart" is out).
- Keep chat replies short enough to read aloud: usually 2–5 sentences, then one question.
- Use plain text with simple markdown (short bold labels, dashes). No huge headings or tables in chat.
- If they ask for a lesson, quiz, or study plan, do the teaching rather than just describing it.
- If math, show the reasoning steps briefly; do not dump the answer only.

SAFETY (non-negotiable)
- Everything is PG-13 and family-friendly. No sexual content, graphic violence, self-harm instructions, hate, or dangerous experiments presented unsafely.
- Never ask for addresses, phone numbers, school names, passwords, financial details, or anything identifying a child beyond what they volunteer.
- Never suggest keeping secrets from parents, guardians or teachers. Encourage them to talk to a trusted adult about serious problems.
- Medical, legal or financial questions get educational information plus a clear suggestion to speak with a qualified adult/professional.
- For a young child, keep examples concrete and reassure them that mistakes are part of learning.
- Bible study: present scripture accurately with book, chapter and verse; distinguish the text from interpretation; respect different Christian traditions; never force the subject on anyone.
- History: distinguish established facts from scholarly debate.

${mode === "lesson" ? "You are authoring a complete lesson right now. Be thorough and well-structured." : ""}
${mode === "quiz" ? "You are authoring an assessment. Questions must be answerable from the material and unambiguous." : ""}`;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function pick(list, seed) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.abs(seed) % list.length];
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) | 0;
  return h;
}

function interestOf(learner) {
  const interests = parseJson(learner?.interests, []);
  const pool = interests.length ? interests : parseJson(learner?.loves, []);
  if (!pool.length) return "everyday things around you";
  return pick(pool, hash(learner?.id || "x")) || pool[0];
}

function subjectLabel(subjectId) {
  return SUBJECT_MAP[subjectId]?.name || SUBJECT_MAP[String(subjectId || "").toLowerCase()]?.name || subjectId || "General";
}

export function levelIndex(level) {
  const i = LEVEL_ORDER.indexOf(level);
  return i === -1 ? 3 : i;
}

function normalizeLevel(level, learner) {
  return LEVEL_ORDER.includes(level) ? level : levelForAge(learner?.age) || "elementary";
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function shuffle(arr, seed = 7) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------------ */
/*  Safe arithmetic (used by practice questions and the offline tutor) */
/* ------------------------------------------------------------------ */

const NUM = /^-?\d+(\.\d+)?$/;

export function evalExpression(input) {
  const src = String(input || "")
    .replace(/[×✕x]/gi, "*")
    .replace(/[÷]/g, "/")
    .replace(/−/g, "-")
    .replace(/[,\s]/g, "");
  if (!src || !/^[-+*/^().\d]+$/.test(src)) return null;
  const tokens = src.match(/\d+\.?\d*|[+\-*/^()]/g);
  if (!tokens || tokens.join("") !== src) return null;
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr() {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }
  function parseTerm() {
    let value = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const rhs = parseUnary();
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }
  function parseUnary() {
    if (peek() === "-") { next(); return -parseUnary(); }
    if (peek() === "+") { next(); return parseUnary(); }
    return parsePower();
  }
  function parsePower() {
    const base = parseAtom();
    if (peek() === "^") { next(); return Math.pow(base, parseUnary()); }
    return base;
  }
  function parseAtom() {
    const token = next();
    if (token === "(") {
      const value = parseExpr();
      if (next() !== ")") throw new Error("bad parens");
      return value;
    }
    if (token != null && NUM.test(token)) return Number(token);
    throw new Error("bad token");
  }

  try {
    const result = parseExpr();
    if (pos !== tokens.length || !Number.isFinite(result)) return null;
    return Math.round(result * 1e6) / 1e6;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Offline lesson generation                                          */
/* ------------------------------------------------------------------ */

export function buildOfflineLesson({ learner, subject, topic, level, duration = 20 }) {
  const subjectId = SUBJECT_MAP[subject] ? subject : findSubjectByTopic(topic)?.subject.id || "math";
  const chosenTopic = topic || guessTopic(subjectId, level);
  const k = knowledgeFor(chosenTopic);
  const interest = interestOf(learner);
  const levelLabel = LEVEL_LABELS[level] || "Elementary";
  const minutes = clamp(Number(duration) || 20, 5, 60);
  const practice = k?.practice?.length ? k.practice : defaultPractice(chosenTopic);
  const example = k?.example ? k.example(interest) : defaultExample(chosenTopic, interest);
  const steps = k?.steps || [
    `Notice what you already know about ${chosenTopic.toLowerCase()}.`,
    `Learn the key vocabulary and what each word really means.`,
    `Work through one example slowly, naming each step.`,
    `Try a new example yourself, then compare with a worked solution.`,
    `Explain the idea out loud in your own words.`,
  ];

  const sections = [
    {
      type: "intro",
      heading: "Welcome",
      body: `Today we are exploring ${chosenTopic.toLowerCase()} in ${subjectLabel(subjectId)}. ${
        k ? k.idea : `This lesson builds a solid, working understanding of ${chosenTopic.toLowerCase()}, starting from what you already know.`
      }`,
      bullets: [
        `We'll take about ${minutes} minutes.`,
        `I'll use ${interest} to make the examples concrete.`,
        "Interrupt me any time with a question — that's what I'm here for.",
      ],
    },
    {
      type: "objectives",
      heading: "What you'll be able to do",
      body: "By the end of this lesson you should be able to:",
      bullets: [
        `Explain ${chosenTopic.toLowerCase()} in your own words.`,
        `Work through a ${levelLabel.toLowerCase()}-level example without help.`,
        `Recognise the most common mistake and avoid it.`,
      ],
    },
    {
      type: "explanation",
      heading: `The big idea: ${chosenTopic}`,
      body: k ? k.idea : `Every subject has a core idea that makes the details make sense. For ${chosenTopic.toLowerCase()}, the core idea is a relationship you can describe, test and use. Read each step below slowly — understanding beats memorising.`,
      steps,
    },
    {
      type: "example",
      heading: "A worked example",
      body: example,
      steps: k?.steps?.length ? k.steps : undefined,
    },
    {
      type: "visual",
      heading: "Picture it",
      body: visualAid(chosenTopic, k, interest),
    },
    {
      type: "guided_practice",
      heading: "Let's try one together",
      body: practice[0] || "Try the first item and tell me your thinking step by step.",
      hint: k?.check ? `Hint: ${k.check}` : "Start with what you know, then take one step at a time. Tell me where you get stuck.",
      steps: ["Read the question twice and underline what is asked.", "Say which idea from the explanation applies.", "Do one step, then check it before continuing."],
    },
    {
      type: "independent_practice",
      heading: "Your turn",
      body: "Work through these on your own. I'll check them with you afterwards.",
      items: practice.slice(0, Math.min(4, Math.max(2, practice.length))),
    },
    {
      type: "check",
      heading: "Quick check",
      body: k?.check || `In one or two sentences, explain ${chosenTopic.toLowerCase()} to someone younger than you.`,
      bullets: [
        "What is the key idea in your own words?",
        "Which part felt easiest, and which part was tricky?",
      ],
    },
    {
      type: "summary",
      heading: "What we covered",
      body: `We built an understanding of ${chosenTopic.toLowerCase()}: what it means, how to work through it, and how to spot mistakes.`,
      bullets: [
        k ? k.idea : `You can now describe ${chosenTopic.toLowerCase()} and use it in an example.`,
        "If any step felt shaky, tell me and we'll try a different explanation.",
        "Practice a little tomorrow — short and often beats long and rare.",
      ],
    },
  ];

  const options = allTopics().filter((t) => t.subjectId === subjectId && t.topic.toLowerCase() !== chosenTopic.toLowerCase());
  const next = pick(options, hash(chosenTopic))?.topic || "More practice on today's topic";

  return {
    title: `${chosenTopic}: ${levelLabel}`,
    subject: subjectId,
    topic: chosenTopic,
    level,
    duration: minutes,
    objectives: [
      `Explain ${chosenTopic.toLowerCase()} clearly`,
      `Solve a ${levelLabel.toLowerCase()} problem independently`,
      "Recognise and correct the common mistake",
    ],
    sections,
    nextLesson: next,
    source: "curriculum",
  };
}

function defaultPractice(topic) {
  const t = String(topic).toLowerCase();
  if (/multiplication/.test(t)) return ["6 × 7", "9 × 8", "12 × 4", "A box holds 8 pencils. How many in 6 boxes?"];
  if (/addition/.test(t)) return ["7 + 8", "14 + 9", "23 + 18", "Sam has 6 marbles, then wins 9 more. How many now?"];
  if (/subtraction/.test(t)) return ["15 − 6", "22 − 9", "40 − 17", "A jar has 18 sweets and 7 are eaten. How many remain?"];
  if (/division/.test(t)) return ["24 ÷ 6", "45 ÷ 5", "63 ÷ 9", "Share 32 cards equally between 8 friends. How many each?"];
  if (/fraction/.test(t)) return ["What is 1/4 of 20?", "Add 1/5 + 2/5", "Which is larger: 2/3 or 1/2?"];
  if (/decimal/.test(t)) return ["0.4 + 0.35", "0.6 × 3", "Write 3/10 as a decimal"];
  if (/solar system|planet/.test(t)) return ["Name the planets in order from the Sun.", "Why is Earth able to support life?", "What is an astronomical unit?"];
  return [
    `Describe ${topic} in one sentence, then in three sentences.`,
    `Give a real example of ${topic.toLowerCase()} from your own life.`,
    `What is one question you still have about ${topic.toLowerCase()}?`,
  ];
}

function defaultExample(topic, interest) {
  return `Start with something you already know — ${interest}. Find one detail of ${topic.toLowerCase()} that connects to it, then widen from that detail to the general rule. Connecting a new idea to something familiar is how memory holds on to it.`;
}

function visualAid(topic, k, interest) {
  const steps = k?.steps?.length ? k.steps : ["What I already know", "The new idea", "Try it", "Check it"];
  const lines = steps.map((s, i) => `${i + 1}. ${s}`);
  return `A simple map for ${topic.toLowerCase()}:\n${lines.join("\n")}\n\nPicture it in steps like a path — you only ever need the next step, not the whole path at once.`;
}

function guessTopic(subjectId, level) {
  const list = allTopics().filter((t) => t.subjectId === subjectId);
  const near = list.filter((t) => levelIndex(t.level) <= levelIndex(level));
  return (near.length ? near : list)[0]?.topic || "Study skills";
}

/* ------------------------------------------------------------------ */
/*  Offline quiz generation                                            */
/* ------------------------------------------------------------------ */

const DISTRACTOR_BANK = [
  "It is a rule that only applies in one specific situation.",
  "It is a name for a tool rather than a concept.",
  "It is the opposite of the idea being described.",
  "It is a detail that only matters in advanced study.",
];

function mcqFor(topic, subjectId, level) {
  const k = knowledgeFor(topic);
  const subject = SUBJECT_MAP[subjectId] || { name: subjectLabel(subjectId) };
  if (k) {
    const wrong = shuffle(
      Object.entries(KNOWLEDGE)
        .filter(([key]) => key !== topic.toLowerCase())
        .map(([, v]) => v.idea),
      13,
    ).slice(0, 3);
    const options = shuffle([k.idea, ...wrong], hash(topic));
    return {
      type: "multiple_choice",
      prompt: `Which statement best describes ${topic.toLowerCase()}?`,
      options,
      answer: k.idea,
      explanation: `The key idea is: ${k.idea}`,
      hint: `Think about what ${topic.toLowerCase()} is used for, not just its name.`,
    };
  }
  const others = SUBJECTS.filter((s) => s.id !== subjectId).map((s) => s.name);
  const correct = `${subject.name}${findDepartmentOf(topic, subjectId) ? ` — ${findDepartmentOf(topic, subjectId)}` : ""}`;
  const options = shuffle([correct, ...shuffle(others, 5).slice(0, 3)], hash(topic));
  return {
    type: "multiple_choice",
    prompt: `Which subject area does "${topic}" belong to?`,
    options,
    answer: correct,
    explanation: `${topic} is studied in ${correct}.`,
    hint: "Look at which department of the curriculum it appears in.",
  };
}

function findDepartmentOf(topic, subjectId) {
  const subject = SUBJECT_MAP[subjectId];
  if (!subject) return null;
  for (const dept of subject.departments) {
    if (dept.topics.some((t) => t.name.toLowerCase() === String(topic).toLowerCase())) return dept.name;
  }
  return null;
}

function trueFalseFor(topic, subjectId) {
  const dept = findDepartmentOf(topic, subjectId);
  const subjectName = subjectLabel(subjectId);
  const makeTrue = hash(topic + "tf") % 2 === 0;
  if (makeTrue) {
    return {
      type: "true_false",
      prompt: `True or false: ${topic} is studied as part of ${subjectName}${dept ? ` (${dept})` : ""}.`,
      options: ["True", "False"],
      answer: "True",
      explanation: `Yes — ${topic} sits in ${dept || subjectName}.`,
    };
  }
  const wrongSubject = SUBJECTS.find((s) => s.id !== subjectId)?.name || "a different subject";
  return {
    type: "true_false",
    prompt: `True or false: ${topic} is studied only as part of ${wrongSubject}, not ${subjectName}.`,
    options: ["True", "False"],
    answer: "False",
    explanation: `${topic} belongs to ${subjectName}${dept ? `, in ${dept}` : ""}.`,
  };
}

function arithmeticQuestions(topic) {
  const t = topic.toLowerCase();
  const pairs = [];
  if (/addition/.test(t)) pairs.push([3, 8], [14, 7], [26, 15]);
  if (/subtraction/.test(t)) pairs.push([14, 6], [23, 9], [41, 18]);
  if (/multiplication/.test(t)) pairs.push([6, 7], [8, 9], [12, 4]);
  if (/division/.test(t)) pairs.push([36, 6], [45, 5], [72, 8]);
  return pairs.map(([a, b]) => {
    const op = /addition/.test(t) ? "+" : /subtraction/.test(t) ? "−" : /division/.test(t) ? "÷" : "×";
    const answer = op === "+" ? a + b : op === "−" ? a - b : op === "÷" ? a / b : a * b;
    return {
      type: "math",
      prompt: `${a} ${op} ${b} = ?`,
      answer: String(answer),
      explanation: `${a} ${op} ${b} = ${answer}.`,
      hint: "Work it out one step at a time, then check with the inverse operation.",
    };
  });
}

function explanationQuestion(topic, knowledge) {
  const topicWords = String(topic).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const ideaWords = String(knowledge?.idea || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 5).slice(0, 3);
  return {
    type: "written_response",
    prompt: `Explain ${String(topic).toLowerCase()} in your own words, then give one example of where it is used.`,
    answer: "Open response — graded for an accurate explanation with a real example.",
    explanation: knowledge?.idea ? `A strong answer covers: ${knowledge.idea}` : "A strong answer states the idea and shows it working in an example.",
    hint: knowledge?.check || "Name the idea, then show it in something you have seen.",
    keywords: [...new Set([...topicWords, ...ideaWords])].slice(0, 6),
  };
}

function ensureWrittenQuestion(questions, topic, knowledge, limit) {
  const hasWritten = questions.some((q) => q.type === "written_response" || (q.type === "short_answer" && EXPLANATION_PROMPT.test(q.prompt || "")));
  if (hasWritten) return questions;
  const extra = { ...explanationQuestion(topic, knowledge), id: `q${questions.length + 1}` };
  if (questions.length >= limit) return [...questions.slice(0, limit - 1), extra];
  return [...questions, extra];
}

export function buildOfflineQuiz({ learner, subject, topic, level, count = 6, types }) {
  const subjectId = SUBJECT_MAP[subject] ? subject : findSubjectByTopic(topic)?.subject.id || "math";
  const chosenTopic = topic || guessTopic(subjectId, level);
  const k = knowledgeFor(chosenTopic);
  const limit = clamp(Number(count) || 6, 3, 12);
  const core = [mcqFor(chosenTopic, subjectId, level), trueFalseFor(chosenTopic, subjectId), ...arithmeticQuestions(chosenTopic).slice(0, 1)];
  const practice = [];
  for (const item of (k?.practice || []).slice(0, 3)) {
    const computed = evalExpression(item);
    practice.push({
      type: computed != null ? "math" : "short_answer",
      prompt: item,
      answer: computed != null ? String(computed) : "Open response — your tutor will review your explanation.",
      explanation: computed != null ? `${item} = ${computed}.` : `A strong answer explains the reasoning, not just the result.`,
      hint: k.check,
      keywords: computed == null ? String(chosenTopic).toLowerCase().split(/\s+/).filter((w) => w.length > 3) : undefined,
    });
  }

  // Reserve room for the written explanation: mastery needs one, so a quiz must never
  // truncate every written question away in favour of objective items.
  const coreRoom = Math.max(1, limit - 2);
  const ordered = [
    ...core.slice(0, coreRoom),
    ...practice.slice(0, Math.max(0, coreRoom - core.length)),
    explanationQuestion(chosenTopic, k),
    {
      type: "short_answer",
      prompt: k?.check || `What is one question you still have about ${chosenTopic.toLowerCase()}?`,
      answer: "Open response — any thoughtful question earns credit.",
      explanation: "Noticing what you don't yet know is a real learning skill.",
      hint: "There is no wrong question here.",
      keywords: String(chosenTopic).toLowerCase().split(/\s+/).filter((w) => w.length > 3),
    },
  ];

  const final = ordered.slice(0, limit).map((q, i) => ({ ...q, id: `q${i + 1}` }));
  return {
    title: `${chosenTopic} check-in`,
    subject: subjectId,
    topic: chosenTopic,
    level,
    questions: final,
    source: "curriculum",
  };
}

/* ------------------------------------------------------------------ */
/*  Public: chat                                                       */
/* ------------------------------------------------------------------ */

export async function tutorReply({ learner, history, message, subject }) {
  const status = aiStatus();
  const system = tutorSystemPrompt(learner, { mode: "chat" });
  if (status.enabled) {
    try {
      const msgs = [
        { role: "system", content: system },
        ...history.slice(-12).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
        {
          role: "user",
          content: subject ? `${message}\n\n(Context: we are working on ${subject}.)` : message,
        },
      ];
      const text = await aiChat(msgs, { temperature: 0.65, maxTokens: 700 });
      return { text, source: "ai" };
    } catch (err) {
      if (!(err instanceof AIError)) throw err;
      const fallback = offlineReply({ learner, history, message });
      return { ...fallback, notice: `Live AI is unavailable (${err.message}). Answering from the built-in curriculum.` };
    }
  }
  return offlineReply({ learner, history, message });
}

/* ------------------------------------------------------------------ */
/*  Offline tutor                                                      */
/* ------------------------------------------------------------------ */

function topicFromText(text) {
  const lower = String(text || "").toLowerCase();
  const entries = Object.entries(KNOWLEDGE);
  let best = null;
  let bestScore = 0;
  for (const [key, value] of entries) {
    let score = 0;
    if (lower.includes(key)) score += key.split(" ").length * 3 + key.length / 6;
    const words = key.split(" ").filter((w) => w.length > 3);
    for (const w of words) if (lower.includes(w)) score += 1;
    if (lower.includes(value.idea.slice(0, 25).toLowerCase())) score += 2;
    if (score > bestScore) { bestScore = score; best = key; }
  }
  if (best && bestScore >= 2) return best;
  for (const t of allTopics()) {
    const name = t.topic.toLowerCase();
    if (lower.includes(name)) return t.topic;
  }
  return null;
}

function confusionLevel(history) {
  const recent = history.slice(-8);
  return recent.filter((m) => m.role !== "assistant" && /(don'?t|do not|not) (understand|get)|confus|stuck|lost|no idea|makes no sense|too hard/i.test(m.content)).length;
}

function lastName(learner) {
  return learner?.name?.split(" ")[0] || "friend";
}

function offlineReplyCore({ learner, history, message, subject }) {
  const name = lastName(learner);
  const interest = interestOf(learner);
  const lower = message.toLowerCase().trim();
  const topic = topicFromText(message) || (subject ? findSubjectByTopic(subject)?.topic.name : null);
  const k = topic ? knowledgeFor(topic) : null;
  const confusion = confusionLevel(history);
  const asksForAnswer = /just (tell|give) me|what('s| is) the answer|answer:/i.test(lower);
  const greeting = /^(hi|hello|hey|good (morning|afternoon|evening)|yo)\b/i.test(lower);

  if (greeting && message.length < 24) {
    const accountability = getAccountability(learner?.id);
    const strictness = normalizeStrictness(learner?.strictness, normalizePreset(learner?.tutor_preset || learner?.tutor_personality, learner?.tutor_character_id));
    const nudge = accountability.hasItems && strictness !== "gentle"
      ? `\n\nOne thing before we start: ${accountability.overdue[0]?.title || accountability.incomplete[0]?.title || accountability.missedSessions[0]?.title} is still open. Want to finish that, or ask me something new?`
      : "";
    return {
      text: `${CHARACTER_LINES.greeting[learner?.tutor_character_id] || `Hello ${name}.`}\n\n${learner?.streak ? `You're on a ${learner.streak}-day streak — steady work.` : "Ready when you are."}${interest && interest !== "everyday things around you" ? ` We could connect today to ${interest}.` : ""}${nudge}`,
      source: "curriculum",
    };
  }

  const mathAnswer = evalExpression(message.replace(/^.*?((?:-?\d[\d\s+\-*/^.()×÷]*\d)|(?:\d))\s*[=?!.]*$/s, "$1"));
  if (mathAnswer != null && /[+\-*/×÷^]/.test(message)) {
    return {
      text: `${message.trim().replace(/\?+/g, "")} = **${mathAnswer}**.\n\nHow I did it: ${describeMathSteps(message)}.\n\nNow your turn to check it — what would you get if you changed one number?`,
      source: "curriculum",
    };
  }

  if (/(quiz|test) me|ask me a question/i.test(lower)) {
    const q = k?.check || (topic ? `Explain ${topic.toLowerCase()} in your own words.` : "What is one thing you learned recently that surprised you?");
    return { text: `Let's find out what's solid and what needs work.\n\n**Question:** ${q}\n\nTake your time — tell me your thinking, not just the answer, and I'll tell you exactly what's right and what to adjust.`, source: "curriculum" };
  }

  if (confusion >= 1 && topic) {
    const strategies = [
      () => `Let's stop and look at it differently. Forget the rules for a second.\n\n${k ? k.idea : `Think of ${topic.toLowerCase()} as a tool for solving a particular kind of problem.`}\n\nHere's a picture to hold in your head: imagine ${interest}. ${
        k?.example ? k.example(interest) : `You are using ${topic.toLowerCase()} whenever you compare, split or combine things.`
      }\n\nWhich part of that feels clearest — the picture or the steps?`,
      () => `That's completely okay. Let's make it smaller.\n\n${(k?.steps || ["Start with what you already know.", "Change one thing at a time.", "Check as you go."]).map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nWe'll do only step 1 first. Tell me what you think step 1 means, and I'll confirm before we go on.`,
      () => `New approach: let's draw it.\n\n${k ? k.idea : `A useful picture for ${topic.toLowerCase()}: a path with numbered stops.`}\n\n${(k?.steps || []).slice(0, 3).map((s, i) => `Stop ${i + 1}: ${s}`).join("\n")}\n\nDescribe stop 1 back to me in your own words. No rush.`,
      () => `Let's do one together, and I'll do the thinking out loud.\n\nMini-example: ${k?.example ? k.example(interest) : `use ${topic.toLowerCase()} with the smallest numbers you can think of.`}\n\nNow you try the same shape with different numbers. I'll wait — and a wrong first try is useful information, not a failure.`,
      () => `We've tried words, steps and pictures. Let's turn it into a quick game.\n\nI'll say a small piece at a time and you answer with one word or number:\n\n1) In ${topic.toLowerCase()}, what's the first thing you'd look for?\n2) What's the very next step?\n3) What would you check at the end?\n\nGo ahead with number 1.`,
    ];
    const chosen = strategies[Math.min(confusion - 1, strategies.length - 1)]();
    return { text: chosen, source: "curriculum" };
  }

  if (topic) {
    const explanation = k
      ? `${k.idea}\n\n${k.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nFor example: ${k.example(interest)}`
      : `${topic} is one piece of ${subjectLabel(findSubjectByTopic(topic)?.subject.id || "your studies")}. The trick to it is to separate *what it is* from *when you use it*.\n\nStart here:\n1. Say what ${topic.toLowerCase()} means in one sentence — even roughly.\n2. Find one example and one non-example.\n3. Practise one small case before a big one.`;
    return {
      text: `${explanation}\n\n**Your turn:** ${k?.check || `Give me one example of ${topic.toLowerCase()} from your own experience.`}`,
      source: "curriculum",
      notice: asksForAnswer ? "Here's the reasoning too, because understanding it will help you next time." : undefined,
    };
  }

  if (asksForAnswer) {
    return {
      text: `I can give you the answer — but let's make sure it sticks. Tell me what you've tried so far and where it stopped making sense. That one detail usually shows me which explanation will work for you.\n\nIf you'd rather I just walk through it, say "walk me through it" and I'll do the whole thing step by step.`,
      source: "curriculum",
    };
  }

  return {
    text: `I'm listening, ${name}. I want to make sure I understand what you're asking.\n\nIs this about:\n- a **topic** you're studying (tell me the subject or the word you're stuck on),\n- a **question** you have about the world,\n- or how you're **feeling** about your learning today?\n\nAny of those is a good answer. If you know the subject, say something like "fractions" or "the solar system" and I'll take it from there.`,
    source: "curriculum",
  };
}

/**
 * Wraps the built-in curriculum reply so the first answer of a conversation
 * arrives in the selected tutor's voice — the same identity the AI prompt and
 * the animated character carry. Later turns stay focused on the teaching.
 */
function offlineReply(args) {
  const reply = offlineReplyCore(args);
  const history = Array.isArray(args.history) ? args.history : [];
  if (history.some((m) => m.role === "assistant")) return reply;
  const character = TUTOR_MAP[args.learner?.tutor_character_id] || TUTOR_MAP.auren;
  const line = CHARACTER_LINES.greeting[character.id];
  const name = personaName(args.learner);
  if (line && reply.text.startsWith(line)) return reply;
  const intro = line ? `${line} I'm ${name} — ${character.title}.` : `I'm ${name} — ${character.title}.`;
  return { ...reply, text: `${intro}\n\n${reply.text}` };
}

function describeMathSteps(message) {
  const m = String(message).match(/(-?\d+(?:\.\d+)?)\s*([+\-*/×÷^])\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return "I combined the numbers using the usual order of operations.";
  const a = Number(m[1]);
  const b = Number(m[3]);
  const op = m[2];
  if (op === "+") return `I added ${a} and ${b} to make ${a + b}.`;
  if (op === "-") return `I subtracted ${b} from ${a} to make ${a - b}.`;
  if (op === "*" || op === "×") return `${a} groups of ${b} makes ${a * b}.`;
  if (op === "/" || op === "÷") return `${a} shared into groups of ${b} gives ${a / b}.`;
  if (op === "^") return `${a} multiplied by itself ${b} times is ${Math.pow(a, b)}.`;
  return "I worked left to right, respecting brackets and powers.";
}

/* ------------------------------------------------------------------ */
/*  Public: lessons                                                    */
/* ------------------------------------------------------------------ */

function normalizeLesson(raw, ctx) {
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  const allowed = new Set(["intro", "objectives", "explanation", "example", "visual", "guided_practice", "independent_practice", "check", "summary"]);
  return {
    title: String(raw.title || `${ctx.topic || ctx.subject}: a lesson`).slice(0, 140),
    subject: ctx.subjectId,
    topic: ctx.topicName,
    level: ctx.level,
    duration: ctx.duration,
    objectives: (Array.isArray(raw.objectives) ? raw.objectives : []).map(String).slice(0, 6),
    sections: sections
      .filter((s) => s && s.heading)
      .map((s) => ({
        type: allowed.has(s.type) ? s.type : "explanation",
        heading: String(s.heading).slice(0, 120),
        body: String(s.body || "").slice(0, 4000),
        bullets: Array.isArray(s.bullets) ? s.bullets.map(String).slice(0, 10) : undefined,
        steps: Array.isArray(s.steps) ? s.steps.map(String).slice(0, 12) : undefined,
        items: Array.isArray(s.items) ? s.items.map(String).slice(0, 10) : undefined,
        hint: s.hint ? String(s.hint) : undefined,
      }))
      .slice(0, 12),
    nextLesson: raw.nextLesson ? String(raw.nextLesson).slice(0, 160) : null,
    source: "ai",
  };
}

export async function generateLesson({ learner, subject, topic, level, duration = 20, extraNote }) {
  const subjectId = SUBJECT_MAP[subject] ? subject : "math";
  const subjectName = subjectLabel(subjectId);
  const chosenTopic = topic || guessTopic(subjectId, level);
  const normalizedLevel = normalizeLevel(level, learner);
  const minutes = clamp(Number(duration) || 20, 5, 60);
  const ctx = { subjectId, topicName: chosenTopic, level: normalizedLevel, duration: minutes };

  if (aiStatus().enabled) {
    try {
      const raw = await aiJson(
        [
          { role: "system", content: tutorSystemPrompt(learner, { mode: "lesson" }) },
          {
            role: "user",
            content: `Create a complete, teachable lesson.

Subject: ${subjectName}
Topic: ${chosenTopic}
Level: ${LEVEL_LABELS[normalizedLevel]}
Target length: ${minutes} minutes
${extraNote ? `Extra instruction: ${extraNote}` : ""}

Return JSON only with this shape:
{
  "title": "lesson title",
  "objectives": ["3-5 concrete learning objectives"],
  "sections": [
    {"type":"intro","heading":"...","body":"..."},
    {"type":"explanation","heading":"...","body":"...","steps":["..."]},
    {"type":"example","heading":"...","body":"...","steps":["worked steps"]},
    {"type":"visual","heading":"...","body":"a text description of a diagram or table the student can picture"},
    {"type":"guided_practice","heading":"...","body":"one problem","hint":"...","steps":["how to approach it"]},
    {"type":"independent_practice","heading":"...","body":"...","items":["3-4 practice problems"]},
    {"type":"check","heading":"...","body":"1-2 checking questions","bullets":["..."]},
    {"type":"summary","heading":"...","body":"...","bullets":["..."]}
  ],
  "nextLesson": "one topic to do next"
}

Rules:
- Everything must be accurate at the stated level and age-appropriate.
- Use the student's interests in at least one example.
- Every practice item must be solvable from the lesson and have an unambiguous answer.
- 5-10 sections total, matched to a ${minutes}-minute lesson.
- No sexual, violent, unsafe or frightening content. Experiments need safety notes.`,
          },
        ],
        { temperature: 0.5, maxTokens: 2600 },
      );
      return normalizeLesson(raw, ctx);
    } catch {
      /* fall through to the curriculum engine */
    }
  }
  return buildOfflineLesson({ learner, subject: subjectId, topic: chosenTopic, level: normalizedLevel, duration: minutes });
}

/* ------------------------------------------------------------------ */
/*  Public: quizzes                                                    */
/* ------------------------------------------------------------------ */

const QUESTION_TYPES = new Set(["multiple_choice", "true_false", "fill_blank", "short_answer", "written_response", "matching", "math"]);

function normalizeQuestion(raw, i) {
  const type = QUESTION_TYPES.has(raw.type) ? raw.type : "multiple_choice";
  const q = {
    id: raw.id ? String(raw.id) : `q${i + 1}`,
    type,
    prompt: String(raw.prompt || "").slice(0, 800),
    answer: raw.answer != null ? String(raw.answer) : "",
    explanation: raw.explanation ? String(raw.explanation).slice(0, 1200) : "",
    hint: raw.hint ? String(raw.hint).slice(0, 500) : "",
  };
  if (["multiple_choice", "true_false"].includes(type)) {
    let options = Array.isArray(raw.options) ? raw.options.map(String).slice(0, 6) : type === "true_false" ? ["True", "False"] : [];
    if (type === "multiple_choice" && options.length < 2) options = [...options, "None of the above"];
    if (!options.includes(q.answer)) options = [q.answer, ...options].slice(0, 6);
    q.options = options;
    if (type === "true_false") q.answer = /^t/i.test(q.answer) ? "True" : "False";
  }
  if (type === "matching") {
    const pairs = Array.isArray(raw.pairs) ? raw.pairs : [];
    q.pairs = pairs.map((p) => ({ left: String(p.left ?? p.term ?? ""), right: String(p.right ?? p.definition ?? "") })).filter((p) => p.left && p.right).slice(0, 6);
    q.answer = JSON.stringify(Object.fromEntries(q.pairs.map((p) => [p.left, p.right])));
  }
  if (Array.isArray(raw.keywords)) q.keywords = raw.keywords.map(String).slice(0, 12);
  return q;
}

export async function generateQuiz({ learner, subject, topic, level, count = 6, types, extraNote }) {
  const subjectId = SUBJECT_MAP[subject] ? subject : "math";
  const chosenTopic = topic || guessTopic(subjectId, normalizeLevel(level, learner));
  const normalizedLevel = normalizeLevel(level, learner);
  const n = clamp(Number(count) || 6, 3, 15);
  const typeList = Array.isArray(types) && types.length ? types.filter((t) => QUESTION_TYPES.has(t)) : ["multiple_choice", "true_false", "short_answer", "math"];

  if (aiStatus().enabled) {
    try {
      const raw = await aiJson(
        [
          { role: "system", content: tutorSystemPrompt(learner, { mode: "quiz" }) },
          {
            role: "user",
            content: `Write a ${n}-question assessment.

Subject: ${subjectLabel(subjectId)}
Topic: ${chosenTopic}
Level: ${LEVEL_LABELS[normalizedLevel]}
Question types allowed: ${typeList.join(", ")}
${extraNote ? `Extra instruction: ${extraNote}` : ""}

Return JSON only:
{"title":"quiz title","questions":[{"type":"multiple_choice","prompt":"...","options":["4 options"],"answer":"exact correct option text","explanation":"why","hint":"a nudge"},{"type":"true_false","prompt":"...","answer":"True","explanation":"..."},{"type":"math","prompt":"...","answer":"number","hint":"..."},{"type":"fill_blank","prompt":"The bottom number of a fraction is the ______.","answer":"denominator","explanation":"..."},{"type":"short_answer","prompt":"...","answer":"model answer","keywords":["expected","terms"]},{"type":"matching","prompt":"Match each term to its meaning","pairs":[{"left":"term","right":"meaning"}]}]}

Rules:
- Answers must be exact and unambiguous; multiple choice options must not overlap.
- Keep language appropriate for the student's age and reading level.
- Do not repeat the same question twice.
- Every question needs a short explanation that teaches, not just judges.`,
          },
        ],
        { temperature: 0.45, maxTokens: 2400 },
      );
      const questions = (Array.isArray(raw.questions) ? raw.questions : []).slice(0, n).map(normalizeQuestion).filter((q) => q.prompt);
      if (questions.length >= Math.min(3, n)) {
        const withWritten = ensureWrittenQuestion(questions, chosenTopic, knowledgeFor(chosenTopic), n);
        return { title: String(raw.title || `${chosenTopic} quiz`), subject: subjectId, topic: chosenTopic, level: normalizedLevel, questions: withWritten, source: "ai" };
      }
    } catch {
      /* fall through */
    }
  }
  return buildOfflineQuiz({ learner, subject: subjectId, topic: chosenTopic, level: normalizedLevel, count: n, types: typeList });
}

/* ------------------------------------------------------------------ */
/*  Grading                                                            */
/* ------------------------------------------------------------------ */

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function numericEqual(a, b) {
  const x = Number(String(a).replace(/[^0-9.\-]/g, ""));
  const y = Number(String(b).replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return Math.abs(x - y) < 1e-6;
}

const OPEN_TYPES = new Set(["short_answer", "written_response"]);
const META_ANSWER = /^open response/i;
const REFLECTION_PROMPT = /\b(one question you still have|questions? you still have|what would you like|how do you feel|what are you curious)\b/i;
const EXPLANATION_PROMPT = /\b(explain|describe|why|how|example|apply|show|reason|mean|compare|justify|prove)\b/i;
const REASONING = /\b(because|so|therefore|since|which means|that means|this shows|as a result|for example|for instance|if|when|then|leads to|results in|used to)\b/i;

function wordList(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean);
}

export function isOpenQuestion(question) {
  if (!question) return false;
  if (OPEN_TYPES.has(question.type)) return true;
  return !question.answer && question.type !== "multiple_choice" && question.type !== "true_false" && question.type !== "matching";
}

function keywordsFor(question, contextText) {
  const provided = (Array.isArray(question.keywords) ? question.keywords : []).map(norm).filter((k) => k.length >= 3);
  const model = META_ANSWER.test(String(question.answer || ""))
    ? []
    : norm(question.answer).split(" ").filter((w) => w.length >= 5).slice(0, 8);
  const context = String(contextText || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4).slice(0, 4);
  return [...new Set([...provided, ...model, ...context])].slice(0, 10);
}

/**
 * Written answers are graded against the idea being assessed, never against
 * length alone. A long paragraph that never touches the topic is wrong.
 */
export function examineWrittenAnswer(question, answer, contextText) {
  const text = String(answer == null ? "" : answer).trim();
  const list = wordList(text);
  const keywords = keywordsFor(question, contextText);
  if (!text) return { scorable: keywords.length > 0, correct: keywords.length ? false : null, substantive: false };
  if (!keywords.length) return { scorable: false, correct: null, substantive: false };
  if (list.length < 5) return { scorable: true, correct: false, substantive: false };
  const normalized = norm(text);
  const hits = keywords.filter((k) => normalized.includes(k)).length;
  const reasoning = REASONING.test(text);
  const explanationRequired = question.type === "written_response" || EXPLANATION_PROMPT.test(question.prompt || "");
  if (explanationRequired) {
    // A real explanation: several sentences with reasoning or an example, either on the topic
    // or developed enough to stand on its own. Length alone is never sufficient.
    const correct = list.length >= 8 && ((hits >= 1 && (reasoning || list.length >= 20)) || (list.length >= 14 && reasoning));
    return { scorable: true, correct, substantive: correct && list.length >= 12, hits };
  }
  const needed = Math.max(1, Math.ceil(keywords.length * 0.4));
  const correct = hits >= needed;
  return { scorable: true, correct, substantive: correct && list.length >= 12 && reasoning, hits, needed };
}

export function gradeLocally(question, answer, contextText) {
  const given = answer == null ? "" : answer;
  const expected = question.answer || "";
  if (question.type === "multiple_choice" || question.type === "true_false") {
    return norm(given) === norm(expected);
  }
  if (question.type === "math") {
    const n = numericEqual(given, expected);
    if (n != null) return n;
    return norm(given) === norm(expected);
  }
  if (question.type === "fill_blank") {
    const g = norm(given);
    const e = norm(expected);
    return Boolean(g) && (g === e || e.includes(g) && g.length > 2 || g.split(" ").filter((w) => e.includes(w)).length >= Math.max(1, Math.ceil(e.split(" ").length * 0.6)));
  }
  if (question.type === "matching") {
    try {
      const givenMap = typeof given === "string" ? JSON.parse(given || "{}") : given || {};
      const expectedMap = JSON.parse(expected || "{}");
      const keys = Object.keys(expectedMap);
      if (!keys.length) return false;
      return keys.every((key) => norm(givenMap[key]) === norm(expectedMap[key]));
    } catch {
      return norm(given) === norm(expected);
    }
  }
  // open response: correctness is judged against the idea, not the character count
  return examineWrittenAnswer(question, given, contextText).correct === true;
}

async function gradeOpenWithAI({ learner, question, answer }) {
  if (!aiStatus().enabled) return null;
  try {
    const raw = await aiJson(
      [
        { role: "system", content: "You are grading one student answer fairly and briefly. Be encouraging but accurate. PG-13, no shaming." },
        {
          role: "user",
          content: `Assess one written explanation from a student.
Question: ${question.prompt}
Reference answer: ${question.answer || "No fixed answer — judge whether the explanation is accurate and relevant."}
Student answer: ${answer}

Mark "correct": true only when the answer is accurate AND the student explains the idea in their own words — with a reason, a cause, a comparison or a worked example. A vague phrase, a restatement of the question, a guess, or a memorised definition with no explanation is not correct. Judge the reasoning, not the length.

Return JSON: {"correct": true|false, "feedback": "two sentences: what was accurate and what to fix", "hint": "one short nudge if incorrect"}`,
        },
      ],
      { temperature: 0.2, maxTokens: 400 },
    );
    return { correct: Boolean(raw.correct), feedback: String(raw.feedback || ""), hint: raw.hint ? String(raw.hint) : "" };
  } catch {
    return null;
  }
}

export async function gradeAttempt({ learner, quiz, answers }) {
  const questions = quiz.questions;
  const results = [];
  let score = 0;
  let scored = 0;
  let application = null;
  const structural = (text) => {
    const list = wordList(text);
    return list.length >= 10 && (REASONING.test(text) || list.length >= 25);
  };
  for (const q of questions) {
    const given = answers?.[q.id] ?? "";
    const open = isOpenQuestion(q);
    let correct = null;
    let graded = false;
    let feedback = "";
    let substantive = false;
    if (open) {
      const local = examineWrittenAnswer(q, given, quiz.topic);
      graded = local.scorable;
      correct = local.scorable ? local.correct : null;
      if (String(given).trim() && aiStatus().enabled) {
        const ai = await gradeOpenWithAI({ learner, question: q, answer: given });
        if (ai) {
          graded = true;
          correct = ai.correct;
          feedback = ai.feedback;
        }
      }
      substantive = correct === true && structural(String(given));
      if (!graded) {
        correct = null;
        feedback = "Saved for your tutor. This question is not scored automatically.";
      } else if (correct == null) {
        correct = false;
      }
    } else {
      graded = true;
      correct = gradeLocally(q, given, quiz.topic);
    }
    if (graded) {
      scored += 1;
      if (correct) score += 1;
    }
    if (
      open && graded && correct === true && substantive &&
      EXPLANATION_PROMPT.test(q.prompt || "") && !REFLECTION_PROMPT.test(q.prompt || "")
    ) {
      if (!application) application = { questionId: q.id, excerpt: String(given).trim().slice(0, 400) };
    }
    results.push({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      given: String(given),
      open,
      graded,
      correct,
      expected: q.answer,
      explanation: q.explanation,
      feedback: feedback || (correct ? "Exactly right — and you showed the reasoning." : graded ? "Not quite yet. Read the explanation, then try a similar one." : ""),
      hint: q.hint,
    });
  }
  const total = scored;
  const pct = total ? Math.round((score / total) * 100) : 0;
  let summary;
  if (aiStatus().enabled) {
    try {
      summary = await aiChat(
        [
          { role: "system", content: tutorSystemPrompt(learner, { mode: "chat" }) },
          {
            role: "user",
            content: `I just finished a ${quiz.topic} quiz and scored ${score}/${total} (${pct}%). Wrong answers: ${
              results.filter((r) => !r.correct).map((r) => `${r.prompt} → my answer: ${r.given}`).join("; ") || "none"
            }.

In 3 short sentences: what I understood well, what to practise next, and one encouraging but specific note. No bullet lists.`,
          },
        ],
        { temperature: 0.6, maxTokens: 300 },
      );
    } catch {
      summary = null;
    }
  }
  if (!summary) {
    const wrong = results.filter((r) => r.graded && r.correct === false).map((r) => r.prompt);
    summary = pct >= 90
      ? `Excellent — ${score} of ${total}. You were accurate and consistent. Next, try a harder question on ${quiz.topic.toLowerCase()} so the improvement keeps going.`
      : pct >= 70
        ? `Good work: ${score} of ${total}. The ideas are mostly there. The one to revisit is ${wrong[0] || "the trickiest item"} — we can redo it slowly.`
        : pct >= 40
          ? `You got ${score} of ${total}, and that is useful information rather than a verdict. ${wrong[0] ? `Let's start again with "${wrong[0]}" and I'll break it into smaller steps.` : "Let's rebuild one step at a time."}`
          : `That was a hard paper: ${score} of ${total}. That means the topic needs a different explanation, not that you can't learn it. Let's go back to ${quiz.topic.toLowerCase()} and build it from the beginning, with an example from something you already love.`;
  }
  return { results, score, total, pct, summary, application };
}

/* ------------------------------------------------------------------ */
/*  Public: study materials                                            */
/* ------------------------------------------------------------------ */

export async function analyzeDocument({ learner, fileName, text }) {
  const cleaned = String(text || "").slice(0, 16000);
  if (!cleaned.trim()) {
    return {
      summary: `I saved "${fileName}" but couldn't read any text from it. If it's a scanned document or a photo, paste the key text here and I'll explain, summarise and quiz you on it.`,
      source: "none",
    };
  }
  if (aiStatus().enabled) {
    try {
      const summary = await aiChat(
        [
          { role: "system", content: tutorSystemPrompt(learner, { mode: "chat" }) },
          {
            role: "user",
            content: `This is a document the student uploaded ("${fileName}"). Summarise it for learning:
1. Two-sentence overview.
2. The 4–6 key ideas (short bullets).
3. Three questions they could be asked about it.
Keep it PG-13 and say if it appears to be a worksheet, notes, or reading.

DOCUMENT:
${cleaned}`,
          },
        ],
        { temperature: 0.4, maxTokens: 900 },
      );
      return { summary, source: "ai" };
    } catch {
      /* fall through */
    }
  }
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 20).slice(0, 6);
  const words = cleaned.toLowerCase().match(/[a-z]{5,}/g) || [];
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
  return {
    summary: `**Overview**\n${sentences.slice(0, 2).join(" ")}\n\n**Key points I can see in the text**\n${
      sentences.slice(0, 5).map((s) => `- ${s.trim().slice(0, 220)}`).join("\n") || "- The document is short; paste more text for a fuller summary."
    }\n\n**Words that come up often:** ${top.join(", ") || "not enough text"}\n\n**Questions to test yourself**\n1. What is the main claim of this document?\n2. Which detail supports it best?\n3. What would you want to check or ask about it?`,
    source: "curriculum",
  };
}

export async function studyGuideFromDocument({ learner, title, text }) {
  if (aiStatus().enabled) {
    try {
      return await aiChat(
        [
          { role: "system", content: tutorSystemPrompt(learner, { mode: "lesson" }) },
          {
            role: "user",
            content: `Turn this into a one-page study guide at the student's level: a title, 5 key points, a worked example if relevant, 5 flashcards (term — definition), and 3 practice questions with answers.

DOCUMENT (${title}):
${String(text).slice(0, 12000)}`,
          },
        ],
        { temperature: 0.4, maxTokens: 1400 },
      );
    } catch {
      /* fall through */
    }
  }
  const sentences = String(text).split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 25);
  return `# Study guide: ${title}

## Key points
${sentences.slice(0, 6).map((s) => `- ${s.trim().slice(0, 200)}`).join("\n") || "- Add more text to get detailed points."}

## Flashcards
${sentences.slice(0, 5).map((s, i) => `${i + 1}. Q: What does point ${i + 1} of this material say? — A: ${s.trim().slice(0, 160)}`).join("\n") || "1. Build flashcards once the document has more text."}

## Practice
1. Summarise the material in three sentences.
2. Which idea is most important, and why?
3. Where could you use this in a real situation?`;
}

/* ------------------------------------------------------------------ */
/*  Memory extraction                                                  */
/* ------------------------------------------------------------------ */

const MEMORY_RULES = [
  { kind: "interest", re: /\bi (?:really )?(?:love|like|enjoy|am into)\s+([a-z][a-z\s]{2,40})/i, template: (m) => `Loves ${m[1].trim()}` },
  { kind: "dislike", re: /\bi (?:hate|dislike|don'?t like)\s+([a-z][a-z\s]{2,40})/i, template: (m) => `Dislikes ${m[1].trim()}` },
  { kind: "fact", re: /\bmy (?:favourite|favorite) ([a-z\s]{2,25}) is\s+([a-z0-9\s]{2,40})/i, template: (m) => `Favourite ${m[1].trim()}: ${m[2].trim()}` },
  { kind: "goal", re: /\bi want to (?:learn|get better at|improve at)\s+([a-z0-9\s]{3,60})/i, template: (m) => `Goal: learn ${m[1].trim()}` },
  { kind: "struggle", re: /\bi (?:struggle|have trouble|find it hard) (?:with|to)\s+([a-z0-9\s]{3,60})/i, template: (m) => `Finds ${m[1].trim()} difficult` },
];

export function extractMemories(message) {
  const found = [];
  for (const rule of MEMORY_RULES) {
    const m = String(message).match(rule.re);
    if (m) found.push({ kind: rule.kind, content: rule.template(m).replace(/\s+/g, " ").slice(0, 180) });
  }
  return found;
}

/* ------------------------------------------------------------------ */
/*  Study plans                                                        */
/* ------------------------------------------------------------------ */

export async function buildStudyPlan({ learner, goal, subject, weeks = 4 }) {
  const subjectId = SUBJECT_MAP[subject] ? subject : "math";
  const pool = allTopics().filter((t) => t.subjectId === subjectId).slice(0, weeks * 2);
  if (aiStatus().enabled) {
    try {
      const raw = await aiJson(
        [
          { role: "system", content: tutorSystemPrompt(learner, { mode: "lesson" }) },
          {
            role: "user",
            content: `Build a ${weeks}-week personalised study plan for the goal: "${goal}" in ${subjectLabel(subjectId)}.
Return JSON: {"title":"...","weeks":[{"week":1,"focus":"...","lessons":["..."],"practice":"...","checkpoint":"..."}]}
Match the student's level and available time (${learner?.daily_goal || 20} minutes a day).`,
          },
        ],
        { temperature: 0.5, maxTokens: 1400 },
      );
      if (Array.isArray(raw.weeks)) {
        return { title: String(raw.title || `Your ${weeks}-week plan`), weeks: raw.weeks.slice(0, weeks), source: "ai" };
      }
    } catch {
      /* fall through */
    }
  }
  const weeksArr = [];
  for (let i = 0; i < weeks; i++) {
    const picks = pool.slice(i * 2, i * 2 + 2).map((t) => t.topic);
    weeksArr.push({
      week: i + 1,
      focus: picks[0] || goal,
      lessons: picks,
      practice: `15 minutes of ${subjectLabel(subjectId).toLowerCase()} practice, then explain one idea out loud.`,
      checkpoint: `Short quiz on ${picks.join(" and ") || goal}.`,
    });
  }
  return { title: `${weeks}-week plan: ${goal}`, weeks: weeksArr, source: "curriculum" };
}

export { ACHIEVEMENTS };
