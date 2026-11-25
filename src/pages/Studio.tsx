import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, Field, Icon, Modal, Spinner } from "../components/ui";
import { AcademyScene } from "../components/character/AcademyScene";
import { TutorAvatar, type AvatarState } from "../components/character/Avatar";
import {
  AppearanceControls,
  EnvironmentPicker,
  PresetPicker,
  StrictnessPicker,
  ToggleRow,
  VoiceSampleButton,
} from "../components/character/TutorPieces";
import { api, timeAgo, type Learner } from "../lib/api";
import {
  defaultAppearanceFor,
  findCharacter,
  presetOf,
  resolveAppearance,
  strictnessOf,
  useTutorBundle,
  type Appearance,
} from "../lib/character";
import { useApp } from "../lib/store";

type SavedLook = { id: string; name: string; character_id: string; appearance: Appearance; created_at: number };

const STATES: AvatarState[] = [
  "idle", "greeting", "listening", "thinking", "talking", "explaining", "pointing",
  "reading", "writing", "celebrating", "confused", "encouraging", "correcting", "coaching",
];

export function Studio() {
  const { learner, meta, refreshAuth, toast } = useApp();
  const { bundle } = useTutorBundle();
  const navigate = useNavigate();
  const [characterId, setCharacterId] = useState(learner?.tutorCharacterId || "auren");
  const [draft, setDraft] = useState<Appearance | null>(null);
  const [presetId, setPresetId] = useState(learner?.tutorPreset || "supportive");
  const [strictnessId, setStrictnessId] = useState(learner?.strictness || "balanced");
  const [tutorName, setTutorName] = useState(learner?.tutorName || "Aster");
  const [state, setState] = useState<AvatarState>("idle");
  const [environment, setEnvironment] = useState(learner?.environment || "auto");
  const [autoEnvironment, setAutoEnvironment] = useState(learner?.autoEnvironment ?? true);
  const [looks, setLooks] = useState<SavedLook[]>([]);
  const [lookName, setLookName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const character = bundle ? findCharacter(bundle, characterId) : null;

  useEffect(() => {
    if (!learner || !bundle) return;
    setCharacterId(learner.tutorCharacterId);
    setDraft(resolveAppearance(findCharacter(bundle, learner.tutorCharacterId), learner.appearance));
    setPresetId(learner.tutorPreset);
    setStrictnessId(learner.strictness);
    setTutorName(learner.tutorName);
    setEnvironment(learner.environment || "auto");
    setAutoEnvironment(learner.autoEnvironment);
    setDirty(false);
  }, [learner?.id, learner?.tutorCharacterId, bundle]);

  const loadLooks = useCallback(async () => {
    if (!learner) return;
    try {
      const res = await api<{ appearances: SavedLook[] }>(`/learners/${learner.id}/appearances`);
      setLooks(res.appearances);
    } catch {
      /* non-fatal */
    }
  }, [learner]);

  useEffect(() => { void loadLooks(); }, [loadLooks]);

  if (!learner) return null;
  if (!bundle || !character || !draft) return <div className="page"><Spinner label="Opening the studio…" /></div>;

  const activeEnvironment = environment === "auto" ? bundle.environments[0] : bundle.environments.find((e) => e.id === environment) || bundle.environments[0];

  const pickCharacter = (id: string) => {
    const next = findCharacter(bundle, id);
    setCharacterId(id);
    setDraft(defaultAppearanceFor(next));
    setPresetId(next.defaultPreset);
    setStrictnessId(strictnessOf(bundle, presetOf(bundle, next.defaultPreset)?.defaultStrictness || next.defaultStrictness)?.id || "balanced");
    setTutorName(next.name);
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      await api<{ learner: Learner }>(`/learners/${learner.id}/tutor`, {
        method: "POST",
        json: {
          characterId,
          tutorName: tutorName.trim() || character.name,
          tutorPreset: presetId,
          strictness: strictnessId,
          appearance: draft,
          environment,
          autoEnvironment,
          voiceStyle: presetOf(bundle, presetId)?.voiceStyle || character.voice.style,
        },
      });
      await refreshAuth();
      setDirty(false);
      toast("Studio changes saved", "good");
    } catch (err: any) {
      toast(err.message || "Could not save your changes", "warn");
    } finally {
      setBusy(false);
    }
  };

  const saveLook = async () => {
    try {
      await api(`/learners/${learner.id}/appearances`, {
        method: "POST",
        json: { name: lookName.trim() || `${character.name} look`, characterId, appearance: draft },
      });
      setSaveOpen(false);
      setLookName("");
      void loadLooks();
      toast("Look saved — you can switch between looks any time", "good");
    } catch (err: any) {
      toast(err.message || "Could not save that look", "warn");
    }
  };

  const applyLook = async (look: SavedLook) => {
    try {
      await api(`/appearances/${look.id}/apply`, { method: "POST", json: {} });
      const nextCharacter = findCharacter(bundle, look.character_id);
      setCharacterId(look.character_id);
      setDraft(resolveAppearance(nextCharacter, look.appearance));
      await refreshAuth();
      toast(`Applied "${look.name}"`, "good");
    } catch (err: any) {
      toast(err.message || "Could not apply that look", "warn");
    }
  };

  const deleteLook = async (look: SavedLook) => {
    try {
      await api(`/appearances/${look.id}`, { method: "DELETE" });
      void loadLooks();
      toast("Look deleted", "good");
    } catch (err: any) {
      toast(err.message || "Could not delete that look", "warn");
    }
  };

  return (
    <div className="page stack">
      <div className="page__head">
        <div>
          <h1 className="page__title">Character studio</h1>
          <p className="page__sub">Change how your tutor looks, sounds and behaves — then watch it live before you save.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon="library" onClick={() => setSaveOpen(true)}>Save this look</Button>
          <Button icon="check" onClick={save} loading={busy} disabled={!dirty}>Save changes</Button>
        </div>
      </div>

      <Card title="Choose a base character" subtitle="Start from any of the ten Academy tutors, then make them yours.">
        <div className="mini-tutor-row">
          {bundle.tutors.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`mini-tutor ${t.id === characterId ? "mini-tutor--on" : ""}`}
              onClick={() => pickCharacter(t.id)}
              title={`${t.name} — ${t.title}`}
            >
              <TutorAvatar character={t} size={66} effects={false} />
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="studio-layout">
        <div className="stack">
          <Card className="card--flat" title={character.name} subtitle={`${character.title} · ${presetOf(bundle, presetId)?.name} · ${strictnessOf(bundle, strictnessId)?.name}`}>
            <div
              className="studio-stage"
              style={{ background: `radial-gradient(110% 90% at 50% 10%, ${character.palette.aura}2e, transparent 70%)` }}
            >
              <TutorAvatar
                character={character}
                appearance={draft}
                size={300}
                state={state}
                speaking={state === "talking"}
                effects
                trackPointer
              />
            </div>
            <div className="row row--tight" style={{ marginTop: 10, justifyContent: "center" }}>
              {STATES.map((s) => (
                <button key={s} className={`chip ${state === s ? "chip--active" : ""}`} onClick={() => setState(s)} style={{ fontSize: 10.5, padding: "3px 8px" }}>
                  {s}
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <VoiceSampleButton
                character={character}
                voiceStyle={presetOf(bundle, presetId)?.voiceStyle || character.voice.style}
                rate={character.voice.rate}
                accent={learner.voiceAccent}
              />
              <Button size="sm" variant="ghost" icon="reset" onClick={() => { setDraft(defaultAppearanceFor(character)); setDirty(true); }}>
                <Icon name="back" size={14} /> Reset look
              </Button>
            </div>
          </Card>

          <Card title="Environment" subtitle="Where lessons take place. Automatic follows the subject.">
            <div style={{ marginBottom: 10 }}>
              <ToggleRow
                label="Automatic environment"
                checked={autoEnvironment}
                hint="Astronomy opens the observatory, history the archive, maths the geometric chamber."
                onChange={(v) => { setAutoEnvironment(v); setDirty(true); }}
              />
            </div>
            <EnvironmentPicker
              environments={bundle.environments}
              value={autoEnvironment ? "auto" : environment}
              onChange={(id) => { setEnvironment(id); setAutoEnvironment(id === "auto"); setDirty(true); }}
              auto={autoEnvironment}
            />
            <div style={{ marginTop: 12 }}>
              <AcademyScene environment={activeEnvironment} className="studio-scene">
                <div className="studio-scene__label">
                  <strong>{activeEnvironment.name}</strong>
                  <span>{activeEnvironment.blurb}</span>
                </div>
              </AcademyScene>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Appearance" subtitle="Every option is stored with your profile and drawn live.">
            <AppearanceControls options={bundle.appearanceOptions} appearance={draft} onChange={(patch) => { setDraft({ ...draft, ...patch }); setDirty(true); }} />
          </Card>

          <Card title="Teaching personality" subtitle="Appearance and personality are independent — pick any combination.">
            <PresetPicker
              presets={bundle.presets}
              value={presetId}
              onChange={(id) => {
                setPresetId(id);
                const preset = presetOf(bundle, id);
                if (preset) setStrictnessId(preset.defaultStrictness);
                setDirty(true);
              }}
            />
            <div style={{ marginTop: 14 }}>
              <span className="field__label">Strictness</span>
              <StrictnessPicker levels={bundle.strictnessLevels} value={strictnessId} onChange={(id) => { setStrictnessId(id); setDirty(true); }} />
            </div>
            <div className="onboard__note" style={{ marginTop: 10 }}>
              Strictness adds real accountability: follow-ups on unfinished work and assignments, required attempts before
              answers, and tracked targets. It never permits humiliation, threats or emotional pressure — and it softens
              automatically for younger learners.
            </div>
          </Card>

          <Card title="Identity & voice" subtitle="The name you'll hear, and the voice that says it.">
            <div className="stack stack--sm">
              <Field label="Tutor name">
                <input className="input" value={tutorName} onChange={(e) => { setTutorName(e.target.value); setDirty(true); }} maxLength={30} />
              </Field>
              <div className="row row--tight">
                <Badge tone="violet">{character.voice.descriptor}</Badge>
                <Badge tone="muted">{character.voice.accent} accent hint</Badge>
                <Badge tone="teal">{presetOf(bundle, presetId)?.name}</Badge>
              </div>
              <VoiceSampleButton
                character={character}
                voiceStyle={presetOf(bundle, presetId)?.voiceStyle || character.voice.style}
                rate={character.voice.rate}
                accent={learner.voiceAccent}
                label="Preview voice"
              />
              <div className="tiny muted">Voice uses your device's speech engine. Exact voice depends on the voices installed in this browser and operating system.</div>
            </div>
          </Card>

          <Card
            title={`Saved looks (${looks.length})`}
            subtitle="Keep several appearances and switch between them."
            action={<Button size="sm" variant="soft" icon="plus" onClick={() => setSaveOpen(true)}>Save current</Button>}
          >
            {looks.length ? (
              <div className="stack stack--sm">
                {looks.map((look) => {
                  const lookChar = findCharacter(bundle, look.character_id);
                  return (
                    <div key={look.id} className="lib-item">
                      <span style={{ width: 46, height: 46, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: "var(--violet-soft)" }}>
                        <TutorAvatar character={lookChar} appearance={look.appearance} size={46} effects={false} />
                      </span>
                      <div className="lib-item__body">
                        <div className="lib-item__title">{look.name}</div>
                        <div className="lib-item__excerpt">{lookChar.name} · {timeAgo(look.created_at)}</div>
                      </div>
                      <div className="row row--tight">
                        <Button size="sm" variant="soft" onClick={() => applyLook(look)}>Apply</Button>
                        <button className="icon-btn" aria-label="Delete look" onClick={() => deleteLook(look)}><Icon name="trash" size={13} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>No saved looks yet. Design one you like and save it — the default is always kept.</p>
            )}
          </Card>

          <Card title="Where else your tutor appears">
            <div className="row row--tight">
              <Button size="sm" variant="ghost" icon="home" onClick={() => navigate("/")}>Dashboard</Button>
              <Button size="sm" variant="ghost" icon="chat" onClick={() => navigate("/tutor")}>Tutor</Button>
              <Button size="sm" variant="ghost" icon="book" onClick={() => navigate("/lessons")}>Lessons</Button>
              <Button size="sm" variant="ghost" icon="target" onClick={() => navigate("/practice")}>Quizzes</Button>
              <Button size="sm" variant="ghost" icon="chart" onClick={() => navigate("/progress")}>Progress</Button>
              <Button size="sm" variant="ghost" icon="compass" onClick={() => navigate("/academy")}>Academy</Button>
            </div>
          </Card>

          {meta?.ai.enabled === false ? (
            <div className="onboard__note">
              This server is using Asterwood's built-in curriculum engine. Character personalities and strictness still change how lessons and replies are phrased; live conversational AI needs <code>OPENAI_API_KEY</code> on the server.
            </div>
          ) : null}
        </div>
      </div>

      {dirty ? (
        <div className="card" style={{ position: "sticky", bottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
          <span className="small">Unsaved studio changes.</span>
          <div className="row">
            <Button variant="ghost" onClick={() => { setDraft(resolveAppearance(character, learner.appearance)); setDirty(false); }}>Undo</Button>
            <Button onClick={save} loading={busy}>Save changes</Button>
          </div>
        </div>
      ) : null}

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save this look"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={saveLook}>Save look</Button>
          </>
        }
      >
        <div className="stack">
          <Field label="Name this look" hint="e.g. 'Winter robes', 'Exam mode', 'Weekend casual'.">
            <input className="input" value={lookName} onChange={(e) => setLookName(e.target.value)} placeholder={`${character.name} look`} />
          </Field>
          <div className="onboard__note">
            Saved looks store the appearance and base character. Applying one never changes your lessons, memory or progress.
          </div>
        </div>
      </Modal>
    </div>
  );
}
