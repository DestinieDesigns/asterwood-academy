import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LearnerAvatar } from "../components/character/Avatar";
import { Badge, Button, Card, Icon, RichText, Spinner } from "../components/ui";
import { api, type GradeResult, type Question, type Quiz, type Rewards } from "../lib/api";
import { useApp } from "../lib/store";

type CheckResponse = { correct?: boolean; open?: boolean; explanation?: string; hint?: string | null; answer?: string | null };

export function QuizView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { learner, meta, bump, toast } = useApp();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<CheckResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; pct: number; results: GradeResult[]; summary: string; rewards?: Rewards } | null>(null);
  const [startedAt] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api<{ quiz: Quiz }>(`/quizzes/${id}`);
      setQuiz(data.quiz);
    } catch (err: any) {
      toast(err.message || "Could not open that quiz", "warn");
      navigate("/practice");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (result) return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startedAt, result]);

  const question: Question | undefined = quiz?.questions[index];

  const shuffledRight = useMemo(() => {
    if (!question?.pairs) return [];
    return [...question.pairs.map((p) => p.right)].sort((a, b) => (a > b ? 1 : -1));
  }, [question]);

  if (loading) return <div className="page"><Spinner label="Preparing your quiz…" /></div>;
  if (!quiz) return null;

  const setAnswer = (value: string) => {
    if (!question) return;
    setAnswers((a) => ({ ...a, [question.id]: value }));
  };

  const check = async () => {
    if (!question) return;
    const value = answers[question.id] || "";
    if (!value.trim()) {
      toast("Give it a try first — a guess is a useful guess.", "warn");
      return;
    }
    setChecking(true);
    try {
      const res = await api<CheckResponse>(`/quizzes/${quiz.id}/check`, { method: "POST", json: { questionId: question.id, answer: value } });
      setChecked(res);
    } catch (err: any) {
      toast(err.message || "Could not check that answer", "warn");
    } finally {
      setChecking(false);
    }
  };

  const next = () => {
    setChecked(null);
    if (index + 1 < quiz.questions.length) setIndex(index + 1);
    else void submit();
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api<{ score: number; total: number; pct: number; results: GradeResult[]; summary: string; rewards?: Rewards }>(
        `/quizzes/${quiz.id}/attempt`,
        { method: "POST", json: { answers } },
      );
      setResult(res);
      bump();
      if (res.rewards?.unlocked?.length) toast("Achievement unlocked", "good", res.rewards.unlocked.map((u) => ({ icon: u.icon, name: u.name })));
    } catch (err: any) {
      toast(err.message || "Could not submit your quiz", "warn");
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => {
    setResult(null);
    setIndex(0);
    setAnswers({});
    setChecked(null);
    setElapsed(0);
  };

  const tutor = learner?.tutorName || "Aster";

  if (result) {
    const wrong = result.results.filter((r) => r.graded && r.correct === false);
    const unscored = result.results.filter((r) => r.graded === false).length;
    return (
      <div className="page">
        <div className="quiz-wrap stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <Button variant="ghost" size="sm" icon="back" onClick={() => navigate("/practice")}>All practice</Button>
            <Badge tone="muted">{quiz.subjectName || quiz.subject} · {quiz.topic}</Badge>
          </div>
          <Card>
            <div className="result-hero">
              <LearnerAvatar size={104} state={result.pct >= 70 ? "celebrating" : "coaching"} />
              <div className="result-score" style={{ marginTop: 8 }}>{result.pct}%</div>
              <p className="muted" style={{ marginTop: 4 }}>
                {result.score} of {result.total} scored answers correct · {Math.floor(elapsed / 60)}m {elapsed % 60}s
                {unscored ? ` · ${unscored} written answer${unscored === 1 ? "" : "s"} saved for ${tutor}` : ""}
              </p>
            </div>
            <div className="feedback feedback--good" style={{ marginTop: 12 }}>
              <strong>{tutor} says</strong>
              <RichText text={result.summary} />
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <Button icon="arrow" onClick={retry}>Try again</Button>
              <Button variant="secondary" icon="cards" onClick={async () => {
                try {
                  const res = await api<{ added: number }>(`/quizzes/${quiz.id}/flashcards`, { method: "POST", json: {} });
                  toast(`${res.added} flashcards saved`, "good");
                  bump();
                } catch { toast("Could not create flashcards", "warn"); }
              }}>
                Make flashcards
              </Button>
              <Button
                variant="ghost"
                icon="chat"
                onClick={() => navigate(`/tutor?ask=${encodeURIComponent(wrong.length ? `I got these wrong in a ${quiz.topic} quiz: ${wrong.map((w) => w.prompt).join("; ")}. Can we go through them?` : `I scored ${result.pct}% on a ${quiz.topic} quiz. Can you stretch me with something harder?`)}`)}
              >
                Go through it with {tutor}
              </Button>
            </div>
          </Card>

          <Card title="Question by question" subtitle="Every answer has an explanation — read the ones you missed.">
            <div className="result-list">
              {result.results.map((r) => (
                <div key={r.id} className={`result-item ${r.graded === false ? "" : r.correct ? "result-item--ok" : "result-item--no"}`}>
                  <div className="spread">
                    <div className="result-item__q">{r.graded === false ? "📝" : r.correct ? "✅" : "➖"} {r.prompt}</div>
                  </div>
                  <div className="tiny" style={{ marginTop: 4 }}>
                    <span className="muted">Your answer:</span> {r.given || "—"}
                    {r.graded === false ? <><br /><span className="muted">Not scored automatically — saved for review.</span></> : null}
                    {r.graded !== false && r.correct === false ? <><br /><span className="muted">Correct:</span> {r.expected || "open response"}</> : null}
                  </div>
                  {r.explanation ? <div className="tiny muted" style={{ marginTop: 4 }}>{r.explanation}</div> : null}
                  {r.feedback ? <div className="tiny" style={{ marginTop: 3 }}>{r.feedback}</div> : null}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const answered = Object.keys(answers).length;

  return (
    <div className="page">
      <div className="quiz-wrap stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <Button variant="ghost" size="sm" icon="back" onClick={() => navigate("/practice")}>Leave quiz</Button>
          <div className="row row--tight">
            <Badge tone="muted">{quiz.subjectName || quiz.subject}</Badge>
            <Badge tone="violet">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} · untimed</Badge>
          </div>
        </div>

        <div className="quiz-progress">
          {quiz.questions.map((q, i) => <span key={q.id} className={i <= index ? "on" : ""} />)}
        </div>

        {question ? (
          <div className="q-card">
            <div className="spread" style={{ marginBottom: 8 }}>
              <span className="tiny muted">Question {index + 1} of {quiz.questions.length}</span>
              <Badge tone="muted">{question.type.replace(/_/g, " ")}</Badge>
            </div>
            <div className="q-prompt">{question.prompt}</div>

            {question.type === "multiple_choice" || question.type === "true_false" ? (
              <div className="options">
                {(question.options || (question.type === "true_false" ? ["True", "False"] : [])).map((opt, i) => {
                  const selected = answers[question.id] === opt;
                  const state = checked && selected ? (checked.open ? "option--on" : checked.correct ? "option--correct" : "option--wrong") : checked && !checked.correct && checked.answer === opt ? "option--correct" : selected ? "option--on" : "";
                  return (
                    <button key={opt} className={`option ${state}`} onClick={() => !checked && setAnswer(opt)} disabled={Boolean(checked)}>
                      <span className="option__key">{String.fromCharCode(65 + i)}</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : question.type === "matching" ? (
              <div className="stack stack--sm">
                {(question.pairs || []).map((pair) => {
                  let mapping: Record<string, string> = {};
                  try { mapping = JSON.parse(answers[question.id] || "{}"); } catch {}
                  return (
                    <div key={pair.left} className="row" style={{ gap: 10 }}>
                      <span className="small" style={{ minWidth: 130, fontWeight: 600 }}>{pair.left}</span>
                      <select
                        className="select"
                        style={{ flex: 1 }}
                        value={mapping[pair.left] || ""}
                        disabled={Boolean(checked)}
                        onChange={(e) => {
                          const nextMap = { ...mapping, [pair.left]: e.target.value };
                          setAnswer(JSON.stringify(nextMap));
                        }}
                      >
                        <option value="">Choose a match…</option>
                        {shuffledRight.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            ) : question.type === "short_answer" || question.type === "written_response" ? (
              <textarea
                className="textarea"
                placeholder="Explain your thinking in your own words…"
                value={answers[question.id] || ""}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={Boolean(checked)}
              />
            ) : (
              <input
                className="input input--lg"
                placeholder={question.type === "math" ? "Your answer" : "Type the missing word…"}
                value={answers[question.id] || ""}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !checked) void check(); }}
                disabled={Boolean(checked)}
              />
            )}

            {checked ? (
              <div className={`feedback ${checked.open ? "feedback--good" : checked.correct ? "feedback--good" : "feedback--bad"}`} style={{ marginTop: 14 }}>
                <strong>{checked.open ? "Saved for review" : checked.correct ? "That's right" : "Not quite — here's why"}</strong>
                {checked.explanation ? <RichText text={checked.explanation} /> : null}
                {!checked.correct && checked.answer ? <div className="small" style={{ marginTop: 4 }}><strong>Correct answer:</strong> {checked.answer}</div> : null}
                {!checked.correct && checked.hint ? <div className="tiny" style={{ marginTop: 4 }}><strong>Hint for next time:</strong> {checked.hint}</div> : null}
              </div>
            ) : question.hint ? (
              <p className="tiny muted" style={{ marginTop: 12 }}><Icon name="bulb" size={12} /> {question.hint}</p>
            ) : null}

            <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
              <span className="tiny muted">{answered} of {quiz.questions.length} answered</span>
              <div className="row">
                {!checked ? (
                  <Button onClick={check} loading={checking} variant="secondary" icon="check">Check answer</Button>
                ) : null}
                <Button
                  onClick={() => (checked ? next() : submit())}
                  loading={submitting}
                  icon={index + 1 < quiz.questions.length ? "arrow" : "sparkles"}
                >
                  {index + 1 < quiz.questions.length ? "Next question" : "Finish quiz"}
                </Button>
              </div>
            </div>
            {!checked && index + 1 === quiz.questions.length ? (
              <p className="tiny muted" style={{ marginTop: 8 }}>You can finish without checking this one — answers are graded together.</p>
            ) : null}
          </div>
        ) : null}

        <Card className="card--flat">
          <div className="spread">
            <div className="row" style={{ gap: 9 }}>
              <LearnerAvatar size={48} state="listening" />
              <div className="small">
                <strong>{tutor} is nearby.</strong>
                <div className="tiny muted">Stuck? Ask for a hint in a completely different way.</div>
              </div>
            </div>
            <Button size="sm" variant="ghost" icon="chat" onClick={() => navigate(`/tutor?ask=${encodeURIComponent(`I'm doing a quiz on ${quiz.topic} and one question is confusing. Can you give me a hint without telling me the answer?`)}`)}>
              Ask for help
            </Button>
          </div>
        </Card>
        <p className="tiny muted center">Quiz: {quiz.title} · {meta?.levels[quiz.level] || quiz.level}</p>
      </div>
    </div>
  );
}
