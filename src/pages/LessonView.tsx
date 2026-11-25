import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LearnerAvatar } from "../components/character/Avatar";
import { Badge, Bar, Button, Card, Icon, RichText, Spinner } from "../components/ui";
import { api, type Lesson, type Rewards, type LessonSection } from "../lib/api";
import { startLesson } from "../lib/actions";
import { useApp } from "../lib/store";

const SECTION_META: Record<string, { label: string; icon: string }> = {
  intro: { label: "Introduction", icon: "👋" },
  objectives: { label: "Learning objectives", icon: "🎯" },
  explanation: { label: "Explanation", icon: "💡" },
  example: { label: "Worked example", icon: "🔍" },
  visual: { label: "Picture it", icon: "🖼️" },
  guided_practice: { label: "Guided practice", icon: "🤝" },
  independent_practice: { label: "Your turn", icon: "✏️" },
  check: { label: "Knowledge check", icon: "❓" },
  summary: { label: "Summary", icon: "✅" },
};

export function LessonView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { learner, meta, version, bump, toast } = useApp();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [startingNext, setStartingNext] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api<{ lesson: Lesson }>(`/lessons/${id}`);
      setLesson(data.lesson);
      const count = data.lesson.sections.length;
      const completedSections = Math.round((data.lesson.progress / 100) * count);
      setDone(data.lesson.status === "completed" ? Array.from({ length: count }, (_, i) => i) : Array.from({ length: Math.min(completedSections, count) }, (_, i) => i));
    } catch (err: any) {
      toast(err.message || "Could not open that lesson", "warn");
      navigate("/lessons");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, version]);

  const persist = async (nextDone: number[], status?: string) => {
    if (!lesson) return;
    const pct = Math.round((nextDone.length / Math.max(1, lesson.sections.length)) * 100);
    setSaving(true);
    try {
      const res = await api<{ lesson: Lesson; rewards?: Rewards }>(`/lessons/${lesson.id}`, {
        method: "PATCH",
        json: { progress: status === "completed" ? 100 : pct, status: status || lesson.status },
      });
      setLesson(res.lesson);
      bump();
    } catch (err: any) {
      toast(err.message || "Could not save your progress", "warn");
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (index: number) => {
    const next = done.includes(index) ? done.filter((i) => i !== index) : [...done, index].sort((a, b) => a - b);
    setDone(next);
    void persist(next);
  };

  const complete = async () => {
    if (!lesson) return;
    setCompleting(true);
    try {
      const res = await api<{ lesson: Lesson; rewards?: Rewards }>(`/lessons/${lesson.id}`, {
        method: "PATCH",
        json: { progress: 100, status: "completed" },
      });
      setLesson(res.lesson);
      setDone(lesson.sections.map((_, i) => i));
      bump();
      if (res.rewards?.unlocked?.length) {
        toast("Lesson complete — and a new achievement!", "good", res.rewards.unlocked.map((u) => ({ icon: u.icon, name: u.name })));
      } else {
        toast(`Lesson complete. +25 XP · ${res.rewards?.streak || learner?.streak || 1}-day streak`, "good");
      }
    } catch (err: any) {
      toast(err.message || "Could not complete that lesson", "warn");
    } finally {
      setCompleting(false);
    }
  };

  const saveToLibrary = async () => {
    if (!lesson) return;
    try {
      await api(`/lessons/${lesson.id}/save`, { method: "POST", json: {} });
      toast("Saved to your library", "good");
      bump();
    } catch (err: any) {
      toast(err.message || "Could not save that lesson", "warn");
    }
  };

  const startNext = async () => {
    if (!lesson || !learner) return;
    setStartingNext(true);
    try {
      const next = await startLesson({ learnerId: learner.id, subject: lesson.subject, topic: lesson.nextLesson || undefined });
      bump();
      navigate(`/lessons/${next.id}`);
    } catch (err: any) {
      toast(err.message || "Could not build the next lesson", "warn");
    } finally {
      setStartingNext(false);
    }
  };

  if (loading) return <div className="page"><Spinner label="Opening your lesson…" /></div>;
  if (!lesson) return null;

  const subject = meta?.subjects.find((s) => s.id === lesson.subject);
  const pct = Math.round((done.length / Math.max(1, lesson.sections.length)) * 100);
  const completed = lesson.status === "completed";

  return (
    <div className="page stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Button variant="ghost" size="sm" icon="back" onClick={() => navigate("/lessons")}>All lessons</Button>
        <div className="row row--tight">
          <Badge tone="violet">{subject?.icon} {lesson.subjectName}</Badge>
          <Badge tone="muted">{meta?.levels[lesson.level] || lesson.level}</Badge>
          <Badge tone="teal">{lesson.duration} min</Badge>
          {completed ? <Badge tone="teal">Completed</Badge> : null}
        </div>
      </div>

      <div className="lesson-layout">
        <div className="stack">
          <Card>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <LearnerAvatar size={78} state={completed ? "celebrating" : "explaining"} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 25, letterSpacing: "-0.03em" }}>{lesson.title}</h1>
                <p className="small muted" style={{ margin: "5px 0 0" }}>
                  Built for {learner?.name} by {learner?.tutorName} · {lesson.sections.length} sections · {saving ? "saving…" : `${pct}% complete`}
                </p>
              </div>
            </div>
            <Bar value={completed ? 100 : pct} height={7} />
            {lesson.objectives.length ? (
              <div style={{ marginTop: 14 }}>
                <div className="field__label" style={{ marginBottom: 5 }}>By the end of this lesson</div>
                <ul className="rich__list" style={{ paddingLeft: 18, fontSize: 13.5, color: "var(--ink-soft)" }}>
                  {lesson.objectives.map((o) => <li key={o}>{o}</li>)}
                </ul>
              </div>
            ) : null}
          </Card>

          {lesson.sections.map((section: LessonSection, index) => {
            const metaInfo = SECTION_META[section.type] || { label: section.type, icon: "📄" };
            const isDone = done.includes(index);
            return (
              <section key={`${section.type}-${index}`} id={`section-${index}`} className={`card lesson-section lesson-section--${section.type}`}>
                <div className="spread" style={{ marginBottom: 6 }}>
                  <div className="lesson-section__label">{metaInfo.icon} {metaInfo.label}</div>
                  <button
                    className={`chip ${isDone ? "chip--good" : ""}`}
                    onClick={() => toggleSection(index)}
                    title={isDone ? "Mark as not done" : "Mark this section as understood"}
                  >
                    <Icon name="check" size={13} /> {isDone ? "Done" : "Got it"}
                  </button>
                </div>
                <h3>{section.heading}</h3>
                {section.body ? <div className="lesson-body"><RichText text={section.body} /></div> : null}
                {section.steps?.length ? (
                  <ol className="rich__list rich__list--num" style={{ marginTop: 10, fontSize: 14 }}>
                    {section.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                ) : null}
                {section.bullets?.length ? (
                  <ul className="rich__list" style={{ marginTop: 10, fontSize: 14 }}>
                    {section.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                ) : null}
                {section.items?.length ? (
                  <div style={{ marginTop: 10 }}>
                    {section.items.map((item, i) => <div key={i} className="practice-item">{i + 1}. {item}</div>)}
                  </div>
                ) : null}
                {section.hint ? <div className="feedback feedback--good" style={{ marginTop: 12 }}><strong>Hint</strong>{section.hint}</div> : null}
              </section>
            );
          })}

          <Card className={completed ? "card--tint" : ""}>
            {completed ? (
              <div className="stack stack--sm">
                <div className="row">
                  <LearnerAvatar size={68} state="celebrating" />
                  <div>
                    <h2 style={{ fontSize: 19 }}>Lesson complete — well done.</h2>
                    <p className="small muted" style={{ margin: 0 }}>You can revisit this any time. Nothing here disappears.</p>
                  </div>
                </div>
                <div className="row">
                  <Button icon="play" onClick={startNext} loading={startingNext}>
                    {lesson.nextLesson ? `Next: ${lesson.nextLesson.slice(0, 34)}` : "Practise this with a quiz"}
                  </Button>
                  <Button variant="secondary" icon="chat" onClick={() => navigate(`/tutor?ask=${encodeURIComponent(`I just finished a lesson on ${lesson.topic}. Can you check my understanding with a few questions?`)}`)}>
                    Ask {learner?.tutorName} to check me
                  </Button>
                  <Button variant="ghost" icon="library" onClick={saveToLibrary}>Save to library</Button>
                </div>
              </div>
            ) : (
              <div className="spread">
                <div>
                  <h2 style={{ fontSize: 17 }}>Finished the lesson?</h2>
                  <p className="small muted" style={{ margin: 0 }}>Marking it complete records your progress and earns XP. You can still come back.</p>
                </div>
                <div className="row">
                  <Button variant="secondary" icon="library" onClick={saveToLibrary}>Save</Button>
                  <Button icon="check" onClick={complete} loading={completing}>Complete lesson</Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <aside className="stack stack--sm lesson-nav">
          <Card title="In this lesson" action={<span className="tiny muted">{pct}%</span>}>
            <ul className="lesson-outline">
              {lesson.sections.map((s, i) => (
                <li key={i}>
                  <button onClick={() => document.getElementById(`section-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                    <span>{done.includes(i) ? "✅" : (SECTION_META[s.type]?.icon || "•")}</span>
                    <span>{s.heading}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="card--tint">
            <div className="row" style={{ gap: 9, marginBottom: 6 }}>
              <LearnerAvatar size={54} state="listening" />
              <div>
                <strong className="small">Stuck on something?</strong>
                <div className="tiny muted">Explain it a different way</div>
              </div>
            </div>
            <Button
              size="sm"
              block
              variant="secondary"
              icon="chat"
              onClick={() => navigate(`/tutor?ask=${encodeURIComponent(`I'm doing a lesson on ${lesson.topic} and I'm stuck. Can you explain it a different way?`)}`)}
            >
              Ask {learner?.tutorName}
            </Button>
          </Card>
          <Card>
            <div className="field__label" style={{ marginBottom: 6 }}>Next up</div>
            <p className="small" style={{ marginBottom: 8 }}>{lesson.nextLesson || "Practice this topic with a quiz."}</p>
            <Button size="sm" block variant="soft" icon="arrow" onClick={startNext} loading={startingNext}>Start next lesson</Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}
