import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mascot } from "../components/Mascot";
import { Badge, Button, Card, Field, Icon, Modal, Spinner } from "../components/ui";
import { api, timeAgo, type Lesson, type Quiz } from "../lib/api";
import { useApp } from "../lib/store";

type ChildRow = {
  id: string;
  name: string;
  age: number | null;
  grade: string | null;
  levelLabel: string;
  ageGroup: string | null;
  xp: number;
  streak: number;
  onboarded: boolean;
  guardianConsent: boolean;
  memoryEnabled: boolean;
  voiceEnabled: boolean;
  uploadsEnabled: boolean;
  gamification: boolean;
  allowedSubjects: string[];
  dailyGoal: number;
  lessonsCompleted: number;
  lessonsInProgress: number;
  quizzes: number;
  avgScore: number;
  weakest: string[];
  recentLessons: { title: string; subject: string; status: string; updated_at: number }[];
  recentAchievements: { code: string; name?: string; icon?: string }[];
  assignments: { id: string; kind: string; title: string; status: string; due_at: string | null; created_at: number }[];
  report?: {
    status: string;
    statusLabel: string;
    tone: string;
    headline: string;
    minutes: number;
    target: number;
    pct: number;
    openItems: number;
    overdue: number;
    missing: string[];
  };
};

type Group = { id: string; name: string; members: string[] };

type Overview = { learners: ChildRow[]; groups: Group[]; role: string };

export function FamilySetup() {
  const { refreshAuth, toast, user } = useApp();
  return (
    <div className="page" style={{ maxWidth: 680, paddingTop: 60 }}>
      <Card>
        <div className="row" style={{ marginBottom: 14 }}>
          <Mascot size={70} mood="wave" />
          <div>
            <h1 style={{ fontSize: 24 }}>Welcome, {user?.name || "there"}.</h1>
            <p className="small muted" style={{ margin: 0 }}>
              {user?.role === "educator" ? "Create your first student profile to begin." : "Create a learner profile for your child. You'll control their subjects, voice, uploads and privacy."}
            </p>
          </div>
        </div>
        <NewLearnerForm
          onCreated={async () => {
            await refreshAuth();
            toast("Learner profile created — let's set them up", "good");
          }}
          onError={(m) => toast(m, "warn")}
        />
      </Card>
    </div>
  );
}

function NewLearnerForm({ onCreated, onError }: { onCreated: () => Promise<void> | void; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [grade, setGrade] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const young = age && Number(age) < 13;

  const submit = async () => {
    if (!name.trim()) { onError("Please enter the learner's name"); return; }
    if (young && !consent) { onError("Please confirm your consent as parent or guardian"); return; }
    setBusy(true);
    try {
      await api("/learners", {
        method: "POST",
        json: { name: name.trim(), age: age ? Number(age) : null, grade, guardianConsent: young ? true : consent, onboarded: false },
      });
      setName(""); setAge(""); setGrade(""); setConsent(false);
      await onCreated();
    } catch (err: any) {
      onError(err.message || "Could not create that profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="onboard__grid">
        <Field label="Learner's name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" />
        </Field>
        <Field label="Age">
          <input className="input" type="number" min={3} max={120} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 8" />
        </Field>
        <Field label="Grade or level" hint="Optional">
          <input className="input" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. Grade 3" />
        </Field>
      </div>
      <label className="row small" style={{ alignItems: "flex-start", gap: 8, background: "var(--amber-soft)", padding: 10, borderRadius: 12 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          I'm the parent, guardian or educator responsible for this learner, and I agree to a learning profile being created{young ? " for a child under 13" : ""}.
        </span>
      </label>
      <Button onClick={submit} loading={busy} icon="plus">Create learner profile</Button>
      <p className="tiny muted" style={{ margin: 0 }}>
        After this you'll answer a few friendly questions with them — never a test — and then you can set subject, voice and upload permissions.
      </p>
    </div>
  );
}

export function Family() {
  const { learner, meta, user, version, bump, toast, switchLearner, learners } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [controlsFor, setControlsFor] = useState<ChildRow | null>(null);
  const [assignFor, setAssignFor] = useState<ChildRow | null>(null);
  const [groupName, setGroupName] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api<Overview>("/family/overview");
      setData(d);
    } catch (err: any) {
      toast(err.message || "Could not load the family dashboard", "warn");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load, version]);

  const openChild = async (child: ChildRow, to = "/") => {
    try {
      await switchLearner(child.id);
      navigate(to);
    } catch (err: any) {
      toast(err.message || "Could not open that profile", "warn");
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;
    try {
      await api("/family/groups", { method: "POST", json: { name: groupName } });
      setGroupName("");
      void load();
      toast("Group created", "good");
    } catch (err: any) {
      toast(err.message || "Could not create that group", "warn");
    }
  };

  const toggleMember = async (group: Group, childId: string) => {
    const isMember = group.members.includes(childId);
    try {
      await api(`/family/groups/${group.id}/members`, { method: "POST", json: { learnerId: childId, remove: isMember } });
      void load();
    } catch (err: any) {
      toast(err.message || "Could not update the group", "warn");
    }
  };

  if (loading) return <div className="page"><Spinner label="Gathering progress…" /></div>;
  if (!data) return null;

  const totalLessons = data.learners.reduce((n, c) => n + c.lessonsCompleted, 0);
  const totalQuizzes = data.learners.reduce((n, c) => n + c.quizzes, 0);

  return (
    <div className="page stack">
      <div className="page__head">
        <div>
          <h1 className="page__title">{data.role === "educator" ? "Educator dashboard" : "Parent dashboard"}</h1>
          <p className="page__sub">
            {data.learners.length} learner profile{data.learners.length === 1 ? "" : "s"} · {totalLessons} lessons completed · {totalQuizzes} quizzes taken
          </p>
        </div>
        <div className="page-actions">
          <Button icon="plus" onClick={() => setAddOpen(true)}>Add learner</Button>
        </div>
      </div>

      {data.learners.length === 0 ? (
        <Card>
          <div className="empty">
            <Mascot size={70} mood="wave" />
            <h3>No learner profiles yet</h3>
            <p>Create one and you'll control subjects, voice, uploads and privacy from here.</p>
            <Button onClick={() => setAddOpen(true)} icon="plus">Add your first learner</Button>
          </div>
        </Card>
      ) : null}

      <div className="children-grid">
        {data.learners.map((child) => (
          <div key={child.id} className="child-card">
            <div className="child-card__head">
              <span className="child-card__avatar">{child.name.slice(0, 1).toUpperCase()}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 750 }}>{child.name}</div>
                <div className="tiny muted">
                  {child.age ? `Age ${child.age} · ` : ""}{child.levelLabel}{child.grade ? ` · ${child.grade}` : ""}
                </div>
              </div>
              {!child.onboarded ? <Badge tone="amber">Setup needed</Badge> : <Badge tone="teal">Active</Badge>}
            </div>

            <div className="row row--tight">
              <Badge tone="violet">🔥 {child.streak}</Badge>
              <Badge tone="teal">⚡ {child.xp} XP</Badge>
              <Badge tone="muted">{child.lessonsCompleted} lessons</Badge>
              {child.quizzes ? <Badge tone="amber">{child.avgScore}% avg</Badge> : null}
            </div>

            {child.report ? (
              <div style={{ background: "var(--surface-2, #faf8fd)", borderRadius: 10, padding: "8px 10px" }}>
                <div className="spread" style={{ marginBottom: 3 }}>
                  <span className="tiny muted">Today's report</span>
                  <Badge tone={child.report.overdue ? "pink" : child.report.pct >= 70 ? "teal" : "amber"}>{child.report.statusLabel}</Badge>
                </div>
                <div className="tiny" style={{ fontWeight: 600 }}>{child.report.headline}</div>
                <div className="tiny muted">{child.report.minutes}/{child.report.target} min · {child.report.openItems} open commitment{child.report.openItems === 1 ? "" : "s"}</div>
              </div>
            ) : null}

            <div>
              <div className="tiny muted" style={{ marginBottom: 3 }}>Needs the most support</div>
              <div className="row row--tight">
                {child.weakest.length ? child.weakest.map((w) => <span key={w} className="chip" style={{ fontSize: 11 }}>{w}</span>) : <span className="tiny muted">Not enough data yet</span>}
              </div>
            </div>

            {child.recentLessons.length ? (
              <div>
                <div className="tiny muted" style={{ marginBottom: 3 }}>Recent lessons</div>
                {child.recentLessons.slice(0, 3).map((l, i) => (
                  <div key={i} className="tiny" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</span>
                    <span className="muted">{l.status === "completed" ? "✅" : "▶"}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {child.assignments.filter((a) => a.status === "assigned").length ? (
              <div>
                <div className="tiny muted" style={{ marginBottom: 3 }}>Assigned</div>
                {child.assignments.filter((a) => a.status === "assigned").slice(0, 3).map((a) => (
                  <div key={a.id} className="tiny">📌 {a.title} <span className="muted">({a.kind})</span></div>
                ))}
              </div>
            ) : null}

            <div className="row row--tight" style={{ marginTop: "auto" }}>
              <Button size="sm" onClick={() => openChild(child)} icon="play">{child.onboarded ? "Open" : "Finish setup"}</Button>
              <Button size="sm" variant="secondary" onClick={() => setControlsFor(child)} icon="lock">Controls</Button>
              <Button size="sm" variant="ghost" onClick={() => setAssignFor(child)} icon="plus">Assign</Button>
              <Button size="sm" variant="ghost" icon="clipboard" onClick={() => { void openChild(child, "/reports"); }}>Report</Button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid--2">
        <Card title="Learning groups" subtitle="Organise learners for shared plans and reports.">
          <div className="row" style={{ marginBottom: 12 }}>
            <input className="input" style={{ flex: 1 }} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Tuesday maths group" />
            <Button size="sm" onClick={createGroup}>Create</Button>
          </div>
          {data.groups.length ? (
            <div className="stack stack--sm">
              {data.groups.map((g) => (
                <div key={g.id} className="card card--flat" style={{ padding: 12 }}>
                  <div className="spread" style={{ marginBottom: 6 }}>
                    <strong className="small">{g.name}</strong>
                    <span className="tiny muted">{g.members.length} member{g.members.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="row row--tight">
                    {data.learners.map((c) => (
                      <button key={c.id} className={`chip ${g.members.includes(c.id) ? "chip--violet" : ""}`} onClick={() => toggleMember(g, c.id)}>
                        {g.members.includes(c.id) ? "✓ " : "+ "}{c.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>No groups yet. Groups are optional — useful for classrooms and co-ops.</p>
          )}
        </Card>

        <Card title="What parents and educators can do here" subtitle="Privacy and permissions are shared with the learner's own profile.">
          <ul className="rich__list" style={{ paddingLeft: 18, fontSize: 13.5, color: "var(--ink-soft)" }}>
            <li>Set permitted subjects — learners can't start lessons outside them.</li>
            <li>Turn voice, uploads, memory or gamification on or off per learner.</li>
            <li>Assign a lesson or quiz with a due date and see when it's completed.</li>
            <li>Review recent lessons, average scores and the subjects needing support.</li>
            <li>Open a learner's dashboard to see exactly what they see.</li>
          </ul>
          <div className="onboard__note" style={{ marginTop: 10 }}>
            Learner data is only visible to the account that owns the profile. One family account cannot see another's records.
          </div>
        </Card>
      </div>

      <Card title="Learner accounts & privacy">
        <p className="small muted">
          {user?.role === "educator"
            ? "Student profiles are managed through this account. For older students, they can create their own Asterwood account and share progress with you separately."
            : "Learners under 13 stay on the parent account with guardian consent recorded, so there is no separate login for a child to manage. Older learners can create their own account, and you can keep a separate parent login for oversight."}
        </p>
        <div className="row">
          <Badge tone="teal">Private by default</Badge>
          <Badge tone="violet">PG-13 content</Badge>
          <Badge tone="amber">No voice stored</Badge>
        </div>
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a learner profile">
        <NewLearnerForm
          onCreated={async () => {
            setAddOpen(false);
            bump();
            void load();
            toast("Learner profile created", "good");
          }}
          onError={(m) => toast(m, "warn")}
        />
      </Modal>

      {controlsFor ? (
        <ControlsModal
          child={controlsFor}
          subjects={meta?.subjects || []}
          onClose={() => setControlsFor(null)}
          onSaved={() => { setControlsFor(null); bump(); void load(); }}
          toast={toast}
        />
      ) : null}

      {assignFor ? (
        <AssignModal child={assignFor} onClose={() => setAssignFor(null)} onSaved={() => { setAssignFor(null); bump(); void load(); }} toast={toast} />
      ) : null}
    </div>
  );
}

function ControlsModal({
  child,
  subjects,
  onClose,
  onSaved,
  toast,
}: {
  child: ChildRow;
  subjects: { id: string; name: string; icon: string }[];
  onClose: () => void;
  onSaved: () => void;
  toast: (m: string, tone?: "info" | "good" | "warn") => void;
}) {
  const [allowed, setAllowed] = useState<string[]>(child.allowedSubjects || []);
  const [voiceEnabled, setVoiceEnabled] = useState(child.voiceEnabled);
  const [uploadsEnabled, setUploadsEnabled] = useState(child.uploadsEnabled);
  const [memoryEnabled, setMemoryEnabled] = useState(child.memoryEnabled);
  const [gamification, setGamification] = useState(child.gamification);
  const [dailyGoal, setDailyGoal] = useState(child.dailyGoal);
  const [consent, setConsent] = useState(child.guardianConsent);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api(`/family/learners/${child.id}/controls`, {
        method: "PATCH",
        json: { allowedSubjects: allowed, voiceEnabled, uploadsEnabled, memoryEnabled, gamification, dailyGoal, guardianConsent: consent },
      });
      toast("Permissions updated", "good");
      onSaved();
    } catch (err: any) {
      toast(err.message || "Could not save controls", "warn");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Controls for ${child.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>Save controls</Button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <span className="field__label">Permitted subjects</span>
          <span className="field__hint" style={{ marginBottom: 6 }}>Leave all off to allow every subject, including optional Bible study.</span>
          <div className="onboard__choices">
            {subjects.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`choice ${allowed.includes(s.id) ? "choice--on" : ""}`}
                onClick={() => setAllowed((a) => (a.includes(s.id) ? a.filter((x) => x !== s.id) : [...a, s.id]))}
              >
                {s.icon} {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="switch">
          <div className="switch__text"><strong>Voice features</strong><span>Microphone, read-aloud and captions.</span></div>
          <label className="switch__control"><input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} /><span className="switch__track" /></label>
        </div>
        <div className="switch">
          <div className="switch__text"><strong>File uploads</strong><span>Upload notes and PDFs for help.</span></div>
          <label className="switch__control"><input type="checkbox" checked={uploadsEnabled} onChange={(e) => setUploadsEnabled(e.target.checked)} /><span className="switch__track" /></label>
        </div>
        <div className="switch">
          <div className="switch__text"><strong>Long-term memory</strong><span>Remember learning preferences and gaps.</span></div>
          <label className="switch__control"><input type="checkbox" checked={memoryEnabled} onChange={(e) => setMemoryEnabled(e.target.checked)} /><span className="switch__track" /></label>
        </div>
        <div className="switch">
          <div className="switch__text"><strong>XP, streaks, badges</strong><span>Encouragement-only gamification.</span></div>
          <label className="switch__control"><input type="checkbox" checked={gamification} onChange={(e) => setGamification(e.target.checked)} /><span className="switch__track" /></label>
        </div>
        <div className="switch">
          <div className="switch__text"><strong>Guardian consent recorded</strong><span>Required for learners under 13.</span></div>
          <label className="switch__control"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span className="switch__track" /></label>
        </div>
        <Field label={`Daily goal · ${dailyGoal} minutes`}>
          <input type="range" min={5} max={120} step={5} value={dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value))} style={{ accentColor: "var(--violet)" }} />
        </Field>
      </div>
    </Modal>
  );
}

function AssignModal({
  child,
  onClose,
  onSaved,
  toast,
}: {
  child: ChildRow;
  onClose: () => void;
  onSaved: () => void;
  toast: (m: string, tone?: "info" | "good" | "warn") => void;
}) {
  const [kind, setKind] = useState<"lesson" | "quiz">("lesson");
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [refId, setRefId] = useState("");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setRefId("");
    const endpoint = kind === "lesson" ? `/lessons?learnerId=${child.id}` : `/quizzes?learnerId=${child.id}`;
    api<any>(endpoint)
      .then((d) => {
        if (!alive) return;
        const list = kind === "lesson" ? (d.lessons as Lesson[]) : (d.quizzes as Quiz[]);
        setItems(list.map((x) => ({ id: x.id, title: x.title })));
      })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [kind, child.id]);

  const save = async () => {
    setBusy(true);
    try {
      await api("/family/assign", {
        method: "POST",
        json: {
          learnerId: child.id,
          kind,
          refId: refId || null,
          title: title.trim() || (items.find((i) => i.id === refId)?.title || `New ${kind} to complete`),
          dueAt: dueAt || null,
        },
      });
      toast("Assignment added", "good");
      onSaved();
    } catch (err: any) {
      toast(err.message || "Could not assign that", "warn");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign work to ${child.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>Assign</Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Type">
          <div className="row row--tight">
            <button className={`choice ${kind === "lesson" ? "choice--on" : ""}`} onClick={() => setKind("lesson")}>Lesson</button>
            <button className={`choice ${kind === "quiz" ? "choice--on" : ""}`} onClick={() => setKind("quiz")}>Quiz</button>
          </div>
        </Field>
        <Field label={`Existing ${kind}`} hint={loading ? "Loading…" : items.length ? "Pick one, or write a title for something new." : "No saved items yet — write a title below and it becomes a task."}>
          <select className="select" value={refId} onChange={(e) => setRefId(e.target.value)} disabled={loading}>
            <option value="">None — just a task</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </Field>
        <Field label="Title / instruction" hint="What should they do?">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Finish the fractions lesson before Friday" />
        </Field>
        <Field label="Due date" hint="Optional">
          <input className="input" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
