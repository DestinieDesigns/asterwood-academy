import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, Icon } from "../components/ui";
import { TutorPresence } from "../components/character/TutorPresence";
import { startLesson, startQuiz } from "../lib/actions";
import { useApp } from "../lib/store";

export function Subjects() {
  const { learner, meta, toast, bump } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("All");
  const [openId, setOpenId] = useState<string | null>(meta?.subjects[0]?.id || null);
  const [busy, setBusy] = useState<string | null>(null);

  const subjects = meta?.subjects || [];
  const groups = ["All", ...Array.from(new Set(subjects.map((s) => s.group)))];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subjects
      .filter((s) => group === "All" || s.group === group)
      .map((s) => {
        if (!q) return s;
        if (s.name.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q)) return s;
        const depts = s.departments
          .map((d) => ({ ...d, topics: d.topics.filter((t) => t.name.toLowerCase().includes(q)) }))
          .filter((d) => d.topics.length || d.name.toLowerCase().includes(q));
        return depts.length ? { ...s, departments: depts } : null;
      })
      .filter(Boolean) as typeof subjects;
  }, [subjects, search, group]);

  if (!learner) return null;
  const allowed = learner.allowedSubjects;

  const learn = async (subjectId: string, topic: string) => {
    if (allowed.length && !allowed.includes(subjectId)) {
      toast("That subject isn't enabled for this profile. A parent or educator can turn it on.", "warn");
      return;
    }
    setBusy(`lesson:${subjectId}:${topic}`);
    try {
      const lesson = await startLesson({ learnerId: learner.id, subject: subjectId, topic });
      bump();
      navigate(`/lessons/${lesson.id}`);
    } catch (err: any) {
      toast(err.message || "Could not build that lesson", "warn");
    } finally {
      setBusy(null);
    }
  };

  const quizFor = async (subjectId: string, topic: string) => {
    setBusy(`quiz:${subjectId}:${topic}`);
    try {
      const quiz = await startQuiz({ learnerId: learner.id, subject: subjectId, topic, count: 6 });
      bump();
      navigate(`/practice/${quiz.id}`);
    } catch (err: any) {
      toast(err.message || "Could not build that quiz", "warn");
    } finally {
      setBusy(null);
    }
  };

  const totalTopics = subjects.reduce((n, s) => n + s.departments.reduce((m, d) => m + d.topics.length, 0), 0);

  return (
    <div className="page stack">
      <div className="page__head">
        <div>
          <h1 className="page__title">Explore subjects</h1>
          <p className="page__sub">
            {totalTopics} topics across {subjects.length} departments — all pitched at {learner.name}'s level, and adjustable any time.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon="chat" onClick={() => navigate("/tutor")}>Ask {learner.tutorName}</Button>
        </div>
      </div>

      <TutorPresence
        message={`Pick any subject and I'll set the room, pitch it to your level, and remember what we covered last time. If a topic feels heavy, we'll start smaller rather than louder.`}
        cta={`Plan a lesson with ${learner.tutorName}`}
      />

      <div className="row">
        <div className="row" style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <Icon name="search" size={16} />
          <input
            className="input"
            placeholder="Search subjects or topics — fractions, fossils, ancient Egypt…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 12 }}
          />
        </div>
        <div className="row row--tight">
          {groups.map((g) => (
            <button key={g} className={`chip ${group === g ? "chip--active" : ""}`} onClick={() => setGroup(g)}>{g}</button>
          ))}
        </div>
      </div>

      {allowed.length ? (
        <div className="challenge" style={{ background: "var(--amber-soft)" }}>
          <strong className="small">This profile has selected subjects enabled by a parent or educator.</strong>
          <p className="tiny muted" style={{ margin: "3px 0 0" }}>
            Enabled: {allowed.map((a) => subjects.find((s) => s.id === a)?.name || a).join(", ")}
          </p>
        </div>
      ) : null}

      <div className="subject-grid">
        {filtered.map((s) => {
          const topicCount = s.departments.reduce((n, d) => n + d.topics.length, 0);
          const isOpen = openId === s.id;
          const blocked = allowed.length && !allowed.includes(s.id);
          return (
            <article className="subject-card" key={s.id} style={{ opacity: blocked ? 0.6 : 1 }}>
              <div className="subject-card__head">
                <span className="subject-card__icon" style={{ background: `${s.color}1f`, color: s.color }}>{s.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="subject-card__name">{s.name}</div>
                  <div className="subject-card__count">{s.departments.length} departments · {topicCount} topics</div>
                </div>
                {s.optional ? <span className="badge badge--amber" style={{ marginLeft: "auto" }}>Optional</span> : null}
              </div>
              <p className="subject-card__blurb">{s.blurb}</p>
              <div className="subject-card__foot">
                <Button
                  size="sm"
                  variant="soft"
                  icon="play"
                  disabled={Boolean(blocked)}
                  loading={busy === `lesson:${s.id}:${s.departments[0]?.topics[0]?.name}`}
                  onClick={() => learn(s.id, s.departments[0]?.topics[0]?.name || s.name)}
                >
                  Start a lesson
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpenId(isOpen ? null : s.id)}>
                  {isOpen ? "Hide topics" : "Browse topics"}
                </Button>
              </div>

              {isOpen ? (
                <div>
                  {s.departments.map((d) => (
                    <div className="dept" key={d.name}>
                      <div className="spread">
                        <span className="dept__name">{d.name}</span>
                        <span className="tiny muted">{d.topics.length} topics</span>
                      </div>
                      <div className="dept__topics">
                        {d.topics.map((t) => (
                          <button
                            key={`${d.name}-${t.name}`}
                            className="topic-btn"
                            disabled={Boolean(blocked)}
                            onClick={() => learn(s.id, t.name)}
                            title={`Start a lesson on ${t.name}`}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                      {d.topics[0] ? (
                        <button
                          className="tiny muted"
                          style={{ background: "none", border: 0, padding: "6px 0 0", cursor: "pointer", textDecoration: "underline" }}
                          onClick={() => quizFor(s.id, d.topics[0].name)}
                        >
                          Quiz me on {d.name.toLowerCase()}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="empty">
            <h3>No subjects match "{search}"</h3>
            <p>Try a shorter word, or ask your tutor — you can learn almost anything.</p>
            <Button variant="secondary" size="sm" onClick={() => { setSearch(""); setGroup("All"); }}>Clear search</Button>
          </div>
        </Card>
      ) : null}

      <Card className="card--tint">
        <div className="spread">
          <div>
            <h2 className="card__title">Can't find your topic?</h2>
            <p className="small muted" style={{ margin: "3px 0 0" }}>
              Type any subject, skill or question into the lesson builder and {learner.tutorName} will build a lesson around it.
            </p>
          </div>
          <Button icon="plus" onClick={() => navigate("/lessons?new=1")}>Build a custom lesson</Button>
        </div>
      </Card>
    </div>
  );
}
