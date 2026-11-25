import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge, Button, Icon, ProgressRing, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import { startLesson, startQuiz } from "../lib/actions";
import {
  formatStudyDate,
  getBook,
  toggleBookmark,
  STATUS_STYLES,
  type BookDetailResponse,
  type BookMark,
  type MasteryStatusId,
  type TopicProgress,
} from "../lib/game";

const STATUS_ORDER: MasteryStatusId[] = ["not_started", "learning", "practicing", "developing", "mastered"];

type ScripturePassage = {
  id: string;
  reference: string;
  title: string;
  book: string;
  verses: { n: number; text: string }[];
  note: string;
};

type ScriptureRoomData = {
  translation: string;
  publicDomain: boolean;
  note: string;
  passages: ScripturePassage[];
};

function ScriptureRoom() {
  const [data, setData] = useState<ScriptureRoomData | null>(null);
  const [activeId, setActiveId] = useState("");
  useEffect(() => {
    let alive = true;
    api<ScriptureRoomData>("/scripture")
      .then((res) => {
        if (!alive) return;
        setData(res);
        setActiveId(res.passages[0]?.id || "");
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!data) return null;
  const passage = data.passages.find((p) => p.id === activeId) || data.passages[0];
  if (!passage) return null;
  return (
    <section className="kjv-room">
      <header className="kjv-room__head">
        <div>
          <span className="world-kicker">Optional reading room</span>
          <h2>King James Version</h2>
          <p>Read the text slowly. The note beside it is commentary, kept clearly separate from scripture.</p>
        </div>
        <Badge tone="amber">Public domain · 1611</Badge>
      </header>
      <div className="kjv-room__tabs">
        {data.passages.map((p) => (
          <button key={p.id} className={p.id === activeId ? "on" : ""} onClick={() => setActiveId(p.id)}>{p.reference}</button>
        ))}
      </div>
      <div className="kjv-spread">
        <article className="kjv-scripture">
          <span className="kjv-label">Scripture · KJV</span>
          <h3>{passage.reference} — {passage.title}</h3>
          {passage.verses.map((v) => (
            <p key={v.n}><sup>{v.n}</sup>{v.text}</p>
          ))}
        </article>
        <aside className="kjv-note">
          <span className="kjv-label">Editorial note · not scripture</span>
          <p>{passage.note}</p>
          <small>{data.note}</small>
        </aside>
      </div>
    </section>
  );
}

export function BookReader() {
  const { bookId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { learner, version, toast, bump } = useApp();
  const [data, setData] = useState<BookDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [coverVisible, setCoverVisible] = useState(true);
  const [coverClosing, setCoverClosing] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [savedMarks, setSavedMarks] = useState<BookMark[]>([]);
  const [markedPages, setMarkedPages] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    if (!learner || !bookId) return;
    try {
      const res = await getBook(learner.id, bookId);
      setData(res);
      const marks = new Set((res.book.bookmarks || []).map((b) => b.topicId || ""));
      setBookmarks(marks);
      setSavedMarks(res.book.bookmarks || []);
      setMarkedPages(new Set((res.book.bookmarks || []).filter((b) => !b.topicId).map((b) => b.page)));
      const focus = params.get("topic");
      if (focus) {
        const found = res.book.chapters.findIndex((c) => c.topics.some((t) => t.id === focus));
        if (found >= 0) setChapterIndex(found);
        setTimeout(() => document.getElementById(`topic-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
      }
    } catch (err: any) {
      toast(err.message || "That book could not be opened", "warn");
    } finally {
      setLoading(false);
    }
  }, [learner, bookId, params, toast]);

  useEffect(() => { void load(); }, [load, version]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCoverClosing(true);
      setTimeout(() => setCoverVisible(false), 720);
    }, 520);
    return () => clearTimeout(timer);
  }, [bookId]);

  const flatTopics = useMemo(() => {
    if (!data) return [];
    return data.book.chapters.flatMap((chapter) => chapter.topics.map((topic) => ({ ...topic, chapterTitle: chapter.title })));
  }, [data]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return flatTopics.filter((t) => `${t.name} ${t.blurb} ${t.chapterTitle}`.toLowerCase().includes(q));
  }, [flatTopics, query]);

  if (!learner) return null;
  if (loading) return <div className="page"><Spinner label="Opening the book…" /></div>;
  if (!data || !bookId) return <div className="page"><p className="muted">This book is not on the shelf.</p></div>;

  const { book, connection, statuses } = data;
  const chapter = book.chapters[Math.min(chapterIndex, book.chapters.length - 1)];
  const topics = searchResults || chapter?.topics || [];

  const openCover = () => {
    setCoverClosing(true);
    setTimeout(() => setCoverVisible(false), 720);
  };

  const learn = async (topic: TopicProgress) => {
    setBusy(`learn:${topic.id}`);
    try {
      const lesson = await startLesson({
        learnerId: learner.id,
        subject: book.subject,
        topic: topic.name,
        bookId: book.id,
        topicId: topic.id,
      });
      bump();
      toast(`The page becomes a lesson: ${topic.name}`, "good");
      navigate(`/lessons/${lesson.id}`);
    } catch (err: any) {
      toast(err.message || "Could not open that lesson", "warn");
    } finally {
      setBusy(null);
    }
  };

  const practise = async (topic: TopicProgress) => {
    setBusy(`quiz:${topic.id}`);
    try {
      const quiz = await startQuiz({
        learnerId: learner.id,
        subject: book.subject,
        topic: topic.name,
        bookId: book.id,
        topicId: topic.id,
        count: 6,
      });
      bump();
      navigate(`/practice/${quiz.id}`);
    } catch (err: any) {
      toast(err.message || "Could not build that practice set", "warn");
    } finally {
      setBusy(null);
    }
  };

  const toggleTopicMark = async (topic: TopicProgress) => {
    try {
      const res = await toggleBookmark(learner.id, book.id, { topicId: topic.id, page: chapterIndex + 1, label: topic.name });
      setBookmarks(new Set(res.bookmarks.filter((b) => b.topicId).map((b) => b.topicId as string)));
      setSavedMarks(res.bookmarks);
      toast(res.bookmarked ? "Bookmarked" : "Bookmark removed", "good");
    } catch (err: any) {
      toast(err.message || "Could not bookmark that page", "warn");
    }
  };

  const togglePageMark = async () => {
    try {
      const res = await toggleBookmark(learner.id, book.id, { page: chapterIndex + 1, label: chapter?.title || `Page ${chapterIndex + 1}` });
      setMarkedPages(new Set(res.bookmarks.filter((b) => !b.topicId).map((b) => b.page)));
      setSavedMarks(res.bookmarks);
      toast(res.bookmarked ? `Bookmarked page ${chapterIndex + 1}` : "Page bookmark removed", "good");
    } catch (err: any) {
      toast(err.message || "Could not bookmark this page", "warn");
    }
  };

  return (
    <div className="page reader-page" style={{ "--book": book.color } as CSSProperties}>
      {coverVisible ? (
        <div className={`reader-cover ${coverClosing ? "reader-cover--closing" : ""}`}>
          <div className="reader-cover__book">
            <span className="reader-cover__spine" />
            <span className="reader-cover__icon">{book.icon}</span>
            <span className="reader-cover__kicker">The Great Library</span>
            <h1>{book.title}</h1>
            <p>{book.subtitle}</p>
            <span className="reader-cover__count">{book.topicCount} topics · {book.chapterCount} chapters</span>
            <span className="reader-cover__foil" aria-hidden="true" />
          </div>
          <div className="reader-cover__hint">
            <span>{book.blurb}</span>
            <Button variant="secondary" onClick={openCover}>Open the book</Button>
          </div>
        </div>
      ) : null}

      <div className="reader-top">
        <Button variant="ghost" size="sm" icon="back" onClick={() => navigate("/world")}>Back to the shelves</Button>
        <div className="reader-top__title">
          <span className="reader-top__icon" style={{ background: book.color }}>{book.icon}</span>
          <div>
            <strong>{book.title}</strong>
            <span>{book.subtitle}</span>
          </div>
        </div>
        <div className="row row--tight">
          <Badge tone="violet">{book.progress}% of book</Badge>
          <Button size="sm" variant="secondary" icon={markedPages.has(chapterIndex + 1) ? "check" : "star"} onClick={togglePageMark}>
            {markedPages.has(chapterIndex + 1) ? "Page saved" : "Save page"}
          </Button>
        </div>
      </div>

      <div className="reader">
        <aside className="reader-page reader-page--left">
          <div className="reader-cover-mini">
            <span>{book.icon}</span>
            <div>
              <strong>{book.title}</strong>
              <small>{book.subtitle}</small>
            </div>
          </div>
          <p className="small" style={{ color: "var(--ink-soft)" }}>{book.blurb}</p>

          <div className="reader-overview">
            <ProgressRing value={book.progress} size={84} label={`${book.progress}%`} sublabel="explored" />
            <div className="reader-overview__counts">
              {STATUS_ORDER.slice(1).map((status) => (
                <span key={status}>
                  <i style={{ background: STATUS_STYLES[status].color }} />
                  {STATUS_STYLES[status].label}
                  <strong>{book.counts[status] || 0}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="reader-chapters">
            <div className="field__label">Chapters</div>
            {book.chapters.map((c, index) => (
              <button
                key={c.id}
                className={`reader-chapter ${index === chapterIndex && !searchResults ? "on" : ""}`}
                onClick={() => { setChapterIndex(index); setQuery(""); }}
              >
                <span className="reader-chapter__num">{c.number}</span>
                <span className="reader-chapter__body">
                  <strong>{c.title}</strong>
                  <small>{c.mastered}/{c.topics.length} mastered · {c.progress}%</small>
                  <span className="reader-chapter__bar"><i style={{ width: `${c.progress}%` }} /></span>
                </span>
              </button>
            ))}
          </div>

          <div className="reader-bookmarks">
            <div className="field__label">Saved pages</div>
            {savedMarks.length ? savedMarks.map((mark) => (
              <button
                key={mark.id}
                className="reader-bookmark"
                onClick={() => {
                  const index = book.chapters.findIndex((c) => c.id === book.chapters[mark.page - 1]?.id);
                  if (index >= 0) setChapterIndex(index);
                  if (mark.topicId) {
                    setQuery("");
                    setTimeout(() => document.getElementById(`topic-${mark.topicId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
                  }
                }}
              >
                <Icon name="star" size={12} />
                <span>{mark.label || mark.topicName || `Page ${mark.page}`}</span>
              </button>
            )) : <p className="tiny muted">No saved pages yet. Use “Save page” or the star beside a topic.</p>}
          </div>

          {connection ? (
            <div className="reader-connection">
              <strong>Thread to another shelf</strong>
              <p>{connection.text}</p>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/world/${connection.bookId}`)}>Follow it →</Button>
            </div>
          ) : null}
        </aside>

        <section className="reader-page reader-page--right reader-page--turn" key={`${book.id}-${chapter?.id || chapterIndex}`}>
          <div className="reader-pagehead">
            <div>
              <span className="tiny muted">{searchResults ? "Search results" : `Chapter ${chapter.number} of ${book.chapters.length}`}</span>
              <h2>{searchResults ? `“${query}”` : chapter.title}</h2>
            </div>
            <div className="reader-pagehead__controls">
              <label className="world-search reader-search">
                <Icon name="search" size={14} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this book…" aria-label="Search this book" />
              </label>
              {!searchResults ? (
                <div className="row row--tight">
                  <button className="reader-turn" aria-label="Previous page" onClick={() => setChapterIndex(Math.max(0, chapterIndex - 1))} disabled={chapterIndex === 0}>
                    <Icon name="back" size={16} />
                  </button>
                  <span className="tiny muted">{chapterIndex + 1}/{book.chapters.length}</span>
                  <button className="reader-turn" aria-label="Next page" onClick={() => setChapterIndex(Math.min(book.chapters.length - 1, chapterIndex + 1))} disabled={chapterIndex >= book.chapters.length - 1}>
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="reader-topics">
            {topics.map((topic) => {
              const style = STATUS_STYLES[topic.status];
              return (
                <article className="topic-entry" key={topic.id} id={`topic-${topic.id}`}>
                  <div className="topic-entry__head">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3>{topic.name}</h3>
                      <p>{topic.blurb}</p>
                      {searchResults ? <span className="tiny muted">{topic.chapterTitle}</span> : null}
                    </div>
                    <div className="topic-entry__side">
                      <span className={`mastery-pill mastery-pill--${topic.status}`} style={{ color: style.color, background: style.track }}>
                        {topic.statusName}{topic.status === "mastered" ? " ✦" : ""}
                      </span>
                      <button
                        className={`topic-mark ${bookmarks.has(topic.id) ? "on" : ""}`}
                        aria-label={bookmarks.has(topic.id) ? "Remove topic bookmark" : "Bookmark topic"}
                        onClick={() => toggleTopicMark(topic)}
                      >
                        <Icon name="star" size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mastery-bar" aria-label={`${topic.progress}% progress`}>
                    <span style={{ width: `${topic.progress}%`, background: style.color }} />
                  </div>

                  <div className="topic-entry__meta">
                    <span><strong>{topic.progress}%</strong></span>
                    <span>{formatStudyDate(topic.lastStudiedAt)}</span>
                    <span>{topic.activities} activit{topic.activities === 1 ? "y" : "ies"}</span>
                    {topic.accuracy != null ? <span>{topic.accuracy}% accuracy</span> : null}
                    <span>{topic.lessons} lesson{topic.lessons === 1 ? "" : "s"}</span>
                  </div>

                  <p className="topic-entry__assessment">{topic.assessment}</p>

                  <div className="row row--tight">
                    <Button
                      size="sm"
                      icon="book"
                      loading={busy === `learn:${topic.id}`}
                      onClick={() => learn(topic)}
                    >
                      {topic.status === "not_started" ? "Begin this topic" : "Continue learning"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="target"
                      loading={busy === `quiz:${topic.id}`}
                      onClick={() => practise(topic)}
                    >
                      Practise
                    </Button>
                    <span className="tiny muted">Evidence: lesson + practice + explanation</span>
                  </div>
                </article>
              );
            })}
            {!topics.length ? (
              <div className="empty">
                <div className="empty__icon"><Icon name="search" size={24} /></div>
                <h3>No topic matches</h3>
                <p>Try a shorter word, or clear the search to return to the chapter.</p>
                <Button size="sm" variant="secondary" onClick={() => setQuery("")}>Clear search</Button>
              </div>
            ) : null}
          </div>

          {!searchResults ? (
            <footer className="reader-footer">
              <Button variant="ghost" size="sm" icon="back" onClick={() => setChapterIndex(Math.max(0, chapterIndex - 1))} disabled={chapterIndex === 0}>
                Previous page
              </Button>
              <div className="reader-dots">
                {book.chapters.map((c, i) => (
                  <button key={c.id} aria-label={`Go to ${c.title}`} className={i === chapterIndex ? "on" : ""} onClick={() => setChapterIndex(i)} />
                ))}
              </div>
              <Button size="sm" icon="arrow" onClick={() => setChapterIndex(Math.min(book.chapters.length - 1, chapterIndex + 1))} disabled={chapterIndex >= book.chapters.length - 1}>
                Next page
              </Button>
            </footer>
          ) : null}
        </section>
      </div>

      {book.id === "bible" ? <ScriptureRoom /> : null}

      <div className="reader-legend">
        <strong>How mastery is earned</strong>
        <div className="mastery-legend-inline">
          {statuses.map((status) => (
            <span key={status.id}><i style={{ background: STATUS_STYLES[status.id].color }} /> {status.name}</span>
          ))}
        </div>
        <p>
          A topic moves from Learning to Practicing with real exercises, then Developing when accuracy is strong.
          Mastered requires a completed lesson, at least two assessments averaging 85%+, and a written explanation that is graded correct — not simply a long answer.
          Mastery can soften after a long break so it can be re-earned honestly.
        </p>
      </div>
    </div>
  );
}
