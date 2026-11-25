import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LearnerAvatar } from "../components/character/Avatar";
import { Badge, Bar, Button, Card, Field, Icon, Modal, ProgressRing, Spinner, Stat } from "../components/ui";
import { api, timeAgo } from "../lib/api";
import { useApp } from "../lib/store";

type ProgressData = {
  learner: { xp: number; streak: number; name: string; levelLabel: string };
  progress: { subject: string; mastery: number; minutes: number; lessons_done: number }[];
  achievements: { code: string; name: string; icon: string; description: string; earned_at: number }[];
  activity: { kind: string; detail: string; xp: number; created_at: number }[];
  last14: { date: string; active: boolean }[];
  attempts: { score: number; total: number; created_at: number; title: string; subject: string }[];
  lessons: { title: string; subject: string; status: string; progress: number; updated_at: number }[];
  counts: { lessonsCompleted: number; quizzesTaken: number; minutes: number; flashcards: number; library: number; avgScore: number };
};

type AchievementAll = { code: string; name: string; icon: string; description: string; earned: boolean; earnedAt: number | null };

export function Progress() {
  const { learner, meta, version, toast } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<ProgressData | null>(null);
  const [all, setAll] = useState<AchievementAll[]>([]);
  const [loading, setLoading] = useState(true);
  const [planOpen, setPlanOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [planSubject, setPlanSubject] = useState("math");
  const [weeks, setWeeks] = useState(4);
  const [planBusy, setPlanBusy] = useState(false);
  const [plan, setPlan] = useState<{ title: string; weeks: { week: number; focus: string; lessons: string[]; practice: string; checkpoint: string }[]; source?: string } | null>(null);

  const load = useCallback(async () => {
    if (!learner) return;
    try {
      const [p, a] = await Promise.all([
        api<ProgressData>(`/progress?learnerId=${learner.id}`),
        api<{ achievements: AchievementAll[] }>(`/achievements?learnerId=${learner.id}`),
      ]);
      setData(p);
      setAll(a.achievements);
    } catch (err: any) {
      toast(err.message || "Could not load progress", "warn");
    } finally {
      setLoading(false);
    }
  }, [learner, toast]);

  useEffect(() => { void load(); }, [load, version]);

  const makePlan = async () => {
    if (!learner || !goal.trim()) return;
    setPlanBusy(true);
    try {
      const res = await api<{ plan: typeof plan }>("/study-plan", { method: "POST", json: { learnerId: learner.id, goal, subject: planSubject, weeks } });
      setPlan(res.plan);
      setPlanOpen(false);
      toast("Study plan ready", "good");
    } catch (err: any) {
      toast(err.message || "Could not build that plan", "warn");
    } finally {
      setPlanBusy(false);
    }
  };

  if (loading) return <div className="page"><Spinner label="Counting your progress…" /></div>;
  if (!data) return null;

  const activeDays = data.last14.filter((d) => d.active).length;

  return (
    <div className="page stack">
      <div className="page__head">
        <div>
          <h1 className="page__title">Progress & achievements</h1>
          <p className="page__sub">Real learning, measured honestly — not a leaderboard against anyone else.</p>
        </div>
        <div className="page-actions">
          <Button icon="target" onClick={() => setPlanOpen(true)}>Build a study plan</Button>
        </div>
      </div>

      <div className="grid grid--4">
        <Card><Stat icon="flame" label="Day streak" value={data.learner.streak} note={data.learner.streak ? "Keep it gentle" : "Every day counts"} /></Card>
        <Card><Stat icon="star" label="Total XP" value={data.learner.xp} note={`${data.counts.lessonsCompleted} lessons completed`} /></Card>
        <Card><Stat icon="target" label="Average quiz score" value={`${data.counts.avgScore}%`} note={`${data.counts.quizzesTaken} quizzes taken`} /></Card>
        <Card><Stat icon="clock" label="Learning time" value={`${data.counts.minutes} min`} note={`${activeDays} active days in 2 weeks`} /></Card>
      </div>

      <div className="grid grid--2">
        <Card title="Your last two weeks" subtitle={`${activeDays} active day${activeDays === 1 ? "" : "s"} — consistency beats intensity.`}>
          <div className="cal">
            {data.last14.map((d) => (
              <div key={d.date} className={`cal__day ${d.active ? "cal__day--on" : ""}`} title={`${d.date}: ${d.active ? "learned" : "no activity"}`} />
            ))}
          </div>
          <div className="spread" style={{ marginTop: 8 }}>
            <span className="tiny muted">Two weeks ago</span>
            <span className="tiny muted">Today</span>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <LearnerAvatar size={64} state={activeDays > 6 ? "celebrating" : "encouraging"} />
            <p className="small muted" style={{ margin: 0, flex: 1 }}>
              {data.learner.streak >= 7
                ? "A full week of learning — that's a habit forming. Nothing is lost if you rest tomorrow."
                : activeDays > 2
                  ? "Short, regular sessions are doing more for you than a long cram ever would."
                  : "One small lesson today keeps the momentum kind and easy."}
            </p>
          </div>
        </Card>

        <Card title="Knowledge by subject" subtitle="Mastery grows with lessons and practice.">
          {data.progress.length ? (
            <div className="stack">
              {data.progress.map((p) => {
                const s = meta?.subjects.find((x) => x.id === p.subject);
                return (
                  <div key={p.subject}>
                    <div className="spread" style={{ marginBottom: 4 }}>
                      <span className="small"><strong>{s?.icon} {s?.name || p.subject}</strong></span>
                      <span className="tiny muted">{p.lessons_done} lesson{p.lessons_done === 1 ? "" : "s"} · {p.minutes} min</span>
                    </div>
                    <Bar value={p.mastery} color={s?.color || undefined} />
                    <div className="tiny muted" style={{ marginTop: 3 }}>{p.mastery}% mastery</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>Complete a lesson and your subject mastery starts filling in.</p>
          )}
        </Card>
      </div>

      <div className="grid grid--2">
        <Card title="Recent quiz results" action={<Button size="sm" variant="ghost" onClick={() => navigate("/practice")}>Practice →</Button>}>
          {data.attempts.length ? (
            <div className="stack stack--sm">
              {data.attempts.map((a, i) => {
                const pct = Math.round((a.score / Math.max(1, a.total)) * 100);
                return (
                  <div key={i} className="lesson-row" style={{ cursor: "default" }}>
                    <span className="lesson-row__icon">{pct >= 80 ? "🌟" : pct >= 50 ? "📈" : "🧩"}</span>
                    <span className="lesson-row__body">
                      <span className="lesson-row__title">{a.title}</span>
                      <span className="lesson-row__meta">{a.score}/{a.total} · {timeAgo(a.created_at)}</span>
                    </span>
                    <Badge tone={pct >= 80 ? "teal" : pct >= 50 ? "amber" : "pink"}>{pct}%</Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>No quizzes yet. A short quiz is a kind way to find gaps.</p>
          )}
        </Card>

        <Card title="Recent activity" subtitle="Every step counts, including small ones.">
          {data.activity.length ? (
            <div className="stack stack--sm">
              {data.activity.slice(0, 8).map((a, i) => (
                <div key={i} className="row" style={{ justifyContent: "space-between", paddingBottom: 6, borderBottom: "1px solid var(--line)" }}>
                  <span className="small">{a.detail}</span>
                  <span className="tiny muted">{a.xp ? `+${a.xp} XP · ` : ""}{timeAgo(a.created_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>Your activity will appear here.</p>
          )}
        </Card>
      </div>

      <Card title={`Achievements (${all.filter((a) => a.earned).length} of ${all.length})`} subtitle="Celebrating consistent learning, never competition.">
        <div className="ach-grid">
          {all.map((a) => (
            <div key={a.code} className={`ach-card ${a.earned ? "" : "ach-card--locked"}`}>
              <div className="ach-card__icon">{a.icon}</div>
              <div className="ach-card__name">{a.name}</div>
              <div className="ach-card__desc">{a.description}</div>
              {a.earned && a.earnedAt ? <div className="tiny muted" style={{ marginTop: 4 }}>{timeAgo(a.earnedAt)}</div> : null}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Lessons in your history">
        {data.lessons.length ? (
          <div className="stack stack--sm">
            {data.lessons.map((l, i) => (
              <div key={i} className="lesson-row" style={{ cursor: "pointer" }} onClick={() => navigate("/lessons")}>
                <span className="lesson-row__icon">{meta?.subjects.find((s) => s.id === l.subject)?.icon || "📘"}</span>
                <span className="lesson-row__body">
                  <span className="lesson-row__title">{l.title}</span>
                  <span className="lesson-row__meta">{l.status === "completed" ? "Completed" : `${l.progress}% in progress`} · {timeAgo(l.updated_at)}</span>
                </span>
                <Icon name="arrow" size={16} />
              </div>
            ))}
          </div>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>No lessons yet — your first one is a good place to start.</p>
        )}
      </Card>

      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Build a study plan"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlanOpen(false)}>Cancel</Button>
            <Button onClick={makePlan} loading={planBusy} icon="sparkles">Create plan</Button>
          </>
        }
      >
        <div className="stack">
          <Field label="What do you want to achieve?" hint="Be specific — 'feel confident with fractions before my exam' works better than 'get better at maths'.">
            <textarea className="textarea" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="I want to understand fractions well enough to help with a test in three weeks." />
          </Field>
          <div className="onboard__grid">
            <Field label="Subject">
              <select className="select" value={planSubject} onChange={(e) => setPlanSubject(e.target.value)}>
                {(meta?.subjects || []).map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </Field>
            <Field label="How many weeks?">
              <select className="select" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                {[2, 4, 6, 8, 12].map((w) => <option key={w} value={w}>{w} weeks</option>)}
              </select>
            </Field>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(plan)} onClose={() => setPlan(null)} wide title={plan?.title || "Your plan"}>
        {plan ? (
          <div className="stack">
            {plan.weeks.map((w) => (
              <div key={w.week} className="card card--flat" style={{ padding: 14 }}>
                <div className="spread" style={{ marginBottom: 4 }}>
                  <strong>Week {w.week} · {w.focus}</strong>
                  <Badge tone="violet">{w.lessons.length} lessons</Badge>
                </div>
                <div className="small muted">{w.lessons.join(" · ") || "Practice and review"}</div>
                <div className="tiny" style={{ marginTop: 6 }}><strong>Practice:</strong> {w.practice}</div>
                <div className="tiny" style={{ marginTop: 2 }}><strong>Checkpoint:</strong> {w.checkpoint}</div>
              </div>
            ))}
            <div className="onboard__note">
              Plans are a guide, not a contract. {learner?.tutorName} will adjust as you go — and you can change the pace in Settings.
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
