import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LearnerAvatar } from "../components/character/Avatar";
import { Badge, Bar, Button, Card, EmptyState, Icon, ProgressRing, RichText, Spinner, Stat } from "../components/ui";
import { api, formatTime, timeAgo, type DashboardData, type Rewards } from "../lib/api";
import { environmentOf, useTutorBundle } from "../lib/character";
import { useApp } from "../lib/store";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Dashboard() {
  const { learner, meta, version, bump, toast } = useApp();
  const { bundle } = useTutorBundle();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState("");
  const [challengeState, setChallengeState] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!learner) return;
    try {
      const d = await api<DashboardData>(`/dashboard?learnerId=${learner.id}`);
      setData(d);
    } catch (err: any) {
      toast(err.message || "Could not load your dashboard", "warn");
    } finally {
      setLoading(false);
    }
  }, [learner, toast]);

  useEffect(() => {
    setLoading(true);
    setChallengeState(null);
    setAnswer("");
    void load();
  }, [load, version]);

  if (!learner) return null;
  const tutor = learner.tutorName || "Aster";

  const checkChallenge = async () => {
    if (!answer.trim()) return;
    try {
      const res = await api<{ correct: boolean; answer?: string; hint?: string; rewards: Rewards }>("/challenge/check", {
        method: "POST",
        json: { learnerId: learner.id, answer },
      });
      if (res.correct) {
        setChallengeState({ ok: true, message: `Correct! ${res.answer ? `The answer is ${res.answer}.` : ""}` });
        if (res.rewards?.unlocked?.length) toast("Achievement unlocked", "good", res.rewards.unlocked.map((u) => ({ icon: u.icon, name: u.name })));
        else toast(`+${res.rewards?.xp ? 10 : 0} XP for the daily challenge`, "good");
        bump();
      } else {
        setChallengeState({ ok: false, message: `Not quite. Hint: ${res.hint}` });
      }
    } catch (err: any) {
      toast(err.message || "Could not check that answer", "warn");
    }
  };

  if (loading) return <div className="page"><Spinner label="Opening your adventure…" /></div>;
  if (!data) return null;

  const goalPct = data.today.goal ? Math.min(100, Math.round((data.today.minutes / data.today.goal) * 100)) : 0;
  const subjects = meta?.subjects || [];
  const personality = meta?.personalities.find((p) => p.id === learner.tutorPreset);
  const environment = environmentOf(bundle, data.environment);
  const game = data.game;
  const level = game?.level;
  const quests = game?.quests;
  const allQuests = quests ? [...quests.daily, ...quests.weekly, ...quests.missions] : [];
  const currentQuest = allQuests.find((q) => q.status === "completed")
    || allQuests.find((q) => q.status === "active" && q.progress > 0)
    || allQuests.find((q) => q.status === "active")
    || null;
  const recommendations = game?.companion.recommendations || [];
  const mastered = game?.stats.mastered || 0;
  const streak = data.streak;

  const accountability = data.accountability;
  const followUps = accountability
    ? [
        ...accountability.overdue.map((a) => ({ key: `o-${a.id}`, label: a.title, tone: "Overdue", to: "/lessons" })),
        ...accountability.dueSoon.map((a) => ({ key: `d-${a.id}`, label: a.title, tone: a.due_at ? `Due ${a.due_at}` : "Due soon", to: "/lessons" })),
        ...accountability.incomplete.slice(0, 2).map((l) => ({ key: `i-${l.id}`, label: l.title, tone: `${l.progress}% done`, to: `/lessons/${l.id}` })),
        ...accountability.missedSessions.slice(0, 2).map((s) => ({ key: `m-${s.id}`, label: s.title, tone: "Missed session", to: "/schedule" })),
      ]
    : [];

  return (
    <div className="page stack game-dashboard">
      <section className="game-hero">
        <div className="game-hero__sky" aria-hidden="true">
          <span className="game-star" style={{ top: "16%", left: "58%" }} />
          <span className="game-star" style={{ top: "28%", left: "82%" }} />
          <span className="game-star" style={{ top: "62%", left: "70%" }} />
          <span className="game-star" style={{ top: "12%", left: "92%" }} />
          <span className="game-constellation" />
        </div>

        <div className="game-hero__player">
          <div className="game-avatar">
            <LearnerAvatar size={136} state={streak > 2 ? "celebrating" : "greeting"} />
            <span className="game-avatar__level">{level?.level || 1}</span>
          </div>
          <div className="game-hero__identity">
            <div className="row row--tight" style={{ marginBottom: 6 }}>
              <span className="welcome__pill">🔥 {streak ? `${streak}-day streak` : "Day one — let's begin"}</span>
              <Badge tone="amber">{level?.title || "Seeker"}</Badge>
            </div>
            <h1>{greeting()}, {learner.name.split(" ")[0]}.</h1>
            <div className="game-rankline">
              <strong>Level {level?.level || 1}</strong>
              <span>{level?.xp || learner.xp} XP</span>
              {level?.nextXp ? <span className="muted">{level.toNext} XP to {level.nextTitle}</span> : <span className="muted">Highest rank</span>}
            </div>
            <div className="game-xpbar"><span style={{ width: `${level?.pct ?? 0}%` }} /></div>
            <div className="game-chips">
              <span><Icon name="star" size={14} /> {mastered} topic{mastered === 1 ? "" : "s"} mastered</span>
              <span><Icon name="clock" size={14} /> {data.today.minutes}/{data.today.goal} min today</span>
              <span><Icon name="target" size={14} /> {data.counts.quizAvg}% quiz average</span>
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <Button icon="chat" onClick={() => navigate("/tutor")}>Ask {tutor}</Button>
              <Button variant="secondary" icon="library" onClick={() => navigate("/world")}>Enter the Library</Button>
            </div>
          </div>
        </div>

        <div className="game-hero__side">
          <div className="game-quest">
            <div className="spread">
              <span className="world-kicker">Current commission</span>
              <Link to="/quests" className="tiny">Board →</Link>
            </div>
            {currentQuest ? (
              <>
                <h2>{currentQuest.title}</h2>
                <p>{currentQuest.description}</p>
                <div className="quest-card__bar"><span style={{ width: `${Math.min(100, Math.round((currentQuest.progress / Math.max(1, currentQuest.target)) * 100))}%` }} /></div>
                <div className="spread tiny muted"><span>{currentQuest.progress}/{currentQuest.target}</span><span>+{currentQuest.xp} XP</span></div>
                {currentQuest.status === "completed" ? (
                  <Button size="sm" block onClick={() => navigate("/quests")}>Claim your reward</Button>
                ) : (
                  <Button size="sm" variant="secondary" block icon="arrow" onClick={() => navigate("/quests")}>See all commissions</Button>
                )}
              </>
            ) : (
              <>
                <h2>The board is clear</h2>
                <p>No urgent commission. Choose a shelf that looks interesting and the next one will find you.</p>
                <Button size="sm" variant="secondary" block onClick={() => navigate("/quests")}>Visit the quest board</Button>
              </>
            )}
          </div>

          <div className="game-companion">
            <LearnerAvatar size={56} state="listening" />
            <div>
              <strong>{game?.companion.name || tutor}</strong>
              <p>{game?.companion.line || "I'm right here. Ask me anything, or open a book and I'll follow along."}</p>
            </div>
          </div>
        </div>
      </section>

      <button className="library-portal" onClick={() => navigate("/world")}>
        <div className="library-portal__scene" aria-hidden="true">
          <span className="library-portal__arch" />
          <span className="library-portal__shelf" />
          <span className="library-portal__book" />
          <span className="library-portal__book library-portal__book--2" />
          <span className="library-portal__book library-portal__book--3" />
          <span className="library-portal__orb" />
        </div>
        <div className="library-portal__copy">
          <span className="world-kicker">The Great Library · {game?.library.totals.topics || 461} topics</span>
          <h2>Your next chapter is on a shelf.</h2>
          <p>{game?.library.totals.mastered || 0} topics mastered · {game?.library.totals.startedBooks || 0} books opened · {game?.stats.sectionsStudied || 0} of 6 sections explored</p>
          <span className="library-portal__cta">Walk into the Library <Icon name="arrow" size={16} /></span>
        </div>
      </button>

      <div className="game-dashboard__grid">
        <div className="stack">
          <Card
            title="Today's objectives"
            subtitle="Small commissions from the board. Missed days are not punished."
            action={<Link to="/quests" className="small">Quest board →</Link>}
          >
            {quests?.daily.length ? (
              <div className="stack stack--sm">
                {quests.daily.map((quest) => {
                  const pct = Math.min(100, Math.round((quest.progress / Math.max(1, quest.target)) * 100));
                  return (
                    <div key={quest.id} className="objective-row">
                      <span className={`objective-row__sigil ${quest.status !== "active" ? "on" : ""}`}>{quest.status === "claimed" ? "✓" : quest.status === "completed" ? "✦" : "◇"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="spread"><strong className="small">{quest.title}</strong><span className="tiny muted">{quest.progress}/{quest.target}</span></div>
                        <div className="objective-row__bar"><span style={{ width: `${pct}%` }} /></div>
                      </div>
                      {quest.status === "completed" ? <button className="chip" onClick={() => navigate("/quests")}>Claim</button> : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon="target" title="No daily commissions" text="The board is being rewritten. Visit it directly." action={<Button size="sm" onClick={() => navigate("/quests")}>Open board</Button>} />
            )}
          </Card>

          <Card
            title="Books recommended for you"
            subtitle={`${game?.companion.name || tutor} chose these from your evidence, not from a sales funnel`}
            action={<Link to="/world" className="small">All shelves →</Link>}
          >
            {recommendations.length ? (
              <div className="recommend-grid">
                {recommendations.map((rec) => (
                  <button
                    key={`${rec.bookId}-${rec.topicId}`}
                    className="recommend-book"
                    style={{ "--book": rec.bookColor } as CSSProperties}
                    onClick={() => navigate(`/world/${rec.bookId}?topic=${encodeURIComponent(rec.topicId)}`)}
                  >
                    <span className="recommend-book__cover"><span>{rec.bookIcon}</span><small>{rec.bookTitle}</small></span>
                    <span className="recommend-book__body">
                      <strong>{rec.topicName}</strong>
                      <small>{rec.reason}</small>
                      <span className={`mastery-pill mastery-pill--${rec.status}`}>{rec.statusName}</span>
                    </span>
                  </button>
                ))}
                {game?.companion.connection ? (
                  <button className="recommend-connection" onClick={() => navigate(`/world/${game.companion.connection!.bookId}`)}>
                    <Icon name="sparkles" size={18} />
                    <strong>A connection worth following</strong>
                    <small>{game.companion.connection.text}</small>
                  </button>
                ) : null}
              </div>
            ) : (
              <EmptyState icon="library" title="No recommendation yet" text="Open a book and study one topic; recommendations grow from real evidence." action={<Button size="sm" onClick={() => navigate("/world")}>Explore the Library</Button>} />
            )}
          </Card>

          <Card
            title="Unfinished lessons"
            subtitle="Lessons you've started and can pick up any time"
            action={<Link to="/lessons" className="small">All lessons →</Link>}
          >
            {data.inProgress.length ? (
              <div className="stack stack--sm">
                {data.inProgress.map((l) => (
                  <button key={l.id} className="lesson-row" onClick={() => navigate(`/lessons/${l.id}`)}>
                    <span className="lesson-row__icon">{subjects.find((s) => s.id === l.subject)?.icon || "📘"}</span>
                    <span className="lesson-row__body">
                      <span className="lesson-row__title">{l.title}</span>
                      <span className="lesson-row__meta">{l.subjectName} · {l.duration} min · {l.progress}% complete</span>
                    </span>
                    <Icon name="arrow" size={17} />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="book"
                title="Nothing half-finished"
                text="Start a lesson from any library book and it will wait right here for you."
                action={<Button size="sm" icon="library" onClick={() => navigate("/world")}>Find a topic</Button>}
              />
            )}
          </Card>

          <div className="grid grid--2">
            <Card title="Recent achievements" action={<Link to="/achievements" className="small">Hall →</Link>}>
              {data.achievements.length ? (
                <div>
                  {data.achievements.map((a) => (
                    <div className="achv" key={a.code}>
                      <span className="achv__icon">{a.icon}</span>
                      <div>
                        <div className="small" style={{ fontWeight: 650 }}>{a.name}</div>
                        <div className="tiny muted">{timeAgo(a.earned_at || Date.now())}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="small muted" style={{ margin: 0 }}>Complete a lesson to light your first badge. Genuine mastery lights the rarer ones.</p>
              )}
            </Card>

            <Card title="Today's goal" subtitle={`${data.today.minutes} of ${data.today.goal} minutes · ${data.today.xpEarned} XP today`}>
              <div className="goal-card">
                <ProgressRing value={goalPct} label={`${goalPct}%`} sublabel="of goal" />
                <div className="goal-card__meta">
                  <Bar value={goalPct} />
                  <div className="goal-card__row" style={{ marginTop: 6 }}>
                    <span>{goalPct >= 100 ? "Goal met — anything else is a bonus." : goalPct > 0 ? "Nice start. A little more?" : "A 10-minute lesson counts."}</span>
                  </div>
                  <Button size="sm" variant="soft" icon={data.inProgress[0] ? "play" : "library"} onClick={() => navigate(data.inProgress[0] ? `/lessons/${data.inProgress[0].id}` : "/world")}>
                    {data.inProgress.length ? "Continue lesson" : "Open a book"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="stack">
          <Card title={`Your companion, ${tutor}`} className="card--tint">
            <div className="row" style={{ alignItems: "flex-start", marginBottom: 10 }}>
              <LearnerAvatar size={76} state="listening" />
              <div>
                <div className="tiny muted">Tutor · guide · co-adventurer</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{tutor}</div>
                <div className="tiny muted">{personality?.name || "Supportive mentor"}</div>
                <div className="tiny muted" style={{ marginTop: 3 }}><Icon name="sparkles" size={11} /> {environment?.name || "Celestial hall"}</div>
              </div>
            </div>
            <p className="small" style={{ color: "var(--ink-soft)" }}>
              {game?.companion.connection?.text
                || (learner.interests.length
                  ? `I remember you love ${learner.interests.slice(0, 2).join(" and ")}. Want to follow that thread into a book?`
                  : "Tell me what you're into and I'll build examples around it.")}
            </p>
            <Button block icon="chat" onClick={() => navigate("/tutor")}>Talk to {tutor}</Button>
            <div className="row row--tight" style={{ marginTop: 8 }}>
              <Button size="sm" variant="ghost" icon="sparkles" onClick={() => navigate("/academy")}>Change tutor</Button>
              <Button size="sm" variant="ghost" icon="edit" onClick={() => navigate("/studio")}>Restyle</Button>
            </div>
          </Card>

          {data.report ? (
            <Card
              title="Accountability report"
              subtitle={`Today · ${data.report.statusLabel.toLowerCase()}`}
              action={<Link to="/reports" className="small">Open report →</Link>}
            >
              <div className="spread" style={{ marginBottom: 6 }}>
                <Badge tone={data.report.tone === "teal" ? "teal" : data.report.tone === "pink" ? "pink" : data.report.tone === "muted" ? "muted" : "amber"}>
                  {data.report.statusLabel}
                </Badge>
                <span className="tiny muted">{data.report.minutes}/{data.report.target} min</span>
              </div>
              <p className="small" style={{ margin: "0 0 8px", fontWeight: 600 }}>{data.report.headline}</p>
              <Bar value={data.report.pct} />
              {data.report.missing.length ? (
                <ul className="report-list report-list--warn" style={{ marginTop: 10 }}>
                  {data.report.missing.map((line) => <li key={line}>{line}</li>)}
                </ul>
              ) : (
                <p className="tiny muted" style={{ margin: "8px 0 0" }}>Nothing overdue and no missing evidence today.</p>
              )}
              {data.report.nextStep ? (
                <Button size="sm" variant="soft" block icon="arrow" onClick={() => navigate(data.report!.nextStep!.to)} style={{ marginTop: 10 }}>
                  {data.report.nextStep.title}
                </Button>
              ) : null}
            </Card>
          ) : null}

          <Card title="Tutor follow-up" subtitle="What your tutor will check in about" action={<span className={`badge ${followUps.length ? "badge--amber" : "badge--teal"}`}>{followUps.length ? `${followUps.length} open` : "All clear"}</span>}>
            {followUps.length ? (
              <div className="stack stack--sm">
                {followUps.slice(0, 4).map((item) => (
                  <button key={item.key} className="lesson-row" onClick={() => navigate(item.to)} style={{ textAlign: "left" }}>
                    <span className="lesson-row__icon"><Icon name={item.tone.includes("Missed") ? "calendar" : item.tone.includes("% done") ? "book" : "target"} size={17} /></span>
                    <span className="lesson-row__body">
                      <span className="lesson-row__title">{item.label}</span>
                      <span className="lesson-row__meta">{item.tone}</span>
                    </span>
                    <Icon name="arrow" size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>Nothing overdue and no unfinished work. {tutor} will keep it that way with a short check-in each session.</p>
            )}
          </Card>

          <Card title="Daily challenge" subtitle="A small win, every day">
            <div className="challenge">
              <span className="challenge__label">⚡ {subjects.find((s) => s.id === data.challenge.subject)?.name || data.challenge.subject}</span>
              <p className="small" style={{ margin: "7px 0 10px", fontWeight: 600 }}>{data.challenge.text}</p>
              {challengeState?.ok ? (
                <div className="feedback feedback--good">{challengeState.message}</div>
              ) : (
                <>
                  <div className="row row--tight">
                    <input
                      className="input"
                      style={{ flex: 1, minWidth: 110 }}
                      placeholder="Your answer"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void checkChallenge(); }}
                    />
                    <Button size="sm" onClick={checkChallenge}>Check</Button>
                  </div>
                  {challengeState ? <div className="feedback feedback--bad" style={{ marginTop: 8 }}>{challengeState.message}</div> : null}
                </>
              )}
            </div>
          </Card>

          <Card title="Upcoming study" action={<Link to="/schedule" className="small">Plan →</Link>}>
            {data.upcoming.length ? (
              <div className="stack stack--sm">
                {data.upcoming.map((s) => (
                  <div key={s.id} className="schedule-item" style={{ padding: 10 }}>
                    <div className="schedule-item__time"><strong>{formatTime(s.startAt)}</strong><span>{new Date(s.startAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div>
                    <div>
                      <div className="small" style={{ fontWeight: 650 }}>{s.title}</div>
                      <div className="tiny muted">{s.subjectName || "General"} · {s.minutes} min</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>No sessions planned. A 20-minute slot tomorrow is a kind gift to your future self.</p>
            )}
          </Card>

          <Card title="At a glance">
            <div className="stack stack--sm">
              <Stat icon="target" label="Average quiz score" value={`${data.counts.quizAvg}%`} />
              <Stat icon="clock" label="Total learning time" value={`${data.counts.minutesTotal} min`} />
              <Stat icon="star" label="Topics mastered" value={`${mastered} of ${game?.stats.totalTopics || 461}`} />
              <Stat icon="flame" label="Current streak" value={`${streak} day${streak === 1 ? "" : "s"}`} />
            </div>
          </Card>

          <Card title="Ask a quick question">
            <RichText text="Tap a starter and I'll take it from there." />
            <div className="stack stack--sm" style={{ marginTop: 8 }}>
              {["Why does the moon change shape?", "Explain my homework step by step", "Quiz me on something I like"].map((q) => (
                <button key={q} className="chip" style={{ textAlign: "left", justifyContent: "flex-start" }} onClick={() => navigate(`/tutor?ask=${encodeURIComponent(q)}`)}>
                  {q}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
