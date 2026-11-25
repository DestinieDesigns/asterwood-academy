import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ChatMessage, type Conversation, type Learner } from "../lib/api";
import { useSpeech } from "../lib/voice";
import { Button, Icon, RichText } from "./ui";
import type { AreaId } from "../game/engine";

type AreaContext = {
  place: string;
  focus: string;
  openers: string[];
  subject?: string;
};

const AREA_CONTEXT: Record<AreaId, AreaContext> = {
  courtyard: {
    place: "the courtyard at Asterwood Academy",
    focus: "the fountain, the Grand Library doors and the Chamber of Numbers",
    openers: ["Explain what I'm looking at", "Who should I meet first?", "What is the Chamber of Numbers?"],
  },
  library: {
    place: "the Grand Library",
    focus: "the shelves and the books on them",
    openers: ["Explain what I'm looking at", "Which book should I open next?", "Quiz me on something from these shelves"],
  },
  study: {
    place: "my quarters",
    focus: "my desk, my journal and the mirror",
    openers: ["Help me plan what to study next", "What should I revise today?", "Explain what I'm looking at"],
  },
  classroom: {
    place: "the Chamber of Numbers",
    focus: "the chalkboard and the lesson on the lectern",
    subject: "math",
    openers: ["Explain what I'm looking at", "Explain the lesson on the lectern", "Quiz me on what's on the chalkboard"],
  },
};

function openerMessage(context: AreaContext, opener: string) {
  return `I'm in ${context.place}, near ${context.focus}. ${opener}.`;
}

export function AdventureChat({
  learner,
  area,
  tutorGender,
  onClose,
  onNotice,
}: {
  learner: Learner;
  area: AreaId;
  tutorGender?: string;
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const context = AREA_CONTEXT[area] || AREA_CONTEXT.courtyard;
  const tutor = learner.tutorName || "Aster";
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try {
      return localStorage.getItem("asterwood:advVoice") !== "0";
    } catch {
      return true;
    }
  });
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const speech = useSpeech({
    style: learner.voiceStyle || "friendly",
    defaultRate: learner.speakingRate || 1,
    accent: learner.voiceAccent || "auto",
    volume: learner.voiceVolume ?? 1,
    gender: tutorGender,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await api<{ conversations: Conversation[] }>(`/tutor/conversations?learnerId=${learner.id}`);
        const latest = list.conversations[0];
        if (!latest) return;
        const thread = await api<{ messages: ChatMessage[] }>(`/tutor/conversations/${latest.id}`);
        if (!alive) return;
        setConversationId(latest.id);
        setMessages(thread.messages);
      } catch {
        // A missing history is fine: the first message starts a new thread.
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      speech.stop();
    };
    // The thread is loaded once per opening; speech helpers stay stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learner.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    // On phones the software keyboard shrinks the visual viewport, not the
    // layout viewport; size the sheet to what is actually visible.
    const vv = window.visualViewport;
    if (!vv || !window.matchMedia?.("(pointer: coarse)").matches) return;
    const apply = () => setViewportHeight(Math.round(vv.height));
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleVoice = () => {
    const next = !autoSpeak;
    setAutoSpeak(next);
    try {
      localStorage.setItem("asterwood:advVoice", next ? "1" : "0");
    } catch {
      /* private mode */
    }
    if (!next) speech.stop();
  };

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending) return;
      setInput("");
      setError(null);
      setSending(true);
      const optimistic: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", content: text, created_at: Date.now() };
      setMessages((current) => [...current, optimistic]);
      try {
        const res = await api<{
          conversationId: string;
          reply: string;
          notice: string | null;
          blocked?: boolean;
        }>("/tutor/chat", {
          method: "POST",
          json: {
            learnerId: learner.id,
            conversationId,
            message: text,
            subject: context.subject,
          },
        });
        setConversationId(res.conversationId);
        if (res.blocked) {
          setMessages((current) => [
            ...current,
            { id: `blocked-${Date.now()}`, role: "assistant", content: res.reply, created_at: Date.now(), meta: { source: "safety" } },
          ]);
        } else {
          const thread = await api<{ messages: ChatMessage[] }>(`/tutor/conversations/${res.conversationId}`);
          setMessages(thread.messages);
          if (autoSpeak && speech.supported && learner.voiceEnabled) speech.speak(res.reply);
        }
        if (res.notice) onNotice(res.notice);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Your tutor could not reply. Please try again.");
        setMessages((current) => current.filter((m) => m.id !== optimistic.id));
        setInput(text);
      } finally {
        setSending(false);
      }
    },
    [autoSpeak, context.subject, conversationId, learner.id, learner.voiceEnabled, onNotice, sending, speech],
  );

  return (
    <div className="adv-overlay adv-chat-wrap">
      <div
        className="adv-chat"
        role="dialog"
        aria-modal="true"
        aria-label={`Talk with ${tutor}`}
        style={viewportHeight ? { height: viewportHeight, maxHeight: viewportHeight } : undefined}
      >
        <header className="adv-chat__head">
          <div>
            <span className="eyebrow">{context.place}</span>
            <h2>{tutor}</h2>
            <p className="muted">You can talk here exactly as in My Tutor — same thread, same memory of your lessons.</p>
          </div>
          <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            {learner.voiceEnabled && speech.supported ? (
              <Button
                variant="ghost"
                size="sm"
                icon="speaker"
                onClick={toggleVoice}
                aria-pressed={autoSpeak}
                title={autoSpeak ? "Replies are read aloud" : "Replies are silent"}
              >
                {autoSpeak ? "Voice on" : "Voice off"}
              </Button>
            ) : null}
            <Button variant="primary" size="sm" icon="x" onClick={onClose}>Leave chat</Button>
          </div>
        </header>

        <div className="adv-chat__body" ref={scrollRef}>
          {loading ? (
            <p className="muted">Opening your last conversation…</p>
          ) : messages.length ? (
            messages.map((message) => (
              <div key={message.id} className={`adv-chat__msg ${message.role === "user" ? "is-user" : ""}`}>
                <span className="adv-chat__avatar">{message.role === "user" ? learner.name.slice(0, 1).toUpperCase() : tutor.slice(0, 1).toUpperCase()}</span>
                <div className="adv-chat__bubble-wrap">
                  <div className="adv-chat__bubble">
                    <RichText text={message.content} />
                  </div>
                  {message.meta?.notice ? <div className="adv-chat__notice">{message.meta.notice}</div> : null}
                  {message.role === "assistant" && learner.voiceEnabled && speech.supported ? (
                    <button type="button" className="adv-chat__read" onClick={() => speech.speak(message.content)}>
                      <Icon name="speaker" size={12} /> Read aloud
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="adv-chat__empty">
              <p>
                <strong>{tutor}</strong> is standing beside you in {context.place}. Ask about the room, the books, the
                lesson — or anything else you were wondering about.
              </p>
            </div>
          )}
          {sending ? <p className="muted adv-chat__thinking">{tutor} is thinking…</p> : null}
        </div>

        {speech.speaking && speech.caption ? (
          <div className="adv-chat__caption">
            <strong>CC</strong>
            <span>{speech.caption}</span>
            <button type="button" onClick={speech.stop} aria-label="Stop reading"><Icon name="x" size={13} /></button>
          </div>
        ) : null}

        {error ? <div className="feedback feedback--bad adv-chat__error">{error}</div> : null}

        <div className="adv-chat__openers">
          {context.openers.map((opener) => (
            <button key={opener} type="button" className="adv-chip" disabled={sending} onClick={() => void send(openerMessage(context, opener))}>
              {opener}
            </button>
          ))}
        </div>

        <form
          className="adv-chat__composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            rows={2}
            maxLength={1200}
            enterKeyHint="send"
            placeholder={`Ask ${tutor} about what you see…`}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
          />
          <Button type="submit" variant="primary" loading={sending} disabled={!input.trim()}>Send</Button>
        </form>
        <p className="adv-chat__foot">Enter sends · Shift+Enter starts a new line · Esc closes the chat</p>
      </div>
    </div>
  );
}
