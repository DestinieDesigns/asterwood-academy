import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, Field, Icon, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/store";

type RequestRow = { id: string; title: string; details: string; kind: string; status: string; created_at: number; learner_id: string | null };
type Volume = {
  id: string;
  title: string;
  subtitle: string;
  section: string;
  subject: string;
  icon: string;
  color: string;
  blurb: string;
  status: string;
  owned: boolean;
  topicCount: number;
  chapterCount: number;
  chapters: { id: string; title: string; topicCount: number }[];
  createdAt: number;
};

function parseChapters(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, topics] = line.split("|");
      return {
        title: (title || "Chapter").trim(),
        topics: (topics || "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ name, blurb: "" })),
      };
    });
}

export function Curator() {
  const { user, learner, meta, toast, bump } = useApp();
  const navigate = useNavigate();
  const staff = user?.role === "parent" || user?.role === "educator";
  const [loading, setLoading] = useState(true);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    section: "foundations",
    subject: "math",
    icon: "📕",
    color: "#8a6cd6",
    blurb: "",
    chapters: "Chapter 1 | First topic, Second topic",
  });
  const [chapterTitle, setChapterTitle] = useState("");
  const [topicName, setTopicName] = useState("");
  const [topicBlurb, setTopicBlurb] = useState("");
  const [chapterId, setChapterId] = useState("");

  const load = useCallback(async () => {
    if (!staff) { setLoading(false); return; }
    try {
      const [v, r] = await Promise.all([
        api<{ books: Volume[] }>("/library/books"),
        api<{ requests: RequestRow[] }>("/library/requests?all=1"),
      ]);
      setVolumes(v.books);
      setRequests(r.requests);
    } catch (err: any) {
      toast(err.message || "The curator's desk is locked", "warn");
    } finally {
      setLoading(false);
    }
  }, [staff, toast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedId && volumes[0]) setSelectedId(volumes[0].id);
    else if (selectedId && !volumes.some((v) => v.id === selectedId)) setSelectedId(volumes[0]?.id || "");
  }, [volumes, selectedId]);

  if (!learner) return null;
  if (!staff) {
    return (
      <div className="page stack">
        <Card title="The curator's desk is for parents and educators" className="card--tint">
          <p className="small muted">A parent or educator account reviews requested subjects and publishes custom volumes. Learners can still request a subject from inside the Library.</p>
          <Button size="sm" icon="library" onClick={() => navigate("/world")}>Back to the Library</Button>
        </Card>
      </div>
    );
  }
  if (loading) return <div className="page"><Spinner label="Opening the curator's desk…" /></div>;

  const selected = volumes.find((v) => v.id === selectedId) || null;
  const canEditSelected = Boolean(selected && (selected.owned || user?.role === "educator"));

  const createVolume = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const res = await api<{ book: { id: string; title: string } }>("/library/books", {
        method: "POST",
        json: {
          ...form,
          chapters: parseChapters(form.chapters),
        },
      });
      toast(`“${res.book.title}” is now on the shelves.`, "good");
      setForm({ title: "", subtitle: "", section: form.section, subject: form.subject, icon: "📕", color: "#8a6cd6", blurb: "", chapters: "Chapter 1 | First topic" });
      setSelectedId(res.book.id);
      bump();
      await load();
    } catch (err: any) {
      toast(err.message || "Could not publish that volume", "warn");
    } finally {
      setSaving(false);
    }
  };

  const appendChapter = async () => {
    if (!selected || !chapterTitle.trim()) return;
    setSaving(true);
    try {
      await api(`/library/books/${selected.id}/chapters`, { method: "POST", json: { title: chapterTitle.trim() } });
      setChapterTitle("");
      toast("Chapter added.", "good");
      bump();
      await load();
    } catch (err: any) {
      toast(err.message || "Could not add that chapter", "warn");
    } finally {
      setSaving(false);
    }
  };

  const appendTopic = async () => {
    if (!selected || !topicName.trim()) return;
    const target = chapterId || selected.chapters[0]?.id;
    if (!target) return;
    setSaving(true);
    try {
      await api(`/library/books/${selected.id}/chapters/${encodeURIComponent(target)}/topics`, {
        method: "POST",
        json: { name: topicName.trim(), blurb: topicBlurb.trim() },
      });
      setTopicName("");
      setTopicBlurb("");
      toast("Topic added to the volume.", "good");
      bump();
      await load();
    } catch (err: any) {
      toast(err.message || "Could not add that topic", "warn");
    } finally {
      setSaving(false);
    }
  };

  const review = async (request: RequestRow, status: "approved" | "declined") => {
    try {
      await api(`/library/requests/${request.id}`, { method: "PATCH", json: { status } });
      setRequests((list) => list.map((r) => (r.id === request.id ? { ...r, status } : r)));
      if (status === "approved") {
        setForm((current) => ({ ...current, title: request.title.slice(0, 100), blurb: request.details ? request.details.slice(0, 500) : current.blurb }));
      }
      toast(status === "approved" ? "Request approved. The volume form below is ready for it." : "Request declined.", status === "approved" ? "good" : "info");
      bump();
    } catch (err: any) {
      toast(err.message || "Could not review that request", "warn");
    }
  };

  const removeVolume = async (volume: Volume) => {
    if (!confirm(`Remove “${volume.title}” from the shelves? Learner bookmarks and mastery records stay untouched.`)) return;
    try {
      await api(`/library/books/${volume.id}`, { method: "DELETE" });
      setVolumes((list) => list.filter((v) => v.id !== volume.id));
      if (selectedId === volume.id) setSelectedId("");
      toast("Volume removed from the catalogue.", "good");
      bump();
    } catch (err: any) {
      toast(err.message || "Could not remove that volume", "warn");
    }
  };

  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className="page stack curator-page">
      <div className="page__head">
        <div>
          <span className="world-kicker">Curator's desk</span>
          <h1 className="page__title">Grow the Library without rewriting it</h1>
          <p className="page__sub">Reviewed custom volumes and learner requests. Published volumes appear on the shelves immediately, with no deploy.</p>
        </div>
        <Button variant="secondary" icon="library" onClick={() => navigate("/world")}>View shelves</Button>
      </div>

      <div className="curator-grid">
        <Card title="Requested shelves" subtitle={`${pending.length} awaiting review`}>
          {requests.length ? (
            <div className="stack stack--sm">
              {requests.map((request) => (
                <div key={request.id} className="request-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{request.title}</strong>
                    <p>{request.details || "No extra details provided."}</p>
                    <span className="tiny muted">{request.kind} · {new Date(request.created_at).toLocaleDateString()}</span>
                  </div>
                  {request.status === "pending" ? (
                    <div className="row row--tight">
                      <Button size="sm" onClick={() => review(request, "approved")}>Approve</Button>
                      <Button size="sm" variant="ghost" onClick={() => review(request, "declined")}>Decline</Button>
                    </div>
                  ) : (
                    <Badge tone={request.status === "approved" ? "teal" : "muted"}>{request.status}</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="small muted">No requests yet. Learners can ask from the Library's “Request a subject” button.</p>}
        </Card>

        <Card title="Published custom volumes" subtitle={`${volumes.length} volumes`}>
          {volumes.length ? (
            <div className="stack stack--sm">
              {volumes.map((volume) => (
                <button key={volume.id} className={`volume-row ${selectedId === volume.id ? "on" : ""}`} onClick={() => { setSelectedId(volume.id); setChapterId(volume.chapters[0]?.id || ""); }}>
                  <span className="volume-row__icon" style={{ background: volume.color }}>{volume.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong>{volume.title}</strong>
                    <small>{volume.chapterCount} chapters · {volume.topicCount} topics · {volume.status}</small>
                  </span>
                  <span className="tiny muted">{volume.owned || user?.role === "educator" ? "Manage →" : "Read-only"}</span>
                </button>
              ))}
            </div>
          ) : <p className="small muted">No custom volumes yet. Create the first one below.</p>}
        </Card>
      </div>

      {selected ? (
        <Card
          title={`${canEditSelected ? "Edit" : "Browse"} “${selected.title}”`}
          subtitle={canEditSelected ? "Add chapters or topics. Core reviewed books are versioned separately and cannot be overwritten here." : "Another curator published this volume. You can read it, but only its author or an educator can change it."}
        >
          {canEditSelected ? (
            <>
          <div className="curator-grid">
            <div className="stack">
              <Field label="New chapter">
                <input className="input" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} placeholder="e.g. Chapter 3 — Field work" maxLength={120} />
              </Field>
              <Button size="sm" onClick={appendChapter} loading={saving} disabled={!chapterTitle.trim()}>Add chapter</Button>
            </div>
            <div className="stack">
              <Field label="Add a topic to a chapter">
                <select className="select" value={chapterId || selected.chapters[0]?.id || ""} onChange={(e) => setChapterId(e.target.value)}>
                  {selected.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
                </select>
              </Field>
              <input className="input" value={topicName} onChange={(e) => setTopicName(e.target.value)} placeholder="Topic name" maxLength={120} />
              <input className="input" value={topicBlurb} onChange={(e) => setTopicBlurb(e.target.value)} placeholder="One-sentence description (optional)" maxLength={400} />
              <Button size="sm" onClick={appendTopic} loading={saving} disabled={!topicName.trim()}>Add topic</Button>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <Button size="sm" variant="danger" icon="trash" onClick={() => removeVolume(selected)}>Remove volume</Button>
          </div>
            </>
          ) : <p className="small muted" style={{ margin: 0 }}>This volume is read-only for your account.</p>}
        </Card>
      ) : null}

      <Card title="Create a reviewed volume" subtitle="Publish a new book, trade module, language shelf or research collection.">
        <div className="grid grid--2">
          <Field label="Title">
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Marine Biology" maxLength={100} />
          </Field>
          <Field label="Subtitle">
            <input className="input" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="A short, inviting line" maxLength={120} />
          </Field>
          <Field label="Section">
            <select className="select" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
              {(meta?.library?.sections || []).map((section) => <option key={section.id} value={section.id}>{section.icon} {section.name}</option>)}
            </select>
          </Field>
          <Field label="Maps to subject" hint="Lessons and quizzes use the existing curriculum engine.">
            <select className="select" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
              {(meta?.subjects || []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </Field>
          <Field label="Icon">
            <input className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={8} />
          </Field>
          <Field label="Cover colour">
            <input className="input" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </Field>
        </div>
        <Field label="Description">
          <textarea className="textarea" value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} maxLength={500} placeholder="What is this volume for, and who will love it?" />
        </Field>
        <Field label="Chapters and topics" hint="One chapter per line: Chapter title | topic one, topic two">
          <textarea className="textarea" value={form.chapters} onChange={(e) => setForm({ ...form, chapters: e.target.value })} rows={5} />
        </Field>
        <div className="row" style={{ marginTop: 10 }}>
          <Button icon="plus" onClick={createVolume} loading={saving} disabled={!form.title.trim()}>Publish volume</Button>
          <span className="tiny muted"><Icon name="check" size={12} /> Published as reviewed because a parent or educator authored it.</span>
        </div>
      </Card>
    </div>
  );
}
