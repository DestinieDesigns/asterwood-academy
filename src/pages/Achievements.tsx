import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Bar, Button, Card, Icon, Spinner } from "../components/ui";
import { useApp } from "../lib/store";
import { api } from "../lib/api";
import { getGame, type GameState } from "../lib/game";

type Achievement = { code: string; name: string; icon: string; description: string; earned: boolean; earnedAt: number | null };

type Tab = "badges" | "milestones" | "relics";

export function Achievements() {
  const { learner, toast, version } = useApp();
  const navigate = useNavigate();
  const [badges, setBadges] = useState<Achievement[]>([]);
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("badges");

  useEffect(() => {
    if (!learner) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      api<{ achievements: Achievement[] }>(`/achievements?learnerId=${encodeURIComponent(learner.id)}`),
      getGame(learner.id),
    ])
      .then(([a, g]) => {
        if (!alive) return;
        setBadges(a.achievements);
        setGame(g.game);
      })
      .catch((err: any) => toast(err.message || "The Achievement Hall is dark", "warn"))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [learner?.id, version, toast]);

  const earned = useMemo(() => badges.filter((b) => b.earned), [badges]);

  if (!learner) return null;
  if (loading) return <div className="page"><Spinner label="Lighting the Achievement Hall…" /></div>;

  const stats = game?.stats;
  const milestones = [
    { label: "Topics mastered", value: stats?.mastered || 0, target: Math.max(1, stats?.totalTopics || 1), icon: "✦" },
    { label: "Books opened", value: game?.library.totals.startedBooks || 0, target: stats?.books || 20, icon: "📖" },
    { label: "Sections explored", value: stats?.sectionsStudied || 0, target: 6, icon: "🗺️" },
    { label: "Books completed", value: game?.library.totals.startedBooks ? game.library.books.filter((b) => b.completed).length : 0, target: stats?.books || 20, icon: "🏛️" },
    { label: "Quests claimed", value: game?.quests.counts.claimed || 0, target: 10, icon: "📜" },
    { label: "Level reached", value: game?.level.level || 1, target: 9, icon: "🕯️" },
  ];

  return (
    <div className="page stack achievements-page">
      <div className="hall-hero">
        <div className="hall-hero__stars" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div>
          <span className="world-kicker">The Achievement Hall</span>
          <h1>Proof of work, not proof of clicks.</h1>
          <p>
            Badges remember what you actually did. Knowledge relics are earned only when a section of the Library
            has been studied deeply enough to leave a mark.
          </p>
          <div className="row row--tight" style={{ marginTop: 12 }}>
            <Badge tone="amber">{earned.length} badges</Badge>
            <Badge tone="violet">{stats?.mastered || 0} mastered topics</Badge>
            <Badge tone="teal">{game?.level.title || "Seeker"} · level {game?.level.level || 1}</Badge>
          </div>
        </div>
        <div className="hall-hero__seal">
          <span>{game?.level.level || 1}</span>
          <small>{game?.level.title || "Seeker"}</small>
        </div>
      </div>

      <div className="segmented">
        <button className={tab === "badges" ? "on" : ""} onClick={() => setTab("badges")}>Badges <span>{earned.length}/{badges.length}</span></button>
        <button className={tab === "milestones" ? "on" : ""} onClick={() => setTab("milestones")}>Milestones</button>
        <button className={tab === "relics" ? "on" : ""} onClick={() => setTab("relics")}>Knowledge relics</button>
      </div>

      {tab === "badges" ? (
        <div className="badge-grid">
          {badges.map((badge) => (
            <article key={badge.code} className={`badge-tile ${badge.earned ? "badge-tile--earned" : "badge-tile--locked"}`}>
              <span className="badge-tile__icon">{badge.earned ? badge.icon : "🔒"}</span>
              <div>
                <strong>{badge.name}</strong>
                <p>{badge.description}</p>
                {badge.earned ? (
                  <span className="tiny" style={{ color: "var(--teal)" }}>
                    Earned {badge.earnedAt ? new Date(badge.earnedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                  </span>
                ) : (
                  <span className="tiny muted">Not yet earned</span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {tab === "milestones" ? (
        <div className="grid grid--2">
          {milestones.map((m) => {
            const pct = Math.min(100, Math.round((m.value / Math.max(1, m.target)) * 100));
            return (
              <Card key={m.label} className="milestone-card">
                <div className="spread">
                  <div className="row row--tight"><span className="milestone-card__icon">{m.icon}</span><strong>{m.label}</strong></div>
                  <span className="tiny muted">{m.value} / {m.target}</span>
                </div>
                <Bar value={pct} height={10} />
                <span className="tiny muted">{pct >= 100 ? "Complete" : `${pct}% of the way`}</span>
              </Card>
            );
          })}
        </div>
      ) : null}

      {tab === "relics" ? (
        <div className="relic-grid">
          {(game?.library.sections || []).map((section) => {
            const unlocked = (section.mastered || 0) > 0;
            return (
              <article key={section.id} className={`relic ${unlocked ? "relic--unlocked" : ""}`} style={{ "--section": section.color } as CSSProperties}>
                <span className="relic__icon">{unlocked ? section.icon : "◇"}</span>
                <strong>{section.name} relic</strong>
                <p>{unlocked ? `${section.mastered} mastered topic${section.mastered === 1 ? "" : "s"} in this section.` : `Master one topic in ${section.name} to wake this relic.`}</p>
                <span className="relic__bar"><i style={{ width: `${section.progress}%` }} /></span>
                <Button size="sm" variant="ghost" onClick={() => navigate("/world")}>Visit the section →</Button>
              </article>
            );
          })}
        </div>
      ) : null}

      <Card className="card--tint">
        <div className="row" style={{ alignItems: "flex-start" }}>
          <Icon name="bulb" size={18} />
          <p className="small" style={{ margin: 0 }}>
            An achievement is a memory of effort, not a score. If a topic's mastery softens after a long break,
            the badge stays — you did the work — but the topic will honestly ask you to show it again.
          </p>
        </div>
      </Card>
    </div>
  );
}
