import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import "../adventure.css";
import { useApp } from "../lib/store";
import {
  api,
  getAdventure,
  saveAdventure,
  type AdventureAppearance,
  type AdventureSettings,
  type Lesson,
} from "../lib/api";
import { startLesson } from "../lib/actions";
import { Button, Icon, RichText } from "../components/ui";
import { AdventureChat } from "../components/AdventureChat";
import {
  ACCESSORIES,
  DEFAULT_APPEARANCE,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFIT_COLORS,
  OUTFITS,
  SKIN_TONES,
} from "../game/avatar";
import { AvatarPreview } from "../game/AvatarPreview";
import {
  AREA_LABELS,
  AcademyEngine,
  type AdventureBook,
  type AreaId,
  type DialogueInfo,
  type PanelKey,
  type PromptInfo,
} from "../game/engine";

const TOUCH_PREVIEW = import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("touch") === "1";

const DEFAULT_SETTINGS: AdventureSettings = {
  sensitivity: 1,
  invertY: false,
  motionReduction: false,
  cameraShake: true,
  speed: 1,
  quality: "high",
};

type Overlay = PanelKey | "dialogue" | "book" | "lesson" | "pause" | "settings" | "chat" | null;

const SECTION_LABELS: Record<string, string> = {
  intro: "Introduction",
  objectives: "Objectives",
  explanation: "Explanation",
  example: "Worked example",
  visual: "Picture it",
  guided_practice: "Guided practice",
  independent_practice: "Your turn",
  check: "Knowledge check",
  summary: "Summary",
};

function clockLabel(minutes: number) {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = Math.floor(minutes % 60);
  const period = hour < 6 ? "Night" : hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Night";
  return { time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, period };
}

function Joystick({ onChange }: { onChange: (x: number, y: number) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const release = () => {
    active.current = false;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };

  const move = (event: React.PointerEvent) => {
    if (!active.current || !baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width / 2 - 14;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const length = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, max / length);
    // A small dead zone stops thumb resting from drifting the camera.
    const nx = Math.abs(dx / max) < 0.1 ? 0 : (dx * scale) / max;
    const ny = Math.abs(dy / max) < 0.1 ? 0 : (dy * scale) / max;
    setKnob({ x: nx * max, y: ny * max });
    onChange(nx, ny);
  };

  return (
    <div
      ref={baseRef}
      className="adv-joystick"
      role="group"
      aria-label="Movement joystick"
      onPointerDown={(event) => {
        event.preventDefault();
        active.current = true;
        baseRef.current?.setPointerCapture(event.pointerId);
        move(event);
      }}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <span className="adv-joystick__knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

export function Adventure() {
  const { learner, meta, toast, bump } = useApp();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AcademyEngine | null>(null);
  const appearanceRef = useRef<AdventureAppearance | null>(null);
  const settingsRef = useRef<AdventureSettings>(DEFAULT_SETTINGS);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"creator" | "game">("creator");
  const [appearance, setAppearance] = useState<AdventureAppearance | null>(null);
  const [settings, setSettings] = useState<AdventureSettings>(DEFAULT_SETTINGS);
  const [startPosition, setStartPosition] = useState<{ area: AreaId; x: number; z: number; yaw: number; pitch: number } | null>(null);
  const [worldTime, setWorldTime] = useState<number | null>(null);
  const [entered, setEntered] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [prompt, setPrompt] = useState<PromptInfo | null>(null);
  const [dialogue, setDialogue] = useState<DialogueInfo | null>(null);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [book, setBook] = useState<AdventureBook | null>(null);
  const [area, setArea] = useState<AreaId>("courtyard");
  const [clock, setClock] = useState(8 * 60);
  const [tutorLine, setTutorLine] = useState<string | null>(null);
  const [companionMode, setCompanionMode] = useState<"follow" | "wait" | "quiet">("follow");
  const [discoveries, setDiscoveries] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [mobile, setMobile] = useState(() => TOUCH_PREVIEW || (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) || false);
  const [mobileHint, setMobileHint] = useState(true);
  const [dragLook, setDragLook] = useState(false);
  const lookNoticeShown = useRef(false);
  const [lessonView, setLessonView] = useState<"list" | "read">("list");
  const [lecternLessons, setLecternLessons] = useState<Lesson[] | null>(null);
  const [recommended, setRecommended] = useState<{ subject: string; subjectName: string; topic: string }[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [lessonDone, setLessonDone] = useState<number[]>([]);
  const [lessonBusy, setLessonBusy] = useState(false);
  const [lessonSaving, setLessonSaving] = useState(false);
  const [newSubject, setNewSubject] = useState("math");

  const books = useMemo<AdventureBook[]>(() => (meta?.library?.catalog || []).map((entry) => ({ ...entry })), [meta]);
  const bookTitle = useCallback((id: string) => books.find((entry) => entry.id === id)?.title || id, [books]);

  const loadLectern = useCallback(async () => {
    if (!learner) return;
    setLecternLessons(null);
    try {
      const [list, recs] = await Promise.all([
        api<{ lessons: Lesson[] }>(`/lessons?learnerId=${learner.id}`),
        api<{ recommended: { subject: string; subjectName: string; topic: string }[] }>(`/lessons-recommended?learnerId=${learner.id}`),
      ]);
      setLecternLessons(list.lessons);
      setRecommended(recs.recommended || []);
    } catch {
      setLecternLessons([]);
    }
  }, [learner?.id]);

  const openLesson = useCallback((lesson: Lesson) => {
    const total = Math.max(1, lesson.sections.length);
    const doneCount = lesson.status === "completed" ? total : Math.round((lesson.progress / 100) * total);
    setLessonDone(Array.from({ length: doneCount }, (_, i) => i));
    setActiveLesson(lesson);
    setLessonView("read");
  }, []);

  const openLectern = useCallback(() => {
    setLessonView("list");
    setOverlay("lesson");
    void loadLectern();
  }, [loadLectern]);

  const beginLesson = async (subject: string, topic?: string) => {
    if (!learner) return;
    setLessonBusy(true);
    try {
      const lesson = await startLesson({ learnerId: learner.id, subject, topic });
      setLecternLessons((current) => [lesson, ...(current || []).filter((l) => l.id !== lesson.id)]);
      openLesson(lesson);
      bump();
      toast("A lesson is laid out on the lectern.", "good");
    } catch (err) {
      toast(err instanceof Error ? err.message : "The lesson could not be built.", "warn");
    } finally {
      setLessonBusy(false);
    }
  };

  const toggleLessonSection = async (index: number) => {
    if (!activeLesson) return;
    const next = lessonDone.includes(index) ? lessonDone.filter((i) => i !== index) : [...lessonDone, index].sort((a, b) => a - b);
    setLessonDone(next);
    const pct = Math.round((next.length / Math.max(1, activeLesson.sections.length)) * 100);
    setLessonSaving(true);
    try {
      const res = await api<{ lesson: Lesson }>(`/lessons/${activeLesson.id}`, { method: "PATCH", json: { progress: pct, status: activeLesson.status } });
      setActiveLesson(res.lesson);
      setLecternLessons((current) => (current || []).map((l) => (l.id === res.lesson.id ? res.lesson : l)));
      bump();
    } catch {
      toast("That section could not be saved.", "warn");
    } finally {
      setLessonSaving(false);
    }
  };

  const completeActiveLesson = async () => {
    if (!activeLesson) return;
    setLessonSaving(true);
    try {
      const res = await api<{ lesson: Lesson }>(`/lessons/${activeLesson.id}`, { method: "PATCH", json: { progress: 100, status: "completed" } });
      setActiveLesson(res.lesson);
      setLessonDone(res.lesson.sections.map((_, i) => i));
      setLecternLessons((current) => (current || []).map((l) => (l.id === res.lesson.id ? res.lesson : l)));
      bump();
      toast("Lesson complete — your progress is recorded.", "good");
    } catch {
      toast("That lesson could not be completed.", "warn");
    } finally {
      setLessonSaving(false);
    }
  };

  useEffect(() => {
    if (TOUCH_PREVIEW) {
      setMobile(true);
      return;
    }
    const query = window.matchMedia?.("(pointer: coarse)");
    if (!query) return;
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!mobile || !entered) return;
    const id = window.setTimeout(() => setMobileHint(false), 9000);
    return () => window.clearTimeout(id);
  }, [mobile, entered]);

  useEffect(() => {
    if (!learner) return;
    let alive = true;
    setLoading(true);
    getAdventure()
      .then(({ profile }) => {
        if (!alive) return;
        setAppearance(profile.appearance);
        appearanceRef.current = profile.appearance;
        setSettings(profile.settings);
        settingsRef.current = profile.settings;
        setStartPosition(profile.position);
        setWorldTime(profile.worldTime);
        setDiscoveries(profile.discoveries);
        setClock(profile.worldTime || 8 * 60);
        setPhase(profile.appearance ? "game" : "creator");
      })
      .catch((err: Error) => {
        if (alive) setError(err.message || "The academy could not be reached.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [learner?.id]);

  const closeOverlay = useCallback(() => {
    setOverlay(null);
    setDialogue(null);
    setBook(null);
    engineRef.current?.setOverlay(false);
  }, []);

  const resume = useCallback(() => {
    closeOverlay();
    engineRef.current?.lock();
  }, [closeOverlay]);

  const persist = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    const snapshot = engine.snapshot();
    setDiscoveries(snapshot.discoveries);
    try {
      await saveAdventure({ position: snapshot.position, worldTime: snapshot.worldTime, discoveries: snapshot.discoveries });
      setSavedAt(Date.now());
    } catch {
      // The next save will try again; a dropped autosave should never interrupt play.
    }
  }, []);

  useEffect(() => {
    if (phase !== "game") return;
    const id = window.setInterval(() => void persist(), 8000);
    return () => window.clearInterval(id);
  }, [phase, persist]);

  useEffect(() => {
    if (phase === "game") void persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area]);

  useEffect(() => {
    if (!tutorLine) return;
    const id = window.setTimeout(() => setTutorLine(null), 9000);
    return () => window.clearTimeout(id);
  }, [tutorLine]);

  useEffect(() => {
    if (phase !== "game" || !appearance || !canvasRef.current || !learner || !meta) return;
    let engine: AcademyEngine | null = null;
    try {
      engine = new AcademyEngine({
        canvas: canvasRef.current,
        appearance: appearanceRef.current || appearance,
        settings: settingsRef.current,
        books,
        tutor: { name: learner.tutorName || "Aster", characterId: learner.tutorCharacterId },
        start: startPosition,
        worldTime,
        onPrompt: setPrompt,
        onDialogue: (next) => {
          setDialogue(next);
          setDialogueIndex(0);
          setOverlay("dialogue");
        },
        onBook: (next) => {
          setBook(next);
          setOverlay("book");
        },
        onAppearance: () => navigate("/characters"),
        onPause: (paused) => {
          if (paused) {
            engine?.setOverlay(true);
            setOverlay((current) => current || "pause");
          } else {
            setOverlay((current) => (current === "pause" ? null : current));
          }
        },
        onArea: (next) => setArea(next),
        onTime: setClock,
        onCompanion: setTutorLine,
        onKey: (panel) => setOverlay(panel),
        onLesson: openLectern,
        onToast: (message) => toast(message, "info"),
        onTutorChat: () => setOverlay("chat"),
        onLook: (mode) => {
          const dragging = mode === "drag";
          setDragLook(dragging);
          if (dragging && !lookNoticeShown.current) {
            lookNoticeShown.current = true;
            toast("Mouse capture isn't available here — drag the world to look, or turn with the arrow keys.", "info");
          }
        },
      });
      engineRef.current = engine;
      engine.setOverlay(true);
      if (import.meta.env.DEV) (window as unknown as { __academy?: AcademyEngine }).__academy = engine;
    } catch (err) {
      setError(err instanceof Error ? err.message : "WebGL is unavailable on this device.");
      return;
    }
    const active = engine;
    return () => {
      const snapshot = active.snapshot();
      void saveAdventure({ position: snapshot.position, worldTime: snapshot.worldTime, discoveries: snapshot.discoveries }).catch(() => {});
      active.dispose();
      if (engineRef.current === active) engineRef.current = null;
    };
    // Engine lifecycle is tied to the learner, not to every UI setting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, learner?.id]);

  const enterAcademy = () => {
    setEntered(true);
    const engine = engineRef.current;
    if (!engine) return;
    // Keep this inside the click so the browser still counts it as a gesture.
    engine.setOverlay(false);
    engine.lock();
  };

  const updateSettings = (patch: Partial<AdventureSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    setSettings(next);
    settingsRef.current = next;
    engineRef.current?.setSettings(next);
  };

  const persistSettings = async () => {
    try {
      await saveAdventure({ settings });
      toast("Comfort settings saved.", "good");
    } catch {
      toast("Could not save settings.", "warn");
    }
    closeOverlay();
  };

  const changeCompanion = (mode: "follow" | "wait" | "quiet") => {
    setCompanionMode(mode);
    engineRef.current?.setCompanionMode(mode);
  };

  const openPause = () => {
    engineRef.current?.setOverlay(true);
    setOverlay("pause");
  };

  const travel = (next: AreaId) => {
    closeOverlay();
    engineRef.current?.travel(next);
    engineRef.current?.lock();
  };

  const currentClock = clockLabel(clock);
  const dialogueLine = dialogue?.lines[Math.min(dialogueIndex, dialogue.lines.length - 1)] || "";
  const bookEntries = discoveries.map((id) => {
    if (id.startsWith("book:")) return { id, label: `Read ${bookTitle(id.slice(5))}`, icon: "book", kind: "Book" };
    if (id.startsWith("npc:")) return { id, label: `Met ${id.slice(4).replace(/^\w/, (c) => c.toUpperCase())}`, icon: "user", kind: "Person" };
    if (id.startsWith("area:")) return { id, label: `Entered the ${AREA_LABELS[id.slice(5) as AreaId] || "academy"}`, icon: "compass", kind: "Place" };
    return { id, label: id, icon: "sparkles", kind: "Discovery" };
  });

  if (!learner) return null;

  if (loading) {
    return (
      <div className="adv-shell adv-loading">
        <Icon name="compass" size={42} />
        <h2>Opening the academy gates…</h2>
        <p className="muted">Loading your saved world position and character.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="adv-shell adv-loading">
        <Icon name="compass" size={42} />
        <h2>The gates would not open</h2>
        <p className="muted">{error}</p>
        <div className="row">
          <Button variant="primary" onClick={() => window.location.reload()}>Try again</Button>
          <Button variant="ghost" onClick={() => navigate("/")}>Back to Asterwood</Button>
        </div>
      </div>
    );
  }

  if (!appearance) {
    return <Navigate to="/characters?first=1" replace />;
  }

  return (
    <div className="adv-shell">
      <canvas ref={canvasRef} className="adv-canvas" />

      {entered && !overlay ? (
        <div className="adv-hud">
          <div className="adv-hud__top">
            <div className="adv-location">
              <span className="adv-location__name">{AREA_LABELS[area]}</span>
              <span className="adv-location__time"><Icon name="clock" size={15} /> {currentClock.time} · {currentClock.period}</span>
            </div>
            <div className="adv-hud__actions">
              <button type="button" className="adv-icon-btn adv-icon-btn--optional" aria-label="Adventure journal (J)" onClick={() => { engineRef.current?.setOverlay(true); setOverlay("journal"); }}><Icon name="book" /></button>
              <button type="button" className="adv-icon-btn adv-icon-btn--optional" aria-label="Satchel (I)" onClick={() => { engineRef.current?.setOverlay(true); setOverlay("satchel"); }}><Icon name="folder" /></button>
              <button type="button" className="adv-icon-btn" aria-label="Map (M)" onClick={() => { engineRef.current?.setOverlay(true); setOverlay("map"); }}><Icon name="compass" /></button>
              <button type="button" className="adv-icon-btn" aria-label="Pause menu" onClick={openPause}><Icon name="settings" /></button>
            </div>
          </div>

          <div className="adv-crosshair" aria-hidden="true" />

          <div className="adv-hud__bottom">
            {prompt ? (
              <div className="adv-prompt">
                {mobile ? null : <kbd>{prompt.key}</kbd>}
                <span>{prompt.label}</span>
              </div>
            ) : mobile ? (
              mobileHint ? <div className="adv-hint adv-hint--mobile">Drag to look · left stick to walk · Use to interact</div> : null
            ) : (
              <div className="adv-hint">
                {`${dragLook ? "Drag to look" : "Mouse look"} · WASD move · ← → turn · E interact · Shift run · Space jump · C tutor · J journal · M map · Esc pause`}
              </div>
            )}
          </div>

          {mobile ? (
            <div className="adv-touch-actions">
              <button type="button" className="adv-jump" aria-label="Jump" onClick={() => { setMobileHint(false); engineRef.current?.jump(); }}>Jump</button>
              <button type="button" className="adv-interact" aria-label="Interact" disabled={!prompt} onClick={() => { setMobileHint(false); engineRef.current?.interact(); }}>Use</button>
            </div>
          ) : null}

          {tutorLine ? <div className="adv-subtitle"><strong>{learner.tutorName || "Aster"}:</strong> {tutorLine}</div> : null}
          <div className="adv-save">{savedAt ? "World saved" : "Autosave every 8s"}</div>
          {mobile ? <Joystick onChange={(x, y) => { setMobileHint(false); engineRef.current?.setStick(x, y); }} /> : null}
        </div>
      ) : null}

      {!entered ? (
        <div className="adv-overlay adv-gate">
          <div className="adv-gate__card">
            <span className="eyebrow">Asterwood Academy · first person</span>
            <h1>Welcome, {learner.name.split(" ")[0]}.</h1>
            <p>
              {learner.tutorName || "Your tutor"} is waiting by the fountain. Walk the courtyard, meet the staff, and open a real book in the Grand Library.
            </p>
            <div className="adv-gate__controls">
              {mobile ? (
                <>
                  <div><kbd>Stick</kbd><span>Walk (left thumb)</span></div>
                  <div><kbd>Drag</kbd><span>Look around</span></div>
                  <div><kbd>Use</kbd><span>Interact / talk</span></div>
                  <div><kbd>Jump</kbd><span>Small hop</span></div>
                </>
              ) : (
                <>
                  <div><kbd>W A S D</kbd><span>Walk</span></div>
                  <div><kbd>Mouse</kbd><span>Look — click to capture, or drag</span></div>
                  <div><kbd>← →</kbd><span>Turn</span></div>
                  <div><kbd>Shift</kbd><span>Run</span></div>
                  <div><kbd>Space</kbd><span>Jump</span></div>
                  <div><kbd>E</kbd><span>Interact</span></div>
                  <div><kbd>J / I / M</kbd><span>Journal · Satchel · Map</span></div>
                </>
              )}
            </div>
            <div className="row adv-gate__actions" style={{ justifyContent: "center", flexWrap: "wrap" }}>
              <Button variant="primary" size="lg" onClick={enterAcademy}>Step inside</Button>
              <Button variant="ghost" icon="user" onClick={() => navigate("/characters")}>Change character</Button>
              <Button variant="ghost" onClick={() => navigate("/")}>Back to Asterwood</Button>
            </div>
            <p className="adv-gate__note">Playing as {appearance.name || learner.name}. Position, look, discoveries and time of day are saved to this learner profile.</p>
          </div>
        </div>
      ) : null}

      {overlay === "chat" ? (
        <AdventureChat
          learner={learner}
          area={area}
          tutorGender={meta?.tutors?.find((entry) => entry.id === learner.tutorCharacterId)?.gender}
          onClose={resume}
          onNotice={(message) => toast(message, "warn")}
        />
      ) : null}

      {overlay === "dialogue" && dialogue ? (
        <div className="adv-overlay adv-dialogue-wrap">
          <div className="adv-dialogue" role="dialog" aria-modal="true" aria-label={`Conversation with ${dialogue.name}`}>
            <div className="adv-dialogue__head">
              <div>
                <span className="adv-dialogue__name" style={{ color: dialogue.accent || "#f0cf8d" }}>{dialogue.name}</span>
                <span className="adv-dialogue__role">{dialogue.role}</span>
              </div>
              <button className="adv-icon-btn" type="button" aria-label="End conversation" onClick={resume}><Icon name="x" /></button>
            </div>
            <p className="adv-dialogue__line">{dialogueLine}</p>
            <div className="adv-dialogue__foot">
              <span className="muted">{Math.min(dialogueIndex + 1, dialogue.lines.length)} / {dialogue.lines.length}</span>
              <div className="row">
                {dialogueIndex < dialogue.lines.length - 1 ? (
                  <Button variant="primary" onClick={() => setDialogueIndex((index) => index + 1)}>Continue</Button>
                ) : (
                  <Button variant="primary" onClick={resume}>Back to the grounds</Button>
                )}
                <Button variant="ghost" onClick={resume}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {overlay === "book" && book ? (
        <div className="adv-overlay adv-book-wrap">
          <div className="adv-book" role="dialog" aria-modal="true" aria-label={`Book: ${book.title}`}>
            <div className="adv-book__cover" style={{ background: `linear-gradient(145deg, ${book.color || "#7c5cf0"}, #241d4f)` }}>
              <span className="adv-book__icon">{book.icon || "📖"}</span>
              <div>
                <h2>{book.title}</h2>
                <p>{book.subtitle || book.section || "A volume from the Great Library"}</p>
              </div>
            </div>
            <div className="adv-book__body">
              <p>{book.blurb || "This volume is waiting to be read."}</p>
              <div className="adv-book__meta">
                <span><strong>{book.topicCount ?? "—"}</strong> topics</span>
                <span><strong>{book.chapterCount ?? "—"}</strong> chapters</span>
                <span><strong>{Math.round(book.progress || 0)}%</strong> explored</span>
              </div>
              <p className="muted">
                The book lifts from the shelf and opens in your hands. Your mastery record travels with it, so anything you have already proven stays proven.
              </p>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <Button variant="primary" onClick={() => navigate(`/world/${book.id}`)}>Open this volume</Button>
                <Button variant="ghost" onClick={resume}>Back to the shelves</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {overlay === "pause" ? (
        <div className="adv-overlay adv-menu-wrap">
          <div className="adv-menu" role="dialog" aria-modal="true" aria-label="Pause menu">
            <div className="adv-menu__head">
              <div>
                <span className="eyebrow">Paused</span>
                <h2>{AREA_LABELS[area]}</h2>
                <p className="muted">{currentClock.time} · {currentClock.period}</p>
              </div>
              <Button variant="primary" onClick={resume}>Resume</Button>
            </div>
            <div className="adv-menu__grid">
              <button type="button" onClick={() => setOverlay("journal")}><Icon name="book" /><span>Journal</span><small>Discoveries and notes</small></button>
              <button type="button" onClick={() => setOverlay("satchel")}><Icon name="folder" /><span>Satchel</span><small>Your look and collection</small></button>
              <button type="button" onClick={() => setOverlay("map")}><Icon name="compass" /><span>Map</span><small>Move between known places</small></button>
              <button type="button" onClick={() => setOverlay("settings")}><Icon name="settings" /><span>Comfort</span><small>Sensitivity and motion</small></button>
              <button type="button" onClick={() => navigate("/characters")}><Icon name="user" /><span>Characters</span><small>Change your scholar or tutor</small></button>
              <button type="button" onClick={() => navigate("/")}><Icon name="back" /><span>Leave academy</span><small>Return to Asterwood</small></button>
            </div>
            <div className="adv-menu__companion">
              <span className="adv-menu__label">{learner.tutorName || "Tutor"} mode</span>
              <div className="adv-chips">
                <button type="button" className={`adv-chip ${companionMode === "follow" ? "is-active" : ""}`} onClick={() => changeCompanion("follow")}>Follow</button>
                <button type="button" className={`adv-chip ${companionMode === "wait" ? "is-active" : ""}`} onClick={() => changeCompanion("wait")}>Wait here</button>
                <button type="button" className={`adv-chip ${companionMode === "quiet" ? "is-active" : ""}`} onClick={() => changeCompanion("quiet")}>Quiet</button>
              </div>
            </div>
            <p className="adv-menu__save">{savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : "Your world is saved automatically."}</p>
          </div>
        </div>
      ) : null}

      {overlay === "settings" ? (
        <div className="adv-overlay adv-menu-wrap">
          <div className="adv-menu" role="dialog" aria-modal="true" aria-label="Comfort settings">
            <div className="adv-menu__head">
              <div>
                <span className="eyebrow">Comfort settings</span>
                <h2>Make the academy yours</h2>
              </div>
              <Button variant="ghost" onClick={closeOverlay}>Close</Button>
            </div>
            <label className="adv-range">
              <span>Look sensitivity <strong>{settings.sensitivity.toFixed(2)}×</strong></span>
              <input type="range" min={0.25} max={3} step={0.05} value={settings.sensitivity} onChange={(event) => updateSettings({ sensitivity: Number(event.target.value) })} />
            </label>
            <label className="adv-range">
              <span>Movement speed <strong>{settings.speed.toFixed(1)}×</strong></span>
              <input type="range" min={0.6} max={1.8} step={0.1} value={settings.speed} onChange={(event) => updateSettings({ speed: Number(event.target.value) })} />
            </label>
            <label className="adv-toggle"><input type="checkbox" checked={settings.invertY} onChange={(event) => updateSettings({ invertY: event.target.checked })} /><span>Invert camera (Y axis)</span></label>
            <label className="adv-toggle"><input type="checkbox" checked={settings.motionReduction} onChange={(event) => updateSettings({ motionReduction: event.target.checked })} /><span>Reduce head bob and camera motion</span></label>
            <label className="adv-toggle"><input type="checkbox" checked={settings.cameraShake} onChange={(event) => updateSettings({ cameraShake: event.target.checked })} /><span>Allow camera shake effects</span></label>
            <label className="adv-field">
              <span>Graphics quality</span>
              <div className="adv-chips">
                <button type="button" className={`adv-chip ${settings.quality === "high" ? "is-active" : ""}`} onClick={() => updateSettings({ quality: "high" })}>High</button>
                <button type="button" className={`adv-chip ${settings.quality === "low" ? "is-active" : ""}`} onClick={() => updateSettings({ quality: "low" })}>Low (mobile / older devices)</button>
              </div>
            </label>
            <div className="row">
              <Button variant="primary" onClick={persistSettings}>Save settings</Button>
              <Button variant="ghost" onClick={() => updateSettings(DEFAULT_SETTINGS)}>Reset to defaults</Button>
            </div>
          </div>
        </div>
      ) : null}

      {overlay === "journal" ? (
        <div className="adv-overlay adv-menu-wrap">
          <div className="adv-menu" role="dialog" aria-modal="true" aria-label="Adventure journal">
            <div className="adv-menu__head">
              <div><span className="eyebrow">Adventure journal</span><h2>{learner.name}'s discoveries</h2><p className="muted">{bookEntries.length} recorded · {AREA_LABELS[area]}</p></div>
              <Button variant="ghost" onClick={resume}>Close</Button>
            </div>
            {bookEntries.length ? (
              <ul className="adv-list">
                {bookEntries.slice().reverse().map((entry) => (
                  <li key={entry.id}><Icon name={entry.icon} size={18} /><span>{entry.label}</span><small>{entry.kind}</small></li>
                ))}
              </ul>
            ) : (
              <p className="muted">Your journal is empty. Talk to someone, enter a building, or open a book.</p>
            )}
            <div className="adv-note">
              <strong>{learner.tutorName || "Your tutor"} notes</strong>
              <p>{area === "library" ? "Every book on these shelves is tied to your real mastery record. Opening one does not grant mastery — the lesson and assessment do." : area === "classroom" ? "The lectern keeps every lesson your tutor has built for you. Lessons are recorded here, but mastery is still earned in assessments." : "The academy is alive even when you are not studying. Explore; the library will still be here."}</p>
            </div>
          </div>
        </div>
      ) : null}

      {overlay === "satchel" ? (
        <div className="adv-overlay adv-menu-wrap">
          <div className="adv-menu" role="dialog" aria-modal="true" aria-label="Satchel">
            <div className="adv-menu__head">
              <div><span className="eyebrow">Satchel</span><h2>What you carry</h2></div>
              <Button variant="ghost" onClick={resume}>Close</Button>
            </div>
            <div className="adv-satchel">
              <div className="adv-satchel__look">
                <AvatarPreview appearance={appearance} />
              </div>
              <div>
                <h3>{appearance.name || learner.name}</h3>
                <p className="muted">{OUTFITS.find((outfit) => outfit.id === appearance.outfit)?.label} · {HAIR_STYLES.find((style) => style.id === appearance.hairStyle)?.label} hair</p>
                <ul className="adv-stats">
                  <li><strong>{bookEntries.filter((entry) => entry.kind === "Book").length}</strong><span>books opened</span></li>
                  <li><strong>{bookEntries.filter((entry) => entry.kind === "Person").length}</strong><span>people met</span></li>
                  <li><strong>{bookEntries.filter((entry) => entry.kind === "Place").length}</strong><span>places explored</span></li>
                </ul>
                <Button variant="secondary" onClick={() => navigate("/characters")}>Change your character</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {overlay === "map" ? (
        <div className="adv-overlay adv-menu-wrap">
          <div className="adv-menu adv-menu--wide" role="dialog" aria-modal="true" aria-label="Academy map">
            <div className="adv-menu__head">
              <div><span className="eyebrow">Academy map</span><h2>Known places</h2><p className="muted">{currentClock.time} · {currentClock.period}</p></div>
              <Button variant="ghost" onClick={resume}>Close</Button>
            </div>
            <div className="adv-map">
              <svg viewBox="0 0 320 240" role="img" aria-label="Schematic map of the academy grounds">
                <rect x="8" y="8" width="304" height="224" rx="16" fill="rgba(30,25,58,.55)" />
                <rect x="130" y="20" width="60" height="34" rx="6" fill="#7c5cf0" opacity=".65" />
                <text x="160" y="41" textAnchor="middle" fill="#fff" fontSize="10">Library</text>
                <circle cx="160" cy="120" r="26" fill="#2f8f83" opacity=".5" />
                <text x="160" y="123" textAnchor="middle" fill="#fff" fontSize="10">Courtyard</text>
                <rect x="232" y="96" width="52" height="34" rx="6" fill="#b34b6b" opacity=".6" />
                <text x="258" y="117" textAnchor="middle" fill="#fff" fontSize="9">Quarters</text>
                <rect x="24" y="88" width="58" height="34" rx="6" fill="#8a5a2f" opacity=".6" />
                <text x="53" y="109" textAnchor="middle" fill="#fff" fontSize="8.5">Numbers</text>
                <rect x="40" y="150" width="64" height="34" rx="6" fill="#347a5c" opacity=".55" />
                <text x="72" y="171" textAnchor="middle" fill="#fff" fontSize="9">Greenhouse</text>
                <rect x="214" y="30" width="58" height="34" rx="6" fill="#5a3f8f" opacity=".55" />
                <text x="243" y="51" textAnchor="middle" fill="#fff" fontSize="9">Observatory</text>
                <circle cx={area === "library" ? 160 : area === "study" ? 258 : area === "classroom" ? 53 : 160} cy={area === "library" ? 37 : area === "study" ? 113 : area === "classroom" ? 105 : 120} r="5" fill="#ffd79a" stroke="#fff" strokeWidth="1.5" />
              </svg>
              <div className="adv-map__list">
                {(["courtyard", "library", "study", "classroom"] as AreaId[]).map((place) => (
                  <button key={place} type="button" className={`adv-chip ${area === place ? "is-active" : ""}`} onClick={() => travel(place)}>
                    {AREA_LABELS[place]}
                  </button>
                ))}
                <p className="muted">Fast travel uses the paths you have already walked. The Great Hall, Observatory interior and wider grounds are marked as sealed until their wing is built.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {overlay === "lesson" && lessonView === "list" ? (
        <div className="adv-overlay adv-menu-wrap">
          <div className="adv-menu adv-menu--wide" role="dialog" aria-modal="true" aria-label="Chamber of Numbers lesson lectern">
            <div className="adv-menu__head">
              <div>
                <span className="eyebrow">Chamber of Numbers</span>
                <h2>Lessons at the lectern</h2>
                <p className="muted">Your tutor writes and records every lesson. Mastery is still earned in your assessments, never by opening a lesson.</p>
              </div>
              <Button variant="ghost" onClick={resume}>Leave</Button>
            </div>

            {lecternLessons === null ? (
              <p className="muted">Opening the lesson ledger…</p>
            ) : lecternLessons.length ? (
              <ul className="adv-lesson-list">
                {lecternLessons.slice(0, 8).map((entry) => (
                  <li key={entry.id}>
                    <button type="button" className="adv-lesson-row" onClick={() => openLesson(entry)}>
                      <span className="adv-lesson-row__title">{entry.title}</span>
                      <span className="adv-lesson-row__meta">{entry.subjectName} · {entry.duration} min · {entry.status === "completed" ? "Completed" : `${entry.progress}% explored`}</span>
                      <Icon name={entry.status === "completed" ? "check" : "arrow"} size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No lesson is open on this lectern yet. Begin one below.</p>
            )}

            <div className="adv-lesson-new">
              <span className="adv-menu__label">Begin a new lesson</span>
              {recommended.length ? (
                <div className="adv-chips">
                  {recommended.map((rec) => (
                    <button key={`${rec.subject}-${rec.topic}`} type="button" className="adv-chip" disabled={lessonBusy} onClick={() => void beginLesson(rec.subject, rec.topic)}>
                      {rec.subjectName}: {rec.topic}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="adv-lesson-new__row">
                <select className="adv-select" value={newSubject} onChange={(event) => setNewSubject(event.target.value)} aria-label="Lesson subject">
                  {(meta?.subjects || []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
                <Button variant="primary" icon="sparkles" loading={lessonBusy} onClick={() => void beginLesson(newSubject)}>Build a lesson</Button>
              </div>
              <p className="adv-lesson-new__note">Built for your level, saved to My Lessons, and marked by the same registrar as the rest of Asterwood.</p>
            </div>
          </div>
        </div>
      ) : null}

      {overlay === "lesson" && lessonView === "read" && activeLesson ? (
        <div className="adv-overlay adv-lesson-wrap">
          <div className="adv-lesson-read" role="dialog" aria-modal="true" aria-label={activeLesson.title}>
            <div className="adv-lesson-read__head">
              <div>
                <span className="eyebrow">{activeLesson.subjectName} · {activeLesson.duration} min · {meta?.levels[activeLesson.level] || activeLesson.level}</span>
                <h2>{activeLesson.title}</h2>
                <p className="muted">{activeLesson.sections.length} sections · {Math.round((lessonDone.length / Math.max(1, activeLesson.sections.length)) * 100)}% explored{lessonSaving ? " · saving…" : ""}</p>
              </div>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={() => { setLessonView("list"); void loadLectern(); }}>Lectern</Button>
                <Button variant="ghost" onClick={resume}>Leave</Button>
              </div>
            </div>
            <div className="adv-lesson-read__body">
              {activeLesson.objectives.length ? (
                <div className="adv-lesson-objectives">
                  <strong>By the end of this lesson</strong>
                  <ul>{activeLesson.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
                </div>
              ) : null}
              {activeLesson.sections.map((section, index) => {
                const done = lessonDone.includes(index);
                return (
                  <section key={`${section.type}-${index}`} className={`adv-lesson-section ${done ? "is-done" : ""}`}>
                    <div className="adv-lesson-section__head">
                      <span className="adv-lesson-section__type">{SECTION_LABELS[section.type] || section.type}</span>
                      <button type="button" className={`adv-chip ${done ? "is-active" : ""}`} aria-pressed={done} onClick={() => void toggleLessonSection(index)}>
                        <Icon name="check" size={13} /> {done ? "Done" : "Got it"}
                      </button>
                    </div>
                    <h3>{section.heading}</h3>
                    {section.body ? <RichText text={section.body} /> : null}
                    {section.steps?.length ? <ol>{section.steps.map((step, i) => <li key={i}>{step}</li>)}</ol> : null}
                    {section.bullets?.length ? <ul>{section.bullets.map((bullet, i) => <li key={i}>{bullet}</li>)}</ul> : null}
                    {section.items?.length ? section.items.map((item, i) => <p key={i} className="adv-lesson-item">{i + 1}. {item}</p>) : null}
                    {section.hint ? <p className="adv-lesson-hint"><strong>Hint</strong> {section.hint}</p> : null}
                  </section>
                );
              })}
            </div>
            <div className="adv-lesson-read__foot">
              {activeLesson.status === "completed" ? (
                <span className="muted">Completed. Mastery still comes from your assessments.</span>
              ) : (
                <Button variant="primary" icon="check" loading={lessonSaving} onClick={() => void completeActiveLesson()}>Complete lesson</Button>
              )}
              <Button variant="ghost" icon="book" onClick={() => navigate(`/lessons/${activeLesson.id}`)}>Open the full lesson page</Button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
