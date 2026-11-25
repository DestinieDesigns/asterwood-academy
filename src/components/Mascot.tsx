import React from "react";

export type Mood = "happy" | "thinking" | "celebrate" | "listening" | "sleepy" | "wave";

export function Mascot({
  mood = "happy",
  size = 96,
  className,
  hue,
}: {
  mood?: Mood;
  size?: number;
  className?: string;
  hue?: string;
}) {
  const gradientId = React.useId().replace(/:/g, "");
  const base = hue || "#7c5cf0";
  const eyes =
    mood === "sleepy" ? (
      <>
        <path d="M31 44 q5 5 10 0" stroke="#221a44" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <path d="M55 44 q5 5 10 0" stroke="#221a44" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      </>
    ) : mood === "thinking" ? (
      <>
        <circle cx="36" cy="43" r="5" fill="#221a44" />
        <circle cx="60" cy="41" r="5" fill="#221a44" />
        <circle cx="34.6" cy="41.4" r="1.7" fill="#fff" />
        <circle cx="58.6" cy="39.4" r="1.7" fill="#fff" />
      </>
    ) : mood === "celebrate" ? (
      <>
        <path d="M30 44 q6 -8 12 0" stroke="#221a44" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M54 44 q6 -8 12 0" stroke="#221a44" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ) : (
      <>
        <ellipse cx="36" cy="43" rx="5.2" ry="5.8" fill="#221a44" />
        <ellipse cx="60" cy="43" rx="5.2" ry="5.8" fill="#221a44" />
        <circle cx="34.6" cy="41.2" r="1.8" fill="#fff" />
        <circle cx="58.6" cy="41.2" r="1.8" fill="#fff" />
      </>
    );

  const mouth =
    mood === "celebrate" ? (
      <path d="M38 53 q10 12 20 0 q-10 5 -20 0" fill="#221a44" />
    ) : mood === "thinking" ? (
      <path d="M42 55 q6 2 12 -1" stroke="#221a44" strokeWidth="3.4" fill="none" strokeLinecap="round" />
    ) : mood === "sleepy" ? (
      <path d="M42 54 q6 4 12 0" stroke="#221a44" strokeWidth="3.2" fill="none" strokeLinecap="round" />
    ) : (
      <path d="M39 53 q9 9 18 0" stroke="#221a44" strokeWidth="3.6" fill="none" strokeLinecap="round" />
    );

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label={`Asterwood mascot, ${mood}`}
    >
      <defs>
        <linearGradient id={`g-${gradientId}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={base} />
          <stop offset="100%" stopColor="#3fc4c9" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="86" rx="24" ry="5" fill="rgba(60,40,120,.12)" />
      <path
        d="M48 14c16 0 27 12 27 27 0 6-1 10-1 15 0 12-11 21-26 21S22 68 22 56c0-5-1-9-1-15 0-15 11-27 27-27z"
        fill={`url(#g-${gradientId})`}
        className="mascot__body"
      />
      <path d="M48 14c2 0 3 1 3 3v-2c0-3 4-4 5-1" fill="none" />
      <path d="M48 12v6" stroke="#3a2a72" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="48" cy="9" r="4.4" fill="#ffd166" stroke="#3a2a72" strokeWidth="2" />
      <ellipse cx="28" cy="54" rx="5.5" ry="3.6" fill="#ff9ec4" opacity=".55" />
      <ellipse cx="68" cy="54" rx="5.5" ry="3.6" fill="#ff9ec4" opacity=".55" />
      {eyes}
      {mouth}
      {mood === "wave" ? (
        <g className="mascot__wave">
          <path d="M74 58 q7 2 8 9" stroke={base} strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="82" cy="70" r="4.6" fill={base} />
        </g>
      ) : null}
      {mood === "celebrate" ? (
        <g opacity=".9">
          <path d="M15 26 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3z" fill="#ffd166" />
          <path d="M80 18 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z" fill="#ff9ec4" />
        </g>
      ) : null}
      {mood === "thinking" ? (
        <g>
          <circle cx="76" cy="26" r="3.4" fill="#fff" stroke={base} strokeWidth="2" />
          <circle cx="83" cy="17" r="5" fill="#fff" stroke={base} strokeWidth="2" />
        </g>
      ) : null}
      {mood === "listening" ? (
        <g>
          <path d="M20 38 q-6 10 0 20" stroke={base} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M12 34 q-8 14 0 28" stroke={base} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".6" />
        </g>
      ) : null}
    </svg>
  );
}
