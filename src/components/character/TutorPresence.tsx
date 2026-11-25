import { useNavigate } from "react-router-dom";
import { Button } from "../ui";
import { useApp } from "../../lib/store";
import { presetOf, useTutorBundle } from "../../lib/character";
import { LearnerAvatar, type AvatarState } from "./Avatar";

/** A compact, consistent tutor presence for pages that are not the chat itself. */
export function TutorPresence({
  message,
  cta,
  to = "/tutor",
  state = "listening",
}: {
  message: string;
  cta?: string;
  to?: string;
  state?: AvatarState;
}) {
  const { learner } = useApp();
  const { bundle } = useTutorBundle();
  const navigate = useNavigate();
  if (!learner) return null;
  const name = learner.tutorName || "Aster";
  const preset = presetOf(bundle, learner.tutorPreset);

  return (
    <div className="tutor-presence">
      <LearnerAvatar size={68} state={state} />
      <div className="tutor-presence__text">
        <strong>{name}</strong>
        <span className="tiny muted">{preset?.name || "Your Academy tutor"} · {learner.strictness?.replace(/_/g, " ")} pacing</span>
        <p className="small">{message}</p>
      </div>
      <Button size="sm" variant="secondary" icon="chat" onClick={() => navigate(to)}>
        {cta || `Ask ${name}`}
      </Button>
    </div>
  );
}
