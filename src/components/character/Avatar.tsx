import React, { useEffect, useMemo, useRef, useState } from "react";
import { findCharacter, resolveAppearance, useTutorBundle, type Appearance, type Character } from "../../lib/character";
import { useApp } from "../../lib/store";
import { onSpeechEvent } from "../../lib/voice";

/**
 * The Asterwood character engine.
 *
 * This is a real-time, layered 2D/2.5D renderer: a rigged vector character
 * whose face, gaze, eyelids, mouth, hair, arms, clothing and magical effects
 * are animated from live state (idle, listening, thinking, speaking, and so on).
 *
 * LIMITATION, stated plainly: these are not photoreal 3D GLB models. There is
 * no mocap or phoneme-level viseme track. Lip movement is driven by real
 * speech-synthesis activity (utterance boundary events) with an amplitude
 * cycle, and gestures are authored transitions rather than skeletal animation.
 * The renderer is resolution-independent, fully recolourable for the
 * customization studio, and cheap enough to keep the learning UI responsive.
 */

export type AvatarState =
  | "idle"
  | "greeting"
  | "listening"
  | "thinking"
  | "talking"
  | "explaining"
  | "pointing"
  | "reading"
  | "writing"
  | "celebrating"
  | "confused"
  | "encouraging"
  | "correcting"
  | "coaching"
  | "farewell";

type Expression = {
  browY: number;
  browTilt: number;
  eyeScale: number;
  gazeY: number;
  mouth: "smile" | "soft" | "big" | "flat" | "o" | "thinking" | "open";
  tilt: number;
};

const EXPRESSIONS: Record<AvatarState, Expression> = {
  idle: { browY: 0, browTilt: 0, eyeScale: 1, gazeY: 0, mouth: "soft", tilt: 0 },
  greeting: { browY: -2, browTilt: 1, eyeScale: 1.04, gazeY: 0, mouth: "smile", tilt: 2 },
  listening: { browY: -2.5, browTilt: 1.5, eyeScale: 1.05, gazeY: 0, mouth: "soft", tilt: -3 },
  thinking: { browY: -1, browTilt: 3, eyeScale: 0.95, gazeY: -3, mouth: "thinking", tilt: 4 },
  talking: { browY: -1, browTilt: 0.5, eyeScale: 1.02, gazeY: 0, mouth: "open", tilt: 0 },
  explaining: { browY: -1, browTilt: 1, eyeScale: 1.02, gazeY: 1, mouth: "smile", tilt: 2 },
  pointing: { browY: -1.5, browTilt: 1, eyeScale: 1.02, gazeY: 2, mouth: "smile", tilt: 3 },
  reading: { browY: 0, browTilt: 0, eyeScale: 1, gazeY: 4.5, mouth: "soft", tilt: -2 },
  writing: { browY: 0.5, browTilt: 0.5, eyeScale: 1, gazeY: 4, mouth: "soft", tilt: 3 },
  celebrating: { browY: -3, browTilt: 2, eyeScale: 1.05, gazeY: 0, mouth: "big", tilt: 0 },
  confused: { browY: 1, browTilt: 4, eyeScale: 1.03, gazeY: 0, mouth: "o", tilt: 6 },
  encouraging: { browY: -2, browTilt: 1, eyeScale: 1.02, gazeY: 0, mouth: "smile", tilt: -2 },
  correcting: { browY: 2, browTilt: -2, eyeScale: 0.98, gazeY: 1, mouth: "flat", tilt: -1 },
  coaching: { browY: 2, browTilt: -2.5, eyeScale: 0.97, gazeY: 0, mouth: "flat", tilt: 0 },
  farewell: { browY: -1, browTilt: 0.5, eyeScale: 1, gazeY: 0, mouth: "smile", tilt: 1 },
};

const HAIR_LENGTH_BOTTOM: Record<string, number> = { short: 178, shoulder: 236, long: 306, floor: 356 };

function useBlink(enabled: boolean) {
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    let closer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlinking(true);
        closer = setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 115);
      }, 2600 + Math.random() * 3800);
    };
    schedule();
    return () => {
      clearTimeout(timer);
      clearTimeout(closer);
    };
  }, [enabled]);
  return blinking;
}

function useGaze(active: boolean) {
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!active) return;
    let timeout: ReturnType<typeof setTimeout>;
    const drift = () => {
      timeout = setTimeout(() => {
        setGaze({ x: Math.random() * 4 - 2, y: Math.random() * 2.4 - 1.2 });
        drift();
      }, 2400 + Math.random() * 3200);
    };
    drift();
    return () => clearTimeout(timeout);
  }, [active]);
  return gaze;
}

/* ------------------------------------------------------------------ */
/*  Hair                                                               */
/* ------------------------------------------------------------------ */

function HairBack({ style, length, color, shade }: { style: string; length: string; color: string; shade: string }) {
  const bottom = HAIR_LENGTH_BOTTOM[length] || 300;

  if (style === "curls") {
    const curls = [];
    for (let i = 0; i < 9; i++) {
      const angle = (-95 + i * 24) * (Math.PI / 180);
      const cx = 160 + Math.cos(angle) * (58 + (i % 3) * 5);
      const cy = 118 + Math.sin(angle) * (58 + (i % 2) * 6);
      curls.push(<circle key={i} cx={cx} cy={cy} r={23 + (i % 3) * 3} fill={i % 2 ? shade : color} />);
    }
    return (
      <g>
        {curls}
        <rect x="104" y="130" width="112" height={Math.max(40, bottom - 150)} rx="52" fill={shade} opacity="0.85" />
      </g>
    );
  }

  if (style === "locs" || style === "braids") {
    const strands = [];
    const count = style === "locs" ? 8 : 2;
    for (let i = 0; i < count; i++) {
      const spread = count === 2 ? 1 : (i / (count - 1)) * 2 - 1;
      const x = 160 + spread * 54;
      const endY = style === "braids" ? Math.max(240, bottom - 40) : bottom - 20;
      strands.push(
        <path
          key={i}
          d={`M${x} 78 C${x + spread * 26} 140 ${x + spread * 30} 200 ${x + spread * 18} ${endY}`}
          stroke={i % 3 === 0 ? shade : color}
          strokeWidth={style === "braids" ? 13 : 15}
          strokeLinecap="round"
          fill="none"
          opacity={0.95}
        />,
      );
      if (style === "braids") {
        strands.push(
          <ellipse key={`t${i}`} cx={x + spread * 18} cy={endY} rx="9" ry="6" fill={shade} />,
        );
      }
    }
    return <g>{strands}</g>;
  }

  if (style === "ponytail") {
    return (
      <g>
        <path d={`M160 54 C120 54 100 84 102 126 L100 168 C118 180 202 180 220 168 L218 126 C220 84 200 54 160 54 Z`} fill={shade} />
        <path d={`M196 66 C232 78 244 122 238 168 C234 206 220 232 204 ${Math.min(bottom, 250)} C196 236 206 210 210 186 C214 152 204 116 184 92 Z`} fill={color} />
        <path d={`M198 70 C226 86 232 124 228 158`} stroke={shade} strokeWidth="4" fill="none" opacity=".5" />
      </g>
    );
  }

  if (style === "long_straight" || style === "long_flow" || style === "wavy_long") {
    const wave = style === "long_flow" ? 18 : style === "wavy_long" ? 12 : 4;
    return (
      <g>
        <path
          d={`M160 48 C116 48 96 82 98 128 L92 ${bottom - 66}
              C${94 + wave} ${bottom - 26} 108 ${bottom - 4} 126 ${bottom - 16}
              C140 ${bottom - 30} 146 ${bottom - 70} 160 ${bottom - 78}
              C174 ${bottom - 70} 180 ${bottom - 30} 194 ${bottom - 16}
              C212 ${bottom - 4} 226 ${bottom - 26} 228 ${bottom - 66}
              L222 128 C224 82 204 48 160 48 Z`}
          fill={color}
        />
        <path d={`M112 92 C104 150 106 210 116 ${bottom - 40}`} stroke={shade} strokeWidth="3" fill="none" opacity=".55" />
        <path d={`M208 92 C216 150 214 210 204 ${bottom - 40}`} stroke={shade} strokeWidth="3" fill="none" opacity=".55" />
        <path d={`M138 78 C130 150 132 220 140 ${bottom - 60}`} stroke={shade} strokeWidth="2" fill="none" opacity=".3" />
      </g>
    );
  }

  if (style === "bob") {
    const b = Math.min(bottom, 208);
    return (
      <g>
        <path d={`M160 50 C118 50 98 82 100 128 L102 ${b - 16} C120 ${b} 200 ${b} 218 ${b - 16} L220 128 C222 82 202 50 160 50 Z`} fill={shade} />
        <path d={`M104 112 C100 156 104 ${b - 26} 124 ${b - 14} C140 ${b - 6} 180 ${b - 6} 196 ${b - 14} C216 ${b - 26} 220 156 216 112 Z`} fill={color} opacity=".96" />
      </g>
    );
  }

  // short styles
  return (
    <g>
      <path d="M160 50 C120 50 100 80 102 124 C112 142 208 142 218 124 C220 80 200 50 160 50 Z" fill={color} />
      <path d="M116 66 C138 54 184 54 206 68" stroke={shade} strokeWidth="4" fill="none" opacity=".5" />
    </g>
  );
}

function HairFront({ style, color, shade }: { style: string; color: string; shade: string }) {
  const common = { fill: color } as const;
  switch (style) {
    case "long_straight":
      return (
        <g>
          <path d="M160 64 C126 64 110 88 110 118 C110 100 126 92 146 94 C140 108 148 122 160 122 C172 122 180 108 174 94 C194 92 210 100 210 118 C210 88 194 64 160 64 Z" {...common} />
          <path d="M110 116 C104 88 128 62 160 62" stroke={shade} strokeWidth="3" fill="none" opacity=".5" />
          <path d="M210 116 C216 88 192 62 160 62" stroke={shade} strokeWidth="3" fill="none" opacity=".5" />
        </g>
      );
    case "bob":
      return (
        <g>
          <path d="M160 62 C124 62 106 88 108 124 L107 148 C122 152 132 150 140 146 L140 122 C146 116 174 116 180 122 L180 146 C188 150 198 152 213 148 L212 124 C214 88 196 62 160 62 Z" {...common} />
          <path d="M138 66 C152 62 168 62 182 66" stroke={shade} strokeWidth="3" fill="none" opacity=".45" />
        </g>
      );
    case "curls":
      return (
        <g>
          <path d="M160 62 C126 62 108 86 110 116 L114 140 C128 142 132 128 140 124 L144 106 C150 116 170 116 176 106 L180 124 C188 128 192 142 206 140 L210 116 C212 86 194 62 160 62 Z" {...common} />
          <circle cx="128" cy="92" r="14" fill={shade} opacity=".85" />
          <circle cx="192" cy="92" r="14" fill={shade} opacity=".85" />
          <circle cx="150" cy="76" r="13" fill={color} />
          <circle cx="174" cy="76" r="12" fill={color} />
        </g>
      );
    case "long_flow":
    case "wavy_long":
      return (
        <g>
          <path d="M160 64 C124 64 108 90 110 120 C118 132 128 126 134 110 C138 128 150 138 166 132 C158 116 160 100 172 90 C184 104 200 114 210 118 C212 88 196 64 160 64 Z" {...common} />
          <path d="M112 118 C108 150 112 178 120 200" stroke={shade} strokeWidth="7" fill="none" strokeLinecap="round" opacity=".8" />
          <path d="M208 118 C212 150 208 178 200 200" stroke={shade} strokeWidth="7" fill="none" strokeLinecap="round" opacity=".8" />
          <path d="M140 72 C150 88 168 96 186 96" stroke={shade} strokeWidth="2.5" fill="none" opacity=".5" />
        </g>
      );
    case "locs":
      return (
        <g>
          <path d="M160 62 C126 62 108 88 112 118 C118 112 120 98 128 92 C132 106 144 112 156 108 C150 96 152 80 164 72 C176 82 190 96 204 100 C210 112 208 118 208 118 C212 88 194 62 160 62 Z" {...common} />
          <path d="M116 108 C108 128 108 150 112 166" stroke={shade} strokeWidth="9" fill="none" strokeLinecap="round" />
          <path d="M204 108 C212 128 212 150 208 166" stroke={shade} strokeWidth="9" fill="none" strokeLinecap="round" />
        </g>
      );
    case "braids":
      return (
        <g>
          <path d="M160 64 C130 64 112 86 112 114 C122 112 128 100 136 94 C144 108 156 112 160 112 C164 112 176 108 184 94 C192 100 198 112 208 114 C208 86 190 64 160 64 Z" {...common} />
          <path d="M120 116 C114 148 116 176 122 200" stroke={shade} strokeWidth="10" fill="none" strokeLinecap="round" />
          <path d="M200 116 C206 148 204 176 198 200" stroke={shade} strokeWidth="10" fill="none" strokeLinecap="round" />
        </g>
      );
    case "ponytail":
      return (
        <g>
          <path d="M160 62 C128 62 110 86 112 118 C122 116 130 104 140 96 C148 108 158 112 168 108 C176 100 188 96 196 100 C204 108 206 114 208 118 C210 86 192 62 160 62 Z" {...common} />
          <path d="M132 70 C148 62 176 62 190 70" stroke={shade} strokeWidth="3" fill="none" opacity=".5" />
        </g>
      );
    case "wavy_short":
      return (
        <g>
          <path d="M160 62 C128 62 108 86 112 116 C118 108 120 96 130 90 C138 104 152 110 164 104 C174 112 186 110 192 100 C202 106 206 112 208 116 C212 86 192 62 160 62 Z" {...common} />
          <path d="M120 84 C136 74 158 72 174 78" stroke={shade} strokeWidth="3" fill="none" opacity=".5" />
        </g>
      );
    default: // short_flow
      return (
        <g>
          <path d="M160 62 C126 62 108 86 110 118 C116 106 122 96 132 90 C140 104 152 112 168 108 C180 104 190 94 198 96 C202 102 206 110 208 118 C212 86 194 62 160 62 Z" {...common} />
          <path d="M116 104 C124 88 136 78 152 74" stroke={shade} strokeWidth="4" fill="none" strokeLinecap="round" opacity=".6" />
          <path d="M156 70 C172 74 186 86 196 100" stroke={shade} strokeWidth="3" fill="none" strokeLinecap="round" opacity=".4" />
        </g>
      );
  }
}

/* ------------------------------------------------------------------ */
/*  Effects & accessories                                              */
/* ------------------------------------------------------------------ */

function Effects({ effect, aura }: { effect: string; aura: string }) {
  const star = (x: number, y: number, r: number, delay: number, key: string) => (
    <path
      key={key}
      className="av-fx-star"
      style={{ animationDelay: `${delay}s` }}
      d={`M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z`}
      fill={aura}
      opacity={0.9}
    />
  );
  switch (effect) {
    case "stars":
      return <g className="av-fx">{star(54, 92, 8, 0, "s1")}{star(266, 78, 6, 0.8, "s2")}{star(42, 208, 5, 1.4, "s3")}{star(280, 206, 7, 0.4, "s4")}{star(70, 300, 4, 1.9, "s5")}{star(258, 306, 5, 1.1, "s6")}</g>;
    case "particles":
      return (
        <g className="av-fx">
          {[38, 74, 250, 282, 60, 268, 48, 276].map((x, i) => (
            <circle key={i} cx={x} cy={110 + i * 32} r={i % 2 ? 2.4 : 3.4} fill={aura} opacity={0.75} style={{ animationDelay: `${i * 0.4}s` }} className="av-fx-float" />
          ))}
        </g>
      );
    case "constellations":
      return (
        <g className="av-fx">
          <path d="M40 92 L74 70 L104 96 L96 138" stroke={aura} strokeWidth="1.3" fill="none" opacity=".55" />
          <path d="M236 70 L268 96 L250 142" stroke={aura} strokeWidth="1.3" fill="none" opacity=".55" />
          {[[40, 92], [74, 70], [104, 96], [96, 138], [236, 70], [268, 96], [250, 142]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.6" fill={aura} className="av-fx-twinkle" style={{ animationDelay: `${i * 0.3}s` }} />
          ))}
        </g>
      );
    case "moonlight":
      return (
        <g className="av-fx">
          <circle cx="258" cy="86" r="26" fill={aura} opacity=".16" />
          <path d="M266 70 a20 20 0 1 0 0 32 a16 16 0 1 1 0 -32" fill={aura} opacity=".8" className="av-fx-float" />
          <circle cx="54" cy="150" r="2.5" fill={aura} opacity=".7" />
          <circle cx="72" cy="116" r="1.8" fill={aura} opacity=".6" />
        </g>
      );
    case "golden_light":
      return (
        <g className="av-fx">
          <circle cx="160" cy="330" r="120" fill={aura} opacity=".1" />
          {[70, 118, 196, 244].map((x, i) => <circle key={x} cx={x} cy={120 + i * 56} r="3" fill={aura} opacity=".8" className="av-fx-float" style={{ animationDelay: `${i * 0.5}s` }} />)}
        </g>
      );
    case "blue_magic":
      return (
        <g className="av-fx">
          <circle cx="160" cy="200" r="126" fill="none" stroke={aura} strokeWidth="1.2" opacity=".3" className="av-fx-pulse" />
          <circle cx="160" cy="200" r="146" fill="none" stroke={aura} strokeWidth="0.9" opacity=".18" className="av-fx-pulse" style={{ animationDelay: "1s" }} />
          <circle cx="252" cy="128" r="3.4" fill={aura} className="av-fx-twinkle" />
          <circle cx="64" cy="248" r="2.6" fill={aura} className="av-fx-twinkle" style={{ animationDelay: ".7s" }} />
        </g>
      );
    case "botanical":
      return (
        <g className="av-fx">
          {[[52, 240], [268, 216], [64, 320], [262, 318]].map(([x, y], i) => (
            <path
              key={i}
              className="av-fx-float"
              style={{ animationDelay: `${i * 0.6}s`, transformOrigin: `${x}px ${y}px` }}
              d={`M${x} ${y} q10 -14 20 -4 q-8 14 -20 4 Z`}
              fill={aura}
              opacity=".7"
            />
          ))}
          <path d="M46 120 q8 22 0 44" stroke={aura} strokeWidth="2" fill="none" opacity=".4" />
        </g>
      );
    case "crystals":
      return (
        <g className="av-fx">
          {[[56, 116], [270, 154], [48, 268], [276, 288]].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y - 9} L${x + 7} ${y} L${x} ${y + 11} L${x - 7} ${y} Z`} fill={aura} opacity=".75" className="av-fx-float" style={{ animationDelay: `${i * 0.7}s` }} />
          ))}
        </g>
      );
    case "butterflies":
      return (
        <g className="av-fx">
          {[[58, 132, 1], [268, 180, 0.8], [72, 288, 1.15]].map(([x, y, s], i) => (
            <g key={i} className="av-butterfly" style={{ animationDelay: `${i * 0.9}s`, transform: `translate(${x}px, ${y}px) scale(${s})` }}>
              <path d="M0 0 q-12 -12 -16 0 q4 12 16 2 Z" fill={aura} opacity=".8" />
              <path d="M0 0 q12 -12 16 0 q-4 12 -16 2 Z" fill={aura} opacity=".65" />
              <path d="M0 0 q-9 12 -12 20 q9 2 12 -10 Z" fill={aura} opacity=".55" />
              <path d="M0 0 q9 12 12 20 q-9 2 -12 -10 Z" fill={aura} opacity=".45" />
            </g>
          ))}
        </g>
      );
    case "books":
      return (
        <g className="av-fx">
          {[[52, 150, -14], [262, 118, 12]].map(([x, y, r], i) => (
            <g key={i} className="av-fx-float" style={{ animationDelay: `${i * 1.2}s`, transformOrigin: `${x}px ${y}px` }}>
              <path d={`M${x - 18} ${y} l18 -6 l18 6 l-18 6 Z`} fill={aura} opacity=".85" transform={`rotate(${r} ${x} ${y})`} />
              <path d={`M${x - 18} ${y} l0 10 l18 6 l0 -10 Z`} fill="#ffffff" opacity=".18" transform={`rotate(${r} ${x} ${y})`} />
            </g>
          ))}
        </g>
      );
    default:
      return null;
  }
}

function Accessory({ accessory, trim, accent }: { accessory: string; trim: string; accent: string }) {
  switch (accessory) {
    case "circlet":
      return (
        <g>
          <path d="M116 100 Q160 86 204 100" stroke={trim} strokeWidth="2.6" fill="none" />
          <path d="M160 86 l4 7 l8 1 l-6 5 l2 8 l-8 -4 l-8 4 l2 -8 l-6 -5 l8 -1 Z" fill={accent} opacity=".95" />
        </g>
      );
    case "crescent":
      return <path d="M208 88 a11 11 0 1 0 0 18 a13 13 0 1 1 0 -18" fill={accent} opacity=".9" />;
    case "crystal_pin":
      return <path d="M186 234 l6 10 l-6 12 l-6 -12 Z" fill={accent} opacity=".9" />;
    case "laurel":
      return (
        <g stroke={trim} fill="none" strokeWidth="2" opacity=".9">
          <path d="M106 108 C92 88 96 66 112 56" />
          <path d="M214 108 C228 88 224 66 208 56" />
          {[0, 1, 2].map((i) => (
            <ellipse key={`l${i}`} cx={98 - i * 5} cy={94 - i * 14} rx="6" ry="3" transform={`rotate(-35 ${98 - i * 5} ${94 - i * 14})`} fill={trim} />
          ))}
          {[0, 1, 2].map((i) => (
            <ellipse key={`r${i}`} cx={222 + i * 5} cy={94 - i * 14} rx="6" ry="3" transform={`rotate(35 ${222 + i * 5} ${94 - i * 14})`} fill={trim} />
          ))}
        </g>
      );
    case "ribbon":
      return (
        <g>
          <path d="M150 226 q-12 -12 -22 -2 q8 12 22 6 Z" fill={accent} />
          <path d="M150 226 q12 -12 22 -2 q-8 12 -22 6 Z" fill={accent} opacity=".85" />
          <circle cx="150" cy="226" r="3" fill={trim} />
        </g>
      );
    default:
      return null;
  }
}

function Outfit({ outfit, robe, trim, skin, accent }: { outfit: string; robe: string; trim: string; skin: string; accent: string }) {
  const kind =
    outfit === "academic_uniform" ? "blazer"
      : outfit === "modern_academic" ? "modern"
        : outfit === "casual" || outfit === "seasonal" ? "casual"
          : "robe";

  if (kind === "blazer") {
    return (
      <g>
        <path d="M160 218 C134 218 104 234 90 262 L64 400 H256 L230 262 C216 234 186 218 160 218 Z" fill={robe} />
        <path d="M128 220 L160 258 L192 220 L184 216 L160 238 L136 216 Z" fill="#f6f3ee" />
        <path d="M158 240 L162 240 L166 268 L160 280 L154 268 Z" fill={trim} />
        <path d="M128 220 L160 258 L138 270 L118 232 Z" fill={robe} opacity=".92" />
        <path d="M192 220 L160 258 L182 270 L202 232 Z" fill={robe} opacity=".92" />
        <path d="M126 220 L160 260" stroke={trim} strokeWidth="2" fill="none" />
        <path d="M194 220 L160 260" stroke={trim} strokeWidth="2" fill="none" />
        {[286, 312, 338].map((y) => <circle key={y} cx="196" cy={y} r="3" fill={trim} />)}
        <path d="M112 246 C120 300 116 350 110 396" stroke={accent} strokeWidth="1.4" fill="none" opacity=".4" />
      </g>
    );
  }

  if (kind === "modern") {
    return (
      <g>
        <path d="M160 218 C136 218 106 234 92 262 L68 400 H252 L228 262 C214 234 184 218 160 218 Z" fill="#f4f1ea" />
        <path d="M160 218 C140 218 114 232 100 256 L88 400 H232 L220 256 C206 232 180 218 160 218 Z" fill={robe} opacity=".92" />
        <path d="M138 218 L160 252 L182 218 L174 214 L160 232 L146 214 Z" fill="#ffffff" />
        <path d="M160 252 L160 400" stroke={trim} strokeWidth="1.6" opacity=".6" />
        <circle cx="160" cy="300" r="2.6" fill={trim} />
        <path d="M148 262 C160 276 172 262 172 262" stroke={trim} strokeWidth="2" fill="none" opacity=".7" />
      </g>
    );
  }

  if (kind === "casual") {
    return (
      <g>
        <path d="M160 218 C134 218 104 234 90 264 L70 400 H250 L230 264 C216 234 186 218 160 218 Z" fill={robe} />
        <path d="M136 218 C146 232 174 232 184 218 L196 224 C186 246 134 246 124 224 Z" fill={trim} opacity=".85" />
        <path d="M150 232 L150 268" stroke={trim} strokeWidth="3" strokeLinecap="round" opacity=".8" />
        <path d="M170 232 L170 268" stroke={trim} strokeWidth="3" strokeLinecap="round" opacity=".8" />
        {outfit === "seasonal" ? (
          <g>
            <path d="M96 268 C130 288 190 288 224 268 L230 300 C190 320 130 320 90 300 Z" fill={trim} opacity=".8" />
            <circle cx="220" cy="288" r="16" fill={accent} opacity=".35" />
          </g>
        ) : null}
        <path d="M108 258 C118 310 114 356 108 396" stroke={accent} strokeWidth="1.4" fill="none" opacity=".35" />
      </g>
    );
  }

  // Robes and gowns
  const isGown = outfit === "starlight_gown" || outfit === "blush_cream";
  return (
    <g>
      <path d="M160 216 C132 216 100 234 86 264 L58 400 H262 L234 264 C220 234 188 216 160 216 Z" fill={robe} />
      <path d="M160 216 C146 216 128 222 116 232 L92 400 H228 L204 232 C192 222 174 216 160 216 Z" fill={robe} opacity=".35" />
      <path
        d={isGown
          ? "M124 222 C140 244 180 244 196 222 L206 236 C186 264 134 264 114 236 Z"
          : "M130 220 L160 262 L190 220 L198 228 L160 288 L122 228 Z"}
        fill={trim}
        opacity=".92"
      />
      {isGown ? <path d="M110 252 C130 268 190 268 210 252" stroke={trim} strokeWidth="2" fill="none" opacity=".6" /> : null}
      <path d="M118 236 C108 300 102 350 96 396" stroke={trim} strokeWidth="1.4" fill="none" opacity=".55" />
      <path d="M202 236 C212 300 218 350 224 396" stroke={trim} strokeWidth="1.4" fill="none" opacity=".55" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} opacity=".85">
          <circle cx={126 + i * 17} cy={330 + (i % 2) * 16} r="1.7" fill={accent} />
        </g>
      ))}
      <path d="M150 286 q10 8 20 0" stroke={accent} strokeWidth="1.3" fill="none" opacity=".5" />
      <circle cx="176" cy={238} r="3.2" fill={accent} opacity={outfit === "crystal_robes" ? 0.9 : 0} />
      <path d="M160 262 l3 8 l-3 10 l-3 -10 Z" fill={accent} opacity={outfit === "crystal_robes" ? 0.85 : 0} />
      <path d="M112 300 q-12 22 -8 54" stroke={skin} strokeWidth="0" fill="none" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Avatar                                                             */
/* ------------------------------------------------------------------ */

export function TutorAvatar({
  character,
  appearance,
  size = 160,
  state = "idle",
  speaking = false,
  effects = true,
  name,
  className = "",
  onClick,
  trackPointer = false,
}: {
  character: Character;
  appearance?: Partial<Appearance> | null;
  size?: number;
  state?: AvatarState;
  speaking?: boolean;
  effects?: boolean;
  name?: string;
  className?: string;
  onClick?: () => void;
  trackPointer?: boolean;
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const look = resolveAppearance(character, appearance);
  const expr = EXPRESSIONS[state] || EXPRESSIONS.idle;
  const blinking = useBlink(state !== "reading");
  const gaze = useGaze(true);
  const [mouth, setMouth] = useState(0);
  const mouthRef = useRef(0);
  const [pulse, setPulse] = useState(0);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mouthRef.current = mouth;
  }, [mouth]);

  useEffect(() => {
    if (!speaking) {
      setMouth(0);
      return;
    }
    const interval = setInterval(() => {
      setMouth(0.18 + Math.random() * 0.78);
    }, 105);
    return () => clearInterval(interval);
  }, [speaking]);

  useEffect(() => {
    return onSpeechEvent((event) => {
      if (event.type === "boundary") {
        setMouth((m) => (m > 0.4 ? 0.28 : 0.95));
        setPulse((p) => p + 1);
      }
      if (event.type === "end") setMouth(0);
    });
  }, []);

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!trackPointer || size < 90) return;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setPointer({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  };

  const hairShade = useMemo(() => {
    const match = /^#?([0-9a-f]{6})$/i.exec(look.hairColor);
    if (!match) return character.palette.hairShade;
    const num = parseInt(match[1], 16);
    const r = Math.max(0, ((num >> 16) & 255) - 34);
    const g = Math.max(0, ((num >> 8) & 255) - 34);
    const b = Math.max(0, (num & 255) - 34);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }, [look.hairColor, character.palette.hairShade]);

  const eyeX = gaze.x + pointer.x * 2.4;
  const eyeY = gaze.y + expr.gazeY + pointer.y * 1.8;
  const mouthOpen = speaking || state === "talking" ? mouth : 0;
  const showEffects = effects && size >= 60;
  const showDetail = size >= 80;

  const mouthShape = () => {
    if (mouthOpen > 0.05) {
      return (
        <g>
          <ellipse cx="160" cy={173} rx={8.5} ry={1.6 + mouthOpen * 6.4} fill="#5c2637" />
          <ellipse cx="160" cy={175 + mouthOpen * 2} rx={5.2} ry={1.4 + mouthOpen * 2.2} fill="#b4566c" opacity=".8" />
        </g>
      );
    }
    switch (expr.mouth) {
      case "big":
        return (
          <g>
            <path d="M146 167 Q160 185 174 167 Q160 174 146 167 Z" fill="#5c2637" />
            <path d="M151 176 Q160 181 169 176 Q160 178 151 176 Z" fill="#c2687c" opacity=".7" />
          </g>
        );
      case "smile":
        return <path d="M149 170 Q160 178 171 170" stroke="#8a4050" strokeWidth="2.4" fill="none" strokeLinecap="round" />;
      case "flat":
        return <path d="M151 172 L169 172" stroke="#8a4050" strokeWidth="2.2" fill="none" strokeLinecap="round" />;
      case "o":
        return <ellipse cx="160" cy="173" rx="4.4" ry="5.2" fill="#6b2b3c" />;
      case "thinking":
        return <path d="M154 172 Q160 168 166 172" stroke="#8a4050" strokeWidth="2.2" fill="none" strokeLinecap="round" />;
      case "open":
        return <ellipse cx="160" cy="173" rx="7" ry="4.4" fill="#5c2637" />;
      default:
        return <path d="M152 171 Q160 176 168 171" stroke="#9a5261" strokeWidth="2.1" fill="none" strokeLinecap="round" />;
    }
  };

  return (
    <div
      ref={boxRef}
      className={`avatar avatar--${state} ${className}`}
      style={{ width: size, height: size }}
      onMouseMove={handleMove}
      onMouseLeave={() => setPointer({ x: 0, y: 0 })}
      onClick={onClick}
      role={onClick ? "button" : "img"}
      aria-label={`${character.name}${name ? `, ${name}` : ""} — ${state}`}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <svg viewBox="0 0 320 400" width="100%" height="100%" aria-hidden="true">
        <defs>
          <radialGradient id={`aura-${uid}`} cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor={character.palette.aura} stopOpacity="0.28" />
            <stop offset="70%" stopColor={character.palette.aura} stopOpacity="0.06" />
            <stop offset="100%" stopColor={character.palette.aura} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`robe-${uid}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor={look.outfit === "crystal_robes" ? "#ffffff" : character.palette.robe} />
            <stop offset="100%" stopColor={character.palette.robe} />
          </linearGradient>
          <linearGradient id={`hair-${uid}`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor={look.hairColor} />
            <stop offset="100%" stopColor={hairShade} />
          </linearGradient>
          <radialGradient id={`iris-${uid}`} cx="45%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="35%" stopColor={look.eyeColor} />
            <stop offset="100%" stopColor={hairShade === look.hairColor ? "#1f2438" : "#141b33"} />
          </radialGradient>
          <linearGradient id={`skin-${uid}`} x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.06" />
          </linearGradient>
        </defs>

        <ellipse cx="160" cy="196" rx="152" ry="200" fill={`url(#aura-${uid})`} />
        {showEffects ? <Effects effect={look.effect} aura={character.palette.aura} /> : null}
        {look.fantasy === "butterfly_wings" ? (
          <g opacity=".55">
            <path d="M150 250 C96 200 62 250 88 306 C110 340 144 312 152 280 Z" fill={character.palette.aura} opacity=".5" />
            <path d="M170 250 C224 200 258 250 232 306 C210 340 176 312 168 280 Z" fill={character.palette.aura} opacity=".5" />
          </g>
        ) : null}

        <g className="av-root">
          <g className="av-hair av-hair--back">
            <HairBack style={look.hairStyle} length={look.hairLength} color={`url(#hair-${uid})`} shade={hairShade} />
          </g>

          {/* arms behind torso */}
          <g className="av-arm av-arm--left">
            <path d="M112 254 C96 272 90 304 93 338 C95 355 105 363 115 358 C123 354 125 336 123 312 L126 270 Z" fill={`url(#robe-${uid})`} />
            <path d="M97 330 C104 336 112 336 118 331" stroke={character.palette.robeTrim} strokeWidth="2" fill="none" opacity=".6" />
            <circle cx="105" cy="357" r="10.4" fill={look.skin} />
          </g>
          <g className="av-arm av-arm--right">
            <path d="M208 254 C224 272 230 304 227 338 C225 355 215 363 205 358 C197 354 195 336 197 312 L194 270 Z" fill={`url(#robe-${uid})`} />
            <path d="M223 330 C216 336 208 336 202 331" stroke={character.palette.robeTrim} strokeWidth="2" fill="none" opacity=".6" />
            <circle cx="215" cy="357" r="10.4" fill={look.skin} />
          </g>

          <Outfit outfit={look.outfit} robe={character.palette.robe} trim={character.palette.robeTrim} skin={look.skin} accent={character.palette.accent} />
          <Accessory accessory={look.accessory} trim={character.palette.robeTrim} accent={character.palette.accent} />

          <rect x="147" y="180" width="26" height="34" rx="10" fill={look.skin} />
          <path d="M147 196 Q160 208 173 196" stroke="#00000022" strokeWidth="4" fill="none" />

          <g className="av-head">
            {look.fantasy === "elf_ears" ? (
              <g>
                <path d="M112 132 C96 116 88 108 86 122 C86 140 100 152 114 148 Z" fill={look.skin} />
                <path d="M208 132 C224 116 232 108 234 122 C234 140 220 152 206 148 Z" fill={look.skin} />
              </g>
            ) : (
              <g>
                <ellipse cx="108" cy="140" rx="8" ry="12" fill={look.skin} />
                <ellipse cx="212" cy="140" rx="8" ry="12" fill={look.skin} />
              </g>
            )}

            <path
              d="M160 62 C196 62 214 90 212 128 C210 162 192 188 160 200 C128 188 110 162 108 128 C106 90 124 62 160 62 Z"
              fill={look.skin}
            />
            <path
              d="M160 62 C196 62 214 90 212 128 C210 162 192 188 160 200 C128 188 110 162 108 128 C106 90 124 62 160 62 Z"
              fill={`url(#skin-${uid})`}
            />
            <path d="M136 186 Q160 198 184 186" stroke="#00000014" strokeWidth="6" fill="none" />

            {look.freckles ? (
              <g fill="#9c5f45" opacity=".55">
                {[[126, 152], [132, 157], [138, 150], [130, 163], [186, 152], [192, 157], [198, 150], [190, 163]].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="1.5" />
                ))}
              </g>
            ) : null}

            <g className="av-eyes">
              {[138, 182].map((cx, index) => (
                <g key={cx}>
                  <ellipse cx={cx} cy="132" rx={showDetail ? 13.5 : 12} ry={showDetail ? 12 : 11} fill="#fdfbff" />
                  <g transform={`translate(${eyeX} ${eyeY})`}>
                    <circle cx={cx} cy="132" r={showDetail ? 9.4 : 8.6} fill={`url(#iris-${uid})`} />
                    <circle cx={cx} cy="133" r="4.1" fill="#1b1730" />
                    <circle cx={cx - 3.2} cy="127.6" r="2.5" fill="#ffffff" opacity=".95" />
                    <circle cx={cx + 3.6} cy="137" r="1.3" fill="#ffffff" opacity=".5" />
                  </g>
                  <path d={`M${cx - 13} 124 Q${cx} 114 ${cx + 13} 124`} stroke="#2a2138" strokeWidth="2.9" fill="none" strokeLinecap="round" />
                  <path d={`M${cx - 11} 143 Q${cx} 147 ${cx + 11} 143`} stroke="#2a2138" strokeWidth="1.1" fill="none" opacity=".35" />
                  <g style={{ transform: blinking ? "scaleY(1)" : "scaleY(0)", transformOrigin: `${cx}px 117px`, transition: "transform 90ms ease" }}>
                    <path d={`M${cx - 14} 118 Q${cx} 116 ${cx + 14} 118 L${cx + 14} 146 Q${cx} 149 ${cx - 14} 146 Z`} fill={look.skin} />
                    <path d={`M${cx - 12} 138 Q${cx} 144 ${cx + 12} 138`} stroke="#3a2a44" strokeWidth="1.6" fill="none" opacity=".55" />
                  </g>
                  <path
                    d={`M${cx - 14} ${116 + expr.browY} Q${cx} ${111 + expr.browY - expr.browTilt * (index === 0 ? 1 : 0.6)} ${cx + 14} ${116 + expr.browY}`}
                    stroke={hairShade}
                    strokeWidth="3.4"
                    fill="none"
                    strokeLinecap="round"
                  />
                </g>
              ))}
            </g>

            <path d="M158 152 Q162 156 159 158" stroke="#00000038" strokeWidth="1.7" fill="none" strokeLinecap="round" />
            <ellipse cx="126" cy="152" rx="10" ry="5.4" fill="#f08b9a" opacity=".22" />
            <ellipse cx="194" cy="152" rx="10" ry="5.4" fill="#f08b9a" opacity=".22" />

            {look.markings || look.fantasy === "starlight_marks" ? (
              <g fill={character.palette.accent} opacity=".8">
                <path d="M124 118 l2 4 l4 1 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 -1 Z" transform="translate(0 16)" />
                <circle cx="198" cy="118" r="1.6" />
                <circle cx="203" cy="124" r="1.1" />
              </g>
            ) : null}

            {mouthShape()}

            {look.glasses !== "none" ? (
              <g stroke={look.glasses === "reading" ? character.palette.robeTrim : "#2f2a44"} strokeWidth="2" fill="none" opacity=".85">
                {look.glasses === "angular" ? (
                  <>
                    <path d="M124 122 L152 122 L150 146 L126 146 Z" />
                    <path d="M168 122 L196 122 L194 146 L170 146 Z" />
                  </>
                ) : (
                  <>
                    <circle cx="138" cy="132" r="17" />
                    <circle cx="182" cy="132" r="17" />
                  </>
                )}
                <path d="M155 131 L165 131" />
                <path d="M121 128 L108 126" />
                <path d="M199 128 L212 126" />
              </g>
            ) : null}

            <g className="av-hair av-hair--front">
              <HairFront style={look.hairStyle} color={`url(#hair-${uid})`} shade={hairShade} />
            </g>
            {look.fantasy === "halo" ? (
              <ellipse className="av-halo" cx="160" cy="48" rx="38" ry="8" fill="none" stroke={character.palette.accent} strokeWidth="3" opacity=".7" />
            ) : null}
          </g>

          {look.effect === "crystals" ? (
            <g opacity=".8">
              <path d="M160 286 l4 9 l-4 11 l-4 -11 Z" fill={character.palette.aura} />
            </g>
          ) : null}

          {state === "reading" ? (
            <g className="av-prop">
              <path d="M112 326 L160 312 L208 326 L208 354 L160 340 L112 354 Z" fill="#f7f1e6" stroke={character.palette.robeTrim} strokeWidth="2" strokeLinejoin="round" />
              <path d="M160 313 L160 340" stroke={character.palette.robeTrim} strokeWidth="1.6" opacity=".7" />
              <path d="M120 330 L152 322 M120 337 L152 329 M168 322 L200 330 M168 329 L200 337" stroke="#a99f8c" strokeWidth="1.2" opacity=".6" />
            </g>
          ) : null}
          {state === "writing" ? (
            <g className="av-prop">
              <path d="M118 350 C150 342 186 342 214 350" stroke={character.palette.robeTrim} strokeWidth="3" fill="none" strokeLinecap="round" opacity=".8" />
              <path d="M206 352 q16 -30 30 -38 q-1 20 -17 34 Z" fill={character.palette.aura} opacity=".85" />
              <path d="M204 354 l-8 6" stroke={character.palette.robeTrim} strokeWidth="2" strokeLinecap="round" />
            </g>
          ) : null}
          {state === "pointing" ? (
            <path d="M246 238 q14 -3 22 4" stroke={character.palette.aura} strokeWidth="2" fill="none" opacity=".6" strokeLinecap="round" />
          ) : null}
        </g>
      </svg>
      {name ? <span className="avatar__name">{name}</span> : null}
    </div>
  );
}

/** The learner's chosen tutor, with live speech animation. */
export function LearnerAvatar({
  size = 120,
  state = "idle",
  speaking = false,
  effects,
  className = "",
  name,
  onClick,
}: {
  size?: number;
  state?: AvatarState;
  speaking?: boolean;
  effects?: boolean;
  className?: string;
  name?: string;
  onClick?: () => void;
}) {
  const { learner } = useApp();
  const { bundle } = useTutorBundle();
  const character = findCharacter(bundle, learner?.tutorCharacterId);
  return (
    <TutorAvatar
      character={character}
      appearance={learner?.appearance}
      size={size}
      state={state}
      speaking={speaking}
      effects={effects}
      name={name}
      className={className}
      onClick={onClick}
      trackPointer={Boolean(onClick)}
    />
  );
}

export function CharacterBadge({ character, appearance, size = 48 }: { character: Character; appearance?: Partial<Appearance> | null; size?: number }) {
  return (
    <span className="character-badge" style={{ width: size, height: size }}>
      <TutorAvatar character={character} appearance={appearance} size={size} effects={false} state="idle" />
    </span>
  );
}
