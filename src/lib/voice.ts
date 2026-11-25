import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Speech activity bus                                                */
/* ------------------------------------------------------------------ */

export type SpeechEvent =
  | { type: "start" }
  | { type: "chunk"; text: string }
  | { type: "boundary"; charIndex: number; length: number }
  | { type: "end" };

const speechListeners = new Set<(event: SpeechEvent) => void>();

/** Subscribe to real speech activity so characters animate only when audio is actually playing. */
export function onSpeechEvent(fn: (event: SpeechEvent) => void): () => void {
  speechListeners.add(fn);
  return () => speechListeners.delete(fn);
}

function emitSpeech(event: SpeechEvent) {
  speechListeners.forEach((fn) => {
    try { fn(event); } catch {}
  });
}

/* ------------------------------------------------------------------ */
/*  Text to speech                                                     */
/* ------------------------------------------------------------------ */

export function stripMarkup(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text: string, max = 210): string[] {
  const clean = stripMarkup(text);
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]*/g) || [clean];
  const chunks: string[] = [];
  let current = "";
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if ((current + " " + sentence).trim().length > max && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Voice heuristics so the style picker produces a genuinely different delivery. */
const STYLE_KEYWORDS: Record<string, RegExp> = {
  friendly: /(samantha|jenny|aria|zira|\bfemale\b|natural|google uk english female)/i,
  calm: /(serena|karen|olivia|susan|\bfemale\b|google uk english female)/i,
  energetic: /(aria|jenny|michelle|zira|\bfemale\b)/i,
  gentle: /(serena|samantha|karen|\bfemale\b)/i,
  professional: /(daniel|david|guy|\bmale\b|google uk english male)/i,
  playful: /(ava|allison|susan|\bfemale\b|google us english)/i,
};

/**
 * Voice names that identify a gender. Used so a tutor keeps their own voice
 * instead of inheriting a male voice from a speaking-style keyword.
 */
const FEMALE_VOICE_NAMES = /(zira|aria|jenny|samantha|ava|allison|susan|serena|karen|olivia|michelle|hazel|sonia|libby|natasha|clara|emily|amber|ashley|cora|elizabeth|sara|sarah|nancy|monica|paulina|sabina|tessa|veena|fiona|moira|linda|heather|catherine|kate|alice|joanna|kendra|salli|kimberly|ivy|ruth|danielle|\bfemale\b)/i;
const MALE_VOICE_NAMES = /(david|mark|guy|daniel|alex|fred|george|james|ryan|thomas|oliver|arthur|liam|connor|eric|christopher|roger|steffan|tony|matthew|brian|russell|joey|justin|kevin|\bmale\b)/i;

const ACCENT_HINTS: Record<string, RegExp> = {
  American: /(en-us|united states|us english|us_)/i,
  British: /(en-gb|uk english|british|gb_)/i,
  Irish: /(en-ie|ireland|irish)/i,
  Australian: /(en-au|australia|australian)/i,
  Canadian: /(en-ca|canada|canadian)/i,
  Indian: /(en-in|india|indian)/i,
  "South African": /(en-za|south africa)/i,
  Transatlantic: /(en-gb|en-us|uk english|us english)/i,
};

export function rankVoices(voices: SpeechSynthesisVoice[], style: string, lang = "en", accent = "auto", gender = ""): SpeechSynthesisVoice[] {
  const matcher = STYLE_KEYWORDS[style] || STYLE_KEYWORDS.friendly;
  const accentMatcher = ACCENT_HINTS[accent];
  const wanted = gender === "female" || gender === "male" ? gender : "";
  return [...voices].sort((a, b) => {
    const score = (v: SpeechSynthesisVoice) => {
      const female = FEMALE_VOICE_NAMES.test(v.name);
      const male = MALE_VOICE_NAMES.test(v.name);
      const genderScore = !wanted ? 0 : wanted === "female" ? (female ? 6 : male ? -8 : 0) : (male ? 6 : female ? -8 : 0);
      return (
        (v.lang?.toLowerCase().startsWith(lang) ? 4 : 0) +
        genderScore +
        (matcher.test(v.name) ? 3 : 0) +
        (accentMatcher && (accentMatcher.test(v.lang || "") || accentMatcher.test(v.name)) ? 2.5 : 0) +
        (v.localService ? 1 : 0) +
        (/natural|premium|enhanced/i.test(v.name) ? 1 : 0)
      );
    };
    return score(b) - score(a);
  });
}

export type SpeechState = {
  supported: boolean;
  speaking: boolean;
  paused: boolean;
  caption: string;
  captionLength: number;
  voices: SpeechSynthesisVoice[];
  voiceURI: string | null;
  rate: number;
  volume: number;
  setRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  setVoiceURI: (uri: string) => void;
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
};

export function useSpeech(options: { style?: string; defaultRate?: number; enabled?: boolean; volume?: number; accent?: string; gender?: string } = {}): SpeechState {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [caption, setCaption] = useState("");
  const [voiceURI, setVoiceURI] = useState<string | null>(() => {
    try { return localStorage.getItem(`plumi:voice:${options.style || "default"}`); } catch { return null; }
  });
  const [rate, setRateState] = useState<number>(options.defaultRate || 1);
  const [volume, setVolumeState] = useState<number>(() => {
    const initial = options.volume ?? 1;
    try {
      const stored = localStorage.getItem("plumi:volume");
      return stored ? Math.max(0, Math.min(1, Number(stored))) : initial;
    } catch { return initial; }
  });
  const cancelled = useRef(false);

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length) setVoices(list);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  useEffect(() => {
    if (options.defaultRate) setRateState(options.defaultRate);
  }, [options.defaultRate]);

  const stop = useCallback(() => {
    if (!supported) return;
    cancelled.current = true;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
    setCaption("");
    emitSpeech({ type: "end" });
  }, [supported]);

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      if (options.enabled === false) return;
      window.speechSynthesis.cancel();
      cancelled.current = false;
      const chunks = chunkText(text);
      if (!chunks.length) return;
      const wanted = options.gender === "female" || options.gender === "male" ? options.gender : "";
      const saved = voices.find((v) => v.voiceURI === voiceURI) || null;
      // A saved pick is kept unless it clearly belongs to the other gender;
      // an auto-ranked voice always respects the tutor's own gender.
      const wrongGender = saved
        ? wanted === "female"
          ? MALE_VOICE_NAMES.test(saved.name) && !FEMALE_VOICE_NAMES.test(saved.name)
          : wanted === "male"
            ? FEMALE_VOICE_NAMES.test(saved.name) && !MALE_VOICE_NAMES.test(saved.name)
            : false
        : false;
      const chosen =
        (saved && !wrongGender ? saved : null) ||
        rankVoices(voices, options.style || "friendly", "en", options.accent || "auto", wanted)[0] ||
        saved ||
        null;

      setSpeaking(true);
      setPaused(false);
      emitSpeech({ type: "start" });
      let index = 0;
      const next = () => {
        if (cancelled.current) return;
        if (index >= chunks.length) {
          setSpeaking(false);
          setCaption("");
          emitSpeech({ type: "end" });
          return;
        }
        const chunk = chunks[index++];
        setCaption(chunk);
        emitSpeech({ type: "chunk", text: chunk });
        const utterance = new SpeechSynthesisUtterance(chunk);
        if (chosen) {
          utterance.voice = chosen;
          utterance.lang = chosen.lang;
        }
        utterance.rate = rate;
        utterance.volume = volume;
        utterance.pitch = options.style === "playful" ? 1.15 : options.style === "professional" ? 0.95 : 1;
        utterance.onboundary = (event) => emitSpeech({ type: "boundary", charIndex: event.charIndex || 0, length: chunk.length });
        utterance.onend = next;
        utterance.onerror = () => {
          setSpeaking(false);
          emitSpeech({ type: "end" });
        };
        window.speechSynthesis.speak(utterance);
      };
      next();
    },
    [supported, options.enabled, options.style, options.accent, options.gender, voices, voiceURI, rate, volume],
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, [supported]);

  const setRate = useCallback((value: number) => {
    setRateState(value);
    try { localStorage.setItem("plumi:rate", String(value)); } catch {}
  }, []);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolumeState(clamped);
    try { localStorage.setItem("plumi:volume", String(clamped)); } catch {}
  }, []);

  const chooseVoice = useCallback((uri: string) => {
    setVoiceURI(uri);
    try { localStorage.setItem(`plumi:voice:${options.style || "default"}`, uri); } catch {}
  }, [options.style]);

  return { supported, speaking, paused, caption, captionLength: caption.length, voices, voiceURI, rate, volume, setRate, setVolume, setVoiceURI: chooseVoice, speak, pause, resume, stop };
}

/* ------------------------------------------------------------------ */
/*  Speech to text                                                     */
/* ------------------------------------------------------------------ */

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

export function getRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useDictation(options: { lang?: string; onFinal?: (text: string) => void } = {}) {
  const supported = Boolean(getRecognitionCtor());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const onFinalRef = useRef(options.onFinal);
  onFinalRef.current = options.onFinal;

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Voice input isn't supported in this browser. Chrome, Edge and Safari work best — you can always type instead.");
      return;
    }
    setError(null);
    try {
      const recognition = new Ctor();
      recognition.lang = options.lang || "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        let finalText = "";
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript;
          else interimText += result[0].transcript;
        }
        if (interimText) setInterim(interimText);
        if (finalText.trim()) {
          setInterim("");
          onFinalRef.current?.(finalText.trim());
        }
      };
      recognition.onerror = (event: any) => {
        const code = event?.error || "unknown";
        setError(
          code === "not-allowed"
            ? "Microphone permission was blocked. Allow the microphone in your browser settings and try again."
            : code === "no-speech"
              ? "I didn't hear anything — try again a little closer to the microphone."
              : `Voice input stopped (${code}). You can type your question instead.`,
        );
        setListening(false);
      };
      recognition.onend = () => {
        setListening(false);
        setInterim("");
      };
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch (err: any) {
      setError(err?.message || "Could not start voice input.");
      setListening(false);
    }
  }, [options.lang]);

  useEffect(() => () => {
    try { recognitionRef.current?.abort(); } catch {}
  }, []);

  return { supported, listening, interim, error, start, stop, clearError: () => setError(null) };
}
