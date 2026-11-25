import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge, Button, Field, Icon, Modal, Spinner } from "../components/ui";
import { LearnerAvatar } from "../components/character/Avatar";
import { useApp } from "../lib/store";
import {
  formatStudyDate,
  getGame,
  getLibrary,
  requestContent,
  STATUS_STYLES,
  type BookSummary,
  type GameState,
  type LibraryData,
  type MasteryStatusId,
} from "../lib/game";

function useSimplified() {
  const [simplified, setSimplified] = useState(() => {
    try { return localStorage.getItem("plumi:libraryMode") === "list"; } catch { return false; }
  });
  const toggle = () => {
    setSimplified((value) => {
      try { localStorage.setItem("plumi:libraryMode", value ? "spells" : "list"); } catch {}
      return !value;
    });
  };
  return { simplified, toggle };
}

export function LibraryWorld() {
  const { learner, user, toast, version } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sectionParam = params.get("section");
  const { simplified, toggle } = useSimplified();
  const [data, setData] = useState<LibraryData | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(() => params.get("section") || "all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BookSummary | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDetails, setRequestDetails] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setActiveSection(sectionParam || "all");
  }, [sectionParam]);

  useEffect(() => {
    if (!learner) return;
    let alive = true;
    setLoading(true);
    Promise.all([getLibrary(learner.id), getGame(learner.id).catch(() => null)])
      .then(([library, gameRes]) => {
        if (!alive) return;
        setData(library);
        if (gameRes) setGame(gameRes.game);
      })
      .catch((err: any) => toast(err.message || "The Library doors are stuck", "warn"))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [learner?.id, version, toast]);

  const sections = useMemo(() => {
    if (!data) return [];
    if (activeSection === "all") return data.sections;
    return data.sections.filter((s) => s.id === activeSection);
  }, [data, activeSection]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sections.map((section) => ({
      ...section,
      books: section.books.filter((b) => !q || `${b.title} ${b.subtitle} ${b.blurb}`.toLowerCase().includes(q)),
    })).filter((section) => section.books.length || !q);
  }, [sections, query]);

  if (!learner) return null;
  if (loading) return <div className="page"><Spinner label="Unlocking the Great Library…" /></div>;
  if (!data) return <div className="page"><p className="muted">The Library could not be opened. Try again from the home page.</p></div>;

  const level = data.level;
  const companionLine = game?.companion.line || "Every shelf is a door. Take your time choosing which one to open.";
  const recent = game?.companion.recommendations?.[0] || null;

  const openBook = (book: BookSummary) => setSelected(book);

  const submitRequest = async () => {
    if (!requestTitle.trim()) return;
    setRequesting(true);
    try {
      await requestContent(learner.id, { title: requestTitle.trim(), details: requestDetails.trim(), kind: "topic" });
      toast("Your request is on the Archivist's desk. A parent or educator can review it.", "good");
      setRequestOpen(false);
      setRequestTitle("");
      setRequestDetails("");
    } catch (err: any) {
      toast(err.message || "Could not send that request", "warn");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="page page--world">
      <section className="world-hero">
        <div className="world-hero__atmosphere" aria-hidden="true">
          <span className="world-orb world-orb--1" />
          <span className="world-orb world-orb--2" />
          <span className="world-dust world-dust--1" />
          <span className="world-dust world-dust--2" />
          <span className="world-dust world-dust--3" />
          <div className="world-window"><span /><span /><span /></div>
          <span className="world-lantern world-lantern--1">🕯️</span>
          <span className="world-lantern world-lantern--2">🕯️</span>
          <span className="world-floating-book world-floating-book--1">📖</span>
          <span className="world-floating-book world-floating-book--2">📕</span>
          <span className="world-floating-book world-floating-book--3">📘</span>
          <div className="world-shelf-silhouette"><i /><i /><i /><i /><i /><i /></div>
        </div>

        <div className="world-hero__content">
          <div className="world-hero__title">
            <span className="world-kicker">The Great Library · {level.title}</span>
            <h1>Every shelf is a door.</h1>
            <p>
              You are the reader this Library has been waiting for. Nothing here is locked behind a grade.
              Open a book, follow the thread that interests you, and let your companion connect it to something else.
            </p>
            <div className="world-stats">
              <span><strong>{data.totals.mastered}</strong> mastered</span>
              <span><strong>{data.stats.inProgress}</strong> in progress</span>
              <span><strong>{data.totals.startedBooks}</strong> books opened</span>
              <span><strong>{data.totals.topics}</strong> topics waiting</span>
            </div>
            <div className="world-progress">
              <div className="spread">
                <span className="tiny">Level {level.level} · {level.title}</span>
                <span className="tiny">{level.nextXp ? `${level.toNext} XP to ${level.nextTitle}` : "Highest rank reached"}</span>
              </div>
              <div className="world-xp"><span style={{ width: `${level.pct}%` }} /></div>
            </div>
          </div>

          <div className="world-companion">
            <LearnerAvatar size={150} state="greeting" />
            <div className="world-companion__bubble">
              <div className="spread">
                <strong>{game?.companion.name || learner.tutorName}</strong>
                <Badge tone="violet">Companion</Badge>
              </div>
              <p>{companionLine}</p>
              {recent ? (
                <button
                  className="world-nudge"
                  onClick={() => navigate(`/world/${recent.bookId}?topic=${encodeURIComponent(recent.topicId)}`)}
                >
                  <span>{recent.bookIcon}</span>
                  <span>
                    <strong>{recent.topicName}</strong>
                    <small>{recent.reason}</small>
                  </span>
                  <Icon name="arrow" size={14} />
                </button>
              ) : null}
              <div className="row row--tight">
                <Button size="sm" variant="secondary" icon="chat" onClick={() => navigate("/tutor")}>Ask {game?.companion.name || learner.tutorName}</Button>
                <Button size="sm" variant="ghost" icon="target" onClick={() => navigate("/quests")}>Quest board</Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="world-toolbar">
        <div className="world-toolbar__sections">
          <button className={`world-section-chip ${activeSection === "all" ? "on" : ""}`} onClick={() => setActiveSection("all")}>
            <span>✦</span> The whole Library
          </button>
          {data.sections.map((section) => (
            <button
              key={section.id}
              className={`world-section-chip ${activeSection === section.id ? "on" : ""}`}
              onClick={() => setActiveSection(section.id)}
              style={{ "--section": section.color } as CSSProperties}
            >
              <span>{section.icon}</span> {section.name}
            </button>
          ))}
        </div>
        <div className="world-toolbar__tools">
          <label className="world-search">
            <Icon name="search" size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the shelves…" aria-label="Search the Library" />
          </label>
          <button className={`mode-toggle ${simplified ? "on" : ""}`} onClick={toggle} aria-pressed={simplified}>
            <Icon name={simplified ? "cards" : "book"} size={15} /> {simplified ? "Shelf view" : "Simple list view"}
          </button>
        </div>
      </div>

      {simplified ? (
        <div className="book-grid">
          {filtered.flatMap((section) => section.books).map((book) => (
            <button key={book.id} className="book-card" onClick={() => openBook(book)} style={{ "--book": book.color } as CSSProperties}>
              <span className="book-card__icon">{book.icon}</span>
              <span className="book-card__title">{book.title}</span>
              <span className="book-card__sub">{book.subtitle}</span>
              <span className="book-card__blurb">{book.blurb}</span>
              <span className="book-card__meta">{book.topicCount} topics · {book.progress}% explored</span>
              <span className="book-card__bar"><i style={{ width: `${book.progress}%` }} /></span>
            </button>
          ))}
          {!filtered.length ? <p className="muted">No book matches that search. The Archivist can request one below.</p> : null}
        </div>
      ) : (
        <div className="world-sections">
          {filtered.map((section) => (
            <section key={section.id} className="shelf-section" style={{ "--section": section.color } as CSSProperties}>
              <header className="shelf-section__head">
                <div>
                  <h2>{section.icon} {section.name}</h2>
                  <p>{section.blurb}</p>
                </div>
                <div className="shelf-section__meter">
                  <span>{section.progress}% explored</span>
                  <div><i style={{ width: `${section.progress}%` }} /></div>
                </div>
              </header>
              <div className="shelf-stage">
                <div className="shelf-glow" aria-hidden="true" />
                <div className="shelf">
                  {section.books.map((book) => (
                    <button
                      key={book.id}
                      className={`book-spine ${book.started ? "book-spine--started" : ""}`}
                      onClick={() => openBook(book)}
                      style={{
                        "--book": book.color,
                        "--height": `${172 + Math.min(44, book.topicCount / 3)}px`,
                        "--width": `${34 + Math.min(16, Math.floor(book.topicCount / 8))}px`,
                      } as CSSProperties}
                      aria-label={`${book.title}. ${book.topicCount} topics. ${book.progress}% explored. Open preview.`}
                    >
                      <span className="book-spine__cap" />
                      <span className="book-spine__icon">{book.icon}</span>
                      <span className="book-spine__title">{book.title}</span>
                      <span className="book-spine__mark" aria-hidden="true" />
                      {book.completed ? <span className="book-spine__star" title="Every topic mastered">✦</span> : null}
                      <span className="book-spine__progress"><i style={{ height: `${book.progress}%` }} /></span>
                    </button>
                  ))}
                  <span className="shelf-vase" aria-hidden="true">🕯️</span>
                </div>
                <div className="shelf-plank" aria-hidden="true" />
                <div className="shelf-undershadow" aria-hidden="true" />
              </div>
            </section>
          ))}
          {!filtered.length ? <p className="muted">No book matches that search. Use “Request a subject” below.</p> : null}
        </div>
      )}

      {game?.companion.connection ? (
        <div className="library-connection">
          <span className="library-connection__icon">🔗</span>
          <div>
            <strong>A thread between shelves</strong>
            <p>{game.companion.connection.text}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate(`/world/${game.companion.connection!.bookId}`)}>
            Follow it
          </Button>
        </div>
      ) : null}

      <section className="chambers">
        <div className="spread" style={{ marginBottom: 8 }}>
          <div>
            <h2 className="chambers__title">Doors off the main hall</h2>
            <p className="tiny muted">Side chambers unlock with levels. No learning is ever locked away — only extra rooms.</p>
          </div>
          <div className="row row--tight">
            {user?.role === "parent" || user?.role === "educator" ? (
              <Button size="sm" variant="ghost" icon="edit" onClick={() => navigate("/curator")}>Curator's desk</Button>
            ) : null}
            <Button size="sm" variant="ghost" icon="plus" onClick={() => setRequestOpen(true)}>Request a subject</Button>
          </div>
        </div>
        <div className="chamber-grid">
          {data.chambers.map((chamber) => (
            <button
              key={chamber.id}
              className={`chamber ${chamber.unlocked ? "" : "chamber--locked"}`}
              onClick={() => {
                if (!chamber.unlocked) {
                  toast(`This door opens at level ${chamber.level}.`, "info");
                  return;
                }
                navigate(chamber.route);
              }}
            >
              <span className="chamber__icon">{chamber.icon}</span>
              <span className="chamber__body">
                <strong>{chamber.name}</strong>
                <small>{chamber.unlocked ? chamber.blurb : `Opens at level ${chamber.level}`}</small>
              </span>
              <Icon name={chamber.unlocked ? "arrow" : "lock"} size={15} />
            </button>
          ))}
        </div>
      </section>

      {data.recent.length ? (
        <section>
          <div className="spread" style={{ marginBottom: 8 }}>
            <h2 className="chambers__title">Pages you left open</h2>
            <span className="tiny muted">Mastery is earned by evidence, never by opening a book.</span>
          </div>
          <div className="recent-topics">
            {data.recent.slice(0, 5).map((item) => (
              <button key={`${item.bookId}-${item.topicId}`} className="recent-topic" onClick={() => navigate(`/world/${item.bookId}?topic=${encodeURIComponent(item.topicId)}`)}>
                <span className={`recent-topic__dot recent-topic__dot--${item.status}`} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{item.topicName}</strong>
                  <small>{item.bookTitle} · {formatStudyDate(item.lastStudiedAt)}</small>
                </span>
                <span className="tiny" style={{ color: STATUS_STYLES[item.status].color }}>{item.statusName}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        wide
        title={selected ? `${selected.title} — ${selected.subtitle}` : "Book"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>Back to the shelf</Button>
            <Button icon="book" onClick={() => { if (selected) navigate(`/world/${selected.id}`); }}>
              Open this book
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="book-preview" style={{ "--book": selected.color } as CSSProperties}>
            <div className="book-preview__scene">
              <div className="book-preview__cover">
                <span className="book-preview__spine" />
                <span className="book-preview__icon">{selected.icon}</span>
                <span className="book-preview__kicker">The Great Library</span>
                <h3>{selected.title}</h3>
                <p>{selected.subtitle}</p>
                <span className="book-preview__count">{selected.topicCount} topics · {selected.chapterCount} chapters</span>
                <span className="book-preview__foil" aria-hidden="true" />
              </div>
              <div className="book-preview__pages" aria-hidden="true"><span /><span /><span /></div>
            </div>
            <div className="book-preview__body">
              <p>{selected.blurb}</p>
              <div className="row row--tight">
                <Badge tone="violet">{selected.progress}% explored</Badge>
                {selected.started ? <Badge tone="teal">In your journey</Badge> : <Badge tone="muted">Unopened</Badge>}
                {selected.completed ? <Badge tone="amber">Every topic mastered</Badge> : null}
              </div>
              <div className="mastery-legend-inline">
                {(Object.keys(STATUS_STYLES) as MasteryStatusId[]).map((status) => (
                  <span key={status}><i style={{ background: STATUS_STYLES[status].color }} /> {STATUS_STYLES[status].label}</span>
                ))}
              </div>
              <div className="book-preview__assurance">
                <Icon name="bulb" size={15} />
                <span>Opening the cover is the beginning, not the achievement. Mastery needs lessons, practice and a real assessment.</span>
              </div>
              <div className="book-preview__actions">
                <Button onClick={() => navigate(`/world/${selected.id}`)}>Read the contents</Button>
                <Button variant="secondary" icon="target" onClick={() => navigate("/quests")}>See related quests</Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request a new shelf"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button onClick={submitRequest} loading={requesting} disabled={!requestTitle.trim()}>Send to the Archivist</Button>
          </>
        }
      >
        <div className="stack">
          <p className="small muted" style={{ margin: 0 }}>
            Ask for a subject, language, trade or research topic. Requests are reviewed by a parent or educator before
            anything is added — generated material is never marked as reviewed automatically.
          </p>
          <Field label="What would you like to study?">
            <input className="input" value={requestTitle} onChange={(e) => setRequestTitle(e.target.value)} placeholder="e.g. Marine biology, carpentry, astronomy history" maxLength={140} />
          </Field>
          <Field label="Anything specific?" hint="Optional. Topics, level, why it matters to you.">
            <textarea className="textarea" value={requestDetails} onChange={(e) => setRequestDetails(e.target.value)} maxLength={2000} placeholder="I want to understand how tides work…" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
