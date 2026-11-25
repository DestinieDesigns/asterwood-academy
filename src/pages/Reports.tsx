import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Bar, Button, Card, EmptyState, Icon, Spinner, Stat } from "../components/ui";
import { api, type LearningReport, type ReportOverview, type ReportSummary } from "../lib/api";
import { useApp } from "../lib/store";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

function toneOf(tone: string): "violet" | "teal" | "amber" | "pink" | "muted" {
  return tone === "teal" || tone === "amber" || tone === "pink" || tone === "muted" ? tone : "violet";
}

function statusIcon(status: string) {
  if (status === "met" || status === "on_track") return "check";
  if (status === "missed" || status === "behind") return "x";
  return "clock";
}

export function Reports() {
  const { learner, user, version, toast } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<ReportOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"daily" | "weekly">("weekly");
  const [anchor, setAnchor] = useState<string>(dayKey());

  const load = useCallback(async () => {
    if (!learner) return;
    try {
      const d = await api<ReportOverview>(`/reports?learnerId=${learner.id}&date=${anchor}`);
      setData(d);
    } catch (err: any) {
      toast(err.message || "Could not load the report", "warn");
    } finally {
      setLoading(false);
    }
  }, [learner, anchor, toast]);

  useEffect(() => { setLoading(true); void load(); }, [load, version]);

  const today = data?.today || dayKey();
  const step = period === "weekly" ? 7 : 1;
  const atLatest = period === "daily" ? anchor >= today : shiftKey(anchor, 6) >= today;

  const report: LearningReport | null = data ? (period === "daily" ? data.daily : data.weekly) : null;
  const history: ReportSummary[] = data ? (period === "daily" ? data.history.daily : data.history.weekly) : [];
  const maxDayMinutes = useMemo(() => {
    if (!report) return 1;
    return Math.max(report.goal.dailyGoal, ...report.days.map((d) => d.minutes), 1);
  }, [report]);

  const go = (nextAnchor: string) => setAnchor(nextAnchor);

  if (!learner) return null;

  if (loading && !data) return <div className="page"><Spinner label="Writing the report…" /></div>;
  if (!data || !report) return null;

  const isFamily = user?.role === "parent" || user?.role === "educator";
  const openCommitments = report.commitments.filter((c) => !c.done);

  return (
    <div className="page stack report-page">
      <div className="page__head">
        <div>
          <h1 className="page__title">{isFamily ? `${learner.name}'s reports` : "Learning reports"}</h1>
          <p className="page__sub">
            A daily and weekly account of real work — kept by {data.learner.tutorName}, not by screen time.
          </p>
        </div>
        <div className="page-actions">
          <div className="row row--tight">
            <button className={`choice ${period === "daily" ? "choice--on" : ""}`} onClick={() => setPeriod("daily")}>Daily</button>
            <button className={`choice ${period === "weekly" ? "choice--on" : ""}`} onClick={() => setPeriod("weekly")}>Weekly</button>
          </div>
        </div>
      </div>

      <Card className="report-period">
        <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="row row--tight">
            <Button size="sm" variant="secondary" icon="back" onClick={() => go(shiftKey(anchor, -step))} aria-label={period === "weekly" ? "Previous week" : "Previous day"}>
              {period === "weekly" ? "Previous week" : "Previous day"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => go(shiftKey(anchor, step))} disabled={atLatest}>
              {period === "weekly" ? "Next week" : "Next day"}
            </Button>
          </div>
          <div style={{ textAlign: "center", minWidth: 180 }}>
            <div style={{ fontWeight: 750 }}>{report.range.label}</div>
            <div className="tiny muted">{period === "weekly" ? `Week of ${report.range.start}` : report.label}</div>
          </div>
          <Button size="sm" variant="ghost" icon="calendar" onClick={() => go(today)} disabled={atLatest}>
            {period === "weekly" ? "This week" : "Today"}
          </Button>
        </div>
      </Card>

      <section className="report-hero">
        <div className="report-hero__top">
          <span className="report-hero__icon"><Icon name={statusIcon(report.status)} size={22} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row row--tight" style={{ marginBottom: 4 }}>
              <Badge tone={toneOf(report.tone)}>{report.statusLabel}</Badge>
              <span className="tiny muted">{period === "weekly" ? "Weekly report" : "Daily report"}</span>
            </div>
            <h2>{report.headline}</h2>
            <p>{report.summary}</p>
          </div>
        </div>
        <div className="report-hero__goal">
          <div className="spread tiny"><span>Study time</span><strong>{report.goal.minutes} / {report.goal.target} min</strong></div>
          <Bar value={report.goal.pct} height={10} />
          <div className="spread tiny muted" style={{ marginTop: 4 }}>
            <span>{period === "weekly" ? `${report.metrics.goalMetDays} day${report.metrics.goalMetDays === 1 ? "" : "s"} at goal` : `${report.metrics.lessons} lessons · ${report.metrics.attempts} assessments`}</span>
            <span>{report.goal.pct}% of the pace</span>
          </div>
        </div>
        <div className="report-note">
          <span className="report-note__who">{report.note.author}</span>
          <p>{report.note.text}</p>
        </div>
      </section>

      <div className="grid grid--4">
        <Card><Stat icon="book" label="Lessons completed" value={report.metrics.lessons} note={`${report.metrics.lessonMinutes} lesson minutes`} /></Card>
        <Card><Stat icon="target" label="Assessment accuracy" value={report.metrics.accuracy == null ? "—" : `${report.metrics.accuracy}%`} note={`${report.metrics.correct}/${report.metrics.questions} correct`} /></Card>
        <Card><Stat icon="star" label="Newly mastered" value={report.metrics.mastered} note={report.metrics.alreadyMastered ? `${report.metrics.alreadyMastered} already mastered, practised again` : `${report.metrics.topicsStudied} studied in this period`} /></Card>
        <Card><Stat icon="flame" label="Active days" value={period === "weekly" ? `${report.metrics.activeDays}/${Math.max(1, report.range.elapsedDays)}` : report.metrics.activeDays ? "Yes" : "No"} note={`${report.metrics.streak}-day streak`} /></Card>
      </div>

      {period === "weekly" ? (
        <Card title="Day by day" subtitle={`A goal is ${report.goal.dailyGoal} minutes. Future days stay empty until they happen.`}>
          <div className="report-week">
            {report.days.map((day) => {
              const pct = Math.min(100, Math.round((day.minutes / maxDayMinutes) * 100));
              return (
                <button
                  key={day.date}
                  className={`report-day ${day.isToday ? "report-day--today" : ""} ${day.future ? "report-day--future" : ""} ${day.goalMet ? "report-day--met" : ""}`}
                  onClick={() => { setPeriod("daily"); go(day.date); }}
                  title={`${day.label}: ${day.minutes} min`}
                >
                  <span className="report-day__bar"><span style={{ height: `${day.future ? 0 : Math.max(pct, day.active ? 6 : 0)}%` }} /></span>
                  <span className="report-day__weekday">{day.weekday}</span>
                  <span className="report-day__minutes">{day.future ? "—" : `${day.minutes}m`}</span>
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      <div className="grid grid--2">
        <Card
          title="What was committed"
          subtitle="Open work is named plainly. Nothing here is a punishment — it is a to-do list."
          action={<Badge tone={openCommitments.length ? "amber" : "teal"}>{openCommitments.length ? `${openCommitments.length} open` : "All clear"}</Badge>}
        >
          {report.commitments.length ? (
            <div className="stack stack--sm">
              {report.commitments.map((item) => (
                <div key={item.key} className="report-commit">
                  <span className={`report-commit__mark ${item.done ? "on" : item.tone === "pink" ? "late" : ""}`}>
                    <Icon name={item.done ? "check" : item.kind === "session" ? "calendar" : item.kind === "goal" ? "clock" : "target"} size={14} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="spread" style={{ gap: 8 }}>
                      <strong className="small">{item.label}</strong>
                      {item.tone === "pink" ? <Badge tone="pink">Overdue</Badge> : item.kind === "goal" ? <span className="tiny muted">{item.done ? "Met" : "Open"}</span> : null}
                    </div>
                    <div className="tiny muted">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="check" title="Nothing outstanding" text="No assignments or sessions are open for this period." />
          )}
        </Card>

        <Card title="What happens next" subtitle="One small, concrete step. The report is only useful if it changes something.">
          <div className="stack stack--sm">
            {report.nextSteps.map((step) => (
              <button key={step.title} className="report-step" onClick={() => navigate(step.to)}>
                <span className="report-step__body">
                  <strong>{step.title}</strong>
                  <small>{step.detail}</small>
                </span>
                <Icon name="arrow" size={16} />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid--2">
        <Card title="What went well" subtitle="Evidence, not encouragement.">
          <ul className="report-list report-list--good">
            {report.wins.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </Card>

        <Card title="Needs honest attention" subtitle="Said kindly, and only when the record supports it.">
          {report.concerns.length ? (
            <ul className="report-list report-list--warn">
              {report.concerns.map((line) => <li key={line}>{line}</li>)}
            </ul>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>Nothing is slipping in this period. Keep the same pace.</p>
          )}
        </Card>
      </div>

      <Card
        title={period === "weekly" ? "Previous weeks" : "Previous days"}
        subtitle="Look back, not to scold, but to spot a pattern."
      >
        <div className="report-history">
          {history.map((item) => {
            const key = period === "daily" ? item.periodKey : item.periodKey;
            const current = period === "daily" ? key === report.periodKey : key === report.periodKey;
            return (
              <button
                key={key}
                className={`report-history__item ${current ? "on" : ""}`}
                onClick={() => go(key)}
                title={`${item.rangeLabel}: ${item.statusLabel}`}
              >
                <span className={`report-history__dot report-history__dot--${item.tone}`} />
                <span className="report-history__label">{period === "daily" ? item.label : item.rangeLabel}</span>
                <span className="report-history__meta">{item.minutes}/{item.target} min · {item.lessons} lessons</span>
                <Badge tone={toneOf(item.tone)}>{item.statusLabel}</Badge>
              </button>
            );
          })}
        </div>
      </Card>

      {isFamily ? (
        <Card title="For the parent" subtitle="The same evidence the learner sees. Nothing is hidden from them.">
          <p className="small" style={{ marginTop: 0 }}>{report.summary}</p>
          {report.concerns.length ? (
            <ul className="report-list report-list--warn">
              {report.concerns.map((line) => <li key={line}>{line}</li>)}
            </ul>
          ) : (
            <p className="small muted">No overdue work or missing evidence in this period.</p>
          )}
          <div className="row row--tight">
            <Button size="sm" variant="secondary" icon="plus" onClick={() => navigate("/family")}>Assign follow-up work</Button>
            <Button size="sm" variant="ghost" icon="calendar" onClick={() => navigate("/schedule")}>Open the schedule</Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
