import React, { useEffect } from "react";

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

const ICONS: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9h5v-5h3v5h5v-9",
  chat: "M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 13 4a8 8 0 0 1 8 8Z",
  compass: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm4-14-2.5 6.5L7 17l2.5-6.5L16 8Z",
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13ZM8 3v18",
  sparkles: "m12 3 2.2 5.5L20 11l-5.8 2.5L12 19l-2.2-5.5L4 11l5.8-2.5L12 3ZM19 17l.9 2.1L22 20l-2.1.9L19 23l-.9-2.1L16 20l2.1-.9L19 17Z",
  library: "M4 4h5v16H4V4Zm7 0h5v16h-5V4Zm8.2.6 4.2 15.5-4.8 1.3L14.4 5.9l4.8-1.3Z",
  chart: "M4 20V10m5 10V4m5 16v-7m5 7V7",
  clipboard: "M9 4h6v3H9V4Zm-3 2H5v15h14V6h-1M8 12h8M8 16h5",
  calendar: "M4 6h16v15H4V6Zm0 5h16M8 3v4m8-4v4",
  user: "M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm-8 9a8 8 0 0 1 16 0",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5a8 8 0 0 0-.2-1.8l2-1.6-2-3.4-2.4 1a8 8 0 0 0-3-1.7L14 2h-4l-.4 2.5a8 8 0 0 0-3 1.7l-2.4-1-2 3.4 2 1.6a8 8 0 0 0 0 3.6l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 3 1.7L10 22h4l.4-2.5a8 8 0 0 0 3-1.7l2.4 1 2-3.4-2-1.6c.13-.6.2-1.2.2-1.8Z",
  family: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 21a6 6 0 0 1 12 0M13 21a6 6 0 0 1 8-5.6",
  play: "M8 5v14l11-7L8 5Z",
  plus: "M12 5v14M5 12h14",
  send: "m4 12 16-8-6 16-3-6-7-2Z",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm-6-3a6 6 0 0 0 12 0M12 18v3",
  speaker: "M11 5 6 9H3v6h3l5 4V5Zm4 3a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14",
  check: "m5 13 4 4L19 7",
  x: "m6 6 12 12M18 6 6 18",
  arrow: "m9 6 6 6-6 6",
  back: "m15 6-6 6 6 6",
  trash: "M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13",
  edit: "M4 20h4L20 8l-4-4L4 16v4Z",
  star: "m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 21l1.1-6.5L2.6 9.8l6.5-.9L12 3Z",
  flame: "M12 22c4 0 6-2.7 6-6 0-4.5-4-6-4-10 0 0-4 2-4 6 0-1-1-2-1-2s-3 2.5-3 6c0 3.3 2 6 6 6Z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v6l4 2",
  upload: "M12 16V4m-5 5 5-5 5 5M4 20h16",
  download: "M12 4v12m-5-5 5 5 5-5M4 20h16",
  folder: "M3 6h6l2 3h10v11H3V6Z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.5-4.5",
  bulb: "M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 2h5.2c0-.8.3-1.5.9-2A6 6 0 0 0 12 3Z",
  lock: "M5 11h14v10H5V11Zm3 0V7a4 4 0 0 1 8 0v4",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-9-10h18M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20",
  cards: "M6 4h12v14H6V4Zm-3 4v13h12",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-5a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
};

export function Icon({ name, size = 20, strokeWidth = 1.9, className }: { name: keyof typeof ICONS | string; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name] || ICONS.sparkles} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Buttons, cards, fields                                             */
/* ------------------------------------------------------------------ */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "soft";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: string;
  block?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, icon, block, children, className = "", disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant} btn--${size} ${block ? "btn--block" : ""} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="spinner spinner--sm" aria-hidden="true" /> : icon ? <Icon name={icon} size={size === "sm" ? 16 : 18} /> : null}
      {children}
    </button>
  );
}

export function Card({
  children,
  title,
  subtitle,
  action,
  className = "",
  id,
}: {
  children?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`card ${className}`} id={id}>
      {title || action ? (
        <header className="card__head">
          <div>
            {title ? <h2 className="card__title">{title}</h2> : null}
            {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
          </div>
          {action ? <div className="card__action">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <label className="field" htmlFor={htmlFor}>
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export function Chip({
  children,
  active,
  onClick,
  tone,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  tone?: "default" | "good" | "violet";
  title?: string;
}) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      className={`chip ${active ? "chip--active" : ""} ${tone ? `chip--${tone}` : ""}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </Comp>
  );
}

export function ProgressRing({ value, size = 92, label, sublabel }: { value: number; size?: number; label?: string; sublabel?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = size / 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--line-2)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b6cf6" />
            <stop offset="100%" stopColor="#35c4c1" />
          </linearGradient>
        </defs>
      </svg>
      <div className="ring__label">
        <strong>{label ?? `${Math.round(clamped)}%`}</strong>
        {sublabel ? <span>{sublabel}</span> : null}
      </div>
    </div>
  );
}

export function Bar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <div className="bar" style={{ height }}>
      <div className="bar__fill" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color || "linear-gradient(90deg, var(--violet), var(--teal))" }} />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? "modal--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog"><Icon name="x" /></button>
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function EmptyState({ icon = "sparkles", title, text, action }: { icon?: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon"><Icon name={icon} size={26} /></div>
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

export function Stat({ label, value, icon, note }: { label: string; value: React.ReactNode; icon?: string; note?: string }) {
  return (
    <div className="stat">
      {icon ? <span className="stat__icon"><Icon name={icon} size={18} /></span> : null}
      <div>
        <div className="stat__value">{value}</div>
        <div className="stat__label">{label}</div>
        {note ? <div className="stat__note">{note}</div> : null}
      </div>
    </div>
  );
}

export function Badge({ children, tone = "violet" }: { children: React.ReactNode; tone?: "violet" | "teal" | "amber" | "pink" | "muted" }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/*  Lightweight rich text                                              */
/* ------------------------------------------------------------------ */

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) parts.push(<strong key={`${keyPrefix}-b-${i}`}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) parts.push(<code key={`${keyPrefix}-c-${i}`}>{token.slice(1, -1)}</code>);
    else parts.push(<em key={`${keyPrefix}-i-${i}`}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const lines = String(text || "").split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let ordered: string[] = [];

  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="rich__list">
          {list.map((item, i) => <li key={i}>{inline(item, `li-${blocks.length}-${i}`)}</li>)}
        </ul>,
      );
      list = [];
    }
    if (ordered.length) {
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="rich__list rich__list--num">
          {ordered.map((item, i) => <li key={i}>{inline(item, `oli-${blocks.length}-${i}`)}</li>)}
        </ol>,
      );
      ordered = [];
    }
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); return; }
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (bullet) {
      if (ordered.length) { flushList(); }
      list.push(bullet[1]);
      return;
    }
    if (numbered) {
      if (list.length) { flushList(); }
      ordered.push(numbered[1]);
      return;
    }
    flushList();
    if (heading) {
      const level = Math.min(2, heading[1].length);
      const Tag: any = level === 1 ? "h3" : "h4";
      blocks.push(<Tag key={`h-${index}`} className="rich__heading">{inline(heading[2], `h-${index}`)}</Tag>);
      return;
    }
    blocks.push(<p key={`p-${index}`} className="rich__p">{inline(line, `p-${index}`)}</p>);
  });
  flushList();
  return <div className={`rich ${className}`}>{blocks}</div>;
}
