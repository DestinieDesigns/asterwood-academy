import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LearnerAvatar } from "../components/character/Avatar";
import { Badge, Button, Card, Field, Icon } from "../components/ui";
import { api } from "../lib/api";
import { useTutorBundle } from "../lib/character";
import { useApp } from "../lib/store";
import { useSpeech } from "../lib/voice";

const ACCENTS = ["auto", "American", "British", "Irish", "Australian", "Canadian", "Indian", "South African", "Transatlantic"];

const THEMES = [
  { id: "classic", label: "Lavender & sky", swatch: "linear-gradient(135deg,#7c5cf0,#3fc4c9)" },
  { id: "sunrise", label: "Warm sunrise", swatch: "linear-gradient(135deg,#f2704c,#ffab84)" },
  { id: "forest", label: "Forest calm", swatch: "linear-gradient(135deg,#2f9e6c,#7fd1a8)" },
  { id: "midnight", label: "Midnight focus", swatch: "linear-gradient(135deg,#241d47,#5b3fd6)" },
];

export function Settings() {
  const { learner, meta, user, patchLearner, toast, logout, refreshAuth } = useApp();
  const { bundle } = useTutorBundle();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    age: "",
    grade: "",
    language: "English",
    country: "",
    tutorName: "Aster",
    tutorPersonality: "friendly",
    strictness: "balanced",
    environment: "auto",
    autoEnvironment: true,
    voiceAccent: "auto",
    voiceVolume: 1,
    voiceStyle: "friendly",
    speakingRate: 1,
    theme: "classic",
    dailyGoal: 20,
    lessonLength: "standard",
    activityPref: "mix",
    examplesFirst: true,
    hintsFirst: true,
    extraTime: false,
    memoryEnabled: true,
    gamification: true,
    voiceEnabled: true,
    uploadsEnabled: true,
  });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const speech = useSpeech({
    style: form.voiceStyle,
    defaultRate: form.speakingRate,
    accent: form.voiceAccent,
    volume: form.voiceVolume,
  });

  useEffect(() => {
    if (!learner) return;
    setForm({
      name: learner.name,
      age: learner.age ? String(learner.age) : "",
      grade: learner.grade || "",
      language: learner.language || "English",
      country: learner.country || "",
      tutorName: learner.tutorName || "Aster",
      tutorPersonality: learner.tutorPreset || "friendly",
      strictness: learner.strictness || "balanced",
      environment: learner.environment || "auto",
      autoEnvironment: learner.autoEnvironment !== false,
      voiceAccent: learner.voiceAccent || "auto",
      voiceVolume: learner.voiceVolume ?? 1,
      voiceStyle: learner.voiceStyle || "friendly",
      speakingRate: learner.speakingRate || 1,
      theme: learner.theme || "classic",
      dailyGoal: learner.dailyGoal || 20,
      lessonLength: learner.lessonLength || "standard",
      activityPref: learner.activityPref || "mix",
      examplesFirst: learner.examplesFirst,
      hintsFirst: learner.hintsFirst,
      extraTime: learner.extraTime,
      memoryEnabled: learner.memoryEnabled,
      gamification: learner.gamification,
      voiceEnabled: learner.voiceEnabled,
      uploadsEnabled: learner.uploadsEnabled,
    });
    setDirty(false);
  }, [learner]);

  if (!learner) return null;

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
    if (patch.theme) document.documentElement.dataset.theme = patch.theme;
  };

  const save = async () => {
    setBusy(true);
    try {
      await patchLearner({
        ...form,
        age: form.age ? Number(form.age) : null,
        speakingRate: Number(form.speakingRate),
        dailyGoal: Number(form.dailyGoal),
      });
      setDirty(false);
      toast("Settings saved", "good");
    } catch (err: any) {
      toast(err.message || "Could not save your settings", "warn");
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      toast("New password must be at least 8 characters", "warn");
      return;
    }
    setPasswordBusy(true);
    try {
      await api("/auth/password", { method: "PATCH", json: { currentPassword, newPassword } });
      setCurrentPassword("");
      setNewPassword("");
      toast("Password updated. Please sign in again.", "good");
      await logout();
    } catch (err: any) {
      toast(err.message || "Could not change your password", "warn");
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div className="page stack">
      <div className="page__head">
        <div>
          <h1 className="page__title">Settings</h1>
          <p className="page__sub">Shape your tutor, your look and how you like to learn.</p>
        </div>
        <div className="page-actions">
          <Button icon="check" onClick={save} loading={busy} disabled={!dirty}>Save changes</Button>
        </div>
      </div>

      <div className="grid grid--2">
        <Card title="Your tutor" subtitle="The name, character and personality that travel with you.">
          <div className="stack">
            <div className="row" style={{ gap: 12 }}>
              <LearnerAvatar size={78} state="greeting" />
              <div style={{ flex: 1 }}>
                <Field label="Tutor name">
                  <input className="input" value={form.tutorName} onChange={(e) => set({ tutorName: e.target.value })} maxLength={30} />
                </Field>
              </div>
            </div>
            <div className="row row--tight">
              <Badge tone="violet">{bundle?.tutors.find((t) => t.id === learner.tutorCharacterId)?.name || "Academy tutor"}</Badge>
              <Badge tone="teal">{bundle?.strictnessLevels.find((s) => s.id === form.strictness)?.name || form.strictness}</Badge>
              <Button size="sm" variant="soft" icon="sparkles" onClick={() => navigate("/academy")}>Tutor Academy</Button>
              <Button size="sm" variant="ghost" icon="settings" onClick={() => navigate("/studio")}>Studio</Button>
            </div>
            <div className="field">
              <span className="field__label">Personality</span>
              <div className="onboard__grid">
                {(bundle?.presets || meta?.personalities || []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`choice ${form.tutorPersonality === p.id ? "choice--on" : ""}`}
                    style={{ alignItems: "flex-start", textAlign: "left" }}
                    onClick={() => set({ tutorPersonality: p.id })}
                  >
                    <span>{p.emoji}</span>
                    <span>
                      <strong style={{ display: "block", fontSize: 12.5 }}>{p.name}</strong>
                      <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)" }}>{p.blurb}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="onboard__grid">
              <Field label="Strictness" hint="Accountability, not pressure. It softens automatically for younger learners.">
                <select className="select" value={form.strictness} onChange={(e) => set({ strictness: e.target.value })}>
                  {(bundle?.strictnessLevels || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Academy environment" hint="Automatic follows the lesson subject.">
                <select className="select" value={form.autoEnvironment ? "auto" : form.environment} onChange={(e) => {
                  const value = e.target.value;
                  set({ environment: value, autoEnvironment: value === "auto" });
                }}>
                  <option value="auto">Automatic — follows the lesson</option>
                  {(bundle?.environments || []).map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
                </select>
              </Field>
              <Field label="Voice style">
                <select className="select" value={form.voiceStyle} onChange={(e) => set({ voiceStyle: e.target.value })}>
                  {(meta?.voiceStyles || []).map((v) => <option key={v.id} value={v.id}>{v.name} — {v.hint}</option>)}
                </select>
              </Field>
              <Field label="Accent preference">
                <select className="select" value={form.voiceAccent} onChange={(e) => set({ voiceAccent: e.target.value })}>
                  {ACCENTS.map((a) => <option key={a} value={a}>{a === "auto" ? "Automatic (device default)" : a}</option>)}
                </select>
              </Field>
              <Field label={`Speaking speed · ${Number(form.speakingRate).toFixed(1)}×`}>
                <input type="range" min={0.6} max={1.6} step={0.1} value={form.speakingRate} onChange={(e) => set({ speakingRate: Number(e.target.value) })} style={{ accentColor: "var(--violet)" }} />
              </Field>
              <Field label={`Volume · ${Math.round(Number(form.voiceVolume) * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={form.voiceVolume} onChange={(e) => set({ voiceVolume: Number(e.target.value) })} style={{ accentColor: "var(--violet)" }} />
              </Field>
            </div>
            <div className="row">
              <Button
                variant="secondary"
                icon="speaker"
                onClick={() => {
                  if (!speech.supported) { toast("This browser can't speak — text lessons still work everywhere.", "warn"); return; }
                  speech.speak(`Hi ${form.name.split(" ")[0] || "there"}, it's ${form.tutorName || "Aster"}. This is how I'll sound when we learn together.`);
                }}
              >
                Preview voice
              </Button>
              {speech.speaking ? <Button variant="ghost" icon="x" onClick={speech.stop}>Stop</Button> : null}
            </div>
            {!speech.supported ? <p className="tiny muted">Speech isn't available in this browser. Try Chrome, Edge or Safari for voice.</p> : null}
          </div>
        </Card>

        <Card title="Appearance" subtitle="Pick a palette that feels right. It changes the whole app.">
          <div className="grid grid--2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`choice ${form.theme === t.id ? "choice--on" : ""}`}
                style={{ padding: 10, justifyContent: "flex-start" }}
                onClick={() => set({ theme: t.id })}
              >
                <span style={{ width: 26, height: 26, borderRadius: 8, background: t.swatch, flexShrink: 0 }} />
                {t.label}
              </button>
            ))}
          </div>
          <div className="divider" style={{ margin: "16px 0" }} />
          <Field label={`Daily learning goal · ${form.dailyGoal} minutes`} hint="A realistic target you can actually keep.">
            <input type="range" min={5} max={120} step={5} value={form.dailyGoal} onChange={(e) => set({ dailyGoal: Number(e.target.value) })} style={{ accentColor: "var(--violet)" }} />
          </Field>
          <div className="onboard__note" style={{ marginTop: 14 }}>
            <Icon name="bulb" size={14} /> Age-aware styling keeps things playful for younger learners and calmer for adults — your palette choice always comes first.
          </div>
        </Card>
      </div>

      <div className="grid grid--2">
        <Card title="How you learn" subtitle="Your tutor adapts to these every lesson.">
          <div className="stack">
            <div className="onboard__grid">
              <Field label="Lesson length">
                <select className="select" value={form.lessonLength} onChange={(e) => set({ lessonLength: e.target.value })}>
                  {(meta?.lessonLengths || []).map((l) => <option key={l.id} value={l.id}>{l.label} · {l.minutes[0]}–{l.minutes[1]} min</option>)}
                </select>
              </Field>
              <Field label="I enjoy">
                <select className="select" value={form.activityPref} onChange={(e) => set({ activityPref: e.target.value })}>
                  <option value="games">Games</option>
                  <option value="quizzes">Quizzes</option>
                  <option value="challenges">Challenges</option>
                  <option value="traditional">Explanations</option>
                  <option value="mix">A bit of everything</option>
                </select>
              </Field>
            </div>
            <div className="switch">
              <div className="switch__text"><strong>Examples before rules</strong><span>Show a concrete example first.</span></div>
              <label className="switch__control"><input type="checkbox" checked={form.examplesFirst} onChange={(e) => set({ examplesFirst: e.target.checked })} /><span className="switch__track" /></label>
            </div>
            <div className="switch">
              <div className="switch__text"><strong>Hints before answers</strong><span>Nudge instead of telling.</span></div>
              <label className="switch__control"><input type="checkbox" checked={form.hintsFirst} onChange={(e) => set({ hintsFirst: e.target.checked })} /><span className="switch__track" /></label>
            </div>
            <div className="switch">
              <div className="switch__text"><strong>Extra time</strong><span>No timers, extra patience, more repetition.</span></div>
              <label className="switch__control"><input type="checkbox" checked={form.extraTime} onChange={(e) => set({ extraTime: e.target.checked })} /><span className="switch__track" /></label>
            </div>
            <div className="switch">
              <div className="switch__text"><strong>Voice features</strong><span>Microphone, read-aloud and captions.</span></div>
              <label className="switch__control"><input type="checkbox" checked={form.voiceEnabled} onChange={(e) => set({ voiceEnabled: e.target.checked })} /><span className="switch__track" /></label>
            </div>
            <div className="switch">
              <div className="switch__text"><strong>Long-term memory</strong><span>Remember strengths, gaps and what worked.</span></div>
              <label className="switch__control"><input type="checkbox" checked={form.memoryEnabled} onChange={(e) => set({ memoryEnabled: e.target.checked })} /><span className="switch__track" /></label>
            </div>
            <div className="switch">
              <div className="switch__text"><strong>XP, streaks and achievements</strong><span>Encouragement only — no harsh penalties.</span></div>
              <label className="switch__control"><input type="checkbox" checked={form.gamification} onChange={(e) => set({ gamification: e.target.checked })} /><span className="switch__track" /></label>
            </div>
          </div>
        </Card>

        <div className="stack">
          <Card title="Your details" subtitle="Used to pitch lessons at the right level.">
            <div className="onboard__grid">
              <Field label="Preferred name">
                <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <Field label="Age">
                <input className="input" type="number" min={3} max={120} value={form.age} onChange={(e) => set({ age: e.target.value })} />
              </Field>
              <Field label="Grade or level">
                <input className="input" value={form.grade} onChange={(e) => set({ grade: e.target.value })} placeholder="e.g. Grade 6" />
              </Field>
              <Field label="Language">
                <input className="input" value={form.language} onChange={(e) => set({ language: e.target.value })} />
              </Field>
              <Field label="Country" hint="Optional">
                <input className="input" value={form.country} onChange={(e) => set({ country: e.target.value })} />
              </Field>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <Button variant="secondary" size="sm" icon="user" onClick={() => navigate("/profile")}>What my tutor remembers</Button>
            </div>
          </Card>

          <Card title="AI tutoring" subtitle="How your tutor's brain is connected right now.">
            <div className="row" style={{ marginBottom: 8 }}>
              <Badge tone={meta?.ai.enabled ? "teal" : "amber"}>{meta?.ai.enabled ? "Live AI connected" : "Built-in curriculum"}</Badge>
              {meta?.ai.enabled ? <span className="tiny muted">{meta.ai.model}</span> : null}
            </div>
            <p className="small muted">
              {meta?.ai.enabled
                ? "Lessons, quizzes and conversations are written live by your AI tutor, grounded in the Asterwood curriculum and safety rules. Your API key stays on the server."
                : "Asterwood is teaching from its built-in curriculum engine: complete lessons, quizzes, tutoring and adaptive memory all work. To enable free-form AI conversation and bespoke lessons, set OPENAI_API_KEY in the server's .env file and restart it."}
            </p>
            <div className="onboard__note" style={{ marginTop: 8 }}>
              API keys are never sent to the browser and never stored in this project's code.
            </div>
          </Card>

          {user?.role !== "student" ? (
            <Card title="Family" subtitle="Manage learners, controls and assignments.">
              <Button variant="secondary" icon="family" onClick={() => navigate("/family")}>Open parent dashboard</Button>
            </Card>
          ) : null}

          <Card title="Account">
            <dl className="kv">
              <dt>Username</dt><dd>{user?.username || "—"}</dd>
              <dt>Email</dt><dd>{user?.email || "Not added"}</dd>
              <dt>Role</dt><dd style={{ textTransform: "capitalize" }}>{user?.role}</dd>
              <dt>Learner profiles</dt><dd>{learner.name}</dd>
            </dl>
            <div className="divider" style={{ margin: "14px 0" }} />
            <div className="stack stack--sm">
              <Field label="Current password">
                <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
              </Field>
              <Field label="New password" hint="At least 8 characters. You'll need to sign in again.">
                <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              </Field>
              <div className="row">
                <Button variant="secondary" onClick={changePassword} loading={passwordBusy} disabled={!currentPassword || !newPassword}>Change password</Button>
                <Button variant="ghost" onClick={() => { void logout(); }}>Sign out</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {dirty ? (
        <div className="card" style={{ position: "sticky", bottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10, boxShadow: "var(--shadow)" }}>
          <span className="small">You have unsaved changes.</span>
          <div className="row">
            <Button variant="ghost" onClick={() => { refreshAuth(); }}>Discard</Button>
            <Button onClick={save} loading={busy}>Save changes</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
