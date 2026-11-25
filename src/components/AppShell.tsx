import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { Icon, Modal, Button } from "./ui";
import { LearnerAvatar } from "./character/Avatar";

const NAV = [
  { group: "Learn", items: [
    { to: "/", label: "Home", icon: "home", end: true, sub: "Your adventure hub" },
    { to: "/adventure", label: "Enter Academy", icon: "compass", sub: "Walk the grounds in first person" },
    { to: "/tutor", label: "My Tutor", icon: "chat", sub: "Talk it through with your companion" },
    { to: "/world", label: "The Great Library", icon: "library", sub: "Explore the shelves and open a book" },
    { to: "/lessons", label: "My Lessons", icon: "book", sub: "Lessons in progress and completed" },
    { to: "/practice", label: "Practice Hall", icon: "target", sub: "Quizzes, flashcards and challenges" },
  ]},
  { group: "Grow", items: [
    { to: "/quests", label: "Quest Board", icon: "target", sub: "Daily commissions and long missions" },
    { to: "/achievements", label: "Achievement Hall", icon: "star", sub: "Badges, milestones and relics" },
    { to: "/academy", label: "Tutor Academy", icon: "sparkles", sub: "Choose and shape your tutor" },
    { to: "/library", label: "My Notes", icon: "folder", sub: "Notes, saved lessons and uploads" },
    { to: "/progress", label: "Progress", icon: "chart", sub: "Your learning journey" },
    { to: "/reports", label: "Reports", icon: "clipboard", sub: "Daily and weekly accountability" },
    { to: "/schedule", label: "Learning Schedule", icon: "calendar", sub: "Plan your study time" },
  ]},
  { group: "You", items: [
    { to: "/characters", label: "Characters", icon: "user", sub: "Choose a look and your tutor" },
    { to: "/studio", label: "Tutor Studio", icon: "edit", sub: "Appearance, personality and voice" },
    { to: "/profile", label: "My Profile", icon: "user", sub: "You and what your tutor remembers" },
    { to: "/settings", label: "Settings", icon: "settings", sub: "Tutor, voice and preferences" },
  ]},
];

const MOBILE = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/world", label: "Library", icon: "library" },
  { to: "/tutor", label: "Tutor", icon: "chat" },
  { to: "/quests", label: "Quests", icon: "target" },
  { to: "/practice", label: "Practice", icon: "book" },
];

function ageTone(groupId: string | null | undefined, meta?: { ageGroups: { id: string; tone: string }[] } | null) {
  return meta?.ageGroups.find((g) => g.id === groupId)?.tone || "bright";
}

export function AppShell() {
  const { learner, learners, user, meta, switchLearner, toast } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isFamily = user?.role === "parent" || user?.role === "educator";

  const nav = [
    ...NAV,
    ...(isFamily ? [{ group: "Family", items: [
      { to: "/family", label: "Parent Dashboard", icon: "family", sub: "Progress, controls and assignments" },
      { to: "/curator", label: "Curator's Desk", icon: "edit", sub: "Review requests and publish new volumes" },
    ] }] : []),
  ];

  const current = nav.flatMap((g) => g.items).find((item) => (item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)));

  useEffect(() => {
    if (!learner || !meta) return;
    document.documentElement.dataset.theme = learner.theme || "classic";
    document.documentElement.dataset.tone = ageTone(learner.ageGroup, meta);
  }, [learner, meta]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (!learner) return null;

  const tutorName = learner.tutorName || "Aster";

  const handleSwitch = async (id: string) => {
    try {
      await switchLearner(id);
      toast("Switched learner profile", "good");
    } catch (err: any) {
      toast(err.message || "Could not switch profile", "warn");
    }
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="sidebar__brand" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="brand__mark">A</span>
          <div>
            <div className="brand__name">Asterwood</div>
            <div className="brand__tag">a school that grows with you</div>
          </div>
        </Link>

        <nav className="nav" aria-label="Main navigation">
          {nav.map((group) => (
            <div key={group.group}>
              <div className="nav__group-title">{group.group}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={(item as any).end}
                  className={({ isActive }) => `nav__link ${isActive ? "nav__link--active" : ""}`}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__foot">
          <div className="row row--tight" style={{ marginBottom: 8 }}>
            <span className="badge badge--violet">🔥 {learner.streak}</span>
            <span className="badge badge--teal">⚡ {learner.xp} XP</span>
          </div>
          <button className="learner-card" onClick={() => navigate("/profile")}>
            <span style={{ width: 36, height: 36, borderRadius: 11, overflow: "hidden", flexShrink: 0, background: "var(--violet-soft)" }}>
              <LearnerAvatar size={36} effects={false} />
            </span>
            <span className="learner-card__meta">
              <span className="learner-card__name">{learner.name}</span>
              <span className="learner-card__sub">{learner.levelLabel} · {tutorName}</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn topbar__burger" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Icon name="compass" size={19} />
          </button>
          <div>
            <div className="topbar__title">{current?.label || "Asterwood"}</div>
            <div className="topbar__sub">{current?.sub || "Learning, your way"}</div>
          </div>
          <div className="topbar__right">
            {learners.length > 1 || isFamily ? (
              <select
                className="select"
                style={{ width: "auto", height: 36, padding: "0 30px 0 10px", fontSize: 12.5 }}
                value={learner.id}
                onChange={(e) => handleSwitch(e.target.value)}
                aria-label="Switch learner"
              >
                {learners.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            ) : null}
            <span className="badge badge--amber hide-sm">🔥 {learner.streak}-day streak</span>
            <span className="badge badge--violet hide-sm">⚡ {learner.xp} XP</span>
            <Button size="sm" variant="secondary" icon="plus" onClick={() => navigate("/world")}>
              Explore library
            </Button>
          </div>
        </header>

        <Outlet />
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {MOBILE.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon name={item.icon} size={19} />
            {item.label}
          </NavLink>
        ))}
        <button onClick={() => setMenuOpen(true)} className={menuOpen ? "active" : ""}>
          <Icon name="settings" size={19} />
          More
        </button>
      </nav>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Where would you like to go?">
        <div className="stack stack--sm">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <strong>{tutorName}</strong> is ready to help
              <div className="tiny muted">{learner.name} · {learner.levelLabel}</div>
            </div>
            <LearnerAvatar size={56} state="greeting" effects={false} />
          </div>
          {nav.map((group) => (
            <div key={group.group}>
              <div className="nav__group-title" style={{ padding: "6px 0 2px" }}>{group.group}</div>
              <div className="stack stack--sm">
                {group.items.map((item) => (
                  <Link key={item.to} to={item.to} className="lesson-row" onClick={() => setMenuOpen(false)}>
                    <span className="lesson-row__icon"><Icon name={item.icon} size={18} /></span>
                    <span className="lesson-row__body">
                      <span className="lesson-row__title">{item.label}</span>
                      <span className="lesson-row__meta">{item.sub}</span>
                    </span>
                    <Icon name="arrow" size={16} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
