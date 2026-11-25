import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mascot } from "../components/Mascot";
import { Button, Field, Icon } from "../components/ui";
import { api, type Learner } from "../lib/api";
import { useApp } from "../lib/store";

const LANGUAGES = ["English", "Spanish", "French", "Portuguese", "German", "Mandarin", "Arabic", "Hindi", "Swahili", "Jamaican Patois", "Other"];
const LEARNER_TYPES = [
  { id: "student", label: "School student", emoji: "🎒" },
  { id: "homeschool", label: "Homeschooling", emoji: "🏡" },
  { id: "independent", label: "Independent learner", emoji: "🧭" },
  { id: "adult", label: "Adult learner", emoji: "☕" },
  { id: "professional", label: "Professional development", emoji: "💼" },
];
const ACTIVITY_PREFS = [
  { id: "games", label: "Games", emoji: "🎮" },
  { id: "quizzes", label: "Quizzes", emoji: "🎯" },
  { id: "challenges", label: "Challenges", emoji: "🏆" },
  { id: "traditional", label: "Explain it to me", emoji: "📖" },
  { id: "mix", label: "A bit of everything", emoji: "🌈" },
];
const CURRICULA = ["National curriculum", "Common Core", "Cambridge / IGCSE", "IB", "GCSE / A-Level", "Caribbean CXC", "Not sure", "Other"];

type Answers = {
  name: string;
  age: string;
  grade: string;
  learnerType: string;
  language: string;
  country: string;
  curriculum: string;
  loves: string[];
  struggles: string[];
  styles: string[];
  activityPref: string;
  lessonLength: string;
  examplesFirst: boolean;
  hintsFirst: boolean;
  extraTime: boolean;
  interests: string[];
  tutorName: string;
  tutorPersonality: string;
  tutorCharacterId: string;
  strictness: string;
  voiceStyle: string;
  guardianConsent: boolean;
  memoryEnabled: boolean;
  gamification: boolean;
};

export function Onboarding() {
  const { learner, meta, refreshAuth, toast } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customInterest, setCustomInterest] = useState("");
  const [answers, setAnswers] = useState<Answers>({
    name: learner?.name || "",
    age: learner?.age ? String(learner.age) : "",
    grade: learner?.grade || "",
    learnerType: learner?.learnerType || "student",
    language: learner?.language || "English",
    country: learner?.country || "",
    curriculum: learner?.curriculum || "",
    loves: learner?.loves || [],
    struggles: learner?.struggles || [],
    styles: learner?.styles || [],
    activityPref: learner?.activityPref || "mix",
    lessonLength: learner?.lessonLength || "standard",
    examplesFirst: learner?.examplesFirst ?? true,
    hintsFirst: learner?.hintsFirst ?? true,
    extraTime: learner?.extraTime ?? false,
    interests: learner?.interests || [],
    tutorName: learner?.tutorName || "Aster",
    tutorPersonality: learner?.tutorPreset || "friendly",
    tutorCharacterId: learner?.tutorCharacterId || "auren",
    strictness: learner?.strictness || "balanced",
    voiceStyle: learner?.voiceStyle || "friendly",
    guardianConsent: learner?.guardianConsent || false,
    memoryEnabled: learner?.memoryEnabled ?? true,
    gamification: learner?.gamification ?? true,
  });

  const set = (patch: Partial<Answers>) => setAnswers((a) => ({ ...a, ...patch }));
  const toggle = (key: "loves" | "struggles" | "styles" | "interests", value: string) => {
    setAnswers((a) => ({
      ...a,
      [key]: a[key].includes(value) ? a[key].filter((v) => v !== value) : [...a[key], value],
    }));
  };

  const tutorName = answers.tutorName.trim() || "Aster";
  const youngLearner = answers.age && Number(answers.age) < 13;
  const steps = 6;
  const totalProgress = ((step + 1) / steps) * 100;

  const interestsAll = useMemo(() => {
    const base = meta?.interests || [];
    const extra = answers.interests.filter((i) => !base.some((b) => b.label === i));
    return { base, extra };
  }, [meta, answers.interests]);

  const finish = async () => {
    if (!learner) return;
    if (youngLearner && !answers.guardianConsent) {
      setError("For a learner under 13, a parent or guardian needs to confirm this profile.");
      setStep(5);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api<{ learner: Learner }>(`/learners/${learner.id}/onboarding`, {
        method: "POST",
        json: {
          ...answers,
          age: answers.age ? Number(answers.age) : null,
          tutorName,
          guardianConsent: youngLearner ? true : answers.guardianConsent,
        },
      });
      await refreshAuth();
      toast("Profile saved. Now design your scholar and choose your tutor.", "good");
      navigate("/characters?first=1");
    } catch (err: any) {
      setError(err.message || "Could not save your profile. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    setError(null);
    if (step === 0 && !answers.name.trim()) {
      setError("What would you like to be called? A first name is perfect.");
      return;
    }
    if (step < steps - 1) setStep(step + 1);
    else void finish();
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const shelfBooks = meta?.library?.catalog || [];

  return (
    <div className="onboard">
      <aside className="onboard__aside">
        <div className="row">
          <span className="brand__mark">A</span>
          <strong style={{ fontSize: 18 }}>Asterwood</strong>
        </div>
        <Mascot size={132} mood={step === 5 ? "celebrate" : step > 2 ? "listening" : "happy"} />
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>A few things about you</h2>
          <p className="onboard__quote">"This isn't a test. It's how I learn to explain things in a way that makes sense to you."</p>
        </div>
        <ol className="onboard__steps">
          {["You and your year", "Where you learn", "Subjects", "How you learn", "Interests", "Your character"].map((label, i) => (
            <li key={label} className={`onboard__step ${i === step ? "onboard__step--active" : ""} ${i < step ? "onboard__step--done" : ""}`}>
              <span>{i < step ? "✓" : i + 1}</span> {label}
            </li>
          ))}
        </ol>
        <p className="tiny muted" style={{ marginTop: "auto" }}>Every optional question can be skipped. You can change all of this later in Settings.</p>
      </aside>

      <div className="onboard__panel">
        <div className="onboard__progress">
          {Array.from({ length: steps }).map((_, i) => <span key={i} className={`onboard__dot ${i <= step ? "onboard__dot--done" : ""}`} />)}
        </div>

        <div className="onboard__greeting">
          <Mascot size={56} mood={step === 5 ? "celebrate" : "happy"} />
          <div className="onboard__bubble">
            {step === 0 && `Hi${answers.name ? ` ${answers.name.split(" ")[0]}` : ""}! Welcome to Asterwood. What should I call you?`}
            {step === 1 && "Tell me a little about where and how you learn — or skip this completely."}
            {step === 2 && "What do you enjoy? And what feels like hard work? Be honest — I use both."}
            {step === 3 && "How do you like a lesson to feel?"}
            {step === 4 && "Last one about you. What are you actually into? This is where the magic happens."}
            {step === 5 && "Almost there. Next you'll design your scholar and choose the tutor who teaches you."}
          </div>
        </div>

        {step === 0 ? (
          <>
            <h1>Let's start with you.</h1>
            <p className="onboard__hint">No right answers here — just enough for me to pitch things correctly.</p>
            <div className="onboard__grid">
              <Field label="Preferred name">
                <input className="input input--lg" value={answers.name} onChange={(e) => set({ name: e.target.value })} placeholder="Your first name or a nickname" autoFocus />
              </Field>
              <Field label="Age" hint="Lessons adjust to you — not the other way round.">
                <input className="input input--lg" type="number" min={3} max={120} value={answers.age} onChange={(e) => set({ age: e.target.value })} placeholder="e.g. 12" />
              </Field>
              <Field label="Grade or level" hint="Optional. 'Year 6', 'Grade 5', 'Adult beginner' all work.">
                <input className="input input--lg" value={answers.grade} onChange={(e) => set({ grade: e.target.value })} placeholder="e.g. Grade 5" />
              </Field>
              <Field label="I'm learning as…">
                <select className="select input--lg" value={answers.learnerType} onChange={(e) => set({ learnerType: e.target.value })}>
                  {LEARNER_TYPES.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
                </select>
              </Field>
            </div>
            <div className="onboard__note" style={{ marginTop: 16 }}>
              <Icon name="bulb" size={15} /> Your age sets a starting point only. If you already know something, we move on. If something is new, we start there — no embarrassment either way.
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1>Where do you learn?</h1>
            <p className="onboard__hint">This helps with spelling, examples and exam styles. All optional.</p>
            <div className="onboard__grid">
              <Field label="Preferred language">
                <select className="select input--lg" value={answers.language} onChange={(e) => set({ language: e.target.value })}>
                  {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="Country" hint="Optional">
                <input className="input input--lg" value={answers.country} onChange={(e) => set({ country: e.target.value })} placeholder="e.g. Jamaica" />
              </Field>
              <Field label="Curriculum" hint="Optional — we'll align topics where it helps.">
                <select className="select input--lg" value={answers.curriculum} onChange={(e) => set({ curriculum: e.target.value })}>
                  <option value="">Not specified</option>
                  {CURRICULA.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1>Which books catch your eye?</h1>
            <p className="onboard__hint">
              This is not a subject menu. These are the first books on the Library shelves — tap the ones you would
              reach for. Nothing here is permanent, and you can explore every shelf later.
            </p>
            <div className="onboard-shelf">
              <div className="onboard-shelf__glow" aria-hidden="true" />
              {shelfBooks.map((book) => {
                const on = answers.loves.includes(book.title);
                return (
                  <button
                    key={book.id}
                    type="button"
                    className={`onboard-book ${on ? "on" : ""}`}
                    style={{ background: book.color }}
                    onClick={() => toggle("loves", book.title)}
                    aria-pressed={on}
                  >
                    <span className="onboard-book__icon">{book.icon}</span>
                    <span className="onboard-book__title">{book.title}</span>
                    <span className="onboard-book__topics">{book.topicCount} topics</span>
                    {on ? <span className="onboard-book__mark">✦</span> : null}
                  </button>
                );
              })}
              <div className="onboard-shelf__plank" aria-hidden="true" />
            </div>
            <div className="onboard__grid" style={{ marginTop: 18 }}>
              <Field label="A shelf that feels heavy right now" hint="Optional. We'll go slower there and come at it from several directions.">
                <select
                  className="select input--lg"
                  value={answers.struggles[0] || ""}
                  onChange={(e) => set({ struggles: e.target.value ? [e.target.value] : [] })}
                >
                  <option value="">Nothing in particular</option>
                  {shelfBooks.map((book) => <option key={book.id} value={book.title}>{book.icon} {book.title}</option>)}
                </select>
              </Field>
              <Field label="What are you hoping to find here?" hint="Optional — a topic, a skill, a question.">
                <input
                  className="input input--lg"
                  value={answers.interests.find((i) => i.startsWith("Hoping: "))?.slice(8) || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAnswers((a) => ({ ...a, interests: value ? [...a.interests.filter((i) => !i.startsWith("Hoping: ")), `Hoping: ${value}`] : a.interests.filter((i) => !i.startsWith("Hoping: ")) }));
                  }}
                  placeholder="e.g. understand tides, write better stories"
                />
              </Field>
            </div>
            <div className="onboard__note" style={{ marginTop: 16 }}>
              Choosing a book does not mark anything as learned. Mastery only grows from lessons, practice and real
              assessment — and your companion will help you find connections between shelves.
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1>How do you like to learn?</h1>
            <p className="onboard__hint">I'll vary my approach anyway — this tells me where to start.</p>
            <div className="field__label" style={{ marginBottom: 8 }}>Things that help me understand</div>
            <div className="onboard__choices" style={{ marginBottom: 18 }}>
              {(meta?.learningStyles || []).map((s) => (
                <button key={s.id} type="button" className={`choice ${answers.styles.includes(s.label) ? "choice--on" : ""}`} onClick={() => toggle("styles", s.label)}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>

            <div className="onboard__grid">
              <Field label="Lesson length I prefer">
                <select className="select input--lg" value={answers.lessonLength} onChange={(e) => set({ lessonLength: e.target.value })}>
                  {(meta?.lessonLengths || []).map((l) => <option key={l.id} value={l.id}>{l.label} · {l.minutes[0]}–{l.minutes[1]} min</option>)}
                </select>
              </Field>
              <Field label="I enjoy…">
                <select className="select input--lg" value={answers.activityPref} onChange={(e) => set({ activityPref: e.target.value })}>
                  {ACTIVITY_PREFS.map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.label}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="switch">
                <div className="switch__text"><strong>Explain with examples first</strong><span>Show me a concrete example before the rule.</span></div>
                <label className="switch__control"><input type="checkbox" checked={answers.examplesFirst} onChange={(e) => set({ examplesFirst: e.target.checked })} /><span className="switch__track" /></label>
              </div>
              <div className="switch">
                <div className="switch__text"><strong>Give me hints before answers</strong><span>Let me try; nudge me rather than telling me.</span></div>
                <label className="switch__control"><input type="checkbox" checked={answers.hintsFirst} onChange={(e) => set({ hintsFirst: e.target.checked })} /><span className="switch__track" /></label>
              </div>
              <div className="switch">
                <div className="switch__text"><strong>Give me extra time</strong><span>No timers on practice; take as long as you need.</span></div>
                <label className="switch__control"><input type="checkbox" checked={answers.extraTime} onChange={(e) => set({ extraTime: e.target.checked })} /><span className="switch__track" /></label>
              </div>
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h1>What are you into?</h1>
            <p className="onboard__hint">This is my favourite part. Tell me anything — I'll build examples around it.</p>
            <div className="onboard__choices" style={{ marginBottom: 12 }}>
              {interestsAll.base.map((i) => (
                <button key={i.id} type="button" className={`choice ${answers.interests.includes(i.label) ? "choice--on" : ""}`} onClick={() => toggle("interests", i.label)}>
                  {i.emoji} {i.label}
                </button>
              ))}
              {interestsAll.extra.map((i) => (
                <button key={i} type="button" className="choice choice--on" onClick={() => toggle("interests", i)}>{i} ✕</button>
              ))}
            </div>
            <div className="row" style={{ marginBottom: 20 }}>
              <input
                className="input"
                style={{ flex: 1, minWidth: 180 }}
                placeholder="Add your own interest — e.g. volcanoes, ballet, motorbikes"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const value = customInterest.trim();
                    if (value && !answers.interests.includes(value)) set({ interests: [...answers.interests, value] });
                    setCustomInterest("");
                  }
                }}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  const value = customInterest.trim();
                  if (value && !answers.interests.includes(value)) set({ interests: [...answers.interests, value] });
                  setCustomInterest("");
                }}
              >
                Add
              </Button>
            </div>

          </>
        ) : null}

        {step === 5 ? (
          <>
            <h1>Ready when you are.</h1>
            <p className="onboard__hint">Here's what I'll start with. You can change any of it later.</p>
            <div className="card card--tint" style={{ marginBottom: 14 }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <Mascot size={46} mood="happy" />
                <div>
                  <strong>Your character and tutor come next</strong>
                  <div className="tiny muted">You'll pick a look, a name and one of ten tutors — and can change either any time.</div>
                </div>
              </div>
              <dl className="kv">
                <dt>Learner</dt><dd>{answers.name || "—"}{answers.age ? `, age ${answers.age}` : ""}</dd>
                <dt>Level</dt><dd>{answers.grade || "Adaptive — we'll find out together"}</dd>
                <dt>Enjoys</dt><dd>{answers.loves.join(", ") || "Still discovering"}</dd>
                <dt>Needs practice</dt><dd>{answers.struggles.join(", ") || "We'll find out gently"}</dd>
                <dt>Interests</dt><dd>{answers.interests.join(", ") || "Add some in Settings"}</dd>
                <dt>Lesson style</dt><dd>{answers.lessonLength}, {answers.activityPref}{answers.examplesFirst ? ", examples first" : ""}{answers.hintsFirst ? ", hints before answers" : ""}</dd>
              </dl>
            </div>

            <div className="switch">
              <div className="switch__text"><strong>Let your tutor remember our lessons</strong><span>Progress, strengths and preferences. You can review or delete any of it.</span></div>
              <label className="switch__control"><input type="checkbox" checked={answers.memoryEnabled} onChange={(e) => set({ memoryEnabled: e.target.checked })} /><span className="switch__track" /></label>
            </div>
            <div className="switch">
              <div className="switch__text"><strong>XP, streaks and achievements</strong><span>Celebrate consistency. No penalties for a missed day.</span></div>
              <label className="switch__control"><input type="checkbox" checked={answers.gamification} onChange={(e) => set({ gamification: e.target.checked })} /><span className="switch__track" /></label>
            </div>

            {youngLearner ? (
              <label className="row small" style={{ alignItems: "flex-start", gap: 8, background: "var(--amber-soft)", padding: 12, borderRadius: 12, marginTop: 14 }}>
                <input type="checkbox" checked={answers.guardianConsent} onChange={(e) => set({ guardianConsent: e.target.checked })} style={{ marginTop: 3 }} />
                <span>I'm a parent or guardian, and I agree to this learning profile being created for a child under 13.</span>
              </label>
            ) : null}

            <div className="onboard__note" style={{ marginTop: 14 }}>
              <Icon name="lock" size={15} /> Your learning history stays private to this account. Your tutor never asks for addresses, phone numbers or passwords, and encourages you to talk to a trusted adult about anything serious.
            </div>
          </>
        ) : null}

        {error ? <div className="feedback feedback--bad" style={{ marginTop: 16 }}>{error}</div> : null}

        <div className="onboard__foot">
          {step > 0 ? <Button variant="ghost" onClick={back} icon="back">Back</Button> : null}
          <Button size="lg" onClick={next} loading={busy} icon={step === 5 ? "sparkles" : undefined}>
            {step === 5 ? "Design your character" : "Continue"}
          </Button>
          {step < 5 ? (
            <Button variant="ghost" className="onboard__skip" onClick={() => setStep(step + 1)}>Skip for now</Button>
          ) : null}
        </div>
        <div className="tiny muted" style={{ marginTop: 14 }}>{Math.round(totalProgress)}% of a very short setup</div>
      </div>
    </div>
  );
}
