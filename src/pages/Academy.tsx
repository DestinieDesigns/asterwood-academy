import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mascot } from "../components/Mascot";
import { Badge, Button, Card, Icon, Modal, Spinner } from "../components/ui";
import { AcademyScene } from "../components/character/AcademyScene";
import { TutorAvatar, type AvatarState } from "../components/character/Avatar";
import {
  AppearanceControls,
  CharacterCard,
  PresetPicker,
  StrictnessPicker,
  VoiceSampleButton,
} from "../components/character/TutorPieces";
import { api, type Learner } from "../lib/api";
import {
  defaultAppearanceFor,
  findCharacter,
  presetOf,
  resolveAppearance,
  strictnessOf,
  useTutorBundle,
  type Appearance,
  type Character,
} from "../lib/character";
import { useApp } from "../lib/store";

export function Academy() {
  const { learner, meta, refreshAuth, toast } = useApp();
  const { bundle, error } = useTutorBundle();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "male" | "female" | "recommended">("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Appearance | null>(null);
  const [presetId, setPresetId] = useState("");
  const [strictnessId, setStrictnessId] = useState("");
  const [tutorName, setTutorName] = useState("");
  const [previewState, setPreviewState] = useState<AvatarState>("greeting");
  const [saving, setSaving] = useState(false);

  const subjectNames = useMemo(() => {
    const map: Record<string, string> = {};
    (meta?.subjects || []).forEach((s) => { map[s.id] = s.name; });
    return map;
  }, [meta]);

  useEffect(() => {
    if (!detailId) setPreviewState("greeting");
  }, [detailId]);

  if (!learner) return null;
  if (!bundle) {
    return (
      <div className="page">
        {error ? <Card><p>{error}</p></Card> : <Spinner label="Opening the Celestial Academy…" />}
      </div>
    );
  }

  const current = findCharacter(bundle, learner.tutorCharacterId);
  const currentPreset = presetOf(bundle, learner.tutorPreset);
  const selectedCharacter: Character | null = detailId ? findCharacter(bundle, detailId) : null;

  const lovedSubjects = new Set(
    [...learner.loves, ...learner.interests]
      .flatMap((value) => (meta?.subjects || []).filter((s) => s.name.toLowerCase() === value.toLowerCase()).map((s) => s.id)),
  );

  const visible = bundle.tutors.filter((t) => {
    if (filter === "male") return t.gender === "male";
    if (filter === "female") return t.gender === "female";
    if (filter === "recommended") return t.affinity.some((a) => lovedSubjects.has(a)) || t.id === learner.tutorCharacterId;
    return true;
  });

  const openDetail = (character: Character) => {
    const isCurrent = character.id === learner.tutorCharacterId;
    setDetailId(character.id);
    setDraft(resolveAppearance(character, isCurrent ? learner.appearance : defaultAppearanceFor(character)));
    setPresetId(isCurrent ? learner.tutorPreset : character.defaultPreset);
    setStrictnessId(
      isCurrent
        ? learner.strictness
        : presetOf(bundle, character.defaultPreset)?.defaultStrictness || character.defaultStrictness,
    );
    setTutorName(isCurrent ? learner.tutorName : character.name);
    setPreviewState("greeting");
  };

  const choosePreset = (id: string) => {
    setPresetId(id);
    const preset = presetOf(bundle, id);
    if (preset) setStrictnessId(preset.defaultStrictness);
  };

  const confirm = async () => {
    if (!selectedCharacter || !draft) return;
    setSaving(true);
    try {
      await api<{ learner: Learner }>(`/learners/${learner.id}/tutor`, {
        method: "POST",
        json: {
          characterId: selectedCharacter.id,
          tutorName: tutorName.trim() || selectedCharacter.name,
          tutorPreset: presetId,
          strictness: strictnessId,
          appearance: draft,
          voiceStyle: presetOf(bundle, presetId)?.voiceStyle || selectedCharacter.voice.style,
        },
      });
      await refreshAuth();
      toast(`${tutorName.trim() || selectedCharacter.name} is now your tutor. Your learning history is untouched.`, "good");
      setDetailId(null);
      navigate("/");
    } catch (err: any) {
      toast(err.message || "Could not save your tutor", "warn");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page stack">
      <AcademyScene environment={bundle.environments[0]} className="academy-hero">
        <div className="academy-hero__inner">
          <div style={{ flex: 1, minWidth: 240 }}>
            <span className="badge badge--violet">The Celestial Academy</span>
            <h1 className="academy-hero__title">Choose the professor who teaches like you learn.</h1>
            <p className="academy-hero__lead">
              Ten tutors, each with their own manner, voice and way of explaining. Their appearance is yours to change;
              their teaching personality is yours to configure. Swap tutors any time — your lessons, memory and progress
              stay exactly where they are.
            </p>
            <div className="row" style={{ marginTop: 12 }}>
              <Button icon="settings" onClick={() => navigate("/studio")}>Open customization studio</Button>
              <Button variant="secondary" icon="user" onClick={() => navigate("/profile")}>My tutor profile</Button>
            </div>
          </div>
          <div className="academy-hero__tutor">
            <TutorAvatar character={current} appearance={learner.appearance} size={150} state="greeting" effects />
            <div className="academy-hero__plate">
              <strong>{learner.tutorName}</strong>
              <span>{current.title} · {currentPreset?.name}</span>
            </div>
          </div>
        </div>
      </AcademyScene>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row row--tight">
          {([["all", "All ten"], ["recommended", "Matches your interests"], ["male", "He/Him"], ["female", "She/Her"]] as const).map(([id, label]) => (
            <button key={id} className={`chip ${filter === id ? "chip--active" : ""}`} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
        <span className="tiny muted">{visible.length} of {bundle.tutors.length} tutors</span>
      </div>

      <div className="tutor-grid">
        {visible.map((character) => (
          <CharacterCard
            key={character.id}
            character={character}
            selected={character.id === learner.tutorCharacterId}
            onSelect={() => openDetail(character)}
            subjectNames={subjectNames}
          />
        ))}
      </div>

      <Card className="card--tint">
        <div className="spread">
          <div className="row" style={{ gap: 12 }}>
            <Mascot size={54} mood="happy" />
            <div>
              <strong className="small">Not sure? Try a conversation first.</strong>
              <p className="tiny muted" style={{ margin: 0 }}>Every tutor can be renamed, restyled and reassigned a personality. You are choosing a voice and a manner, not a cage.</p>
            </div>
          </div>
          <Button variant="secondary" icon="chat" onClick={() => navigate("/tutor")}>Talk to {learner.tutorName}</Button>
        </div>
      </Card>

      <Modal
        open={Boolean(selectedCharacter && draft)}
        onClose={() => setDetailId(null)}
        wide
        title={selectedCharacter ? `${selectedCharacter.name} — ${selectedCharacter.title}` : "Tutor"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetailId(null)}>Keep browsing</Button>
            <Button onClick={confirm} loading={saving} icon="check">
              {selectedCharacter && selectedCharacter.id === learner.tutorCharacterId ? "Save changes" : "Choose this tutor"}
            </Button>
          </>
        }
      >
        {selectedCharacter && draft ? (
          <div className="tutor-detail">
            <div className="tutor-detail__art">
              <div className="tutor-detail__stage" style={{ background: `radial-gradient(110% 90% at 50% 15%, ${selectedCharacter.palette.aura}33, transparent 70%)` }}>
                <TutorAvatar
                  character={selectedCharacter}
                  appearance={draft}
                  size={276}
                  state={previewState}
                  speaking={previewState === "talking"}
                  effects
                  trackPointer
                />
              </div>
              <div className="row row--tight" style={{ justifyContent: "center" }}>
                {(["greeting", "listening", "thinking", "talking", "explaining", "celebrating", "coaching"] as AvatarState[]).map((s) => (
                  <button key={s} className={`chip ${previewState === s ? "chip--active" : ""}`} onClick={() => setPreviewState(s)} style={{ fontSize: 11, padding: "3px 8px" }}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="onboard__note" style={{ marginTop: 10 }}>
                <Icon name="bulb" size={14} /> These are live animations, not a looping video: blink, gaze, gesture and lip movement respond to state and speech.
              </div>
              <div style={{ marginTop: 8 }}>
                <VoiceSampleButton
                  character={selectedCharacter}
                  voiceStyle={presetOf(bundle, presetId)?.voiceStyle || selectedCharacter.voice.style}
                  rate={selectedCharacter.voice.rate}
                  accent={learner.voiceAccent}
                />
              </div>
            </div>

            <div className="stack">
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <Badge tone="violet">{selectedCharacter.pronunciation}</Badge>
                  <Badge tone="muted">{selectedCharacter.voice.descriptor}</Badge>
                </div>
                <p className="small" style={{ marginTop: 8 }}>{selectedCharacter.intro}</p>
                <div className="row row--tight">
                  {selectedCharacter.traits.map((t) => <span key={t} className="chip" style={{ fontSize: 11 }}>{t}</span>)}
                </div>
              </div>

              <div className="onboard__note">
                <strong>Teaching style.</strong> {selectedCharacter.teachingStyle}
                <div className="tiny muted" style={{ marginTop: 3 }}>
                  Strongest in {selectedCharacter.affinity.map((a) => subjectNames[a] || a).join(", ")} — but teaches every subject.
                </div>
              </div>

              <label className="field">
                <span className="field__label">Call your tutor</span>
                <input className="input" value={tutorName} onChange={(e) => setTutorName(e.target.value)} maxLength={30} placeholder={selectedCharacter.name} />
              </label>

              <div className="field">
                <span className="field__label">Teaching personality</span>
                <PresetPicker presets={bundle.presets} value={presetId} onChange={choosePreset} />
              </div>

              <div className="field">
                <span className="field__label">Strictness</span>
                <StrictnessPicker levels={bundle.strictnessLevels} value={strictnessId} onChange={setStrictnessId} />
              </div>

              <details className="studio-details" open>
                <summary>Customize appearance</summary>
                <div style={{ marginTop: 10 }}>
                  <AppearanceControls options={bundle.appearanceOptions} appearance={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />
                  <div className="row" style={{ marginTop: 10 }}>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(defaultAppearanceFor(selectedCharacter))}>Reset to original look</Button>
                    <Button size="sm" variant="ghost" icon="settings" onClick={() => navigate("/studio")}>Full studio →</Button>
                  </div>
                </div>
              </details>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
