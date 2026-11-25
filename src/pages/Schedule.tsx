import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Field, Icon, Spinner } from "../components/ui";
import { TutorPresence } from "../components/character/TutorPresence";
import { api, formatDate, formatTime, type ScheduleSession } from "../lib/api";
import { startLesson } from "../lib/actions";
import { useApp } from "../lib/store";

function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(16, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Schedule() {
  const { learner, meta, version, bump, toast } = useApp();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ScheduleSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [startAt, setStartAt] = useState(defaultStart());
  const [minutes, setMinutes] = useState(20);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learner) return;
    try {
      const data = await api<{ sessions: ScheduleSession[] }>(`/schedule?learnerId=${learner.id}`);
      setSessions(data.sessions);
    } catch (err: any) {
      toast(err.message || "Could not load your schedule", "warn");
    } finally {
      setLoading(false);
    }
  }, [learner, toast]);

  useEffect(() => { void load(); }, [load, version]);

  const add = async () => {
    if (!learner || !title.trim()) {
      toast("Give your study session a name first.", "warn");
      return;
    }
    setBusy(true);
    try {
      await api("/schedule", { method: "POST", json: { learnerId: learner.id, title, subject: subject || null, startAt, minutes, note } });
      setTitle("");
      setNote("");
      bump();
      void load();
      toast("Study session added", "good");
    } catch (err: any) {
      toast(err.message || "Could not add that session", "warn");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (session: ScheduleSession) => {
    try {
      await api(`/schedule/${session.id}`, { method: "PATCH", json: { done: !session.done } });
      void load();
    } catch (err: any) {
      toast(err.message || "Could not update that session", "warn");
    }
  };

  const remove = async (session: ScheduleSession) => {
    try {
      await api(`/schedule/${session.id}`, { method: "DELETE" });
      void load();
      toast("Session removed", "good");
    } catch (err: any) {
      toast(err.message || "Could not remove that session", "warn");
    }
  };

  const beginNow = async (session: ScheduleSession) => {
    if (!learner) return;
    setStarting(session.id);
    try {
      const lesson = await startLesson({ learnerId: learner.id, subject: session.subject || "reading", topic: session.title, duration: session.minutes });
      bump();
      navigate(`/lessons/${lesson.id}`);
    } catch (err: any) {
      toast(err.message || "Could not start that lesson", "warn");
    } finally {
      setStarting(null);
    }
  };

  if (!learner) return null;
  const upcoming = sessions.filter((s) => !s.done && new Date(s.startAt).getTime() >= Date.now() - 3600000);
  const past = sessions.filter((s) => s.done || new Date(s.startAt).getTime() < Date.now() - 3600000);

  return (
    <div className="page stack">
      <div className="page__head">
        <div>
          <h1 className="page__title">Learning schedule</h1>
          <p className="page__sub">A gentle rhythm beats a crowded calendar. Plan a little, keep it kind.</p>
        </div>
      </div>

      <TutorPresence
        message={`Sessions you plan here come back to me. I'll remember them, show up ready, and follow up — kindly — on anything that slips. A missed session is information, not a failure.`}
        cta={`Talk it through with ${learner.tutorName}`}
      />

      <div className="grid grid--dash">
        <div className="stack">
          <Card title="Coming up" subtitle={`${upcoming.length} planned session${upcoming.length === 1 ? "" : "s"}`}>
            {loading ? (
              <Spinner />
            ) : upcoming.length ? (
              <div className="stack stack--sm">
                {upcoming.map((s) => (
                  <div key={s.id} className="schedule-item">
                    <div className="schedule-item__time">
                      <strong>{formatTime(s.startAt)}</strong>
                      <span>{formatDate(s.startAt)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="spread">
                        <div>
                          <div className="small" style={{ fontWeight: 700 }}>{s.title}</div>
                          <div className="tiny muted">{s.subjectName || "General"} · {s.minutes} min{s.note ? ` · ${s.note}` : ""}</div>
                        </div>
                        <div className="row row--tight">
                          <Button size="sm" variant="soft" icon="play" onClick={() => beginNow(s)} loading={starting === s.id}>Start</Button>
                          <button className="icon-btn" aria-label="Mark done" onClick={() => toggle(s)}><Icon name="check" size={14} /></button>
                          <button className="icon-btn" aria-label="Delete" onClick={() => remove(s)}><Icon name="trash" size={14} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="calendar" title="Nothing planned yet" text="Add a session on the right — even 15 minutes helps." />
            )}
          </Card>

          <Card title="Past & completed" subtitle="A record, not a scorecard.">
            {past.length ? (
              <div className="stack stack--sm">
                {past.map((s) => (
                  <div key={s.id} className={`schedule-item ${s.done ? "schedule-item--done" : ""}`}>
                    <div className="schedule-item__time">
                      <strong>{formatTime(s.startAt)}</strong>
                      <span>{formatDate(s.startAt)}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="small" style={{ fontWeight: 650 }}>{s.title}</div>
                      <div className="tiny muted">{s.subjectName || "General"} · {s.minutes} min</div>
                    </div>
                    <Badge tone={s.done ? "teal" : "muted"}>{s.done ? "Done" : "Missed"}</Badge>
                    <div className="row row--tight">
                      <button className="icon-btn" aria-label="Toggle done" onClick={() => toggle(s)}><Icon name="check" size={14} /></button>
                      <button className="icon-btn" aria-label="Delete" onClick={() => remove(s)}><Icon name="trash" size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>Nothing in the past yet.</p>
            )}
          </Card>
        </div>

        <Card title="Plan a session">
          <div className="stack">
            <Field label="What will you work on?">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fractions practice" />
            </Field>
            <Field label="Subject">
              <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">General</option>
                {(meta?.subjects || []).map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </Field>
            <Field label="When?">
              <input className="input" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </Field>
            <Field label={`Length · ${minutes} minutes`}>
              <input type="range" min={10} max={90} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} style={{ accentColor: "var(--violet)" }} />
            </Field>
            <Field label="Note" hint="Optional">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. before dinner" />
            </Field>
            <Button icon="plus" onClick={add} loading={busy}>Add to schedule</Button>
            <div className="onboard__note">
              Reminders aren't forced on you. Asterwood shows what's coming up; you decide when to learn.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
