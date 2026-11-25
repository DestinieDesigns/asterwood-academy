import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, Icon, Spinner } from "../components/ui";
import { LearnerAvatar } from "../components/character/Avatar";
import { useApp } from "../lib/store";
import { claimQuest, getQuests, type Quest, type QuestBoard, type LevelInfo } from "../lib/game";

const KIND_COPY = {
  daily: { title: "Today's commissions", icon: "☀️", blurb: "Fresh each day. Missing a day never takes anything away." },
  weekly: { title: "This week's challenges", icon: "🌙", blurb: "A little more room to breathe and explore." },
  missions: { title: "Long missions", icon: "✦", blurb: "The slow, deep work of becoming someone who knows things." },
} as const;

function QuestCard({ quest, onClaim, claiming }: { quest: Quest; onClaim: (q: Quest) => void; claiming: string | null }) {
  const pct = Math.min(100, Math.round((quest.progress / Math.max(1, quest.target)) * 100));
  const complete = quest.status === "completed";
  const claimed = quest.status === "claimed";
  return (
    <article className={`quest-card ${complete ? "quest-card--ready" : ""} ${claimed ? "quest-card--claimed" : ""}`}>
      <div className="quest-card__top">
        <span className="quest-card__seal">{claimed ? "✓" : complete ? "✦" : "◇"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{quest.title}</h3>
          <p>{quest.description}</p>
        </div>
        <span className="quest-card__xp">+{quest.xp} XP</span>
      </div>
      <div className="quest-card__bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="quest-card__foot">
        <span className="tiny muted">{quest.progress} / {quest.target}</span>
        {claimed ? (
          <span className="tiny" style={{ color: "var(--teal)" }}>Reward claimed</span>
        ) : complete ? (
          <Button size="sm" onClick={() => onClaim(quest)} loading={claiming === quest.id}>Claim reward</Button>
        ) : (
          <span className="tiny muted">{pct}% complete</span>
        )}
      </div>
    </article>
  );
}

export function Quests() {
  const { learner, toast, version, bump } = useApp();
  const navigate = useNavigate();
  const [board, setBoard] = useState<QuestBoard | null>(null);
  const [level, setLevel] = useState<LevelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learner) return;
    try {
      const res = await getQuests(learner.id);
      setBoard(res.quests);
      setLevel(res.level);
    } catch (err: any) {
      toast(err.message || "The quest board is being rewritten", "warn");
    } finally {
      setLoading(false);
    }
  }, [learner, toast]);

  useEffect(() => { void load(); }, [load, version]);

  if (!learner) return null;
  if (loading) return <div className="page"><Spinner label="Reading the quest board…" /></div>;
  if (!board || !level) return <div className="page"><p className="muted">The board is empty right now. Try again in a moment.</p></div>;

  const claim = async (quest: Quest) => {
    setClaiming(quest.id);
    try {
      const res = await claimQuest(learner.id, quest.id);
      setBoard(res.quests);
      setLevel(res.level);
      toast(`Commission complete. +${quest.xp} XP.`, "good");
      if (res.rewards?.unlocked?.length) {
        toast("New achievement", "good", res.rewards.unlocked.map((u) => ({ icon: u.icon, name: u.name })));
      }
      bump();
    } catch (err: any) {
      toast(err.message || "Could not claim that reward", "warn");
    } finally {
      setClaiming(null);
    }
  };

  const next = [...board.daily, ...board.weekly, ...board.missions].find((q) => q.status === "active");

  return (
    <div className="page stack quests-page">
      <div className="quest-hero">
        <div className="quest-hero__orb" aria-hidden="true" />
        <div className="quest-hero__body">
          <span className="world-kicker">The Quest Board</span>
          <h1>Commissions from your companion</h1>
          <p>
            These come from real learning, not from time spent on a screen. A missed day costs nothing —
            the board simply waits for your next honest attempt.
          </p>
          <div className="quest-hero__stats">
            <span><strong>{level.level}</strong>{level.title}</span>
            <span><strong>{board.counts.claimable}</strong>ready to claim</span>
            <span><strong>{board.counts.claimed}</strong>rewards claimed</span>
            <span><strong>{board.counts.missionsDone}</strong>missions complete</span>
          </div>
          <div className="quest-levelbar">
            <div className="spread"><span className="tiny">Level {level.level}</span><span className="tiny">{level.nextXp ? `${level.toNext} XP to ${level.nextTitle}` : "Highest rank"}</span></div>
            <div className="world-xp"><span style={{ width: `${level.pct}%` }} /></div>
          </div>
        </div>
        <div className="quest-hero__companion">
          <LearnerAvatar size={138} state="celebrating" />
          <p>
            <strong>{learner.tutorName}</strong>
            {next ? ` suggests: “${next.title}.” ${next.description}` : " has nothing urgent for you. Explore a shelf that looks interesting."}
          </p>
          <Button size="sm" variant="secondary" icon="library" onClick={() => navigate("/world")}>Back to the shelves</Button>
        </div>
      </div>

      <div className="quest-lanes">
        {(["daily", "weekly", "missions"] as const).map((kind) => {
          const copy = KIND_COPY[kind];
          const list = board[kind];
          return (
            <section className="quest-lane" key={kind}>
              <header className="quest-lane__head">
                <div>
                  <h2>{copy.icon} {copy.title}</h2>
                  <p>{copy.blurb}</p>
                </div>
                <Badge tone={kind === "missions" ? "amber" : kind === "weekly" ? "violet" : "teal"}>
                  {list.filter((q) => q.status === "claimed").length}/{list.length}
                </Badge>
              </header>
              <div className="stack stack--sm">
                {list.map((quest) => <QuestCard key={quest.id} quest={quest} onClaim={claim} claiming={claiming} />)}
              </div>
            </section>
          );
        })}
      </div>

      <div className="grid grid--2">
        <Card title="How rewards work" className="card--tint">
          <ul className="clean-list">
            <li><Icon name="check" size={15} /> Rewards are granted for completed lessons, accurate practice, assessments and demonstrated mastery.</li>
            <li><Icon name="check" size={15} /> Reading a page or opening a book never counts as mastery.</li>
            <li><Icon name="check" size={15} /> Missed days do not break your progress or lock content.</li>
            <li><Icon name="check" size={15} /> All educational content stays available; levels only unlock extra rooms and trophies.</li>
          </ul>
        </Card>
        <Card title="Your next move" className="card--tint">
          <p className="small muted" style={{ marginTop: 0 }}>
            {next
              ? `The shortest path to “${next.title}” is ${next.description.toLowerCase()} You are at ${next.progress} of ${next.target}.`
              : "Everything on the board is claimed. Choose a topic you are curious about and let the next commission find you."}
          </p>
          <div className="row row--tight">
            <Button size="sm" icon="library" onClick={() => navigate("/world")}>Open the Library</Button>
            <Button size="sm" variant="secondary" icon="chat" onClick={() => navigate("/tutor")}>Ask {learner.tutorName}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
