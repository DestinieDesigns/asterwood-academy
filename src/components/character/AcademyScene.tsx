import React from "react";
import type { EnvironmentDef } from "../../lib/character";

/**
 * A layered, animated environment for the Celestial Academy.
 * Decorative only: it sits behind real content and never blocks interaction.
 */
export function AcademyScene({
  environment,
  children,
  className = "",
  tall = false,
  dim = false,
}: {
  environment?: EnvironmentDef | null;
  children?: React.ReactNode;
  className?: string;
  tall?: boolean;
  dim?: boolean;
}) {
  const colors = environment?.colors || { sky: "#1b1740", mid: "#3a2c78", glow: "#9f8bff", accent: "#ffd166", floor: "#241a45" };
  const id = environment?.id || "celestial_hall";

  const motif = () => {
    switch (id) {
      case "observatory":
        return (
          <g>
            <circle cx="640" cy="96" r="54" fill="none" stroke={colors.accent} strokeWidth="2" opacity=".6" />
            <circle cx="640" cy="96" r="34" fill="none" stroke={colors.accent} strokeWidth="1.2" opacity=".5" />
            <path d="M560 96 H720 M640 16 V176" stroke={colors.glow} strokeWidth=".8" opacity=".3" />
            <circle cx="700" cy="150" r="12" fill={colors.glow} opacity=".7" className="scene__float" />
            <ellipse cx="604" cy="128" rx="26" ry="7" fill="none" stroke={colors.accent} strokeWidth="1.4" opacity=".5" transform="rotate(-18 604 128)" />
            <path d="M150 300 L150 190 L176 190 L176 300" fill={colors.sky} opacity=".7" />
            <path d="M150 190 L162 150 L176 190" fill={colors.mid} opacity=".9" />
          </g>
        );
      case "botanical_lab":
        return (
          <g>
            {[0, 1, 2].map((i) => (
              <g key={i} opacity=".8">
                <path d={`M${90 + i * 34} 300 C${84 + i * 34} 254 ${104 + i * 34} 226 ${114 + i * 34} 200`} stroke={colors.glow} strokeWidth="2.4" fill="none" />
                <ellipse cx={104 + i * 34} cy="238" rx="15" ry="7" fill={colors.glow} opacity=".45" transform={`rotate(${-24 + i * 16} ${104 + i * 34} 238)`} />
                <ellipse cx={114 + i * 34} cy="212" rx="13" ry="6" fill={colors.accent} opacity=".4" transform={`rotate(${28 - i * 10} ${114 + i * 34} 212)`} />
                <path d={`M${74 + i * 32} 300 L${94 + i * 32} 300 L${88 + i * 32} 268 L${80 + i * 32} 268 Z`} fill={colors.floor} stroke={colors.glow} strokeWidth="1" opacity=".6" />
              </g>
            ))}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <circle key={`s${i}`} cx={300 + i * 58} cy={70 + (i % 3) * 34} r={2 + (i % 2)} fill={colors.accent} opacity=".55" className="scene__twinkle" style={{ animationDelay: `${i * 0.4}s` }} />
            ))}
            <path d="M520 300 C520 210 600 200 600 300" fill="none" stroke={colors.mid} strokeWidth="2" opacity=".6" />
          </g>
        );
      case "archive":
        return (
          <g>
            {[0, 1, 2, 3].map((i) => (
              <g key={i} opacity=".75">
                <rect x={70 + i * 42} y="120" width="34" height="180" fill={colors.mid} />
                {[0, 1, 2, 3, 4].map((j) => (
                  <rect key={j} x={74 + i * 42} y={132 + j * 28} width="26" height="20" fill={j % 2 ? colors.accent : colors.glow} opacity=".28" />
                ))}
              </g>
            ))}
            {[0, 1, 2].map((i) => (
              <g key={`c${i}`}>
                <rect x={560 + i * 48} y="110" width="26" height="34" rx="3" fill={colors.glow} opacity=".3" />
                <ellipse cx={573 + i * 48} cy="146" rx="26" ry="8" fill={colors.accent} opacity=".18" />
                <circle cx={573 + i * 48} cy="96" r="10" fill={colors.accent} opacity=".5" />
              </g>
            ))}
            <path d="M300 300 V130 M300 220 H250" stroke={colors.mid} strokeWidth="3" opacity=".5" />
          </g>
        );
      case "geometry_chamber":
        return (
          <g>
            <polygon points="640,120 690,196 590,196" fill="none" stroke={colors.glow} strokeWidth="2" opacity=".7" className="scene__float" />
            <circle cx="520" cy="120" r="34" fill="none" stroke={colors.accent} strokeWidth="1.6" opacity=".6" />
            <rect x="700" y="220" width="46" height="46" fill="none" stroke={colors.glow} strokeWidth="1.6" opacity=".55" className="scene__float" style={{ animationDelay: "1.2s" }} />
            <path d="M60 300 L60 180 L180 180 L180 300" fill="none" stroke={colors.mid} strokeWidth="2" opacity=".6" />
            <path d="M60 180 L120 120 L180 180" fill="none" stroke={colors.mid} strokeWidth="2" opacity=".5" />
            {[0, 1, 2, 3].map((i) => (
              <circle key={i} cx={380 + i * 40} cy={90 + (i % 2) * 24} r="2.4" fill={colors.accent} className="scene__twinkle" style={{ animationDelay: `${i * 0.5}s` }} />
            ))}
          </g>
        );
      case "enchanted_library":
        return (
          <g>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <g key={i}>
                <rect x={50 + i * 46} y="140" width="36" height="160" fill={colors.mid} opacity=".7" />
                {[0, 1, 2].map((j) => (
                  <rect key={j} x={54 + i * 46} y={152 + j * 42} width="28" height="34" fill={colors.glow} opacity={0.18 + (j % 2) * 0.1} />
                ))}
              </g>
            ))}
            {[0, 1, 2].map((i) => (
              <g key={`b${i}`} className="scene__float" style={{ animationDelay: `${i * 1.1}s` }}>
                <path d={`M${560 + i * 52} ${140 + i * 26} l26 -8 l26 8 l-26 8 Z`} fill={colors.accent} opacity=".55" />
                <path d={`M${560 + i * 52} ${140 + i * 26} l0 14 l26 8 l0 -14 Z`} fill={colors.glow} opacity=".22" />
              </g>
            ))}
            {[0, 1, 2, 3, 4].map((i) => (
              <circle key={i} cx={300 + i * 42} cy={70 + (i % 2) * 30} r="2" fill={colors.accent} className="scene__twinkle" style={{ animationDelay: `${i * 0.6}s` }} />
            ))}
          </g>
        );
      case "discovery_lab":
        return (
          <g>
            <path d="M560 300 L640 190 L720 300 Z" fill={colors.mid} opacity=".8" />
            <path d="M610 246 L640 190 L670 246 Z" fill={colors.accent} opacity=".4" />
            <ellipse cx="640" cy="196" rx="18" ry="6" fill={colors.glow} opacity=".3" className="scene__float" />
            <path d="M80 300 L80 210 L210 210 L210 300" fill={colors.floor} opacity=".7" stroke={colors.glow} strokeWidth="1" />
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={88} y={222 + i * 18} width="112" height="13" fill={i % 2 ? colors.accent : colors.glow} opacity=".25" />
            ))}
            {[0, 1, 2].map((i) => (
              <path key={i} d={`M${300 + i * 44} 300 l8 -22 l8 22 Z`} fill={colors.glow} opacity=".4" />
            ))}
          </g>
        );
      case "illuminated_study":
        return (
          <g>
            <rect x="540" y="70" width="150" height="150" rx="8" fill={colors.glow} opacity=".16" />
            <path d="M540 145 H690 M615 70 V220" stroke={colors.accent} strokeWidth="2" opacity=".35" />
            <ellipse cx="615" cy="240" rx="90" ry="16" fill={colors.accent} opacity=".16" />
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect x={100 + i * 46} y="230" width="34" height="70" rx="4" fill={colors.mid} opacity=".8" />
                <path d={`M${104 + i * 46} 240 q13 -8 26 0`} stroke={colors.accent} strokeWidth="1.4" fill="none" opacity=".6" />
              </g>
            ))}
            {[0, 1, 2, 3].map((i) => (
              <circle key={i} cx={330 + i * 40} cy={78 + (i % 2) * 26} r="2.2" fill={colors.accent} opacity=".5" className="scene__twinkle" style={{ animationDelay: `${i * 0.7}s` }} />
            ))}
          </g>
        );
      default:
        return (
          <g>
            {[0, 1, 2].map((i) => (
              <g key={i} opacity=".7">
                <path d={`M${80 + i * 240} 300 L${80 + i * 240} 150 A60 60 0 0 1 ${200 + i * 240} 150 L${200 + i * 240} 300`} fill="none" stroke={colors.mid} strokeWidth="14" />
                <path d={`M${110 + i * 240} 300 L${110 + i * 240} 156 A30 30 0 0 1 ${170 + i * 240} 156 L${170 + i * 240} 300`} fill={colors.glow} opacity=".12" />
              </g>
            ))}
            <path d="M0 300 H800 V220 Q400 190 0 220 Z" fill={colors.floor} opacity=".55" />
            <path d="M300 60 L300 120" stroke={colors.accent} strokeWidth="1.2" opacity=".4" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <circle key={i} cx={90 + i * 120} cy={50 + (i % 3) * 30} r="2.4" fill={colors.accent} className="scene__twinkle" style={{ animationDelay: `${i * 0.5}s` }} />
            ))}
          </g>
        );
    }
  };

  return (
    <div
      className={`scene ${tall ? "scene--tall" : ""} ${dim ? "scene--dim" : ""} ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 50% 0%, ${colors.mid} 0%, ${colors.sky} 62%, ${colors.floor} 100%)`,
      }}
    >
      <svg className="scene__art" viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        {motif()}
        <rect x="0" y="0" width="800" height="300" fill="url(#sceneVignette)" opacity=".0" />
      </svg>
      <div className="scene__content">{children}</div>
    </div>
  );
}
