import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../studio.css";
import { Button, Icon, Spinner } from "../components/ui";
import { AvatarPreview } from "../game/AvatarPreview";
import { TutorAvatar } from "../components/character/Avatar";
import { AppearanceControls, PresetPicker, StrictnessPicker } from "../components/character/TutorPieces";
import {
  defaultAppearanceFor,
  findCharacter,
  presetOf,
  resolveAppearance,
  strictnessOf,
  useTutorBundle,
  type Appearance,
} from "../lib/character";
import {
  ACCESSORIES,
  DEFAULT_APPEARANCE,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFIT_COLORS,
  OUTFITS,
  SKIN_TONES,
} from "../game/avatar";
import {
  activateAdventureCharacter,
  api,
  createAdventureCharacter,
  deleteAdventureCharacter,
  getAdventure,
  updateAdventureCharacter,
  type AdventureAppearance,
  type AdventureCharacter,
  type Learner,
} from "../lib/api";
import { useApp } from "../lib/store";

const MAX_CHARACTERS = 4;

type Mode = "select" | "edit" | "create";
type Tab = "look" | "tutor";

function Swatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (color: string) => void; label: string }) {
  return (
    <div className="studio-swatches" role="group" aria-label={label}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={`studio-swatch ${value.toLowerCase() === color.toLowerCase() ? "is-active" : ""}`}
          style={{ background: color }}
          aria-label={`${label}: ${color}`}
          aria-pressed={value.toLowerCase() === color.toLowerCase()}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

/** A lightweight CSS portrait for roster cards — no extra WebGL contexts. */
function Portrait({ appearance, size = "md" }: { appearance: AdventureAppearance; size?: "sm" | "md" }) {
  return (
    <span className={`studio-portrait studio-portrait--${size}`} aria-hidden="true">
      <span className="studio-portrait__body" style={{ background: appearance.outfitColor }} />
      <span className="studio-portrait__neck" style={{ background: appearance.skin }} />
      <span className="studio-portrait__head" style={{ background: appearance.skin }} />
      <span
        className={`studio-portrait__hair studio-portrait__hair--${appearance.hairStyle}`}
        style={{ background: appearance.hairColor }}
      />
    </span>
  );
}

export function Characters() {
  const { learner, refreshAuth, toast } = useApp();
  const { bundle } = useTutorBundle();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [characters, setCharacters] = useState<AdventureCharacter[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("select");
  const [tab, setTab] = useState<Tab>(params.get("tab") === "tutor" ? "tutor" : "look");
  const [draft, setDraft] = useState<AdventureAppearance>(DEFAULT_APPEARANCE);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [tutorCharacterId, setTutorCharacterId] = useState(learner?.tutorCharacterId || "auren");
  const [tutorName, setTutorName] = useState(learner?.tutorName || "");
  const [presetId, setPresetId] = useState(learner?.tutorPreset || "supportive");
  const [strictnessId, setStrictnessId] = useState(learner?.strictness || "balanced");
  const [tutorDraft, setTutorDraft] = useState<Appearance | null>(null);
  const [tutorSaving, setTutorSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getAdventure()
      .then(({ profile }) => {
        if (!alive) return;
        setCharacters(profile.characters || []);
        setActiveId(profile.activeCharacterId || null);
        const current = profile.characters.find((c) => c.id === profile.activeCharacterId) || profile.characters[0];
        if (current) {
          setSelectedId(current.id);
          setDraft({ ...current.appearance, name: current.appearance.name || current.name });
          setMode(profile.characters.length ? "select" : "create");
        } else {
          setDraft({ ...DEFAULT_APPEARANCE, name: learner?.name?.split(" ")[0] || "" });
          setMode("create");
        }
      })
      .catch((err: Error) => alive && setError(err.message || "The studio could not be opened."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [learner?.id]);

  useEffect(() => {
    if (!learner || !bundle) return;
    const character = findCharacter(bundle, learner.tutorCharacterId);
    setTutorCharacterId(learner.tutorCharacterId);
    setTutorName(learner.tutorName);
    setPresetId(learner.tutorPreset);
    setStrictnessId(learner.strictness);
    setTutorDraft(resolveAppearance(character, learner.appearance));
  }, [learner?.id, learner?.tutorCharacterId, bundle]);

  const selected = useMemo(
    () => characters.find((c) => c.id === selectedId) || characters.find((c) => c.id === activeId) || null,
    [characters, selectedId, activeId],
  );
  const tutorCharacter = bundle ? findCharacter(bundle, tutorCharacterId) : null;

  const update = (patch: Partial<AdventureAppearance>) => setDraft((current) => ({ ...current, ...patch }));

  const randomise = () => {
    const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
    update({
      skin: pick(SKIN_TONES),
      hairStyle: pick(HAIR_STYLES.map((s) => s.id)),
      hairColor: pick(HAIR_COLORS),
      outfit: pick(OUTFITS.map((o) => o.id)),
      outfitColor: pick(OUTFIT_COLORS),
      accessory: pick(ACCESSORIES.map((a) => a.id)),
      freckles: Math.random() > 0.6,
    });
  };

  const startNew = () => {
    if (characters.length >= MAX_CHARACTERS) {
      setError(`You can keep ${MAX_CHARACTERS} characters. Delete one to make room.`);
      return;
    }
    setError(null);
    setDraft({ ...DEFAULT_APPEARANCE });
    setSelectedId(null);
    setMode("create");
    setTab("look");
  };

  const startEdit = (character: AdventureCharacter | null) => {
    if (!character) return;
    setDraft({ ...character.appearance, name: character.appearance.name || character.name });
    setSelectedId(character.id);
    setMode("edit");
    setTab("look");
  };

  const saveCharacter = async (): Promise<AdventureCharacter | null> => {
    const name = draft.name.trim();
    if (!name) {
      setError("Give your scholar a name — it appears on their nameplate.");
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = { name, appearance: { ...draft, name } };
      const res = selectedId && mode === "edit"
        ? await updateAdventureCharacter(selectedId, payload)
        : await createAdventureCharacter(payload);
      setCharacters(res.profile.characters);
      setActiveId(res.profile.activeCharacterId);
      const saved =
        res.profile.characters.find((c) => c.id === res.profile.activeCharacterId) ||
        res.profile.characters[res.profile.characters.length - 1] ||
        null;
      if (saved) {
        setSelectedId(saved.id);
        setDraft(saved.appearance);
      }
      setMode("select");
      return saved;
    } catch (err: any) {
      setError(err.message || "That character could not be saved.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const enterAcademy = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode !== "select") {
        const saved = await saveCharacter();
        if (!saved) return;
        await activateAdventureCharacter(saved.id);
      } else {
        const targetId = selectedId || activeId;
        if (targetId) await activateAdventureCharacter(targetId);
      }
      navigate("/adventure");
    } catch (err: any) {
      setError(err.message || "The gates would not open yet.");
    } finally {
      setBusy(false);
    }
  };

  const removeCharacter = async (id: string) => {
    setBusy(true);
    try {
      const res = await deleteAdventureCharacter(id);
      setCharacters(res.profile.characters);
      setActiveId(res.profile.activeCharacterId);
      const next = res.profile.characters.find((c) => c.id === res.profile.activeCharacterId) || res.profile.characters[0] || null;
      setSelectedId(next?.id || null);
      if (next) setDraft({ ...next.appearance, name: next.appearance.name || next.name });
      setConfirmDelete(null);
      if (!res.profile.characters.length) setMode("create");
      toast("Character deleted. Your learning progress was untouched.", "good");
    } catch (err: any) {
      setError(err.message || "That character could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  const pickTutor = (id: string) => {
    if (!bundle) return;
    const next = findCharacter(bundle, id);
    setTutorCharacterId(id);
    setTutorName(next.name);
    setPresetId(next.defaultPreset);
    setStrictnessId(strictnessOf(bundle, presetOf(bundle, next.defaultPreset)?.defaultStrictness || next.defaultStrictness)?.id || "balanced");
    setTutorDraft(defaultAppearanceFor(next));
  };

  const choosePreset = (id: string) => {
    setPresetId(id);
    const preset = bundle ? presetOf(bundle, id) : null;
    if (preset) setStrictnessId(preset.defaultStrictness);
  };

  const saveTutor = async () => {
    if (!learner || !bundle || !tutorCharacter || !tutorDraft) return;
    setTutorSaving(true);
    try {
      await api<{ learner: Learner }>(`/learners/${learner.id}/tutor`, {
        method: "POST",
        json: {
          characterId: tutorCharacterId,
          tutorName: tutorName.trim() || tutorCharacter.name,
          tutorPreset: presetId,
          strictness: strictnessId,
          appearance: tutorDraft,
          voiceStyle: presetOf(bundle, presetId)?.voiceStyle || tutorCharacter.voice.style,
        },
      });
      await refreshAuth();
      toast(`${tutorName.trim() || tutorCharacter.name} is your tutor now.`, "good");
    } catch (err: any) {
      setError(err.message || "Your tutor could not be saved.");
    } finally {
      setTutorSaving(false);
    }
  };

  if (!learner) return null;
  if (loading) return <div className="studio-loading"><Spinner label="Opening the studio…" /></div>;

  const showingTutor = mode !== "select" && tab === "tutor";

  return (
    <div className="studio">
      <header className="studio-top">
        <div className="studio-brand">
          <span className="studio-brand__mark">A</span>
          <div>
            <strong>Asterwood Studio</strong>
            <span>Characters &amp; tutors</span>
          </div>
        </div>
        <div className="studio-steps" aria-label="Studio steps">
          <span className={tab === "look" && mode !== "select" ? "is-on" : ""}>1 · Your look</span>
          <span className={showingTutor ? "is-on" : ""}>2 · Your tutor</span>
          <span className={mode === "select" ? "is-on" : ""}>3 · Enter</span>
        </div>
        <div className="studio-top__actions">
          <Button variant="ghost" icon="back" onClick={() => navigate("/")}>Home</Button>
        </div>
      </header>

      <main className="studio-main">
        <section className={`studio-stage ${showingTutor ? "studio-stage--tutor" : ""}`}>
          <div className="studio-stage__glow" aria-hidden="true" />
          <div className="studio-stage__preview">
            {showingTutor && tutorCharacter && tutorDraft ? (
              <TutorAvatar character={tutorCharacter} appearance={tutorDraft} size={300} state="greeting" effects />
            ) : (
              <AvatarPreview appearance={draft} />
            )}
          </div>
          <div className="studio-plaque">
            <strong>{showingTutor ? tutorName || tutorCharacter?.name : draft.name || "Unnamed scholar"}</strong>
            <span>
              {showingTutor
                ? `${tutorCharacter?.title || "Your tutor"}${bundle ? ` · ${presetOf(bundle, presetId)?.name || ""}` : ""}`
                : `${OUTFITS.find((o) => o.id === draft.outfit)?.label} · ${HAIR_STYLES.find((h) => h.id === draft.hairStyle)?.label} hair`}
            </span>
          </div>
          {!showingTutor ? (
            <div className="studio-stage__strip">
              {characters.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  className={`studio-mini ${selectedId === character.id ? "is-on" : ""}`}
                  onClick={() => {
                    setSelectedId(character.id);
                    setDraft({ ...character.appearance, name: character.appearance.name || character.name });
                    setMode("select");
                  }}
                  title={character.name || "Scholar"}
                >
                  <Portrait appearance={character.appearance} size="sm" />
                  <span>{character.name || "Scholar"}</span>
                </button>
              ))}
              {characters.length < MAX_CHARACTERS ? (
                <button type="button" className="studio-mini studio-mini--new" onClick={startNew} disabled={busy}>
                  <span className="studio-mini__plus">+</span>
                  <span>New</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className="studio-panel">
          {error ? <div className="studio-error">{error}</div> : null}

          {mode === "select" ? (
            <div className="studio-select">
              <span className="studio-eyebrow">Welcome back</span>
              <h1>Who's walking the halls today?</h1>
              <p className="studio-lead">
                Pick a scholar you've already made, or create someone new. Every character shares your lessons, memory
                and progress — only the look changes.
              </p>

              <div className="studio-roster">
                {characters.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    className={`studio-card ${selectedId === character.id ? "is-on" : ""}`}
                    onClick={() => {
                      setSelectedId(character.id);
                      setDraft({ ...character.appearance, name: character.appearance.name || character.name });
                    }}
                  >
                    <Portrait appearance={character.appearance} />
                    <span className="studio-card__meta">
                      <strong>{character.name || "Scholar"}</strong>
                      <span>{character.id === activeId ? "Currently in the academy" : "Ready to explore"}</span>
                    </span>
                    {character.id === activeId ? <span className="studio-card__badge">Active</span> : null}
                  </button>
                ))}
                {characters.length < MAX_CHARACTERS ? (
                  <button type="button" className="studio-card studio-card--new" onClick={startNew} disabled={busy}>
                    <span className="studio-card__plus">+</span>
                    <span className="studio-card__meta">
                      <strong>Create a character</strong>
                      <span>{MAX_CHARACTERS - characters.length} of {MAX_CHARACTERS} slots free</span>
                    </span>
                  </button>
                ) : null}
              </div>

              <div className="studio-tutorline">
                <div className="studio-tutorline__avatar">
                  {tutorCharacter ? (
                    <TutorAvatar character={tutorCharacter} appearance={tutorDraft || undefined} size={62} effects={false} state="idle" />
                  ) : null}
                </div>
                <div>
                  <span className="studio-eyebrow">Your AI tutor</span>
                  <strong>{tutorName || tutorCharacter?.name || "Not chosen yet"}</strong>
                  <span className="studio-tutorline__sub">
                    {tutorCharacter?.title || ""}{tutorCharacter && bundle ? ` · ${presetOf(bundle, presetId)?.name || ""}` : ""}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="sparkles"
                  onClick={() => {
                    setMode("edit");
                    setTab("tutor");
                  }}
                >
                  Change tutor
                </Button>
              </div>

              <div className="studio-actions">
                <Button size="lg" icon="compass" loading={busy} onClick={enterAcademy} disabled={!characters.length}>
                  Enter the academy
                </Button>
                <Button variant="secondary" icon="edit" onClick={() => startEdit(selected)} disabled={!selected || busy}>
                  Edit this look
                </Button>
                {selected && characters.length > 1 ? (
                  confirmDelete === selected.id ? (
                    <Button variant="ghost" onClick={() => void removeCharacter(selected.id)} loading={busy}>
                      Tap again to delete
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => setConfirmDelete(selected.id)}>Delete</Button>
                  )
                ) : null}
              </div>
              <p className="studio-note">
                Switching characters never touches mastery, reports or your tutor's memory. Those stay with you.
              </p>
            </div>
          ) : (
            <div className="studio-editor">
              <div className="studio-editor__head">
                <div>
                  <span className="studio-eyebrow">{mode === "create" ? "New scholar" : "Editing"}</span>
                  <h1>{mode === "create" ? "Create a character" : draft.name || "Your character"}</h1>
                </div>
                <Button variant="ghost" icon="back" onClick={() => setMode("select")} disabled={busy}>
                  Characters
                </Button>
              </div>

              <div className="studio-tabs" role="tablist" aria-label="Studio sections">
                <button type="button" role="tab" aria-selected={tab === "look"} className={tab === "look" ? "is-on" : ""} onClick={() => setTab("look")}>
                  Your look
                </button>
                <button type="button" role="tab" aria-selected={tab === "tutor"} className={tab === "tutor" ? "is-on" : ""} onClick={() => setTab("tutor")}>
                  Your tutor
                </button>
              </div>

              {tab === "look" ? (
                <div className="studio-scroll">
                  <label className="studio-field">
                    <span>Character name</span>
                    <input
                      className="studio-input"
                      value={draft.name}
                      maxLength={30}
                      placeholder="e.g. Rowan, Mina, Ash"
                      onChange={(event) => update({ name: event.target.value })}
                    />
                    <small>Shown on your nameplate. Your learner name and reports stay the same.</small>
                  </label>

                  <div className="studio-row">
                    <Button variant="secondary" icon="sparkles" onClick={randomise}>Surprise me</Button>
                    <span className="studio-hint">Or choose each piece below.</span>
                  </div>

                  <div className="studio-field">
                    <span>Skin tone</span>
                    <Swatches colors={SKIN_TONES} value={draft.skin} label="Skin tone" onChange={(skin) => update({ skin })} />
                  </div>

                  <div className="studio-field">
                    <span>Hair</span>
                    <div className="studio-chips">
                      {HAIR_STYLES.map((style) => (
                        <button key={style.id} type="button" className={`studio-chip ${draft.hairStyle === style.id ? "is-on" : ""}`} aria-pressed={draft.hairStyle === style.id} onClick={() => update({ hairStyle: style.id })}>
                          {style.label}
                        </button>
                      ))}
                    </div>
                    <Swatches colors={HAIR_COLORS} value={draft.hairColor} label="Hair colour" onChange={(hairColor) => update({ hairColor })} />
                  </div>

                  <div className="studio-field">
                    <span>Outfit</span>
                    <div className="studio-chips">
                      {OUTFITS.map((outfit) => (
                        <button key={outfit.id} type="button" className={`studio-chip ${draft.outfit === outfit.id ? "is-on" : ""}`} aria-pressed={draft.outfit === outfit.id} onClick={() => update({ outfit: outfit.id })}>
                          {outfit.label}
                        </button>
                      ))}
                    </div>
                    <Swatches colors={OUTFIT_COLORS} value={draft.outfitColor} label="Outfit colour" onChange={(outfitColor) => update({ outfitColor })} />
                  </div>

                  <div className="studio-field">
                    <span>Extras</span>
                    <div className="studio-chips">
                      {ACCESSORIES.map((accessory) => (
                        <button key={accessory.id} type="button" className={`studio-chip ${draft.accessory === accessory.id ? "is-on" : ""}`} aria-pressed={draft.accessory === accessory.id} onClick={() => update({ accessory: accessory.id })}>
                          {accessory.label}
                        </button>
                      ))}
                      <button type="button" className={`studio-chip ${draft.freckles ? "is-on" : ""}`} aria-pressed={draft.freckles} onClick={() => update({ freckles: !draft.freckles })}>
                        Freckles
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="studio-scroll">
                  {!bundle || !tutorCharacter || !tutorDraft ? (
                    <Spinner label="Opening the tutor gallery…" />
                  ) : (
                    <>
                      <p className="studio-lead">
                        Ten tutors, each with their own manner and voice. Their look is yours to change; their teaching
                        style is yours to tune. Swap any time without losing progress.
                      </p>
                      <div className="studio-tutorgrid">
                        {bundle.tutors.map((tutor) => (
                          <button
                            key={tutor.id}
                            type="button"
                            className={`studio-tutor ${tutor.id === tutorCharacterId ? "is-on" : ""}`}
                            onClick={() => pickTutor(tutor.id)}
                            title={`${tutor.name} — ${tutor.title}`}
                          >
                            <TutorAvatar character={tutor} size={58} effects={false} state="idle" />
                            <span>{tutor.name}</span>
                          </button>
                        ))}
                      </div>

                      <div className="studio-tutorbio">
                        <strong>{tutorCharacter.name} · {tutorCharacter.title}</strong>
                        <p>{tutorCharacter.intro}</p>
                        <span className="studio-hint">
                          Strongest in {tutorCharacter.affinity.join(", ")} — but teaches every subject.
                        </span>
                      </div>

                      <label className="studio-field">
                        <span>What should your tutor be called?</span>
                        <input className="studio-input" value={tutorName} maxLength={30} placeholder={tutorCharacter.name} onChange={(event) => setTutorName(event.target.value)} />
                      </label>

                      <div className="studio-field">
                        <span>Teaching personality</span>
                        <PresetPicker presets={bundle.presets} value={presetId} onChange={choosePreset} />
                      </div>

                      <div className="studio-field">
                        <span>Strictness</span>
                        <StrictnessPicker levels={bundle.strictnessLevels} value={strictnessId} onChange={setStrictnessId} />
                      </div>

                      <details className="studio-details">
                        <summary>Fine-tune your tutor's look</summary>
                        <div style={{ marginTop: 10 }}>
                          <AppearanceControls options={bundle.appearanceOptions} appearance={tutorDraft} onChange={(patch) => setTutorDraft({ ...tutorDraft, ...patch })} />
                          <Button size="sm" variant="ghost" onClick={() => setTutorDraft(defaultAppearanceFor(tutorCharacter))}>Reset to original look</Button>
                        </div>
                      </details>

                      <Button variant="primary" icon="check" loading={tutorSaving} onClick={() => void saveTutor()}>
                        Save tutor
                      </Button>
                    </>
                  )}
                </div>
              )}

              <div className="studio-actions studio-actions--foot">
                <Button size="lg" icon="compass" loading={busy} onClick={enterAcademy}>
                  {mode === "create" ? "Create & enter the academy" : "Save & enter the academy"}
                </Button>
                {tab === "look" ? (
                  <Button variant="secondary" onClick={() => void saveCharacter()} disabled={busy}>Save character</Button>
                ) : null}
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
