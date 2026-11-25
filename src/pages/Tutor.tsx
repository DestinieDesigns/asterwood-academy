import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LearnerAvatar } from "../components/character/Avatar";
import { Button, Modal, RichText, Spinner, Icon } from "../components/ui";
import { api, timeAgo, type ChatMessage, type Conversation, type Rewards } from "../lib/api";
import { useApp } from "../lib/store";
import { rankVoices, useDictation, useSpeech } from "../lib/voice";
import { useRef as useReactRef } from "react";

const LANG_CODES: Record<string, string> = {
  English: "en-US", Spanish: "es-ES", French: "fr-FR", German: "de-DE", Portuguese: "pt-BR",
  Mandarin: "zh-CN", Arabic: "ar-SA", Hindi: "hi-IN", Swahili: "sw-KE", "Jamaican Patois": "en-JM",
};

export function Tutor() {
  const { learner, meta, version, bump, toast, patchLearner } = useApp();
  const [params] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Conversation | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try { return localStorage.getItem("plumi:autoSpeak") === "1"; } catch { return false; }
  });
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const askedOnce = useReactRef(false);

  const tutorGender = meta?.tutors?.find((entry) => entry.id === learner?.tutorCharacterId)?.gender;
  const speech = useSpeech({
    style: learner?.voiceStyle || "friendly",
    defaultRate: learner?.speakingRate || 1,
    accent: learner?.voiceAccent || "auto",
    volume: learner?.voiceVolume ?? 1,
    gender: tutorGender,
  });
  const dictation = useDictation({
    lang: LANG_CODES[learner?.language || "English"] || "en-US",
    onFinal: (text) => setInput((prev) => (prev ? `${prev.trim()} ${text}` : text)),
  });

  const tutor = learner?.tutorName || "Aster";
  const avatarState = dictation.listening ? "listening" : sending ? "thinking" : speech.speaking ? "talking" : "idle";

  const loadConversations = useCallback(async () => {
    if (!learner) return;
    try {
      const data = await api<{ conversations: Conversation[] }>(`/tutor/conversations?learnerId=${learner.id}`);
      setConversations(data.conversations);
    } catch {
      /* non-fatal */
    }
  }, [learner]);

  const openConversation = useCallback(async (id: string) => {
    setLoadingConv(true);
    setActiveId(id);
    try {
      const data = await api<{ conversation: Conversation; messages: ChatMessage[] }>(`/tutor/conversations/${id}`);
      setMessages(data.messages);
      if (data.conversation.subject) setSubject(data.conversation.subject);
    } catch (err: any) {
      setError(err.message || "Could not open that conversation");
    } finally {
      setLoadingConv(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations, version]);

  useEffect(() => {
    return () => speech.stop();
  }, [speech.stop]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || !learner || sending) return;
      setError(null);
      setInput("");
      setSending(true);
      const optimistic: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", content: text, created_at: Date.now() };
      setMessages((prev) => [...prev, optimistic]);
      try {
        const res = await api<{
          conversationId: string;
          reply: string;
          source: string;
          notice: string | null;
          rewards: Rewards;
          blocked?: boolean;
        }>("/tutor/chat", {
          method: "POST",
          json: { learnerId: learner.id, conversationId: activeId, message: text, subject: subject || undefined },
        });
        if (!res.blocked) {
          const data = await api<{ messages: ChatMessage[] }>(`/tutor/conversations/${res.conversationId}`);
          setMessages(data.messages);
          if (autoSpeak && speech.supported && learner.voiceEnabled) speech.speak(res.reply);
          if (res.rewards?.unlocked?.length) toast("Achievement unlocked", "good", res.rewards.unlocked.map((u) => ({ icon: u.icon, name: u.name })));
        } else {
          setMessages((prev) => [...prev, { id: `blocked-${Date.now()}`, role: "assistant", content: res.reply, created_at: Date.now(), meta: { source: "safety" } }]);
        }
        setActiveId(res.conversationId);
        bump();
        void loadConversations();
        if (res.notice) toast(res.notice, "warn");
      } catch (err: any) {
        setError(err.message || "Your tutor couldn't reply. Please try again.");
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setInput(text);
      } finally {
        setSending(false);
      }
    },
    [activeId, autoSpeak, bump, learner, loadConversations, sending, speech, subject, toast],
  );

  useEffect(() => {
    const ask = params.get("ask");
    if (ask && learner && !askedOnce.current) {
      askedOnce.current = true;
      setInput(ask);
      window.setTimeout(() => void send(ask), 120);
    }
  }, [params, learner, send]);

  const newConversation = () => {
    setActiveId(null);
    setMessages([]);
    setError(null);
    speech.stop();
  };

  const deleteConversation = async () => {
    if (!confirmDelete) return;
    try {
      await api(`/tutor/conversations/${confirmDelete.id}`, { method: "DELETE" });
      if (activeId === confirmDelete.id) newConversation();
      setConfirmDelete(null);
      void loadConversations();
      toast("Conversation deleted", "good");
    } catch (err: any) {
      toast(err.message || "Could not delete that conversation", "warn");
    }
  };

  const saveToLibrary = async (message: ChatMessage, index: number) => {
    const question = [...messages].slice(0, index).reverse().find((m) => m.role === "user")?.content || "A question I asked";
    try {
      await api("/library", {
        method: "POST",
        json: {
          learnerId: learner?.id,
          kind: "explanation",
          title: question.slice(0, 90),
          body: message.content,
          subject: subject || null,
        },
      });
      toast("Saved to your library", "good");
      bump();
    } catch (err: any) {
      toast(err.message || "Could not save that", "warn");
    }
  };

  const toggleAutoSpeak = () => {
    const next = !autoSpeak;
    setAutoSpeak(next);
    try { localStorage.setItem("plumi:autoSpeak", next ? "1" : "0"); } catch {}
    if (!next) speech.stop();
    if (next && !speech.supported) toast("This browser can't speak. Captions and text still work.", "warn");
  };

  if (!learner) return null;

  const suggested = [
    `Explain ${learner.struggles[0] || "fractions"} in a way I'll understand`,
    learner.interests[0] ? `Teach me something using ${learner.interests[0]}` : "Why does the moon change shape?",
    "Quiz me on what I learned this week",
    "I'm stuck on my homework — help me think it through",
  ];

  const voiceEnabled = learner.voiceEnabled;

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">My tutor</h1>
          <p className="page__sub">{tutor} remembers your lessons, your interests and what helped last time.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" size="sm" icon="plus" onClick={newConversation}>New chat</Button>
        </div>
      </div>

      <div className="chat-layout">
        <aside className="stack stack--sm" style={{ minHeight: 0 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="row" style={{ gap: 9, marginBottom: 8 }}>
              <LearnerAvatar size={56} state={avatarState} speaking={speech.speaking} />
              <div>
                <div style={{ fontWeight: 750, fontSize: 14 }}>{tutor}</div>
                <div className="tiny muted">{learner.levelLabel} · {meta?.personalities.find((p) => p.id === learner.tutorPreset)?.name}</div>
                <div className="tiny muted" style={{ textTransform: "capitalize" }}>{learner.strictness?.replace(/_/g, " ")} pacing</div>
              </div>
            </div>
            <div className="spread">
              <span className={`badge ${meta?.ai.enabled ? "badge--teal" : "badge--violet"}`}>
                {meta?.ai.enabled ? "Live AI" : "Curriculum engine"}
              </span>
              <span className="tiny muted">{learner.memoryEnabled ? "Memory on" : "Memory off"}</span>
            </div>
          </div>
          <div className="card" style={{ padding: 10, flex: 1, overflowY: "auto", minHeight: 0 }}>
            <div className="nav__group-title" style={{ paddingTop: 2 }}>Conversations</div>
            <div className="chat-list">
              {conversations.length ? conversations.map((c) => (
                <div key={c.id} style={{ position: "relative" }}>
                  <button className={`conv ${activeId === c.id ? "conv--active" : ""}`} onClick={() => openConversation(c.id)}>
                    <span className="msg__avatar" style={{ background: c.subject ? "var(--teal-soft)" : undefined }}>
                      {meta?.subjects.find((s) => s.id === c.subject)?.icon || "💬"}
                    </span>
                    <span className="conv__body">
                      <span className="conv__title">{c.title}</span>
                      <span className="conv__meta">{timeAgo(c.updated_at)} · {c.messages} messages</span>
                    </span>
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Delete conversation"
                    title="Delete"
                    onClick={() => setConfirmDelete(c)}
                    style={{ position: "absolute", right: 2, top: 4, width: 26, height: 26, border: 0, background: "transparent", opacity: 0.6 }}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              )) : <p className="tiny muted" style={{ padding: "6px 8px" }}>No conversations yet. Ask anything to begin.</p>}
            </div>
          </div>
          {conversations.length ? (
            <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirmDelete(conversations[0])}>Delete latest</Button>
          ) : null}
        </aside>

        <section className="chat-panel">
          <header className="chat-head">
            <LearnerAvatar size={52} state={avatarState} speaking={speech.speaking} />
            <div>
              <div className="chat-head__name">{tutor}</div>
              <div className="chat-head__sub">
                {dictation.listening ? "Listening…" : sending ? "Thinking…" : speech.speaking ? "Speaking — tap stop to interrupt" : "Ready when you are"}
              </div>
            </div>
            <div className="chat-head__tools">
              <select
                className="select"
                aria-label="Subject context"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ width: "auto", height: 34, fontSize: 12.5, padding: "0 28px 0 9px" }}
              >
                <option value="">Any subject</option>
                {(meta?.subjects || []).map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
              {voiceEnabled ? (
                <>
                  <button
                    className={`icon-btn ${autoSpeak ? "active" : ""}`}
                    onClick={toggleAutoSpeak}
                    title={autoSpeak ? "Read replies aloud (on)" : "Read replies aloud (off)"}
                    aria-pressed={autoSpeak}
                    style={autoSpeak ? { background: "var(--violet-soft)", color: "var(--violet-deep)", borderColor: "var(--violet-2)" } : undefined}
                  >
                    <Icon name="speaker" size={17} />
                  </button>
                  <button className="icon-btn" onClick={() => setShowVoiceSettings(true)} title="Voice settings" aria-label="Voice settings">
                    <Icon name="settings" size={16} />
                  </button>
                </>
              ) : null}
            </div>
          </header>

          <div className="chat-scroll" ref={scrollRef}>
            {loadingConv ? (
              <Spinner label="Opening your conversation…" />
            ) : messages.length === 0 ? (
              <div className="stack" style={{ margin: "auto 0", maxWidth: 620 }}>
                <div className="row" style={{ gap: 14 }}>
                  <LearnerAvatar size={112} state="greeting" />
                  <div>
                    <h2 style={{ fontSize: 21 }}>What shall we explore, {learner.name.split(" ")[0]}?</h2>
                    <p className="small muted" style={{ margin: "4px 0 0" }}>
                      Ask me anything — a subject, a homework question, or something you've always wondered about.
                      {voiceEnabled ? " You can speak or type; I'll always show captions." : " Voice is turned off for this profile, so we'll use text."}
                    </p>
                  </div>
                </div>
                <div className="suggestions">
                  {suggested.map((s) => (
                    <button key={s} className="chip" onClick={() => void send(s)} style={{ whiteSpace: "normal", textAlign: "left" }}>{s}</button>
                  ))}
                </div>
                {!meta?.ai.enabled ? (
                  <p className="tiny muted">
                    Live AI isn't configured on this server, so I'm teaching from Asterwood's built-in curriculum engine.
                    It still remembers you and adapts, and you can connect an AI key in Settings for free-form conversation.
                  </p>
                ) : null}
              </div>
            ) : (
              messages.map((m, index) => (
                <div key={m.id} className={`msg ${m.role === "user" ? "msg--user" : "msg--assistant"}`}>
                  <span className="msg__avatar">
                    {m.role === "user" ? learner.name.slice(0, 1).toUpperCase() : <LearnerAvatar size={34} state="idle" effects={false} />}
                  </span>
                  <div>
                    <div className="bubble">
                      <RichText text={m.content} />
                    </div>
                    {m.meta?.notice ? <div className="msg__notice">{m.meta.notice}</div> : null}
                    <div className="msg__meta">
                      <span>{timeAgo(m.created_at)}</span>
                      {m.role === "assistant" ? (
                        <>
                          {voiceEnabled ? (
                            <button className="btn btn--ghost btn--sm" style={{ height: 22, padding: "0 6px", fontSize: 11 }} onClick={() => speech.speak(m.content)}>
                              <Icon name="speaker" size={12} /> Read
                            </button>
                          ) : null}
                          <button className="btn btn--ghost btn--sm" style={{ height: 22, padding: "0 6px", fontSize: 11 }} onClick={() => saveToLibrary(m, index)}>
                            <Icon name="library" size={12} /> Save
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}

            {sending ? (
              <div className="msg msg--assistant">
                <span className="msg__avatar"><LearnerAvatar size={34} state="thinking" effects={false} /></span>
                <div className="bubble" style={{ display: "flex", gap: 5, alignItems: "center", padding: "14px 16px" }}>
                  <span className="spinner spinner--sm" /> <span className="small muted">{tutor} is thinking…</span>
                </div>
              </div>
            ) : null}
          </div>

          {speech.speaking && speech.caption ? (
            <div className="captions">
              <strong>CC</strong>
              <span>{speech.caption}</span>
              <button className="icon-btn" style={{ width: 26, height: 26, marginLeft: "auto", border: 0, background: "transparent" }} onClick={speech.stop} aria-label="Stop reading">
                <Icon name="x" size={14} />
              </button>
            </div>
          ) : null}

          {dictation.error ? (
            <div className="captions" style={{ background: "var(--amber-soft)", color: "#8a5a0c" }}>
              <strong>Mic</strong>
              <span>{dictation.error}</span>
              <button className="icon-btn" style={{ width: 24, height: 24, marginLeft: "auto", border: 0, background: "transparent" }} onClick={dictation.clearError} aria-label="Dismiss">
                <Icon name="x" size={13} />
              </button>
            </div>
          ) : null}

          {error ? <div className="feedback feedback--bad" style={{ margin: "0 14px 8px" }}>{error}</div> : null}

          <div className="composer">
            <div className="composer__row">
              <textarea
                className="composer__input"
                placeholder={dictation.listening ? "Listening… speak naturally" : `Ask ${tutor} anything…`}
                value={dictation.listening && dictation.interim ? `${input} ${dictation.interim}`.trim() : input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                aria-label="Message your tutor"
              />
              {voiceEnabled ? (
                <button
                  className={`mic-btn ${dictation.listening ? "mic-btn--on" : ""}`}
                  onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
                  title={dictation.supported ? (dictation.listening ? "Stop listening" : "Speak your question") : "Voice input isn't supported in this browser"}
                  aria-label={dictation.listening ? "Stop voice input" : "Start voice input"}
                  disabled={!dictation.supported}
                >
                  <Icon name="mic" size={19} />
                </button>
              ) : null}
              <Button icon="send" onClick={() => void send(input)} loading={sending} disabled={!input.trim()} aria-label="Send message">
                Send
              </Button>
            </div>
            <div className="composer__hint">
              {voiceEnabled
                ? dictation.supported
                  ? "Enter to send · Shift+Enter for a new line · microphone for voice, with captions"
                  : "Enter to send · voice input isn't available in this browser, but typing works perfectly"
                : "Text-only mode is on for this profile (a parent can change that in the Parent Dashboard)."}
            </div>
          </div>
        </section>
      </div>

      <Modal open={showVoiceSettings} onClose={() => setShowVoiceSettings(false)} title="Voice settings">
        <div className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong className="small">Read replies aloud</strong>
              <div className="tiny muted">{speech.supported ? "Uses your browser's speech engine — no audio leaves this device." : "Not supported in this browser."}</div>
            </div>
            <label className="switch__control"><input type="checkbox" checked={autoSpeak} onChange={toggleAutoSpeak} /><span className="switch__track" /></label>
          </div>
          <div className="field">
            <span className="field__label">Speaking speed · {speech.rate.toFixed(1)}×</span>
            <input type="range" min={0.6} max={1.6} step={0.1} value={speech.rate} onChange={(e) => speech.setRate(Number(e.target.value))} style={{ accentColor: "var(--violet)" }} />
          </div>
          <div className="field">
            <span className="field__label">Voice style</span>
            <select className="select" value={learner.voiceStyle} onChange={(e) => void patchLearner({ voiceStyle: e.target.value })}>
              {(meta?.voiceStyles || []).map((v) => <option key={v.id} value={v.id}>{v.name} — {v.hint}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="field__label">System voice</span>
            <select className="select" value={speech.voiceURI || ""} onChange={(e) => speech.setVoiceURI(e.target.value)}>
              {speech.voices.length === 0 ? <option value="">Using browser default</option> : null}
              {rankVoices(speech.voices, learner.voiceStyle, (LANG_CODES[learner.language] || "en").slice(0, 2)).map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
              ))}
            </select>
            <span className="field__hint">Voices come from your operating system and browser.</span>
          </div>
          <Button variant="secondary" icon="speaker" onClick={() => speech.speak(`Hi ${learner.name.split(" ")[0]}, it's ${tutor}. This is how I'll sound when we talk.`)}>
            Preview voice
          </Button>
          {speech.speaking ? <Button variant="ghost" onClick={speech.stop} icon="x">Stop speaking</Button> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this conversation?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Keep it</Button>
            <Button variant="danger" onClick={deleteConversation}>Delete conversation</Button>
          </>
        }
      >
        <p className="small">The messages will be removed. What {tutor} has learned about your learning style stays in your profile, and you can manage that separately.</p>
      </Modal>
    </div>
  );
}
