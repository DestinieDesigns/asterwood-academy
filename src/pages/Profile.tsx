import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LearnerAvatar } from "../components/character/Avatar";
import { Badge, Button, Card, Field, Icon, Modal, Spinner, Stat } from "../components/ui";
import { api, timeAgo, type Achievement, type ActivityRow, type Learner, type MemoryItem } from "../lib/api";
import { useApp } from "../lib/store";

type ProfileData = {
  learner: Learner;
  memory: MemoryItem[];
  achievements: Achievement[];
  activity: ActivityRow[];
  counts: { lessons: number; lessonsCompleted: number; quizzes: number; flashcards: number; library: number; minutes: number };
};

const KIND_LABEL: Record<string, string> = {
  fact: "About me",
  interest: "Interest",
  preference: "How I learn",
  strength: "Strength",
  struggle: "Needs practice",
  goal: "Goal",
  progress: "Progress",
};

export function Profile() {
  const { learner, meta, user, version, bump, toast, patchLearner } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [editing, setEditing] = useState<MemoryItem | null>(null);
  const [kind, setKind] = useState("fact");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmResetMemory, setConfirmResetMemory] = useState(false);
  const [confirmResetHistory, setConfirmResetHistory] = useState(false);

  const load = useCallback(async () => {
    if (!learner) return;
    try {
      const d = await api<ProfileData>(`/learners/${learner.id}/profile`);
      setData(d);
    } catch (err: any) {
      toast(err.message || "Could not load your profile", "warn");
    } finally {
      setLoading(false);
    }
  }, [learner, toast]);

  useEffect(() => { void load(); }, [load, version]);

  const saveMemory = async () => {
    if (!learner || !content.trim()) return;
    setBusy(true);
    try {
      if (editing) await api(`/memory/${editing.id}`, { method: "PATCH", json: { content } });
      else await api(`/learners/${learner.id}/memory`, { method: "POST", json: { kind, content } });
      setMemoryOpen(false);
      setEditing(null);
      setContent("");
      bump();
      void load();
      toast(editing ? "Memory updated" : "Saved — I'll remember that", "good");
    } catch (err: any) {
      toast(err.message || "Could not save that", "warn");
    } finally {
      setBusy(false);
    }
  };

  const deleteMemory = async (item: MemoryItem) => {
    try {
      await api(`/memory/${item.id}`, { method: "DELETE" });
      bump();
      void load();
      toast("Forgotten", "good");
    } catch (err: any) {
      toast(err.message || "Could not delete that", "warn");
    }
  };

  const resetMemory = async () => {
    if (!learner) return;
    try {
      await api(`/learners/${learner.id}/reset-memory`, { method: "POST", json: {} });
      setConfirmResetMemory(false);
      bump();
      void load();
      toast("Memory cleared. Your lessons and progress are untouched.", "good");
    } catch (err: any) {
      toast(err.message || "Could not clear memory", "warn");
    }
  };

  const resetHistory = async () => {
    if (!learner) return;
    try {
      await api(`/learners/${learner.id}/reset-history`, { method: "POST", json: {} });
      setConfirmResetHistory(false);
      bump();
      void load();
      toast("Learning history reset", "good");
    } catch (err: any) {
      toast(err.message || "Could not reset history", "warn");
    }
  };

  if (!learner) return null;
  if (loading) return <div className="page"><Spinner label="Opening your profile…" /></div>;
  if (!data) return null;

  const personality = meta?.personalities.find((p) => p.id === learner.tutorPersonality);

  return (
    <div className="page stack">
      <div className="page__head">
        <div>
          <h1 className="page__title">My profile</h1>
          <p className="page__sub">You, your tutor, and everything Asterwood remembers — all editable.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon="settings" onClick={() => navigate("/settings")}>Edit details</Button>
        </div>
      </div>

      <Card>
        <div className="profile-head">
          <span className="avatar-lg">{learner.name.slice(0, 1).toUpperCase()}</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ fontSize: 22 }}>{learner.name}</h2>
            <div className="tiny muted" style={{ marginTop: 2 }}>
              {learner.age ? `Age ${learner.age} · ` : ""}{learner.levelLabel}{learner.grade ? ` · ${learner.grade}` : ""} · {learner.language}
              {learner.country ? ` · ${learner.country}` : ""}
            </div>
            <div className="row row--tight" style={{ marginTop: 8 }}>
              <Badge tone="violet">🔥 {learner.streak}-day streak</Badge>
              <Badge tone="teal">⚡ {learner.xp} XP</Badge>
              <Badge tone="muted">{meta?.achievements ? `${data.achievements.length} achievements` : ""}</Badge>
              {learner.guardianConsent ? <Badge tone="amber">Guardian approved</Badge> : null}
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <LearnerAvatar size={88} state="greeting" onClick={() => navigate("/studio")} />
            <div>
              <div className="tiny muted">Your tutor</div>
              <strong>{learner.tutorName}</strong>
              <div className="tiny muted">{personality?.name}</div>
              <button className="chip" style={{ marginTop: 5, fontSize: 11 }} onClick={() => navigate("/academy")}>Academy →</button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid--4">
        <Card><Stat icon="book" label="Lessons completed" value={data.counts.lessonsCompleted} note={`${data.counts.lessons} lessons built`} /></Card>
        <Card><Stat icon="target" label="Quizzes taken" value={data.counts.quizzes} /></Card>
        <Card><Stat icon="clock" label="Minutes learning" value={data.counts.minutes} /></Card>
        <Card><Stat icon="library" label="Saved items" value={data.counts.library} note={`${data.counts.flashcards} flashcards`} /></Card>
      </div>

      <div className="grid grid--2">
        <Card
          title="What your tutor remembers"
          subtitle="You can correct anything here. Memory is only used to teach you better."
          action={<Button size="sm" variant="soft" icon="plus" onClick={() => { setEditing(null); setKind("fact"); setContent(""); setMemoryOpen(true); }}>Add</Button>}
        >
          {data.memory.length ? (
            <div style={{ maxHeight: 430, overflowY: "auto" }}>
              {data.memory.map((m) => (
                <div key={m.id} className="memory-item">
                  <span className="memory-item__kind">{KIND_LABEL[m.kind] || m.kind}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small">{m.content}</div>
                    <div className="tiny muted">{timeAgo(m.created_at)}</div>
                  </div>
                  <div className="row row--tight">
                    <button className="icon-btn" aria-label="Edit memory" onClick={() => { setEditing(m); setKind(m.kind); setContent(m.content); setMemoryOpen(true); }}><Icon name="edit" size={13} /></button>
                    <button className="icon-btn" aria-label="Forget this" onClick={() => deleteMemory(m)}><Icon name="trash" size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              {learner.memoryEnabled ? "Nothing yet. As you learn, what works for you will appear here." : "Memory is switched off for this profile, so nothing is being remembered."}
            </p>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <Button size="sm" variant="ghost" onClick={() => setConfirmResetMemory(true)}>Clear all memory</Button>
            <span className="tiny muted">Progress and lessons are kept.</span>
          </div>
        </Card>

        <div className="stack">
          <Card title="How I learn best" subtitle="From your setup and our lessons.">
            <dl className="kv">
              <dt>Learning styles</dt><dd>{learner.styles.join(", ") || "Still discovering"}</dd>
              <dt>Interests</dt><dd>{learner.interests.join(", ") || "Add some in Settings"}</dd>
              <dt>Enjoys</dt><dd>{learner.loves.join(", ") || "—"}</dd>
              <dt>Finds tricky</dt><dd>{learner.struggles.join(", ") || "—"}</dd>
              <dt>Lesson length</dt><dd style={{ textTransform: "capitalize" }}>{learner.lessonLength}</dd>
              <dt>Hints before answers</dt><dd>{learner.hintsFirst ? "Yes" : "No — give the answer sooner"}</dd>
              <dt>Extra time</dt><dd>{learner.extraTime ? "Yes, untimed" : "No timer pressure by default"}</dd>
            </dl>
            <div className="row" style={{ marginTop: 12 }}>
              <Button size="sm" variant="secondary" icon="settings" onClick={() => navigate("/settings")}>Change these</Button>
            </div>
          </Card>

          <Card title="Achievements" action={<Button size="sm" variant="ghost" onClick={() => navigate("/progress")}>All →</Button>}>
            {data.achievements.length ? (
              <div className="row row--tight">
                {data.achievements.slice(0, 8).map((a) => (
                  <span key={a.code} className="chip" title={a.description}>{a.icon} {a.name}</span>
                ))}
              </div>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>Your first badge is one lesson away.</p>
            )}
          </Card>
        </div>
      </div>

      <Card title="Privacy & control" subtitle="You are in charge of your learning data.">
        <div className="switch">
          <div className="switch__text">
            <strong>Let {learner.tutorName} remember me</strong>
            <span>Turn off to stop new memory being saved. Existing memory stays until you clear it.</span>
          </div>
          <label className="switch__control">
            <input type="checkbox" checked={learner.memoryEnabled} onChange={async (e) => { try { await patchLearner({ memoryEnabled: e.target.checked }); toast(e.target.checked ? "Memory on" : "Memory off — nothing new will be saved", "good"); } catch { toast("Could not change that", "warn"); } }} />
            <span className="switch__track" />
          </label>
        </div>
        <div className="switch">
          <div className="switch__text">
            <strong>Voice features</strong>
            <span>Speech input, read-aloud and captions. Text-only always works.</span>
          </div>
          <label className="switch__control">
            <input type="checkbox" checked={learner.voiceEnabled} onChange={async (e) => { try { await patchLearner({ voiceEnabled: e.target.checked }); } catch { toast("Could not change that", "warn"); } }} />
            <span className="switch__track" />
          </label>
        </div>
        <div className="switch">
          <div className="switch__text">
            <strong>XP, streaks and achievements</strong>
            <span>Purely for encouragement. Never a penalty for missing a day.</span>
          </div>
          <label className="switch__control">
            <input type="checkbox" checked={learner.gamification} onChange={async (e) => { try { await patchLearner({ gamification: e.target.checked }); } catch { toast("Could not change that", "warn"); } }} />
            <span className="switch__track" />
          </label>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <Button variant="secondary" icon="library" onClick={() => navigate("/library")}>Review saved materials</Button>
          <Button variant="danger" icon="trash" onClick={() => setConfirmResetHistory(true)}>Reset my learning history</Button>
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Signed in as {user?.email} ({user?.role}). {learner.guardianConsent ? "This profile was approved by a parent or guardian." : "You can enable guardian controls from a parent account."}
        </p>
      </Card>

      <Modal
        open={memoryOpen}
        onClose={() => { setMemoryOpen(false); setEditing(null); }}
        title={editing ? "Correct this memory" : "Add something for your tutor to remember"}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setMemoryOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={saveMemory} loading={busy}>Save</Button>
          </>
        }
      >
        <div className="stack">
          {!editing ? (
            <Field label="Type">
              <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label="Memory" hint="Write it as a fact about you, e.g. 'I prefer diagrams before formulas.'">
            <textarea className="textarea" value={content} onChange={(e) => setContent(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={confirmResetMemory}
        onClose={() => setConfirmResetMemory(false)}
        title="Clear everything your tutor remembers?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmResetMemory(false)}>Keep my memory</Button>
            <Button variant="danger" onClick={resetMemory}>Clear memory</Button>
          </>
        }
      >
        <p className="small">Your lessons, quizzes, XP and library stay exactly as they are. Only the notes your tutor keeps about how you learn will be removed.</p>
      </Modal>

      <Modal
        open={confirmResetHistory}
        onClose={() => setConfirmResetHistory(false)}
        title="Reset your learning history?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmResetHistory(false)}>Cancel</Button>
            <Button variant="danger" onClick={resetHistory}>Reset everything</Button>
          </>
        }
      >
        <p className="small">This deletes your lessons, quizzes and attempts, flashcards, saved library items, schedule progress, memory, XP and achievements. Your profile details and account stay. This cannot be undone.</p>
      </Modal>
    </div>
  );
}
