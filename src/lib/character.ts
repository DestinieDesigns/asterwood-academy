import { useEffect, useState } from "react";
import { api } from "./api";

export type Appearance = {
  skin: string;
  hairColor: string;
  eyeColor: string;
  hairStyle: string;
  hairLength: string;
  outfit: string;
  effect: string;
  accessory: string;
  glasses: string;
  freckles: boolean;
  markings: boolean;
  fantasy: string;
};

export type Character = {
  id: string;
  name: string;
  pronunciation: string;
  gender: "male" | "female";
  title: string;
  tagline: string;
  intro: string;
  traits: string[];
  teachingStyle: string;
  affinity: string[];
  defaultPreset: string;
  defaultStrictness: string;
  voice: { style: string; pitch: number; rate: number; accent: string; descriptor: string };
  palette: { skin: string; hair: string; hairShade: string; eyes: string; robe: string; robeTrim: string; aura: string; accent: string };
  style: {
    hairStyle: string;
    hairLength: string;
    outfit: string;
    effect: string;
    accessory: string;
    glasses: string;
    freckles: boolean;
    markings: boolean;
    fantasy: string;
  };
};

export type Preset = {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  summary: string;
  voiceStyle: string;
  defaultStrictness: string;
  prompt: string;
};

export type Strictness = { id: string; name: string; blurb: string; prompt: string };

export type EnvironmentDef = {
  id: string;
  name: string;
  blurb: string;
  subjects: string[];
  colors: { sky: string; mid: string; glow: string; accent: string; floor: string };
};

export type AppearanceOptions = {
  skins: { id: string; label: string; hex: string }[];
  hairColors: { id: string; label: string; hex: string; shade: string }[];
  eyeColors: { id: string; label: string; hex: string }[];
  hairStyles: { id: string; label: string; layer: string }[];
  hairLengths: { id: string; label: string }[];
  outfits: { id: string; label: string }[];
  effects: { id: string; label: string }[];
  accessories: { id: string; label: string }[];
  glasses: { id: string; label: string }[];
  fantasy: { id: string; label: string }[];
};

export type TutorBundle = {
  tutors: Character[];
  presets: Preset[];
  strictnessLevels: Strictness[];
  environments: EnvironmentDef[];
  appearanceOptions: AppearanceOptions;
};

let cache: TutorBundle | null = null;
let pending: Promise<TutorBundle> | null = null;
const listeners = new Set<(b: TutorBundle) => void>();

export function loadTutorBundle(): Promise<TutorBundle> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = api<TutorBundle>("/tutors")
      .then((data) => {
        cache = data;
        listeners.forEach((fn) => fn(data));
        return data;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

export function useTutorBundle(): { bundle: TutorBundle | null; error: string | null } {
  const [bundle, setBundle] = useState<TutorBundle | null>(cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (cache) setBundle(cache);
    loadTutorBundle()
      .then((data) => { if (alive) setBundle(data); })
      .catch((err) => { if (alive) setError(err?.message || "Could not load the Academy"); });
    const listener = (data: TutorBundle) => { if (alive) setBundle(data); };
    listeners.add(listener);
    return () => { alive = false; listeners.delete(listener); };
  }, []);

  return { bundle, error };
}

export function getCachedBundle(): TutorBundle | null {
  return cache;
}

export const FALLBACK_PALETTE = {
  skin: "#f2d3bf",
  hair: "#e9edf7",
  hairShade: "#c3cde3",
  eyes: "#8fd3ff",
  robe: "#1c2b55",
  robeTrim: "#c9d4ea",
  aura: "#7db8ff",
  accent: "#e7eeff",
};

export function fallbackCharacter(id = "auren"): Character {
  const names: Record<string, string> = {
    auren: "Auren", kaelion: "Kaelion", zephiran: "Zephiran", elvaris: "Elvaris", orionis: "Orionis",
    aeloria: "Aeloria", solenne: "Solenne", nymeria: "Nymeria", elaris: "Elaris", vespera: "Vespera",
  };
  return {
    id,
    name: names[id] || "Auren",
    pronunciation: "",
    gender: "male",
    title: "Celestial tutor",
    tagline: "Your tutor at the Celestial Academy.",
    intro: "I'm here to help you learn.",
    traits: ["Patient", "Thoughtful"],
    teachingStyle: "A thoughtful academic mentor.",
    affinity: [],
    defaultPreset: "supportive",
    defaultStrictness: "balanced",
    voice: { style: "calm", pitch: 1, rate: 1, accent: "neutral", descriptor: "calm" },
    palette: FALLBACK_PALETTE,
    style: {
      hairStyle: "short_flow",
      hairLength: "short",
      outfit: "celestial_robes",
      effect: "stars",
      accessory: "none",
      glasses: "none",
      freckles: false,
      markings: false,
      fantasy: "none",
    },
  };
}

export function defaultAppearanceFor(character: Character): Appearance {
  return {
    skin: character.palette.skin,
    hairColor: character.palette.hair,
    eyeColor: character.palette.eyes,
    hairStyle: character.style.hairStyle,
    hairLength: character.style.hairLength,
    outfit: character.style.outfit,
    effect: character.style.effect,
    accessory: character.style.accessory,
    glasses: character.style.glasses,
    freckles: Boolean(character.style.freckles),
    markings: Boolean(character.style.markings),
    fantasy: character.style.fantasy,
  };
}

export function resolveAppearance(character: Character, appearance?: Partial<Appearance> | null): Appearance {
  const base = defaultAppearanceFor(character);
  if (!appearance) return base;
  const out = { ...base };
  (Object.keys(base) as (keyof Appearance)[]).forEach((key) => {
    const value = appearance[key];
    if (value !== undefined && value !== null && value !== "") {
      (out as any)[key] = value;
    }
  });
  return out;
}

export function findCharacter(bundle: TutorBundle | null, id: string | undefined): Character {
  return bundle?.tutors.find((t) => t.id === id) || bundle?.tutors[0] || fallbackCharacter(id);
}

export function presetOf(bundle: TutorBundle | null, id: string | undefined): Preset | null {
  return bundle?.presets.find((p) => p.id === id) || bundle?.presets[0] || null;
}

export function strictnessOf(bundle: TutorBundle | null, id: string | undefined): Strictness | null {
  return bundle?.strictnessLevels.find((s) => s.id === id) || bundle?.strictnessLevels[1] || null;
}

export function environmentOf(bundle: TutorBundle | null, id: string | undefined): EnvironmentDef | null {
  return bundle?.environments.find((e) => e.id === id) || bundle?.environments[0] || null;
}
