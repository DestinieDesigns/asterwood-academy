import React from "react";
import { Badge, Button, Icon } from "../ui";
import { TutorAvatar, type AvatarState } from "./Avatar";
import {
  defaultAppearanceFor,
  type Appearance,
  type AppearanceOptions,
  type Character,
  type EnvironmentDef,
  type Preset,
  type Strictness,
} from "../../lib/character";
import { useSpeech } from "../../lib/voice";

export function CharacterCard({
  character,
  selected,
  onSelect,
  subjectNames,
}: {
  character: Character;
  selected?: boolean;
  onSelect: () => void;
  subjectNames?: Record<string, string>;
}) {
  return (
    <button className={`tutor-card ${selected ? "tutor-card--on" : ""}`} onClick={onSelect} type="button">
      <div className="tutor-card__art" style={{ background: `radial-gradient(120% 100% at 50% 10%, ${character.palette.aura}44, transparent 65%)` }}>
        <TutorAvatar character={character} size={168} effects state="idle" />
        {selected ? <span className="tutor-card__tick"><Icon name="check" size={14} /></span> : null}
      </div>
      <div className="tutor-card__body">
        <div className="spread" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="tutor-card__name">{character.name}</div>
            <div className="tiny muted">{character.pronunciation}</div>
          </div>
          <Badge tone="muted">{character.gender === "male" ? "He/Him" : "She/Her"}</Badge>
        </div>
        <div className="tutor-card__title">{character.title}</div>
        <div className="tutor-card__traits">
          {character.traits.slice(0, 3).map((t) => <span key={t}>{t}</span>)}
        </div>
        <div className="tiny muted" style={{ marginTop: 2 }}>
          {character.affinity.map((a) => subjectNames?.[a] || a).join(" · ")}
        </div>
      </div>
    </button>
  );
}

export function SwatchRow({
  options,
  value,
  onChange,
  label,
  hexKey = "hex",
  extra,
}: {
  options: { id: string; label: string; [key: string]: any }[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  hexKey?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="swatch-row">
        {options.map((option) => {
          const isActive = option[hexKey] ? value === option[hexKey] || value === option.id : value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`swatch ${isActive ? "swatch--on" : ""}`}
              onClick={() => onChange(option[hexKey] || option.id)}
              title={option.label}
              aria-label={`${label}: ${option.label}`}
              aria-pressed={isActive}
              style={option[hexKey] && String(option[hexKey]).startsWith("#") ? { background: option[hexKey] } : undefined}
            >
              {option[hexKey] && String(option[hexKey]).startsWith("#") ? null : option.label.slice(0, 2)}
            </button>
          );
        })}
        {extra}
      </div>
    </div>
  );
}

export function SelectRow({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="switch">
      <div className="switch__text">
        <strong>{label}</strong>
        {hint ? <span>{hint}</span> : null}
      </div>
      <label className="switch__control">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch__track" />
      </label>
    </div>
  );
}

export function AppearanceControls({
  options,
  appearance,
  onChange,
}: {
  options: AppearanceOptions;
  appearance: Appearance;
  onChange: (patch: Partial<Appearance>) => void;
}) {
  return (
    <div className="stack stack--sm">
      <SwatchRow label="Skin tone" options={options.skins} value={appearance.skin} onChange={(v) => onChange({ skin: v })} />
      <SwatchRow label="Hair colour" options={options.hairColors} value={appearance.hairColor} onChange={(v) => onChange({ hairColor: v })} />
      <SwatchRow label="Eye colour" options={options.eyeColors} value={appearance.eyeColor} onChange={(v) => onChange({ eyeColor: v })} />
      <div className="onboard__grid">
        <SelectRow label="Hairstyle" value={appearance.hairStyle} options={options.hairStyles} onChange={(v) => onChange({ hairStyle: v })} />
        <SelectRow label="Hair length" value={appearance.hairLength} options={options.hairLengths} onChange={(v) => onChange({ hairLength: v })} />
        <SelectRow label="Outfit" value={appearance.outfit} options={options.outfits} onChange={(v) => onChange({ outfit: v })} />
        <SelectRow label="Magical effect" value={appearance.effect} options={options.effects} onChange={(v) => onChange({ effect: v })} />
        <SelectRow label="Accessory" value={appearance.accessory} options={options.accessories} onChange={(v) => onChange({ accessory: v })} />
        <SelectRow label="Glasses" value={appearance.glasses} options={options.glasses} onChange={(v) => onChange({ glasses: v })} />
        <SelectRow label="Fantasy feature" value={appearance.fantasy} options={options.fantasy} onChange={(v) => onChange({ fantasy: v })} />
      </div>
      <div>
        <ToggleRow label="Freckles" checked={appearance.freckles} onChange={(v) => onChange({ freckles: v })} />
        <ToggleRow label="Celestial markings" checked={appearance.markings} onChange={(v) => onChange({ markings: v })} />
      </div>
    </div>
  );
}

export function PresetPicker({
  presets,
  value,
  onChange,
}: {
  presets: Preset[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="onboard__grid">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={`choice ${value === preset.id ? "choice--on" : ""}`}
          style={{ alignItems: "flex-start", textAlign: "left", padding: 11 }}
          onClick={() => onChange(preset.id)}
        >
          <span style={{ fontSize: 17 }}>{preset.emoji}</span>
          <span>
            <strong style={{ display: "block", fontSize: 12.5 }}>{preset.name}</strong>
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)" }}>{preset.blurb}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function StrictnessPicker({
  levels,
  value,
  onChange,
}: {
  levels: Strictness[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="stack stack--sm">
      <div className="strictness">
        {levels.map((level, index) => (
          <button
            key={level.id}
            type="button"
            className={`strictness__step ${value === level.id ? "strictness__step--on" : ""}`}
            onClick={() => onChange(level.id)}
            title={level.blurb}
          >
            <span className="strictness__dot" data-step={index + 1} />
            <span className="strictness__label">{level.name}</span>
          </button>
        ))}
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>{levels.find((l) => l.id === value)?.blurb}</p>
    </div>
  );
}

export function EnvironmentPicker({
  environments,
  value,
  onChange,
  auto,
}: {
  environments: EnvironmentDef[];
  value: string;
  onChange: (id: string) => void;
  auto?: boolean;
}) {
  return (
    <div className="env-grid">
      <button
        type="button"
        className={`env-card env-card--auto ${value === "auto" ? "env-card--on" : ""}`}
        onClick={() => onChange("auto")}
      >
        <span className="env-card__art" style={{ background: "linear-gradient(140deg,#241d47,#143a3c 60%,#342a1a)" }}>
          <Icon name="sparkles" size={18} />
        </span>
        <strong>Automatic</strong>
        <span className="tiny muted">{auto ? "Follows the lesson subject" : "Grand hall"}</span>
      </button>
      {environments.map((env) => (
        <button
          key={env.id}
          type="button"
          className={`env-card ${value === env.id ? "env-card--on" : ""}`}
          onClick={() => onChange(env.id)}
          title={env.blurb}
        >
          <span
            className="env-card__art"
            style={{ background: `radial-gradient(120% 100% at 50% 0%, ${env.colors.mid}, ${env.colors.sky} 70%)` }}
          >
            <span style={{ background: env.colors.glow }} className="env-card__dot" />
            <span style={{ background: env.colors.accent }} className="env-card__dot" />
            <span style={{ background: env.colors.mid }} className="env-card__floor" />
          </span>
          <strong>{env.name}</strong>
          <span className="tiny muted">{env.blurb}</span>
        </button>
      ))}
    </div>
  );
}

export function VoiceSampleButton({
  character,
  voiceStyle,
  rate = 1,
  pitch = 1,
  label = "Hear their voice",
  line,
  accent = "auto",
}: {
  character: Character;
  voiceStyle: string;
  rate?: number;
  pitch?: number;
  label?: string;
  line?: string;
  accent?: string;
}) {
  const speech = useSpeech({ style: voiceStyle, defaultRate: rate, accent, gender: character.gender });
  const text = line || `${character.intro} I'm ${character.name}, and I'll be your tutor here.`;
  return (
    <div className="row">
      <Button
        size="sm"
        variant="secondary"
        icon={speech.speaking ? "x" : "speaker"}
        onClick={() => (speech.speaking ? speech.stop() : speech.speak(text))}
      >
        {speech.speaking ? "Stop" : label}
      </Button>
      {!speech.supported ? <span className="tiny muted">Speech isn't available in this browser — text tutoring still works.</span> : null}
      {speech.speaking && speech.caption ? <span className="tiny muted" style={{ flex: 1, minWidth: 160 }}>“{speech.caption.slice(0, 90)}…”</span> : null}
    </div>
  );
}

export function AnimationPreview({
  character,
  appearance,
  state,
}: {
  character: Character;
  appearance: Appearance;
  state: AvatarState;
}) {
  return (
    <div className="anim-preview">
      <TutorAvatar character={character} appearance={appearance} size={300} state={state} speaking={state === "talking"} effects />
      <div className="anim-preview__label">{state}</div>
    </div>
  );
}

export function resetAppearance(character: Character): Appearance {
  return defaultAppearanceFor(character);
}
