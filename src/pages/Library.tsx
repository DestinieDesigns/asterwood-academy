import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Field, Icon, Modal, RichText, Spinner } from "../components/ui";
import { TutorPresence } from "../components/character/TutorPresence";
import { api, timeAgo, uploadFile, type LibraryItem, type Upload } from "../lib/api";
import { useApp } from "../lib/store";

const KINDS: Record<string, { label: string; icon: string }> = {
  note: { label: "Note", icon: "📝" },
  question: { label: "Question", icon: "❓" },
  lesson: { label: "Lesson", icon: "📘" },
  study_guide: { label: "Study guide", icon: "🧭" },
  vocabulary: { label: "Vocabulary", icon: "💬" },
  bookmark: { label: "Bookmark", icon: "🔖" },
  explanation: { label: "Explanation", icon: "💡" },
};

export function Library() {
  const { learner, meta, version, bump, toast } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | "notes" | "lessons" | "uploads" | "guides">("all");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("note");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<LibraryItem | null>(null);
  const [viewingUpload, setViewingUpload] = useState<Upload | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [guideBusy, setGuideBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!learner) return;
    try {
      const data = await api<{ items: LibraryItem[]; uploads: Upload[] }>(`/library?learnerId=${learner.id}`);
      setItems(data.items);
      setUploads(data.uploads);
    } catch (err: any) {
      toast(err.message || "Could not load your library", "warn");
    } finally {
      setLoading(false);
    }
  }, [learner, toast]);

  useEffect(() => { void load(); }, [load, version]);

  const addNote = async () => {
    if (!learner || !title.trim()) return;
    setBusy(true);
    try {
      await api("/library", { method: "POST", json: { learnerId: learner.id, title, body, kind, subject: subject || null } });
      setTitle("");
      setBody("");
      setNoteOpen(false);
      bump();
      void load();
      toast("Saved to your library", "good");
    } catch (err: any) {
      toast(err.message || "Could not save that", "warn");
    } finally {
      setBusy(false);
    }
  };

  const saveItem = async (item: LibraryItem) => {
    try {
      await api(`/library/${item.id}`, { method: "PATCH", json: { title: item.title, body: item.body } });
      setViewing(null);
      void load();
      toast("Updated", "good");
    } catch (err: any) {
      toast(err.message || "Could not update that", "warn");
    }
  };

  const removeItem = async (id: string) => {
    try {
      await api(`/library/${id}`, { method: "DELETE" });
      setViewing(null);
      bump();
      void load();
      toast("Removed from your library", "good");
    } catch (err: any) {
      toast(err.message || "Could not remove that", "warn");
    }
  };

  const doUpload = async (file?: File | null) => {
    if (!file || !learner) return;
    if (!learner.uploadsEnabled) {
      toast("Uploads are turned off for this profile.", "warn");
      return;
    }
    setUploading(true);
    try {
      const res = await uploadFile(file, learner.id);
      toast(res.upload.textFound ? "Uploaded and explained — open it to read the summary." : "Uploaded. I couldn't read text from that file format, but the file is saved.", res.upload.textFound ? "good" : "warn");
      bump();
      void load();
      if (res.upload.textFound) setViewingUpload(res.upload);
    } catch (err: any) {
      toast(err.message || "Upload failed", "warn");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const makeGuide = async (upload: Upload) => {
    setGuideBusy(upload.id);
    try {
      await api(`/uploads/${upload.id}/study-guide`, { method: "POST", json: {} });
      toast("Study guide created — find it in Study guides", "good");
      bump();
      void load();
      setTab("guides");
    } catch (err: any) {
      toast(err.message || "Could not build a study guide", "warn");
    } finally {
      setGuideBusy(null);
    }
  };

  const removeUpload = async (id: string) => {
    try {
      await api(`/uploads/${id}`, { method: "DELETE" });
      setViewingUpload(null);
      bump();
      void load();
      toast("Upload deleted", "good");
    } catch (err: any) {
      toast(err.message || "Could not delete that upload", "warn");
    }
  };

  if (!learner) return null;

  const q = search.trim().toLowerCase();
  const filteredItems = items
    .filter((i) => (tab === "notes" ? ["note", "question", "bookmark", "vocabulary", "explanation"].includes(i.kind) : tab === "lessons" ? i.kind === "lesson" : tab === "guides" ? i.kind === "study_guide" : true))
    .filter((i) => !q || i.title.toLowerCase().includes(q) || (i.body || "").toLowerCase().includes(q));
  const filteredUploads = uploads.filter((u) => (tab === "uploads" || tab === "all") && (!q || u.name.toLowerCase().includes(q)));

  return (
    <div className="page stack">
      <div className="page__head">
        <div>
          <h1 className="page__title">My library</h1>
          <p className="page__sub">Everything you've saved, in one place — yours to keep, edit or delete.</p>
        </div>
        <div className="page-actions">
          <Button icon="plus" onClick={() => setNoteOpen(true)}>New note</Button>
          <Button variant="secondary" icon="upload" onClick={() => fileRef.current?.click()} loading={uploading} disabled={!learner.uploadsEnabled}>
            Upload a file
          </Button>
        </div>
      </div>

      <TutorPresence
        message={`Bring me what you save here. I can turn a note or an upload into an explanation, a quiz or a study guide — and I'll remember which ones helped.`}
        cta={`Study with ${learner.tutorName}`}
      />

      <TutorPresence
        message={`Bring me what you save here. I can turn a note or an upload into an explanation, a quiz or a study guide — and I'll remember which ones helped.`}
        cta={`Study with ${learner.tutorName}`}
      />

      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,.ppt,.pptx,.rtf,image/*,text/*"
        onChange={(e) => void doUpload(e.target.files?.[0])}
      />

      <div className="row">
        <div className="row" style={{ flex: 1, minWidth: 220 }}>
          <Icon name="search" size={16} />
          <input className="input" placeholder="Search your library…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="tabs" style={{ margin: 0, border: 0 }}>
          {[["all", "All"], ["notes", "Notes & questions"], ["lessons", "Lessons"], ["guides", "Study guides"], ["uploads", "Uploads"]].map(([id, label]) => (
            <button key={id} className={`tab ${tab === id ? "tab--active" : ""}`} onClick={() => setTab(id as typeof tab)}>{label}</button>
          ))}
        </div>
      </div>

      <Card>
        <div
          className={`dropzone ${dragging ? "dropzone--over" : ""}`}
          onClick={() => learner.uploadsEnabled && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void doUpload(e.dataTransfer.files?.[0]);
          }}
        >
          <Icon name="upload" size={22} />
          <div style={{ marginTop: 6, fontWeight: 650 }}>
            {uploading ? "Reading and explaining your file…" : learner.uploadsEnabled ? "Drop a PDF, document or notes file here" : "Uploads are turned off for this profile"}
          </div>
          <div className="tiny" style={{ marginTop: 3 }}>
            {learner.uploadsEnabled
              ? "Text-based files and PDFs are read and explained. Images are stored, but OCR isn't available."
              : "A parent or educator can enable uploads in the Parent Dashboard."}
          </div>
        </div>
      </Card>

      {loading ? (
        <Spinner label="Opening your library…" />
      ) : (
        <>
          {filteredItems.length === 0 && filteredUploads.length === 0 ? (
            <Card>
              <EmptyState
                icon="library"
                title="Your library is ready"
                text="Save explanations from your tutor, notes you write, or lessons you want to revisit."
                action={<Button icon="plus" onClick={() => setNoteOpen(true)}>Write your first note</Button>}
              />
            </Card>
          ) : null}

          {filteredItems.length ? (
            <div className="grid grid--2">
              {filteredItems.map((item) => (
                <div key={item.id} className="lib-item">
                  <span className="lib-item__icon">{KINDS[item.kind]?.icon || "📄"}</span>
                  <div className="lib-item__body">
                    <button style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer" }} onClick={() => setViewing(item)}>
                      <div className="lib-item__title">{item.title}</div>
                      <div className="lib-item__excerpt">{item.body || "No content yet"}</div>
                    </button>
                    <div className="tiny muted" style={{ marginTop: 5 }}>
                      {KINDS[item.kind]?.label || item.kind}{item.subject ? ` · ${meta?.subjects.find((s) => s.id === item.subject)?.name || item.subject}` : ""} · {timeAgo(item.created_at)}
                    </div>
                  </div>
                  <button className="icon-btn" aria-label="Open" onClick={() => setViewing(item)}><Icon name="arrow" size={14} /></button>
                </div>
              ))}
            </div>
          ) : null}

          {filteredUploads.length ? (
            <Card title="Uploaded materials" subtitle="Asterwood reads the text, summarises it and can turn it into a study guide.">
              <div className="stack stack--sm">
                {filteredUploads.map((u) => (
                  <div key={u.id} className="lib-item">
                    <span className="lib-item__icon"><Icon name="folder" size={15} /></span>
                    <div className="lib-item__body">
                      <button style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer" }} onClick={() => setViewingUpload(u)}>
                        <div className="lib-item__title">{u.name}</div>
                        <div className="lib-item__excerpt">{u.summary || "No summary yet"}</div>
                      </button>
                      <div className="tiny muted" style={{ marginTop: 4 }}>{(u.size / 1024).toFixed(0)} KB · {timeAgo(u.created_at)}</div>
                    </div>
                    <div className="row row--tight">
                      <Button size="sm" variant="soft" onClick={() => makeGuide(u)} loading={guideBusy === u.id}>Study guide</Button>
                      <button className="icon-btn" aria-label="Delete upload" onClick={() => removeUpload(u.id)}><Icon name="trash" size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      )}

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="New library entry"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button onClick={addNote} loading={busy} icon="check">Save</Button>
          </>
        }
      >
        <div className="stack">
          <Field label="Title">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Why the sky is blue" />
          </Field>
          <div className="onboard__grid">
            <Field label="Type">
              <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(KINDS).filter(([k]) => k !== "lesson").map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </Field>
            <Field label="Subject" hint="Optional">
              <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">None</option>
                {(meta?.subjects || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Content">
            <textarea className="textarea" style={{ minHeight: 160 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write anything you want to remember. Markdown-ish formatting works." />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        wide
        title={viewing?.title || "Library item"}
        footer={
          <>
            <Button variant="danger" icon="trash" onClick={() => viewing && removeItem(viewing.id)}>Delete</Button>
            <Button variant="secondary" icon="chat" onClick={() => { if (viewing) { navigate(`/tutor?ask=${encodeURIComponent(`Help me understand this note of mine: ${viewing.title}`)}`); setViewing(null); } }}>
              Ask tutor about this
            </Button>
            <Button icon="check" onClick={() => viewing && saveItem(viewing)}>Save changes</Button>
          </>
        }
      >
        {viewing ? (
          <div className="stack">
            <div className="row row--tight">
              <Badge tone="violet">{KINDS[viewing.kind]?.label || viewing.kind}</Badge>
              {viewing.subject ? <Badge tone="muted">{meta?.subjects.find((s) => s.id === viewing.subject)?.name || viewing.subject}</Badge> : null}
              <span className="tiny muted">{new Date(viewing.created_at).toLocaleDateString()}</span>
            </div>
            <textarea
              className="textarea"
              style={{ minHeight: 220 }}
              value={viewing.body || ""}
              onChange={(e) => setViewing({ ...viewing, body: e.target.value })}
            />
            <Card className="card--flat" title="Preview">
              <RichText text={viewing.body || ""} />
            </Card>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(viewingUpload)}
        onClose={() => setViewingUpload(null)}
        wide
        title={viewingUpload?.name || "Upload"}
        footer={
          <>
            <Button variant="danger" icon="trash" onClick={() => viewingUpload && removeUpload(viewingUpload.id)}>Delete</Button>
            <Button icon="sparkles" onClick={() => viewingUpload && makeGuide(viewingUpload)} loading={Boolean(guideBusy)}>Create study guide</Button>
          </>
        }
      >
        {viewingUpload ? (
          <div className="stack">
            <p className="tiny muted">{viewingUpload.mime || "file"} · {(viewingUpload.size / 1024).toFixed(0)} KB · {timeAgo(viewingUpload.created_at)}</p>
            <Card className="card--flat" title="What Asterwood found">
              <RichText text={viewingUpload.summary || "No readable text was found in this file."} />
            </Card>
            <Card className="card--flat" title="Study next">
              <div className="row">
                <Button size="sm" variant="secondary" icon="target" onClick={() => { setViewingUpload(null); navigate("/practice"); }}>Quiz myself</Button>
                <Button size="sm" variant="ghost" icon="chat" onClick={() => { setViewingUpload(null); navigate(`/tutor?ask=${encodeURIComponent(`Can you help me understand the document called "${viewingUpload.name}"?`)}`); }}>Talk it through</Button>
              </div>
            </Card>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
