import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Field, Icon, Modal, Spinner } from "../components/ui";
import { api, timeAgo, type Lesson } from "../lib/api";
import { startLesson } from "../lib/actions";
import { useApp } from "../lib/store";

export function Lessons() {
  const { learner, meta, version, bump, toast } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "in_progress" | "completed">("all");
  const [builderOpen, setBuilderOpen] = useState(params.get("new") === "1");
  const [subject, setSubject] = useState("math");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(20);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Lesson | null>(null);

  const load = useCallback(async () => {
    if (!learner) return;
    try {
      const data = await api<{ lessons: Lesson[] }>(`/lessons?learnerId=${learner.id}`);
      setLessons(data.lessons);
    } catch (err: any) {
      toast(err.message || "Could not load lessons", "warn");
    } finally {
      setLoading(false);
    }
  }, [learner, toast]);

  useEffect(() => {
    void load();
  }, [load, version]);

  useEffect(() => {
    if (params.get("new") === "1") setBuilderOpen(true);
  }, [params]);

  const closeBuilder = () => {
    setBuilderOpen(false);
    if (params.get("new")) {
      params.delete("new");
      setParams(params, { replace: true });
    }
  };

  const create = async () => {
    if (!learner) return;
    setBusy(true);
    try {
      const lesson = await startLesson({ learnerId: learner.id, subject, topic: topic.trim() || undefined, duration, extraNote: note.trim() || undefined });
      bump();
      closeBuilder();
      setTopic("");
      setNote("");
      navigate(`/lessons/${lesson.id}`);
    } catch (err: any) {
      toast(err.message || "Could not build that lesson", "warn");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    try {
      await api(`/lessons/${confirmDelete.id}`, { method: "DELETE" });
      setConfirmDelete(null);
      bump();
      void load();
      toast("Lesson deleted", "good");
    } catch (err: any) {
      toast(err.message || "Could not delete that lesson", "warn");
    }
  };

  if (!learner) return null;
  const filtered = lessons.filter((l) => filter === "all" || l.status === filter);
  const subjects = meta?.subjects || [];

  return (
    <div className="page stack">
      <div className="page__head">
        <div>
          <h1 className="page__title">My lessons</h1>
          <p className="page__sub">Lessons you can pause, resume and revisit — every one built around you.</p>
        </div>
        <div className="page-actions">
          <Button icon="plus" onClick={() => setBuilderOpen(true)}>New lesson</Button>
        </div>
      </div>

      <div className="row row--tight">
        {(["all", "in_progress", "completed"] as const).map((f) => (
          <button key={f} className={`chip ${filter === f ? "chip--active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? `All (${lessons.length})` : f === "in_progress" ? `In progress (${lessons.filter((l) => l.status === "in_progress").length})` : `Completed (${lessons.filter((l) => l.status === "completed").length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading your lessons…" />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="book"
            title={filter === "completed" ? "No completed lessons yet" : "Your first lesson is waiting"}
            text="Tell your tutor a subject or a topic and it will build a complete lesson: objectives, examples, practice and a knowledge check."
            action={<Button icon="plus" onClick={() => setBuilderOpen(true)}>Build a lesson</Button>}
          />
        </Card>
      ) : (
        <div className="stack stack--sm">
          {filtered.map((l) => {
            const s = subjects.find((x) => x.id === l.subject);
            return (
              <div key={l.id} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ alignItems: "flex-start" }}>
                  <span className="lesson-row__icon" style={{ background: `${s?.color || "#7c5cf0"}1a` }}>{s?.icon || "📘"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="spread" style={{ gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{l.title}</div>
                        <div className="tiny muted">
                          {l.subjectName} · {l.duration} min · {timeAgo(l.updatedAt)} · {l.sections.length} sections
                        </div>
                      </div>
                      <div className="row row--tight">
                        <Badge tone={l.status === "completed" ? "teal" : "violet"}>{l.status === "completed" ? "Completed" : `${l.progress}%`}</Badge>
                        <Button size="sm" variant="soft" icon={l.status === "completed" ? "book" : "play"} onClick={() => navigate(`/lessons/${l.id}`)}>
                          {l.status === "completed" ? "Revisit" : "Continue"}
                        </Button>
                        <button className="icon-btn" aria-label="Delete lesson" onClick={() => setConfirmDelete(l)}><Icon name="trash" size={15} /></button>
                      </div>
                    </div>
                    <div className="bar" style={{ marginTop: 10, height: 6 }}>
                      <div className="bar__fill" style={{ width: `${l.status === "completed" ? 100 : l.progress}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={builderOpen}
        onClose={closeBuilder}
        title={`Build a lesson with ${learner.tutorName}`}
        footer={
          <>
            <Button variant="secondary" onClick={closeBuilder}>Cancel</Button>
            <Button onClick={create} loading={busy} icon="sparkles">Create lesson</Button>
          </>
        }
      >
        <div className="stack">
          <Field label="Subject">
            <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
          </Field>
          <Field label="Topic or question" hint="Leave blank and your tutor will choose a sensible next step for your level.">
            <input
              className="input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. long division, the water cycle, essay introductions"
              list="topic-suggestions"
            />
            <datalist id="topic-suggestions">
              {(subjects.find((s) => s.id === subject)?.departments || []).flatMap((d) => d.topics.map((t) => <option key={t.name} value={t.name} />))}
            </datalist>
          </Field>
          <Field label="How long should it take?">
            <div className="row row--tight">
              {[{ m: 10, l: "Quick · 10 min" }, { m: 20, l: "Standard · 20 min" }, { m: 40, l: "Extended · 40 min" }].map((o) => (
                <button key={o.m} className={`choice ${duration === o.m ? "choice--on" : ""}`} onClick={() => setDuration(o.m)}>{o.l}</button>
              ))}
            </div>
          </Field>
          <Field label="Anything specific?" hint="Optional — e.g. 'use football examples', 'I have an exam on Friday', 'explain like I'm 7'.">
            <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tell your tutor what would help most…" />
          </Field>
          <div className="onboard__note">
            {meta?.ai.enabled
              ? "Your lesson is written live by your AI tutor, then saved so you can revisit it."
              : "Lessons come from Asterwood's built-in curriculum and include objectives, worked examples, practice and a check. Add an AI key in Settings for fully bespoke lessons."}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this lesson?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Keep it</Button>
            <Button variant="danger" onClick={remove}>Delete</Button>
          </>
        }
      >
        <p className="small">"{confirmDelete?.title}" and its progress will be removed. Notes you saved to your library are kept.</p>
      </Modal>
    </div>
  );
}
