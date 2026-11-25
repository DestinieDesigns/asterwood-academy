import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Field, Icon, Modal, Spinner } from "../components/ui";
import { api, timeAgo, type Flashcard, type Quiz } from "../lib/api";
import { startQuiz } from "../lib/actions";
import { useApp } from "../lib/store";

export function Practice() {
  const { learner, meta, version, bump, toast } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"quizzes" | "flashcards">("quizzes");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [builder, setBuilder] = useState(false);
  const [subject, setSubject] = useState("math");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(6);
  const [busy, setBusy] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const load = useCallback(async () => {
    if (!learner) return;
    try {
      const [q, f] = await Promise.all([
        api<{ quizzes: Quiz[] }>(`/quizzes?learnerId=${learner.id}`),
        api<{ flashcards: Flashcard[] }>(`/flashcards?learnerId=${learner.id}`),
      ]);
      setQuizzes(q.quizzes);
      setCards(f.flashcards);
    } catch (err: any) {
      toast(err.message || "Could not load practice", "warn");
    } finally {
      setLoading(false);
    }
  }, [learner, toast]);

  useEffect(() => { void load(); }, [load, version]);

  const build = async () => {
    if (!learner) return;
    setBusy(true);
    try {
      const quiz = await startQuiz({ learnerId: learner.id, subject, topic: topic.trim() || undefined, count });
      bump();
      setBuilder(false);
      setTopic("");
      navigate(`/practice/${quiz.id}`);
    } catch (err: any) {
      toast(err.message || "Could not build that quiz", "warn");
    } finally {
      setBusy(false);
    }
  };

  const makeFlashcards = async (quiz: Quiz) => {
    try {
      const res = await api<{ added: number }>(`/quizzes/${quiz.id}/flashcards`, { method: "POST", json: {} });
      toast(`${res.added} flashcards added`, "good");
      bump();
      void load();
      setTab("flashcards");
    } catch (err: any) {
      toast(err.message || "Could not create flashcards", "warn");
    }
  };

  const addCard = async () => {
    if (!learner || !cardFront.trim() || !cardBack.trim()) return;
    setBusy(true);
    try {
      await api("/flashcards", { method: "POST", json: { learnerId: learner.id, front: cardFront, back: cardBack } });
      setCardFront("");
      setCardBack("");
      setCardOpen(false);
      bump();
      void load();
      toast("Flashcard added", "good");
    } catch (err: any) {
      toast(err.message || "Could not add that card", "warn");
    } finally {
      setBusy(false);
    }
  };

  const gradeCard = async (remembered: boolean) => {
    const card = cards[cardIndex];
    if (!card) return;
    try {
      await api(`/flashcards/${card.id}`, { method: "PATCH", json: { box: remembered ? card.box + 1 : 0 } });
      setFlipped(false);
      setCardIndex((i) => (i + 1) % Math.max(1, cards.length));
      void load();
    } catch {
      toast("Could not update that card", "warn");
    }
  };

  const removeCard = async (id: string) => {
    try {
      await api(`/flashcards/${id}`, { method: "DELETE" });
      void load();
      setCardIndex(0);
      toast("Flashcard deleted", "good");
    } catch (err: any) {
      toast(err.message || "Could not delete that card", "warn");
    }
  };

  if (!learner) return null;
  const subjects = meta?.subjects || [];
  const currentCard = cards[cardIndex];

  return (
    <div className="page stack">
      <div className="page__head">
        <div>
          <h1 className="page__title">Practice & quizzes</h1>
          <p className="page__sub">Immediate feedback, hints and explanations — no judgement, no pressure.</p>
        </div>
        <div className="page-actions">
          <Button icon="plus" onClick={() => setBuilder(true)}>New quiz</Button>
          <Button variant="secondary" icon="cards" onClick={() => setCardOpen(true)}>Add flashcard</Button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "quizzes" ? "tab--active" : ""}`} onClick={() => setTab("quizzes")}>Quizzes & tests ({quizzes.length})</button>
        <button className={`tab ${tab === "flashcards" ? "tab--active" : ""}`} onClick={() => setTab("flashcards")}>Flashcards ({cards.length})</button>
      </div>

      {loading ? (
        <Spinner label="Loading practice…" />
      ) : tab === "quizzes" ? (
        <>
          {quizzes.length === 0 ? (
            <Card>
              <EmptyState
                icon="target"
                title="No quizzes yet"
                text="Build one on any topic. Each question comes with an explanation, and you can retake as often as you like."
                action={<Button icon="plus" onClick={() => setBuilder(true)}>Build my first quiz</Button>}
              />
            </Card>
          ) : (
            <div className="grid grid--2">
              {quizzes.map((q) => {
                const s = subjects.find((x) => x.id === q.subject);
                const best = q.best;
                const pct = best ? Math.round((best.score / Math.max(1, best.total)) * 100) : null;
                return (
                  <Card key={q.id}>
                    <div className="row" style={{ alignItems: "flex-start", marginBottom: 8 }}>
                      <span className="subject-card__icon" style={{ width: 38, height: 38, fontSize: 18, background: `${s?.color || "#7c5cf0"}1a` }}>{s?.icon || "🎯"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{q.title}</div>
                        <div className="tiny muted">{s?.name || q.subject} · {q.questionCount ?? q.questions.length} questions · {timeAgo(q.createdAt)}</div>
                      </div>
                      {pct !== null ? <Badge tone={pct >= 80 ? "teal" : pct >= 50 ? "amber" : "pink"}>{pct}% best</Badge> : null}
                    </div>
                    <div className="row row--tight">
                      <Button size="sm" icon="play" onClick={() => navigate(`/practice/${q.id}`)}>{q.attempts ? "Retake" : "Start quiz"}</Button>
                      <Button size="sm" variant="ghost" icon="cards" onClick={() => makeFlashcards(q)}>Make flashcards</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="grid grid--3">
            <Card title="Daily challenge" className="card--flat">
              <p className="small muted" style={{ marginBottom: 8 }}>A small question each day, right on your dashboard. No streaks lost for missing it.</p>
              <Button size="sm" variant="secondary" onClick={() => navigate("/")}>Go to today's challenge</Button>
            </Card>
            <Card title="Untimed by default" className="card--flat">
              <p className="small muted" style={{ margin: 0 }}>
                {learner.extraTime ? "Extra time is switched on for this profile — no timers anywhere." : "Practice has no timer pressure. If you'd like extra-time settings, enable them in Settings."}
              </p>
            </Card>
            <Card title="Turn mistakes into learning" className="card--flat">
              <p className="small muted" style={{ margin: 0 }}>Every wrong answer comes with an explanation. Ask your tutor to walk through it a different way.</p>
            </Card>
          </div>
        </>
      ) : (
        <div className="stack">
          {cards.length === 0 ? (
            <Card>
              <EmptyState
                icon="cards"
                title="No flashcards yet"
                text="Add your own, or turn any quiz into a flashcard set with one tap."
                action={<Button icon="plus" onClick={() => setCardOpen(true)}>Add a flashcard</Button>}
              />
            </Card>
          ) : (
            <div className="grid grid--2">
              <Card title="Flashcard practice" action={<span className="tiny muted">{cardIndex + 1} / {cards.length}</span>}>
                <button
                  className="card"
                  style={{ minHeight: 170, width: "100%", display: "grid", placeItems: "center", textAlign: "center", cursor: "pointer", background: flipped ? "var(--violet-soft)" : "var(--paper)" }}
                  onClick={() => setFlipped((f) => !f)}
                >
                  <div>
                    <div className="tiny muted" style={{ marginBottom: 6 }}>{flipped ? "Answer" : "Question — tap to flip"}</div>
                    <div style={{ fontSize: 16, fontWeight: 650, lineHeight: 1.4 }}>
                      {currentCard ? (flipped ? currentCard.back : currentCard.front) : ""}
                    </div>
                  </div>
                </button>
                <div className="row" style={{ marginTop: 12 }}>
                  <Button size="sm" variant="secondary" icon="back" onClick={() => { setFlipped(false); setCardIndex((i) => (i - 1 + cards.length) % cards.length); }}>Previous</Button>
                  {flipped ? (
                    <>
                      <Button size="sm" onClick={() => gradeCard(true)}>I knew it</Button>
                      <Button size="sm" variant="secondary" onClick={() => gradeCard(false)}>Show again</Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => setFlipped(true)}>Reveal answer</Button>
                  )}
                  <Button size="sm" variant="ghost" icon="arrow" onClick={() => { setFlipped(false); setCardIndex((i) => (i + 1) % cards.length); }}>Next</Button>
                </div>
              </Card>

              <Card title={`All cards (${cards.length})`} action={<Button size="sm" variant="soft" icon="plus" onClick={() => setCardOpen(true)}>Add</Button>}>
                <div className="stack stack--sm" style={{ maxHeight: 380, overflowY: "auto" }}>
                  {cards.map((c, i) => (
                    <div key={c.id} className="lib-item" style={{ cursor: "pointer", borderColor: i === cardIndex ? "var(--violet-2)" : undefined }} onClick={() => { setCardIndex(i); setFlipped(false); }}>
                      <span className="lib-item__icon"><Icon name="cards" size={15} /></span>
                      <div className="lib-item__body">
                        <div className="lib-item__title">{c.front}</div>
                        <div className="lib-item__excerpt">{c.back}</div>
                      </div>
                      <button className="icon-btn" aria-label="Delete card" onClick={(e) => { e.stopPropagation(); void removeCard(c.id); }}>
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      <Modal
        open={builder}
        onClose={() => setBuilder(false)}
        title="Build a quiz"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBuilder(false)}>Cancel</Button>
            <Button onClick={build} loading={busy} icon="sparkles">Create quiz</Button>
          </>
        }
      >
        <div className="stack">
          <Field label="Subject">
            <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
          </Field>
          <Field label="Topic" hint="Leave blank and your tutor will test something appropriate for your level.">
            <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. fractions, fossils, ancient Rome" />
          </Field>
          <Field label="How many questions?">
            <div className="row row--tight">
              {[3, 6, 10].map((n) => (
                <button key={n} className={`choice ${count === n ? "choice--on" : ""}`} onClick={() => setCount(n)}>{n} questions</button>
              ))}
            </div>
          </Field>
          <div className="onboard__note">
            Feedback appears after every answer, with an explanation and a hint. Open questions are reviewed by your tutor when you submit.
          </div>
        </div>
      </Modal>

      <Modal
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        title="New flashcard"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCardOpen(false)}>Cancel</Button>
            <Button onClick={addCard} loading={busy}>Save card</Button>
          </>
        }
      >
        <div className="stack">
          <Field label="Front (question or term)">
            <input className="input" value={cardFront} onChange={(e) => setCardFront(e.target.value)} placeholder="What is 7 × 8?" />
          </Field>
          <Field label="Back (answer or definition)">
            <textarea className="textarea" value={cardBack} onChange={(e) => setCardBack(e.target.value)} placeholder="56 — because 7 groups of 8" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
