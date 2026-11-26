import { useState } from "react";
import { Mascot } from "../components/Mascot";
import { Button, Card, Field, Icon, Badge } from "../components/ui";
import { useApp } from "../lib/store";

type Mode = "home" | "login" | "signup";

export function Landing() {
  const [mode, setMode] = useState<Mode>("home");
  const { serverOffline } = useApp();
  return (
    <>
      {serverOffline ? (
        <div className="preview-banner" role="status">
          <strong>Static preview</strong> — the learning server isn't connected here, so sign-in, lessons and chat are unavailable. Run <code>bun run dev</code> for the full app.
        </div>
      ) : null}
      {mode === "home" ? <Marketing setMode={setMode} /> : <AuthScreen mode={mode} setMode={setMode} />}
    </>
  );
}

function GuestEntry({ block = false }: { block?: boolean }) {
  const { guest, serverOffline } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      await guest();
    } catch (err: any) {
      setError(err.message || "Could not start a guest session.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`guest-entry${block ? " guest-entry--block" : ""}`}>
      <Button variant="ghost" size={block ? "lg" : "md"} block={block} onClick={start} loading={busy} disabled={serverOffline}>
        Continue as guest
      </Button>
      <span className="tiny muted">No account needed. Guest progress stays in this browser.</span>
      {serverOffline ? <span className="tiny muted">Guest access needs the Asterwood server.</span> : null}
      {error ? <div className="feedback feedback--bad">{error}</div> : null}
    </div>
  );
}

function Marketing({ setMode }: { setMode: (m: Mode) => void }) {
  const { meta } = useApp();
  const subjects = meta?.subjects || [];
  return (
    <div className="landing">
      <header className="landing__nav">
        <span className="brand__mark">A</span>
        <div>
          <div className="brand__name">Asterwood</div>
          <div className="brand__tag" style={{ fontSize: 11, color: "var(--muted)" }}>a school that grows with you</div>
        </div>
        <div className="row">
          <Button variant="ghost" size="sm" onClick={() => setMode("login")}>Sign in</Button>
          <Button size="sm" onClick={() => setMode("signup")}>Start learning</Button>
        </div>
      </header>

      <section className="landing__hero">
        <div>
          <span className="badge badge--violet">For ages 3 to 103</span>
          <h1 className="landing__title" style={{ marginTop: 14 }}>
            A patient tutor who <em>remembers you</em>.
          </h1>
          <p className="landing__lead">
            Asterwood learns how you learn — your interests, your level, the way an explanation finally clicks — and builds
            every lesson around it. From first letters to calculus, in a conversation you can speak out loud.
          </p>
          <div className="landing__points">
            <div className="landing__point"><span><Icon name="check" size={16} /></span><span><strong>Personal, not generic.</strong> Dinosaur maths for dinosaur fans. Real questions from your own life.</span></div>
            <div className="landing__point"><span><Icon name="check" size={16} /></span><span><strong>Teaches, doesn't just answer.</strong> Hints first, step by step, a different approach when the first one misses.</span></div>
            <div className="landing__point"><span><Icon name="check" size={16} /></span><span><strong>Grows with you.</strong> Lessons adapt as your skills do — no ceiling from your age, no floor either.</span></div>
          </div>
          <div className="row">
            <Button size="lg" icon="sparkles" onClick={() => setMode("signup")}>Meet your tutor</Button>
            <Button size="lg" variant="secondary" onClick={() => setMode("login")}>I already have an account</Button>
          </div>
          <GuestEntry />
          <div className="row" style={{ marginTop: 14, fontSize: 12, color: "var(--muted)", gap: 8 }}>
            <Icon name="lock" size={14} /> Private by default · PG-13 · No ads
          </div>
        </div>

        <div className="landing__art">
          <div className="row" style={{ marginBottom: 14 }}>
            <Mascot size={64} mood="happy" />
            <div>
              <strong style={{ display: "block" }}>Nova</strong>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>your tutor · curious explorer</span>
            </div>
            <span className="badge badge--teal" style={{ marginLeft: "auto" }}>listening</span>
          </div>
          <div className="landing__chat">
            <div className="landing__bubble landing__bubble--me">I don't understand fractions.</div>
            <div className="landing__bubble landing__bubble--tutor">
              That's okay — let's try it a different way. Imagine a pizza cut into four equal pieces and you eat one. How many are left, and what fraction is that?
            </div>
            <div className="landing__bubble landing__bubble--me">Three left… so three quarters?</div>
            <div className="landing__bubble landing__bubble--tutor">
              Exactly. You just did fraction subtraction. Now the interesting part: was that easier with pizza than with numbers?
            </div>
          </div>
          <div className="landing__demo-input">
            <Icon name="mic" size={16} />
            <span>Or just say it out loud — voice conversations, with captions</span>
          </div>
        </div>
      </section>

      <div className="landing__stats">
        <div className="landing__stat"><strong>{meta?.totalTopics || 200}+</strong><span>topics across every level</span></div>
        <div className="landing__stat"><strong>{subjects.length || 9}</strong><span>subject departments</span></div>
        <div className="landing__stat"><strong>9</strong><span>age stages, one adaptive engine</span></div>
        <div className="landing__stat"><strong>24/7</strong><span>whenever a question appears</span></div>
      </div>

      <section className="landing__section">
        <h2 style={{ fontSize: 25, letterSpacing: "-0.03em" }}>Every subject. Every level. One tutor.</h2>
        <p style={{ color: "var(--muted)", marginTop: 6, marginBottom: 20, maxWidth: 640 }}>
          Mathematics, reading and writing, the sciences, history and geography, Bible study, coding, languages and life
          skills — with specialised topics inside each one.
        </p>
        <div className="landing__cards">
          {subjects.slice(0, 6).map((s) => (
            <Card key={s.id} className="card--flat">
              <div className="row" style={{ marginBottom: 8 }}>
                <span className="subject-card__icon" style={{ background: `${s.color}1a`, color: s.color, width: 38, height: 38, fontSize: 19 }}>{s.icon}</span>
                <strong>{s.name}</strong>
              </div>
              <p className="small muted" style={{ margin: 0 }}>{s.blurb}</p>
              <div className="row row--tight" style={{ marginTop: 10 }}>
                {s.departments.slice(0, 3).map((d) => <span key={d.name} className="chip" style={{ fontSize: 11, padding: "3px 8px" }}>{d.name}</span>)}
              </div>
            </Card>
          ))}
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          {subjects.slice(6).map((s) => <span key={s.id} className="chip">{s.icon} {s.name}</span>)}
        </div>
      </section>

      <section className="landing__section">
        <div className="grid grid--3">
          <Card title="Built for real learning" className="card--flat">
            <ul className="rich__list" style={{ paddingLeft: 18, fontSize: 13.5, color: "var(--ink-soft)" }}>
              <li>Lessons with objectives, examples, guided and independent practice</li>
              <li>Quizzes with explanations, hints and second chances</li>
              <li>Progress, streaks and achievements that celebrate effort</li>
              <li>Upload notes and PDFs, then get summaries and study guides</li>
            </ul>
          </Card>
          <Card title="Voice that works" className="card--flat">
            <p className="small muted" style={{ marginBottom: 10 }}>
              Speak your question, hear the answer. Choose the voice, personality and speaking speed — with captions while
              your tutor talks, and a text-only mode whenever you prefer quiet.
            </p>
            <div className="row row--tight">
              {["Friendly", "Calm", "Energetic", "Gentle", "Professional", "Playful"].map((v) => <span key={v} className="chip" style={{ fontSize: 11 }}>{v}</span>)}
            </div>
          </Card>
          <Card title="Safe by design" className="card--flat">
            <p className="small muted" style={{ marginBottom: 10 }}>
              Age-aware content, PG-13 everywhere, no ads and no manipulation. Younger learners get parent-managed profiles
              with subject, voice and upload controls.
            </p>
            <div className="row row--tight">
              <Badge tone="amber">Parent controls</Badge>
              <Badge tone="teal">Private profiles</Badge>
              <Badge tone="violet">Memory you can edit</Badge>
            </div>
          </Card>
        </div>
      </section>

      <section className="landing__section">
        <div className="card" style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap", background: "linear-gradient(120deg, var(--violet-soft), var(--paper) 65%)" }}>
          <Mascot size={92} mood="wave" />
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>Start with one question.</h2>
            <p className="muted small" style={{ margin: 0 }}>
              Asterwood will ask a little about you first — never an exam, always skippable — then build your first lesson
              around something you actually love.
            </p>
          </div>
          <Button size="lg" onClick={() => setMode("signup")}>Create your profile</Button>
        </div>
      </section>

      <footer className="landing__footer">
        Asterwood Academy is a learning companion, not a replacement for parents, teachers or professional advice.
        <br />Built with care for curious people of every age.
      </footer>
    </div>
  );
}

function AuthScreen({ mode, setMode }: { mode: Exclude<Mode, "home">; setMode: (m: Mode) => void }) {
  const { login, signup, serverOffline } = useApp();
  const [role, setRole] = useState<"student" | "parent" | "educator">("student");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (serverOffline) {
      setError("This static preview can't sign in. Accounts need the Asterwood server.");
      return;
    }
    if (mode === "signup" && role === "student" && age && Number(age) < 13 && !consent) {
      setError("A parent or guardian needs to agree before an account is created for someone under 13.");
      return;
    }
    if (mode === "signup" && !/^[a-z0-9][a-z0-9._-]{2,23}$/i.test(username.trim())) {
      setError("Choose a username with 3–24 letters, numbers, dots, dashes or underscores.");
      return;
    }
    if (mode === "signup" && email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Please check the email address, or leave it blank.");
      return;
    }
    if (password.length < 8) {
      setError("Please use at least 8 characters for your password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(loginId.trim(), password);
      else await signup({ username: username.trim().toLowerCase(), email: email.trim() || null, password, name: name.trim(), age: age ? Number(age) : null, role });
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <aside className="auth__aside">
        <div>
          <div className="row">
            <span className="brand__mark">A</span>
            <strong style={{ fontSize: 20 }}>Asterwood</strong>
          </div>
          <h1 style={{ fontSize: 34, letterSpacing: "-0.04em", marginTop: 32, maxWidth: 380 }}>
            Learning that starts with <em style={{ fontStyle: "normal", color: "var(--violet-deep)" }}>you</em>.
          </h1>
          <p style={{ color: "var(--ink-soft)", maxWidth: 380, marginTop: 10 }}>
            Your tutor remembers what you've learned, what clicked, and what needs another try — then adapts every lesson.
          </p>
        </div>
        <div>
          <Mascot size={140} mood="happy" />
          <p className="small muted" style={{ maxWidth: 320 }}>
            "Every person can learn. Every person learns differently. And learning should never have an age limit."
          </p>
        </div>
      </aside>

      <main className="auth__panel">
        <div style={{ maxWidth: 380, width: "100%", margin: "0 auto" }}>
          <button className="btn btn--ghost btn--sm" onClick={() => setMode("home")} style={{ marginBottom: 14, paddingLeft: 0 }}>
            <Icon name="back" size={16} /> Back
          </button>
          <h2 className="auth__title">{mode === "login" ? "Welcome back" : "Let's get you learning"}</h2>
          <p className="auth__sub">
            {mode === "login" ? "Your tutor has been keeping your progress safe." : "One account, then a short friendly chat about you."}
          </p>

          {mode === "signup" ? (
            <div className="auth__tabs" role="tablist" aria-label="Account type">
              {(["student", "parent", "educator"] as const).map((r) => (
                <button key={r} className={`auth__tab ${role === r ? "auth__tab--active" : ""}`} onClick={() => setRole(r)} type="button">
                  {r === "student" ? "I'm learning" : r === "parent" ? "Parent" : "Educator"}
                </button>
              ))}
            </div>
          ) : null}

          <form className="auth__form" onSubmit={submit}>
            {mode === "signup" ? (
              <Field label={role === "student" ? "Your name" : "Your name"}>
                <input className="input input--lg" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should we call you?" required />
              </Field>
            ) : null}
            {mode === "signup" ? (
              <>
                <Field label="Username" hint="3–24 letters, numbers, dots, dashes or underscores. Kids can use just a username — no email needed.">
                  <input className="input input--lg" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. shy_scholar" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={24} required />
                </Field>
                <Field label="Email (optional)" hint={role === "student" ? "Optional. Add one for password recovery, or leave it blank." : "Recommended for account recovery."}>
                  <input className="input input--lg" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                </Field>
              </>
            ) : (
              <Field label="Username or email">
                <input className="input input--lg" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="shy_scholar or you@example.com" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
              </Field>
            )}
            <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
              <input className="input input--lg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} required />
            </Field>
            {mode === "signup" && role === "student" ? (
              <>
                <Field label="Age" hint="This helps us pitch lessons at the right level. You can change it later.">
                  <input className="input input--lg" type="number" min={3} max={120} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 10" />
                </Field>
                {age && Number(age) < 13 ? (
                  <label className="row small" style={{ alignItems: "flex-start", gap: 8, background: "var(--amber-soft)", padding: 10, borderRadius: 12 }}>
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>A parent or guardian is setting this up with me and agrees to the learning profile.</span>
                  </label>
                ) : null}
              </>
            ) : null}

            {serverOffline ? (
              <div className="feedback feedback--bad">This static preview can't sign in or create accounts. Start the Asterwood server to use them.</div>
            ) : null}
            {error ? <div className="feedback feedback--bad">{error}</div> : null}

            <Button type="submit" size="lg" block loading={busy} disabled={serverOffline}>
              {mode === "login" ? "Sign in" : "Create my account"}
            </Button>
          </form>

          <GuestEntry block />

          <p className="auth__switch">
            {mode === "login" ? (
              <>New to Asterwood? <button className="btn btn--ghost btn--sm" onClick={() => setMode("signup")} style={{ padding: 0, height: "auto" }}>Create an account</button></>
            ) : (
              <>Already have an account? <button className="btn btn--ghost btn--sm" onClick={() => setMode("login")} style={{ padding: 0, height: "auto" }}>Sign in</button></>
            )}
          </p>
          <p className="auth__legal">
            {role === "parent" || role === "educator"
              ? "You'll create learner profiles you control, with subject, voice and privacy settings. Children do not need their own email address — one adult account can hold a profile for each learner."
              : "Asterwood keeps your learning history private to your account. You can review or delete what your tutor remembers at any time."}
          </p>
        </div>
      </main>
    </div>
  );
}
