import * as THREE from "three";
import type { AdventureAppearance, AdventurePosition, AdventureSettings } from "../lib/api";
import { makeAvatar, makeHands, makeNameTag } from "./avatar";

export type AdventureBook = {
  id: string;
  title: string;
  subtitle?: string;
  section?: string;
  subject?: string;
  icon?: string;
  color?: string;
  blurb?: string;
  progress?: number;
  topicCount?: number;
  chapterCount?: number;
};

export type AreaId = "courtyard" | "library" | "study" | "classroom";
export type PromptInfo = { label: string; key: string };
export type DialogueInfo = { name: string; role: string; lines: string[]; accent?: string };
export type PanelKey = "journal" | "satchel" | "map";

type Collider = { x1: number; x2: number; z1: number; z2: number };
type Interactable = { id: string; area: AreaId; x: number; z: number; radius: number; label: string; run: () => void; object?: THREE.Object3D };
type RoutePhase = "morning" | "afternoon" | "evening" | "night";

type NpcDef = {
  id: string;
  name: string;
  role: string;
  /** Shorter role for the floating tag; dialogue keeps the full title. */
  tagRole?: string;
  accent: string;
  robe: string;
  skin: string;
  hair: string;
  lines: string[];
  routes: Record<RoutePhase, [number, number][]>;
};

const TUTOR_ROBES: Record<string, string> = {
  auren: "#6c5ce7",
  lyra: "#2f8f83",
  cassian: "#3f6fb0",
  seraphina: "#b34b6b",
  orin: "#b5762f",
  thalia: "#7a4a9e",
  fen: "#4f7d3a",
  isolde: "#2f6f8f",
  bramble: "#8a5a2f",
  vesper: "#444a63",
};

const NPC_DEFS: NpcDef[] = [
  {
    id: "mira",
    name: "Mira Quill",
    role: "Head Librarian",
    accent: "#f0cf8d",
    robe: "#8a5a2f",
    skin: "#d19a73",
    hair: "#4a2f22",
    lines: [
      "The Grand Library is open. Books choose their readers here, so treat them kindly.",
      "Every volume keeps a record of what you have truly understood. Opening a cover is only the beginning.",
      "If a topic feels heavy, start with the chapter that frightens you least. That is usually the door.",
    ],
    routes: {
      morning: [[0, -26], [8, -12], [0, -2]],
      afternoon: [[0, -26], [-6, -8], [0, -2]],
      evening: [[0, -26], [0, -14]],
      night: [[0, -26], [0, -22]],
    },
  },
  {
    id: "orin",
    name: "Professor Orin Vane",
    role: "Professor of Mathematics",
    tagRole: "Mathematics",
    accent: "#bfe0ff",
    robe: "#3f6fb0",
    skin: "#b97a4f",
    hair: "#7a4a2c",
    lines: [
      "Numbers are not a wall to memorise. They are a language for describing patterns you can already see.",
      "When a problem defeats you, write down what you know and what you want. The gap between them is the method.",
      "The Chamber of Numbers is through the west hall. Bring a question, not an answer.",
    ],
    routes: {
      morning: [[-24, -6], [-14, 2], [-26, 8]],
      afternoon: [[-14, 2], [-24, -6], [-8, -6]],
      evening: [[-24, -6], [-14, 2]],
      night: [[-24, -6], [-26, -2]],
    },
  },
  {
    id: "sable",
    name: "Sable Fern",
    role: "Greenhouse Keeper",
    tagRole: "Greenhouse",
    accent: "#c7f0c0",
    robe: "#347a5c",
    skin: "#8d5a3b",
    hair: "#2a1c16",
    lines: [
      "Plants teach patience. You cannot hurry a seed, but you can keep showing up.",
      "The moonflowers only open at night. If you are awake, come and see them — quietly.",
      "Take a cutting if you like. Growing something is the best proof that you understood it.",
    ],
    routes: {
      morning: [[-24, 16], [-20, 8], [-26, 12]],
      afternoon: [[-20, 8], [-24, 16], [-16, 14]],
      evening: [[-24, 16], [-26, 12]],
      night: [[-24, 16], [-22, 14]],
    },
  },
  {
    id: "tamsin",
    name: "Tamsin Reed",
    role: "Third-year Student",
    tagRole: "Third-year",
    accent: "#ffd3e4",
    robe: "#9a4a63",
    skin: "#f4d3bd",
    hair: "#c9c9d6",
    lines: [
      "I keep a list of questions instead of a list of answers. It makes the library feel friendlier.",
      "The fountain is the best place to think. Something about the water makes a hard problem smaller.",
      "If you see the floating books, do not duck. They are only curious.",
    ],
    routes: {
      morning: [[6, 10], [14, 2], [2, 6]],
      afternoon: [[14, 2], [0, 8], [8, 14]],
      evening: [[0, 8], [6, 10]],
      night: [[0, 8], [4, 6]],
    },
  },
  {
    id: "caius",
    name: "Caius Bell",
    role: "Astral Researcher",
    tagRole: "Astral Studies",
    accent: "#d9d0ff",
    robe: "#5a3f8f",
    skin: "#e8b894",
    hair: "#2a1c16",
    lines: [
      "The tower is cold, but the sky makes up for it. I chart what moves and what refuses to.",
      "You can learn a great deal from a thing that does not behave as predicted. Especially then.",
      "At night the observatory answers questions the daylight cannot. Bring a coat.",
    ],
    routes: {
      morning: [[40, -14], [20, -20], [30, -6]],
      afternoon: [[20, -20], [40, -14], [14, -22]],
      evening: [[40, -14], [20, -20]],
      night: [[40, -14], [42, -18]],
    },
  },
  {
    id: "nell",
    name: "Nell Bright",
    role: "Provisioner",
    accent: "#ffe3ae",
    robe: "#a5652f",
    skin: "#f4d3bd",
    hair: "#b57b3d",
    lines: [
      "Ink, paper, warm socks, and a little courage. That is most of what an academy sells.",
      "I trade in useful things. A good question is worth more than a shiny trinket, but I will take both.",
      "The gate stays open until the bell. After that, only the stars get in.",
    ],
    routes: {
      morning: [[6, 32], [0, 24], [10, 22]],
      afternoon: [[10, 22], [-4, 30], [6, 32]],
      evening: [[6, 32], [0, 28]],
      night: [[6, 32], [4, 30]],
    },
  },
  {
    id: "alaric",
    name: "Brother Alaric",
    role: "Archivist",
    accent: "#f0e2c2",
    robe: "#6b5236",
    skin: "#b97a4f",
    hair: "#c9c9d6",
    lines: [
      "History is not a list of dates. It is a record of people deciding what mattered enough to keep.",
      "The archive remembers what the hall forgets. If you want to know why a thing is, start there.",
      "Bring me a question about the past and I will show you three ways it is still present.",
    ],
    routes: {
      morning: [[-10, -22], [0, -26], [-20, -10]],
      afternoon: [[0, -26], [-20, -10], [-10, -22]],
      evening: [[0, -26], [-14, -18]],
      night: [[0, -26], [-4, -24]],
    },
  },
];

const COURTYARD_SPAWN = { x: 0, z: 42, yaw: 0 };
const LIBRARY_BASE = 400;
const STUDY_BASE = 400;
const CLASSROOM_BASE = 800;

export const AREA_LABELS: Record<AreaId, string> = {
  courtyard: "Academy Courtyard",
  library: "Grand Library",
  study: "Your Quarters",
  classroom: "Chamber of Numbers",
};

/** A flat painted panel (chalkboard, sign) that stays legible in dim light. */
function paintedPanel(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = Math.round(1024 * (height / width));
  const ctx = canvas.getContext("2d")!;
  draw(ctx, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
}

const PHASES: { id: RoutePhase; from: number; to: number }[] = [
  { id: "morning", from: 5, to: 12 },
  { id: "afternoon", from: 12, to: 17 },
  { id: "evening", from: 17, to: 21 },
  { id: "night", from: 21, to: 5 },
];

function phaseFor(hour: number): RoutePhase {
  if (hour >= 21 || hour < 5) return "night";
  return PHASES.find((p) => hour >= p.from && hour < p.to)?.id || "afternoon";
}

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  appearance: AdventureAppearance;
  settings: AdventureSettings;
  books: AdventureBook[];
  tutor: { name: string; characterId: string };
  start: AdventurePosition | null;
  worldTime: number | null;
  onPrompt: (prompt: PromptInfo | null) => void;
  onDialogue: (dialogue: DialogueInfo) => void;
  onBook: (book: AdventureBook) => void;
  onAppearance: () => void;
  onPause: (paused: boolean) => void;
  onArea: (area: AreaId, label: string) => void;
  onTime: (minutes: number) => void;
  onCompanion: (line: string) => void;
  onKey: (panel: PanelKey) => void;
  onLesson: () => void;
  onToast: (message: string) => void;
  /** Opens the in-world tutor chat (the companion is the interactable). */
  onTutorChat: () => void;
  /** Tells the UI whether mouse look is captured or must be dragged. */
  onLook: (mode: "locked" | "drag") => void;
};

export class AcademyEngine {
  private opts: EngineOptions;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;

  private appearance: AdventureAppearance;
  private settings: AdventureSettings;
  private hands!: THREE.Group;

  private lights!: { hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight };
  private stars = new THREE.Group();
  private floaters: THREE.Object3D[] = [];
  private water?: THREE.Mesh;
  private sky!: THREE.Mesh;
  private cloudMat!: THREE.MeshBasicMaterial;
  private clouds: { pivot: THREE.Group; speed: number }[] = [];
  private fog = new THREE.Fog("#d7e6f0", 70, 300);
  private skyTopDay = new THREE.Color("#2f6cb8");
  private skyTopNight = new THREE.Color("#0a1028");
  private skyHorizonDay = new THREE.Color("#c9e1f1");
  private skyHorizonNight = new THREE.Color("#18213d");
  private skyTop = new THREE.Color();
  private skyHorizon = new THREE.Color();
  private cloudDay = new THREE.Color("#ffffff");
  private cloudNight = new THREE.Color("#2a3247");
  private scratchColor = new THREE.Color();

  private colliders: Record<AreaId, Collider[]> = { courtyard: [], library: [], study: [], classroom: [] };
  private interactables: Interactable[] = [];
  private area: AreaId = "courtyard";
  private worldMinutes: number;
  private timeStamp = 0;

  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private yVel = 0;
  private jumpY = 0;
  private onGround = true;
  private bob = 0;
  private keys = new Set<string>();
  private stick = { x: 0, y: 0 };
  private running = false;
  private locked = false;
  private overlayOpen = false;
  private nearest: Interactable | null = null;
  private nearestKey = "";
  private touchLook: { id: number; x: number; y: number } | null = null;
  private dragging = false;
  private dragPointerId: number | null = null;
  private dragLast = { x: 0, y: 0 };
  private dragDistance = 0;
  private pointerLockBlocked = false;
  private pauseOnUnlock = false;
  private lockTimer = 0;
  private coarsePointer = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

  private npcs: { def: NpcDef; group: THREE.Group; routePhase: RoutePhase; index: number; wait: number; label: THREE.Sprite }[] = [];
  private companion!: THREE.Group;
  private companionMode: "follow" | "wait" | "quiet" = "follow";
  private companionTarget = new THREE.Vector3();
  private lastCompanionLine = 0;
  private lastDestination = "";
  private ornaments: { mesh: THREE.Mesh; speed: number; baseY: number; phase: number }[] = [];

  private matCache = new Map<string, THREE.MeshStandardMaterial>();
  private onResize = () => this.resize();
  private onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);
  private onKeyUp = (event: KeyboardEvent) => this.handleKeyUp(event);
  private onMouseMove = (event: MouseEvent) => this.handleMouseMove(event);
  private onPointerLock = () => this.handlePointerLock();
  private onPointerLockError = () => this.enableDragLook();
  private onCanvasClick = () => this.handleCanvasClick();
  private onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
  private onPointerMove = (event: PointerEvent) => this.handlePointerDrag(event);
  private onPointerUp = (event: PointerEvent) => this.handlePointerUp(event);
  private onTouchStart = (event: TouchEvent) => this.handleTouchStart(event);
  private onTouchMove = (event: TouchEvent) => this.handleTouchMove(event);
  private onTouchEnd = (event: TouchEvent) => this.handleTouchEnd(event);

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.canvas = opts.canvas;
    this.appearance = opts.appearance;
    this.settings = opts.settings;
    this.worldMinutes = opts.worldTime && opts.worldTime > 0 ? opts.worldTime : 8 * 60;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: opts.settings.quality !== "low",
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPixelRatio()));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = opts.settings.quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 420);
    this.camera.rotation.order = "YXZ";

    this.buildLights();
    this.buildCourtyard();
    this.buildLibrary();
    this.buildStudy();
    this.buildClassroom();
    this.buildCompanion();
    this.buildNpcs();
    this.enableWorldShadows();
    this.buildSky();
    this.buildPlayer();
    this.attachEvents();

    const start = opts.start || { area: "courtyard", ...COURTYARD_SPAWN, pitch: 0 };
    this.teleport(start.area, start);
    this.opts.onArea(this.area, AREA_LABELS[this.area]);
    this.resize();
    this.loop();
  }

  /* ---------------------------------------------------------------- */
  /*  Public controls                                                  */
  /* ---------------------------------------------------------------- */

  setOverlay(open: boolean) {
    this.overlayOpen = open;
    if (open) {
      // Closing the overlay ourselves is not the player pressing Escape.
      this.pauseOnUnlock = false;
      window.clearTimeout(this.lockTimer);
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      this.keys.clear();
      this.stick = { x: 0, y: 0 };
    }
  }

  /** Touch screens cap the render scale lower: phones report 3x pixels for a screen this size. */
  private maxPixelRatio() {
    return this.coarsePointer ? 1.5 : 2;
  }

  /**
   * Ask for pointer lock. Must be called directly from a click handler so the
   * browser still sees a user gesture. Pointer lock is optional: when it is
   * denied (embedded hosts often deny it silently) drag-to-look takes over.
   */
  lock() {
    // Pointer lock does not exist for touch input; drag-to-look is already active.
    if (this.overlayOpen || this.pointerLockBlocked || this.coarsePointer) return;
    if (document.pointerLockElement === this.canvas) return;
    window.clearTimeout(this.lockTimer);
    try {
      const result = this.canvas.requestPointerLock?.() as unknown;
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch(() => this.enableDragLook());
      }
    } catch {
      this.enableDragLook();
    }
    // Some hosts neither resolve, reject nor fire pointerlockchange.
    this.lockTimer = window.setTimeout(() => {
      if (document.pointerLockElement !== this.canvas) this.enableDragLook();
    }, 900);
  }

  private enableDragLook() {
    if (this.pointerLockBlocked) return;
    this.pointerLockBlocked = true;
    this.locked = false;
    window.clearTimeout(this.lockTimer);
    this.opts.onLook("drag");
  }

  private handleCanvasClick() {
    if (this.coarsePointer) return;
    // A drag is a look gesture, not a request to capture the pointer.
    if (this.dragDistance > 6) {
      this.dragDistance = 0;
      return;
    }
    this.lock();
  }

  setSettings(settings: AdventureSettings) {
    this.settings = settings;
    this.renderer.setPixelRatio(settings.quality === "low" ? Math.min(window.devicePixelRatio || 1, 1) : Math.min(window.devicePixelRatio || 1, this.maxPixelRatio()));
    this.renderer.shadowMap.enabled = settings.quality !== "low";
    this.lights.sun.castShadow = settings.quality !== "low" && this.area === "courtyard";
  }

  applyAppearance(appearance: AdventureAppearance) {
    this.appearance = appearance;
    if (this.hands) {
      this.camera.remove(this.hands);
      this.disposeGroup(this.hands);
    }
    this.hands = makeHands(appearance);
    this.camera.add(this.hands);
  }

  setCompanionMode(mode: "follow" | "wait" | "quiet") {
    this.companionMode = mode;
    if (mode === "wait") {
      this.opts.onCompanion(`${this.opts.tutor.name} settles down to wait, watching the hall.`);
    } else if (mode === "quiet") {
      this.opts.onCompanion(`${this.opts.tutor.name} will stay close and keep quiet while you explore.`);
    } else {
      this.opts.onCompanion(`${this.opts.tutor.name} falls back in beside you.`);
    }
  }

  travel(area: AreaId) {
    this.teleport(area);
    this.opts.onArea(area, AREA_LABELS[area]);
    this.addDiscovery(`area:${area}`);
  }

  interact() {
    if (this.overlayOpen) return;
    this.nearest?.run();
  }

  jump() {
    if (this.overlayOpen || !this.onGround) return;
    this.yVel = 6.4;
    this.onGround = false;
  }

  snapshot(): { position: AdventurePosition; worldTime: number; discoveries: string[] } {
    return {
      position: { area: this.area, x: this.pos.x, z: this.pos.z, yaw: this.yaw, pitch: this.pitch },
      worldTime: Math.round(this.worldMinutes),
      discoveries: [...this.discoveries],
    };
  }

  getDiscoveries() {
    return [...this.discoveries];
  }

  private discoveries: string[] = [];

  addDiscovery(id: string) {
    if (this.discoveries.includes(id)) return;
    this.discoveries.push(id);
    this.opts.onToast("Discovery recorded in your journal.");
  }

  setStick(x: number, y: number) {
    this.stick.x = Math.max(-1, Math.min(1, x));
    this.stick.y = Math.max(-1, Math.min(1, y));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLock);
    document.removeEventListener("pointerlockerror", this.onPointerLockError);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    window.clearTimeout(this.lockTimer);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("click", this.onCanvasClick);
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.renderer.dispose();
  }

  /* ---------------------------------------------------------------- */
  /*  Setup helpers                                                    */
  /* ---------------------------------------------------------------- */

  private mat(color: string, options: { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number } = {}) {
    const key = `${color}|${options.roughness ?? ""}|${options.metalness ?? ""}|${options.emissive ?? ""}|${options.transparent ? options.opacity : ""}`;
    const cached = this.matCache.get(key);
    if (cached) return cached;
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.85,
      metalness: options.metalness ?? 0.04,
      emissive: options.emissive || "#000000",
      emissiveIntensity: options.emissiveIntensity ?? 0,
      ...(options.transparent === undefined ? {} : { transparent: options.transparent, opacity: options.opacity ?? 1 }),
    });
    this.matCache.set(key, material);
    return material;
  }

  private box(size: [number, number, number], position: [number, number, number], color: string, options?: Parameters<AcademyEngine["mat"]>[1]) {
    const geometry = new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(geometry, this.mat(color, options));
    mesh.position.set(...position);
    mesh.castShadow = !options?.transparent;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  private plane(size: [number, number], position: [number, number, number], color: string, rotation = -Math.PI / 2) {
    const geometry = new THREE.PlaneGeometry(...size);
    const mesh = new THREE.Mesh(geometry, this.mat(color, { roughness: 0.95 }));
    mesh.rotation.x = rotation;
    mesh.position.set(...position);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  /** Subtle procedural grain so large flat surfaces are not dead colour fields. */
  private surfaceTexture(base: string, speckle: string, repeat: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1500; i += 1) {
      ctx.globalAlpha = 0.04 + Math.random() * 0.16;
      ctx.fillStyle = Math.random() > 0.45 ? speckle : "#ffffff";
      const s = 1 + Math.random() * 3;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, s, s);
    }
    for (let i = 0; i < 4; i += 1) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      const gradient = ctx.createRadialGradient(x, y, 4, x, y, 42);
      gradient.addColorStop(0, speckle);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  private surface(size: [number, number], position: [number, number, number], base: string, joint: string, repeat: number) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(...size),
      new THREE.MeshStandardMaterial({ map: this.stoneTexture(base, joint, repeat), roughness: 0.96, metalness: 0 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(...position);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  /** Wooden floorboards for interiors. */
  private plankTexture(base: string, grain: string, repeat: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    const planks = 4;
    const width = 128 / planks;
    const color = new THREE.Color(base);
    for (let i = 0; i < planks; i += 1) {
      color.set(base).offsetHSL(0, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.06);
      ctx.fillStyle = `#${color.getHexString()}`;
      ctx.fillRect(i * width + 1, 0, width - 2, 128);
      ctx.strokeStyle = grain;
      ctx.globalAlpha = 0.35;
      for (let g = 0; g < 7; g += 1) {
        const y = Math.random() * 128;
        ctx.beginPath();
        ctx.moveTo(i * width + 3, y);
        ctx.bezierCurveTo(i * width + width * 0.3, y + 4, i * width + width * 0.7, y - 4, i * width + width - 3, y + 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = grain;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < planks; i += 1) ctx.fillRect(i * width, 0, 1.6, 128);
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  /** Patterned rug: border, inner line and a central diamond. */
  private rugTexture(base: string, border: string, accent: string, repeatY = 1) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = border;
    ctx.lineWidth = 20;
    ctx.strokeRect(10, 10, 236, 236);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.8;
    ctx.strokeRect(30, 30, 196, 196);
    ctx.globalAlpha = 1;
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.moveTo(128, 74);
    ctx.lineTo(182, 128);
    ctx.lineTo(128, 182);
    ctx.lineTo(74, 128);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(128, 102);
    ctx.lineTo(154, 128);
    ctx.lineTo(128, 154);
    ctx.lineTo(102, 128);
    ctx.closePath();
    ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, repeatY);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  /** Flagstones for paths and plazas, so paving reads as laid stone. */
  private stoneTexture(base: string, joint: string, repeat: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = joint;
    ctx.fillRect(0, 0, 128, 128);
    const tiles = 4;
    const size = 128 / tiles;
    const color = new THREE.Color(base);
    for (let row = 0; row < tiles; row += 1) {
      for (let col = 0; col < tiles; col += 1) {
        color.set(base).offsetHSL(0, (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.07);
        ctx.fillStyle = `#${color.getHexString()}`;
        ctx.fillRect(col * size + 0.9, row * size + 0.9, size - 1.8, size - 1.8);
      }
    }
    for (let i = 0; i < 900; i += 1) {
      ctx.globalAlpha = 0.03 + Math.random() * 0.08;
      ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : joint;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  /** Give every built mesh real shadow casting and receiving. */
  private enableWorldShadows() {
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      const glass = Array.isArray(material) ? material.some((entry) => entry.transparent) : Boolean(material?.transparent);
      mesh.castShadow = !glass;
      mesh.receiveShadow = true;
    });
  }

  private addCollider(area: AreaId, x: number, z: number, width: number, depth: number) {
    this.colliders[area].push({ x1: x - width / 2, x2: x + width / 2, z1: z - depth / 2, z2: z + depth / 2 });
  }

  private addInteractable(area: AreaId, x: number, z: number, radius: number, label: string, run: () => void, object?: THREE.Object3D) {
    this.interactables.push({ id: `${area}:${label}:${x.toFixed(1)}:${z.toFixed(1)}`, area, x, z, radius, label, run, object });
  }

  private buildLights() {
    const hemi = new THREE.HemisphereLight("#e6f2ff", "#6f6754", 0.78);
    this.scene.add(hemi);
    const ambient = new THREE.AmbientLight("#ffe6c8", 0.16);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight("#fff1d6", 2.35);
    sun.position.set(38, 62, 28);
    sun.castShadow = this.settings.quality !== "low";
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    const shadowCamera = sun.shadow.camera as THREE.OrthographicCamera;
    shadowCamera.left = -70;
    shadowCamera.right = 70;
    shadowCamera.top = 70;
    shadowCamera.bottom = -70;
    shadowCamera.near = 1;
    shadowCamera.far = 240;
    shadowCamera.updateProjectionMatrix();
    sun.target.position.set(0, 0, 0);
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.lights = { hemi, sun };

    for (let i = 0; i < 90; i += 1) {
      const star = new THREE.Mesh(new THREE.SphereGeometry(0.24, 4, 4), new THREE.MeshBasicMaterial({ color: "#fff6d8", transparent: true, opacity: 0.9 }));
      const angle = (i / 90) * Math.PI * 2;
      const radius = 130 + (i % 7) * 18;
      star.position.set(Math.cos(angle) * radius, 50 + (i % 13) * 12, Math.sin(angle) * radius);
      this.stars.add(star);
    }
    this.scene.add(this.stars);
  }

  /** Gradient sky dome, sun glow and drifting low-poly clouds. */
  private buildSky() {
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color("#4a83c4") },
        horizonColor: { value: new THREE.Color("#d7e7f2") },
        sunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3) },
        glow: { value: 1 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunDir;
        uniform float glow;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          float height = clamp(dir.y, 0.0, 1.0);
          vec3 color = mix(horizonColor, topColor, pow(height, 0.32));
          float sun = max(dot(dir, normalize(sunDir)), 0.0);
          color += vec3(1.0, 0.83, 0.55) * pow(sun, 220.0) * 1.15 * glow;
          color += vec3(1.0, 0.72, 0.45) * pow(sun, 10.0) * 0.10 * glow;
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), material);
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    this.sky = sky;
    this.scene.add(sky);
    this.scene.fog = this.fog;

    this.cloudMat = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false });
    const puffGeometry = new THREE.SphereGeometry(1, 10, 7);
    for (let i = 0; i < 9; i += 1) {
      const pivot = new THREE.Group();
      const cloud = new THREE.Group();
      const angle = (i / 9) * Math.PI * 2 + 0.4;
      const radius = 155 + (i % 3) * 18;
      cloud.position.set(Math.cos(angle) * radius, 58 + (i % 4) * 9, Math.sin(angle) * radius);
      const puffs = 4 + (i % 3);
      for (let p = 0; p < puffs; p += 1) {
        const puff = new THREE.Mesh(puffGeometry, this.cloudMat);
        puff.position.set((p - puffs / 2) * 7 + Math.random() * 3, Math.random() * 2, (Math.random() - 0.5) * 7);
        puff.scale.set(7 + Math.random() * 5, 2.4 + Math.random() * 1.6, 4 + Math.random() * 3);
        cloud.add(puff);
      }
      pivot.add(cloud);
      this.scene.add(pivot);
      this.clouds.push({ pivot, speed: 0.004 + (i % 4) * 0.0012 });
    }
  }

  private tree(x: number, z: number, size = 1, variant: "pine" | "leafy" = "pine") {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * size, 0.24 * size, 2.2 * size, 7), this.mat("#5a4030", { roughness: 0.95 }));
    trunk.position.set(x, 1.1 * size, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    this.scene.add(trunk);
    if (variant === "leafy") {
      const tones = ["#3f7a52", "#4a8760", "#356a49", "#568f63"];
      const clusters: [number, number, number, number][] = [
        [0, 3.2, 0, 1.55],
        [-0.9, 2.9, 0.4, 1.15],
        [0.9, 3, -0.3, 1.2],
        [0.2, 4.1, 0.2, 1.1],
        [-0.3, 2.5, -0.9, 1],
      ];
      clusters.forEach(([dx, dy, dz, scale], index) => {
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(scale * size, 12, 9), this.mat(tones[index % tones.length], { roughness: 0.9 }));
        canopy.position.set(x + dx * size, dy * size, z + dz * size);
        canopy.scale.set(1.1, 0.9, 1);
        canopy.castShadow = true;
        canopy.receiveShadow = true;
        this.scene.add(canopy);
      });
      return;
    }
    const colors = ["#2f6b4f", "#3b7d59", "#2a5c45"];
    for (let i = 0; i < 3; i += 1) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry((1.3 - i * 0.24) * size, 1.7 * size, 9), this.mat(colors[i % 3], { roughness: 0.9 }));
      cone.position.set(x, (2.2 + i * 0.72) * size, z);
      cone.rotation.y = i * 0.7;
      cone.castShadow = true;
      cone.receiveShadow = true;
      this.scene.add(cone);
    }
  }

  private shrub(x: number, z: number, size = 1) {
    const tones = ["#3e6d4c", "#4c7d57", "#356044"];
    for (let i = 0; i < 3; i += 1) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.55 * size, 10, 8), this.mat(tones[i % tones.length], { roughness: 0.95 }));
      blob.position.set(x + (i - 1) * 0.5 * size, 0.5 * size, z + ((i % 2) - 0.5) * 0.4 * size);
      blob.scale.y = 0.82;
      blob.castShadow = true;
      blob.receiveShadow = true;
      this.scene.add(blob);
    }
  }

  private lantern(x: number, z: number) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 3.1, 8), this.mat("#3c3550"));
    post.position.set(x, 1.55, z);
    this.scene.add(post);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), this.mat("#ffd79a", { emissive: "#ffbf5e", emissiveIntensity: 2.4 }));
    glow.position.set(x, 3.1, z);
    this.scene.add(glow);
    const light = new THREE.PointLight("#ffc879", 6, 13, 2);
    light.position.set(x, 3.05, z);
    this.scene.add(light);
  }

  private banner(x: number, y: number, z: number, color: string, width = 1.5, height = 4) {
    const b = this.box([width, height, 0.06], [x, y, z], color, { roughness: 0.9 });
    b.rotation.z = 0.015;
    this.box([width * 0.18, height * 0.7, 0.02], [x, y - 0.2, z + 0.05], "#f2e5bd", { roughness: 0.9 });
    // Hanging rail, so the cloth reads as mounted rather than floating.
    this.box([width * 1.16, 0.07, 0.1], [x, y + height / 2 + 0.03, z + 0.02], "#c9a86a", { metalness: 0.4, roughness: 0.5 });
    return b;
  }

  private buildCourtyard() {
    const groundMaterial = new THREE.MeshStandardMaterial({ map: this.surfaceTexture("#6d8858", "#5a7548", 140), roughness: 0.98, metalness: 0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Distant conifers and low hills close the horizon beyond the grounds.
    const distantTreeMat = this.mat("#4a6b55", { roughness: 1 });
    for (let i = 0; i < 46; i += 1) {
      const angle = (i / 46) * Math.PI * 2 + 0.05;
      const radius = 108 + (i % 6) * 8;
      const height = 5 + (i % 5) * 1.7;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5 + (i % 3) * 0.4, height, 7), distantTreeMat);
      cone.position.set(Math.cos(angle) * radius, height / 2 - 0.3, Math.sin(angle) * radius);
      cone.castShadow = false;
      cone.receiveShadow = false;
      this.scene.add(cone);
    }

    // A ring of low, fog-softened hills closes the horizon beyond the grounds.
    const hillMat = this.mat("#6f8b77", { roughness: 1 });
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2 + 0.18;
      const radius = 205 + (i % 4) * 24;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(34, 14, 9), hillMat);
      hill.position.set(Math.cos(angle) * radius, -9 - (i % 3) * 3, Math.sin(angle) * radius);
      hill.scale.set(1.7 + (i % 3) * 0.5, 0.5 + (i % 2) * 0.16, 1.15 + (i % 4) * 0.22);
      hill.castShadow = false;
      hill.receiveShadow = false;
      this.scene.add(hill);
    }

    this.surface([17, 76], [0, 0.011, 4], "#c2bdb0", "#a8a397", 14);
    this.surface([72, 13], [0, 0.012, 6], "#c2bdb0", "#a8a397", 12);
    this.surface([13, 32], [0, 0.013, -14], "#c7c2b5", "#aca79a", 8);
    const plazaMaterial = new THREE.MeshStandardMaterial({ map: this.stoneTexture("#c8c2b4", "#ada79a", 10), roughness: 0.93, metalness: 0 });
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 0.12, 48), plazaMaterial);
    plaza.position.set(0, 0.04, 4);
    plaza.receiveShadow = true;
    this.scene.add(plaza);
    const plazaRim = new THREE.Mesh(new THREE.TorusGeometry(14.9, 0.16, 8, 64), this.mat("#b7ae9d", { roughness: 0.85 }));
    plazaRim.rotation.x = Math.PI / 2;
    plazaRim.position.set(0, 0.1, 4);
    plazaRim.castShadow = true;
    plazaRim.receiveShadow = true;
    this.scene.add(plazaRim);

    // Fountain
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.9, 36), this.mat("#b9b2a3"));
    basin.position.set(0, 0.45, 4);
    this.scene.add(basin);
    this.water = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.18, 36), this.mat("#4aa8b8", { emissive: "#1f7d8c", emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.3 }));
    this.water.position.set(0, 0.9, 4);
    this.scene.add(this.water);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.2, 14), this.mat("#cdc5b4"));
    column.position.set(0, 2.1, 4);
    this.scene.add(column);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mat("#b9b2a3"));
    bowl.position.set(0, 3.3, 4);
    bowl.rotation.x = Math.PI;
    this.scene.add(bowl);
    this.addCollider("courtyard", 0, 4, 7, 7);

    // Floating books above the plaza
    const bookColors = ["#8a6cd6", "#2f6f8f", "#b34b6b", "#347a5c"];
    for (let i = 0; i < 7; i += 1) {
      const book = this.box([0.7, 0.12, 0.5], [0, 0, 0], bookColors[i % bookColors.length], { roughness: 0.65 });
      const pages = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.44), this.mat("#f6edd4", { roughness: 0.8, emissive: "#ffdfa0", emissiveIntensity: 0.22 }));
      pages.position.set(0, 0.065, 0);
      book.add(pages);
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.5), this.mat("#e4c884", { metalness: 0.35, roughness: 0.45 }));
      spine.position.set(-0.315, 0, 0);
      book.add(spine);
      book.userData.orbit = { radius: 4 + i * 0.55, height: 5.2 + (i % 3) * 1.2, speed: 0.14 + i * 0.02, offset: (i / 7) * Math.PI * 2 };
      this.floaters.push(book);
    }

    // Grand Library
    const lib = this.box([34, 15, 16], [0, 7.5, -38], "#cfc3da");
    lib.geometry = new THREE.BoxGeometry(34, 15, 16);
    this.addCollider("courtyard", 0, -38, 34, 16);
    this.box([37, 1, 18], [0, 15.4, -38], "#7d6a9c");
    const dome = new THREE.Mesh(new THREE.SphereGeometry(8.4, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), this.mat("#7f8fc0", { metalness: 0.2, roughness: 0.55 }));
    dome.position.set(0, 15.8, -38);
    this.scene.add(dome);
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.2, 10), this.mat("#d9c27a", { metalness: 0.6, roughness: 0.3 }));
    finial.position.set(0, 25.2, -38);
    this.scene.add(finial);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i += 1) {
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 9.2, 12), this.mat("#e4dccb"));
        column.position.set(side * (6 + i * 2.9), 5.2, -29.6);
        this.scene.add(column);
      }
    }
    this.box([8, 4.6, 0.5], [0, 2.3, -29.9], "#4a3527");
    this.box([9.6, 0.5, 2.6], [0, 4.8, -29.6], "#8f7ca8");
    this.box([12, 0.4, 2.8], [0, 0.2, -28.2], "#cfc7b8");
    this.addInteractable("courtyard", 0, -27.8, 3.4, "Enter the Grand Library", () => this.openArea("library"));
    this.box([3.6, 0.5, 0.1], [-7.5, 10.2, -30.2], "#d9c27a");
    this.banner(-10.5, 7.2, -29.7, "#5b4b9e", 1.4, 3.4);
    this.banner(10.5, 7.2, -29.7, "#2f6f8f", 1.4, 3.4);

    // Great Hall
    const hall = this.box([26, 10, 12], [-40, 5, -12], "#c8bda6");
    hall.geometry = new THREE.BoxGeometry(26, 10, 12);
    this.addCollider("courtyard", -40, -12, 26, 12);
    this.box([28, 1, 14], [-40, 10.4, -12], "#8d7b5f");
    this.box([5.2, 5, 0.4], [-36, 2.5, -6.1], "#4a3527");
    this.addInteractable("courtyard", -36, -5.4, 2.6, "Great Hall (sealed for now)", () => this.openDoorNotice());
    for (let i = 0; i < 3; i += 1) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 6.4, 10), this.mat("#e0d4bc"));
      column.position.set(-45 + i * 5, 3.2, -5.4);
      this.scene.add(column);
    }

    // Chamber of Numbers: the mathematics classroom west of the plaza.
    this.box([10, 7, 8], [-26, 3.5, 3], "#cbb69a");
    this.addCollider("courtyard", -26, 3, 10, 8);
    this.box([11, 0.7, 9], [-26, 7.35, 3], "#7d6a9c");
    this.box([0.25, 4.2, 2.8], [-20.95, 2.1, 3], "#3a2a1d");
    this.box([2.8, 0.28, 4.4], [-20.6, 4.6, 3], "#8d7b5f");
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 4.6, 10), this.mat("#e0d4bc"));
      pillar.position.set(-20.2, 2.3, 3 + side * 1.7);
      this.scene.add(pillar);
    }
    for (const z of [0.7, 5.3]) {
      this.box([0.12, 1.4, 1.05], [-20.93, 3.5, z], "#2f3350", { emissive: "#ffcf7a", emissiveIntensity: 0.9 });
    }
    const chamberSign = paintedPanel((ctx, w, h) => {
      ctx.fillStyle = "#241d36";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#d9c27a";
      ctx.lineWidth = 9;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = "#f6e6b8";
      ctx.font = "700 58px Segoe UI, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("CHAMBER OF NUMBERS", w / 2, h / 2 + 2);
    }, 5.2, 0.95);
    chamberSign.position.set(-20.86, 5.55, 3);
    chamberSign.rotation.y = Math.PI / 2;
    this.scene.add(chamberSign);
    this.addInteractable("courtyard", -20.3, 3, 2.2, "Enter the Chamber of Numbers", () => this.openArea("classroom"));

    // Dormitory / personal quarters
    const dorm = this.box([14, 9, 13], [34, 4.5, 18], "#b9a8c9");
    dorm.geometry = new THREE.BoxGeometry(14, 9, 13);
    this.addCollider("courtyard", 34, 18, 14, 13);
    this.box([16, 0.8, 15], [34, 9.2, 18], "#6f5a8c");
    this.box([0.4, 4.4, 3.4], [27, 2.2, 18], "#4a3527");
    this.addInteractable("courtyard", 26.5, 18, 2.8, "Enter your quarters and dressing room", () => this.openArea("study"));
    this.banner(30, 6.8, 11.4, "#5b4b9e", 1.3, 3.4);

    // Greenhouse
    const glass = this.mat("#bfe8dd", { transparent: true, opacity: 0.34, roughness: 0.1, metalness: 0.1 });
    const greenhouse = new THREE.Mesh(new THREE.BoxGeometry(13, 6.5, 10), glass);
    greenhouse.position.set(-32, 3.25, 18);
    this.scene.add(greenhouse);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(13.3, 0.22, 10.3), this.mat("#5c7d70"));
    frame.position.set(-32, 6.6, 18);
    this.scene.add(frame);
    for (const [dx, dz] of [[-6.2, -4.6], [6.2, -4.6], [-6.2, 4.6], [6.2, 4.6]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6.6, 0.2), this.mat("#5c7d70"));
      post.position.set(-32 + dx, 3.3, 18 + dz);
      this.scene.add(post);
    }
    this.addCollider("courtyard", -32, 18, 13, 10);
    for (let i = 0; i < 5; i += 1) {
      const planter = this.box([2.2, 0.7, 1.4], [-36 + i * 2, 0.35, 14.4], "#7a5034");
      planter.rotation.y = 0.1 * i;
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), this.mat(i % 2 ? "#d96c9a" : "#e8c95a"));
      bloom.position.set(-36 + i * 2, 1.15, 14.4);
      this.scene.add(bloom);
    }
    this.addInteractable("courtyard", -32, 23.4, 3, "Peer into the Enchanted Greenhouse", () =>
      this.opts.onDialogue({ name: "Enchanted Greenhouse", role: "Living Laboratory", accent: "#c7f0c0", lines: ["The glass is warm. Inside, moonflowers turn their heads toward you.", "Sable keeps this place alive even when no one is watching. A lesson in quiet consistency.", "The greenhouse will open fully in the next chapter of the academy."] }),
    );

    // Observatory tower
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.6, 21, 18), this.mat("#9d93b5"));
    tower.position.set(44, 10.5, -30);
    this.scene.add(tower);
    this.addCollider("courtyard", 44, -30, 10, 10);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(4.7, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mat("#6d7db0", { metalness: 0.35, roughness: 0.4 }));
    cap.position.set(44, 21, -30);
    this.scene.add(cap);
    this.box([2.4, 1.4, 0.2], [44, 11, -25.6], "#2f3350", { emissive: "#ffcf7a", emissiveIntensity: 1.2 });
    this.addInteractable("courtyard", 44, -24.5, 3, "Astral Observatory (opens at night)", () =>
      this.opts.onDialogue({ name: "Astral Observatory", role: "Celestial Studies", accent: "#d9d0ff", lines: ["The door is warm. Somewhere above, a brass telescope turns by itself.", "At night, Caius says, the sky answers questions the daylight cannot.", "The observatory interior is planned for the expansion phase."] }),
    );

    // Gate
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 8, 12), this.mat("#b9b0a2"));
      pillar.position.set(side * 7.5, 4, 56);
      this.scene.add(pillar);
      this.addCollider("courtyard", side * 7.5, 56, 2.6, 2.6);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), this.mat("#ffe1a6", { emissive: "#ffc06a", emissiveIntensity: 2 }));
      lamp.position.set(side * 7.5, 8.3, 56);
      this.scene.add(lamp);
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.6, 8, 30, Math.PI), this.mat("#b9b0a2"));
    arch.position.set(0, 8, 56);
    this.scene.add(arch);
    this.addInteractable("courtyard", 0, 55.4, 5, "Academy Gate (beyond the grounds)", () =>
      this.opts.onDialogue({ name: "Academy Gate", role: "The wider world", accent: "#ffe3ae", lines: ["Beyond the gate the path falls away into mist and pines.", "The grounds are your whole world for now. The forest will open when the academy is ready.", "Nell keeps the gate until the bell, then only the stars get in."] }),
    );

    // Trees, benches, lanterns
    const treeSpots: [number, number, number][] = [[-18, 34, 1], [18, 34, 1.1], [-14, -2, 0.9], [14, -2, 0.95], [-26, 38, 1.2], [26, 40, 1], [-42, 22, 1.1], [50, 8, 1.2], [38, 36, 0.9], [-46, 0, 1.05]];
    treeSpots.forEach(([x, z, s], index) => this.tree(x, z, s, index % 3 === 1 ? "leafy" : "pine"));
    for (const [x, z] of [[-8, 12], [8, 12], [-8, -4], [8, -4]]) this.lantern(x, z);
    for (const [x, z, s] of [[-23, 12, 1], [-35, 9, 1.2], [23, 27, 1.1], [43, 23, 1], [-16, 46, 1.2], [13, 47, 0.9], [-45, -8, 1.1], [49, -14, 1]] as [number, number, number][]) this.shrub(x, z, s);
    for (const [x, z, rot] of [[-6, 14, 0], [6, 14, 0], [-11, 4, Math.PI / 2], [11, 4, Math.PI / 2]] as [number, number, number][]) {
      const seat = this.box([2.2, 0.16, 0.7], [x, 0.55, z], "#8a6a4a");
      seat.rotation.y = rot;
      this.box([0.14, 0.55, 0.6], [x - 0.8, 0.28, z], "#6d523a").rotation.y = rot;
      this.box([0.14, 0.55, 0.6], [x + 0.8, 0.28, z], "#6d523a").rotation.y = rot;
    }

    // Statue of the founder
    const statueBase = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 1.2, 10), this.mat("#c9c2b2"));
    statueBase.position.set(-10, 0.6, -16);
    this.scene.add(statueBase);
    const statueBody = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 2.4, 10), this.mat("#8b8fa0", { metalness: 0.25, roughness: 0.5 }));
    statueBody.position.set(-10, 2.4, -16);
    this.scene.add(statueBody);
    const statueHead = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), this.mat("#8b8fa0", { metalness: 0.25, roughness: 0.5 }));
    statueHead.position.set(-10, 3.8, -16);
    this.scene.add(statueHead);
    this.addCollider("courtyard", -10, -16, 2.4, 2.4);
    this.addInteractable("courtyard", -10, -14.7, 2.4, "Read the founder's inscription", () =>
      this.opts.onDialogue({ name: "Inscription", role: "Beneath the founder's statue", accent: "#f0cf8d", lines: ["\"We built this academy not to store answers, but to keep better questions.\"", "The stone is worn smooth by a great many thoughtful hands.", "A small brass plate adds: \"Tuition is attention.\""] }),
    );
  }

  private buildLibrary() {
    const bx = LIBRARY_BASE;
    const libraryFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 26),
      new THREE.MeshStandardMaterial({ map: this.plankTexture("#7a573b", "#573a25", 10), roughness: 0.9, metalness: 0 }),
    );
    libraryFloor.rotation.x = -Math.PI / 2;
    libraryFloor.position.set(bx, 0.02, 0);
    libraryFloor.receiveShadow = true;
    this.scene.add(libraryFloor);
    this.box([30, 0.3, 26], [bx, 9, 0], "#6b5240", { emissive: "#241a12", emissiveIntensity: 1 });
    for (let i = 0; i < 5; i += 1) this.box([0.34, 0.26, 25.6], [bx - 12 + i * 6, 8.7, 0], "#4b3524");
    this.box([30, 0.24, 0.3], [bx, 8.45, -12.7], "#b08b5a");
    this.box([30, 0.24, 0.3], [bx, 8.45, 12.7], "#b08b5a");
    this.box([0.3, 0.24, 26], [bx - 14.7, 8.45, 0], "#b08b5a");
    this.box([0.3, 0.24, 26], [bx + 14.7, 8.45, 0], "#b08b5a");
    this.box([30, 10, 0.6], [bx, 5, -13], "#8a6a4a");
    this.box([0.6, 10, 26], [bx - 15, 5, 0], "#8a6a4a");
    this.box([0.6, 10, 26], [bx + 15, 5, 0], "#8a6a4a");
    this.box([15, 10, 0.6], [bx - 7.5, 5, 13], "#8a6a4a");
    this.box([15, 10, 0.6], [bx + 7.5, 5, 13], "#8a6a4a");
    this.addCollider("library", bx - 15.3, 0, 0.9, 26);
    this.addCollider("library", bx + 15.3, 0, 0.9, 26);
    this.addCollider("library", bx, -13.3, 30, 0.9);
    this.addCollider("library", bx - 11.25, 13.3, 7.5, 0.9);
    this.addCollider("library", bx + 11.25, 13.3, 7.5, 0.9);

    // Shelves and books
    const shelfColor = "#6d4b2f";
    const trim = "#c9a86a";
    const shelfPlan: { x: number; z: number; rot: number }[] = [];
    for (let i = 0; i < 6; i += 1) {
      shelfPlan.push({ x: bx - 13.9, z: -9 + i * 3.4, rot: Math.PI / 2 });
      shelfPlan.push({ x: bx + 13.9, z: -9 + i * 3.4, rot: -Math.PI / 2 });
    }
    for (let i = 0; i < 4; i += 1) shelfPlan.push({ x: bx - 9 + i * 6, z: -12.2, rot: 0 });
    for (const shelf of shelfPlan) {
      const unit = this.box([3, 7.4, 0.9], [shelf.x, 3.7, shelf.z], shelfColor);
      unit.rotation.y = shelf.rot;
      this.box([3.1, 0.12, 1], [shelf.x, 0.2, shelf.z], trim).rotation.y = shelf.rot;
      this.box([3.1, 0.12, 1], [shelf.x, 2.6, shelf.z], trim).rotation.y = shelf.rot;
      this.box([3.1, 0.12, 1], [shelf.x, 5, shelf.z], trim).rotation.y = shelf.rot;
      this.box([3.1, 0.12, 1], [shelf.x, 7.2, shelf.z], trim).rotation.y = shelf.rot;
    }

    // Reading tables and chandelier
    for (const [x, z] of [[bx - 5, 4], [bx + 5, 4], [bx, -4]]) {
      this.box([3.4, 0.22, 1.7], [x, 1.05, z], "#7a5533");
      for (const [dx, dz] of [[-1.3, -0.6], [1.3, -0.6], [-1.3, 0.6], [1.3, 0.6]]) this.box([0.16, 1, 0.16], [x + dx, 0.52, z + dz], "#5f4128");
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8), this.mat("#f1e5c1"));
      candle.position.set(x + 0.7, 1.32, z);
      this.scene.add(candle);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), this.mat("#ffd18a", { emissive: "#ffb347", emissiveIntensity: 3 }));
      flame.position.set(x + 0.7, 1.55, z);
      this.scene.add(flame);
      const light = new THREE.PointLight("#ffc778", 2.2, 8, 2);
      light.position.set(x + 0.7, 2, z);
      this.scene.add(light);
    }
    const chandelier = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 6, 24), this.mat("#c9a86a", { metalness: 0.7, roughness: 0.3 }));
    chandelier.rotation.x = Math.PI / 2;
    chandelier.position.set(bx, 7.2, 0);
    this.scene.add(chandelier);
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), this.mat("#f1e5c1"));
      candle.position.set(bx + Math.cos(angle) * 2.2, 7.45, Math.sin(angle) * 2.2);
      this.scene.add(candle);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), this.mat("#ffd18a", { emissive: "#ffb347", emissiveIntensity: 3 }));
      flame.position.set(bx + Math.cos(angle) * 2.2, 7.7, Math.sin(angle) * 2.2);
      this.scene.add(flame);
    }
    const ambient = new THREE.PointLight("#ffd7a1", 22, 34, 1.6);
    ambient.position.set(bx, 7.4, 0);
    this.scene.add(ambient);
    // Two warm fills lift the reading room and the ceiling out of black.
    for (const [lx, lz] of [[bx - 7, 6], [bx + 7, -6]] as [number, number][]) {
      this.box([1.1, 0.08, 1.1], [lx, 8.8, lz], "#ffe6b8", { emissive: "#ffcf82", emissiveIntensity: 1.6 });
      const fill = new THREE.PointLight("#ffd9a8", 16, 22, 1.5);
      fill.position.set(lx, 8.4, lz);
      this.scene.add(fill);
    }
    this.banner(bx - 13, 6.5, -12.4, "#5b4b9e", 1.6, 3.2);
    this.banner(bx + 13, 6.5, -12.4, "#2f6f8f", 1.6, 3.2);

    // Physical books, one per curriculum volume (first twelve)
    const books = this.opts.books.slice(0, 12);
    books.forEach((book, i) => {
      const row = i % 4;
      const col = Math.floor(i / 4);
      const x = bx - 8.1 + col * 3.3;
      const y = 1.35 + row * 1.42;
      const z = -11.65;
      const cover = this.box([0.42, 0.58, 0.16], [x, y, z], book.color || "#8a6cd6", { roughness: 0.6 });
      cover.rotation.z = 0.03 * (i % 2 ? 1 : -1);
      this.box([0.36, 0.04, 0.17], [x, y + 0.2, z + 0.01], "#f3e7c8");
      this.box([0.05, 0.42, 0.17], [x - 0.16, y, z + 0.01], "#f3e7c8");
      this.addInteractable("library", x, z + 1.3, 2.1, `Read "${book.title}"`, () => {
        this.setOverlay(true);
        this.addDiscovery(`book:${book.id}`);
        this.opts.onBook(book);
      }, cover);
    });

    this.addInteractable("library", bx, 12.1, 2.8, "Leave the Grand Library", () => this.openArea("courtyard", { x: 0, z: -26, yaw: Math.PI }));

    const bookCount = Math.max(0, books.length - 12);
    this.addInteractable("library", bx - 4, -11.2, 3, "Browse the reserve collection", () =>
      this.opts.onDialogue({
        name: "Reserve Collection",
        role: "Behind the reading room",
        accent: "#f0cf8d",
        lines: [
          "The reserve shelves hold more volumes than this room can display.",
          bookCount > 0 ? `${bookCount} further volumes are indexed in the Great Library.` : "Every current volume is on these shelves.",
          "Open the Great Library from the sidebar to browse the full catalogue.",
        ],
      }),
    );
  }

  private buildStudy() {
    const z0 = STUDY_BASE;
    const studyFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshStandardMaterial({ map: this.plankTexture("#74553c", "#513824", 5), roughness: 0.9, metalness: 0 }),
    );
    studyFloor.rotation.x = -Math.PI / 2;
    studyFloor.position.set(0, 0.02, z0);
    studyFloor.receiveShadow = true;
    this.scene.add(studyFloor);
    this.box([12, 0.3, 12], [0, 6, z0], "#745c49", { emissive: "#33241a", emissiveIntensity: 0.9 });
    this.box([12, 7, 0.5], [0, 3.5, z0 + 6], "#9b7a56");
    this.box([12, 7, 0.5], [0, 3.5, z0 - 6], "#9b7a56");
    this.box([0.5, 7, 12], [-6, 3.5, z0], "#9b7a56");
    this.box([0.5, 7, 12], [6, 3.5, z0], "#9b7a56");
    for (const bz of [z0 - 3.5, z0 + 1.5, z0 + 4.6]) this.box([11.7, 0.22, 0.28], [0, 5.76, bz], "#4b3524");
    this.box([11.7, 0.22, 0.24], [0, 5.66, z0 + 5.95], "#c9a86a");
    this.box([11.7, 0.22, 0.24], [0, 5.66, z0 - 5.95], "#c9a86a");
    this.box([0.24, 0.22, 11.7], [-5.95, 5.66, z0], "#c9a86a");
    this.box([0.24, 0.22, 11.7], [5.95, 5.66, z0], "#c9a86a");
    this.box([11.75, 0.26, 0.2], [0, 0.12, z0 + 5.78], "#6b4a35");
    this.box([11.75, 0.26, 0.2], [0, 0.12, z0 - 5.78], "#6b4a35");
    this.box([0.2, 0.26, 11.75], [-5.78, 0.12, z0], "#6b4a35");
    this.box([0.2, 0.26, 11.75], [5.78, 0.12, z0], "#6b4a35");
    this.addCollider("study", 0, z0 + 6.3, 12, 0.9);
    this.addCollider("study", 0, z0 - 6.3, 12, 0.9);
    this.addCollider("study", -6.3, z0, 0.9, 12);
    this.addCollider("study", 6.3, z0, 0.9, 12);

    // Enchanted mirror
    const frame = this.box([2.8, 4, 0.25], [0, 2.4, z0 - 5.7], "#c9a86a", { metalness: 0.55, roughness: 0.35 });
    frame.rotation.y = 0;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 3.5), this.mat("#9fd8e8", { metalness: 0.9, roughness: 0.08, emissive: "#2b6474", emissiveIntensity: 0.25 }));
    glass.position.set(0, 2.4, z0 - 5.55);
    this.scene.add(glass);
    this.addInteractable("study", 0, z0 - 4.6, 2.3, "Look into the enchanted mirror", () => {
      this.setOverlay(true);
      this.opts.onAppearance();
    });

    // Desk, journal, bed, window, rug
    this.box([3.6, 0.2, 1.8], [3.4, 1.05, z0 - 3.4], "#7a5533");
    for (const [dx, dz] of [[-1.4, -0.7], [1.4, -0.7], [-1.4, 0.7], [1.4, 0.7]]) this.box([0.14, 1, 0.14], [3.4 + dx, 0.52, z0 - 3.4 + dz], "#5f4128");
    this.box([0.7, 0.08, 0.5], [2.8, 1.2, z0 - 3.4], "#f1e5c1");
    this.box([0.62, 0.02, 0.44], [2.8, 1.25, z0 - 3.4], "#b34b6b");
    this.addInteractable("study", 2.8, z0 - 2.4, 1.9, "Open your adventure journal", () => {
      this.setOverlay(true);
      this.opts.onKey("journal");
    });
    // Bed: frame, full mattress, duvet, pillows and headboard.
    this.box([2.4, 0.5, 4.4], [-3.6, 0.45, z0 + 1.4], "#6f5a8c");
    this.box([2.25, 0.28, 4.15], [-3.6, 0.84, z0 + 1.4], "#e6dcf5");
    this.box([2.3, 0.16, 2.7], [-3.6, 1.0, z0 + 2.2], "#8b6bb3");
    this.box([0.95, 0.18, 0.52], [-4.1, 1.02, z0 - 0.55], "#f6f0ff");
    this.box([0.95, 0.18, 0.52], [-3.1, 1.02, z0 - 0.55], "#f6f0ff");
    this.box([2.65, 1.15, 0.18], [-3.6, 1.1, z0 - 0.82], "#5b4677");
    this.box([0.2, 1.4, 0.2], [-4.6, 0.7, z0 - 0.6], "#5f4128");

    // Window onto the grounds, replacing the panel that sat behind the mirror.
    const windowView = paintedPanel((ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#8fc4ea");
      sky.addColorStop(0.65, "#d8ebf6");
      sky.addColorStop(1, "#e9f2e6");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff4cf";
      ctx.beginPath();
      ctx.arc(w * 0.74, h * 0.26, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7fa07a";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.78);
      ctx.quadraticCurveTo(w * 0.3, h * 0.6, w * 0.55, h * 0.76);
      ctx.quadraticCurveTo(w * 0.8, h * 0.9, w, h * 0.72);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#5d7f5c";
      for (let i = 0; i < 4; i += 1) {
        const x = w * (0.15 + i * 0.23);
        ctx.beginPath();
        ctx.moveTo(x, h * 0.82);
        ctx.lineTo(x + 14, h * 0.62);
        ctx.lineTo(x + 28, h * 0.82);
        ctx.closePath();
        ctx.fill();
      }
    }, 3.35, 2.75);
    windowView.position.set(5.66, 3.55, z0 + 2.6);
    windowView.rotation.y = -Math.PI / 2;
    this.scene.add(windowView);
    this.box([0.14, 0.16, 3.7], [5.6, 4.98, z0 + 2.6], "#c9a86a");
    this.box([0.14, 0.16, 3.7], [5.6, 2.12, z0 + 2.6], "#c9a86a");
    this.box([0.14, 3.02, 0.16], [5.6, 3.55, z0 + 2.6 - 1.75], "#c9a86a");
    this.box([0.14, 3.02, 0.16], [5.6, 3.55, z0 + 2.6 + 1.75], "#c9a86a");
    this.box([0.08, 0.07, 3.35], [5.58, 3.55, z0 + 2.6], "#c9a86a");
    this.box([0.08, 2.75, 0.07], [5.58, 3.55, z0 + 2.6], "#c9a86a");
    for (const side of [-1, 1]) this.box([0.12, 5.0, 0.5], [5.52, 2.65, z0 + 2.6 + side * 2.05], "#6a4f86");
    this.box([0.18, 0.12, 4.6], [5.54, 5.16, z0 + 2.6], "#c9a86a");

    // Framed constellation print over the desk.
    const print = paintedPanel((ctx, w, h) => {
      ctx.fillStyle = "#1d2542";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f4e7c3";
      for (let i = 0; i < 34; i += 1) {
        ctx.globalAlpha = 0.45 + Math.random() * 0.55;
        ctx.beginPath();
        ctx.arc(12 + Math.random() * (w - 24), 12 + Math.random() * (h - 24), 1 + Math.random() * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#d9c27a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.22, h * 0.32);
      ctx.lineTo(w * 0.44, h * 0.55);
      ctx.lineTo(w * 0.36, h * 0.78);
      ctx.lineTo(w * 0.66, h * 0.68);
      ctx.lineTo(w * 0.78, h * 0.3);
      ctx.stroke();
      ctx.fillStyle = "#f3d99a";
      for (const [x, y] of [[0.22, 0.32], [0.44, 0.55], [0.36, 0.78], [0.66, 0.68], [0.78, 0.3]]) {
        ctx.beginPath();
        ctx.arc(w * x, h * y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 2.2, 1.5);
    print.position.set(5.72, 3.5, z0 - 3.4);
    print.rotation.y = -Math.PI / 2;
    this.scene.add(print);
    this.box([0.12, 0.12, 2.4], [5.68, 4.3, z0 - 3.4], "#c9a86a");
    this.box([0.12, 0.12, 2.4], [5.68, 2.7, z0 - 3.4], "#c9a86a");
    this.box([0.12, 1.7, 0.12], [5.68, 3.5, z0 - 3.4 - 1.14], "#c9a86a");
    this.box([0.12, 1.7, 0.12], [5.68, 3.5, z0 - 3.4 + 1.14], "#c9a86a");

    // A real door under the exit prompt, so leaving the quarters is legible.
    this.box([2.3, 3.8, 0.14], [0, 1.9, z0 + 5.72], "#5b4130");
    this.box([0.9, 1.05, 0.05], [0, 2.65, z0 + 5.65], "#4a3528");
    this.box([0.9, 1.05, 0.05], [0, 1.35, z0 + 5.65], "#4a3528");
    this.box([2.7, 0.18, 0.2], [0, 3.85, z0 + 5.7], "#c9a86a");
    this.box([0.18, 3.9, 0.2], [-1.2, 1.95, z0 + 5.7], "#c9a86a");
    this.box([0.18, 3.9, 0.2], [1.2, 1.95, z0 + 5.7], "#c9a86a");
    this.box([0.1, 0.1, 0.14], [0.85, 1.95, z0 + 5.64], "#d9c27a", { metalness: 0.6, roughness: 0.3 });
    for (const side of [-1, 1]) {
      this.box([0.26, 0.42, 0.12], [side * 2.15, 3.6, z0 + 5.7], "#c9a86a", { metalness: 0.4, roughness: 0.4 });
      const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), this.mat("#ffe6b8", { emissive: "#ffcf82", emissiveIntensity: 2.2 }));
      sconce.position.set(side * 2.15, 3.72, z0 + 5.62);
      this.scene.add(sconce);
    }
    const doorLight = new THREE.PointLight("#ffd9a8", 8, 11, 1.7);
    doorLight.position.set(0, 4.2, z0 + 4.6);
    this.scene.add(doorLight);

    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 4),
      new THREE.MeshStandardMaterial({ map: this.rugTexture("#7d5a8f", "#d9c27a", "#cbb8ea"), roughness: 0.95, metalness: 0 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.04, z0 + 1.5);
    rug.receiveShadow = true;
    this.scene.add(rug);

    // Pendant over the rug, plus the existing corner lamp.
    this.box([0.06, 0.6, 0.06], [0, 5.55, z0 + 1.5], "#3a2f27");
    this.box([0.46, 0.1, 0.46], [0, 5.2, z0 + 1.5], "#c9a86a", { metalness: 0.45, roughness: 0.4 });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), this.mat("#fff0cf", { emissive: "#ffcf82", emissiveIntensity: 2.2 }));
    globe.position.set(0, 5.0, z0 + 1.5);
    this.scene.add(globe);
    const pendantLight = new THREE.PointLight("#ffd9a8", 11, 17, 1.7);
    pendantLight.position.set(0, 4.85, z0 + 1.5);
    this.scene.add(pendantLight);
    const lamp = new THREE.PointLight("#ffd7a1", 12, 18, 1.6);
    lamp.position.set(0, 4.2, z0 - 2);
    this.scene.add(lamp);
    this.addInteractable("study", 0, z0 + 5.2, 2.4, "Leave your quarters", () => this.openArea("courtyard", { x: 26, z: 18, yaw: -Math.PI / 2 }));
  }

  private buildClassroom() {
    const bx = CLASSROOM_BASE;
    const classroomFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 15),
      new THREE.MeshStandardMaterial({ map: this.plankTexture("#7d5a3f", "#5a3f2a", 8), roughness: 0.9, metalness: 0 }),
    );
    classroomFloor.rotation.x = -Math.PI / 2;
    classroomFloor.position.set(bx, 0.02, 0);
    classroomFloor.receiveShadow = true;
    this.scene.add(classroomFloor);
    const runner = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 14),
      new THREE.MeshStandardMaterial({ color: "#6d3f3a", roughness: 0.95, metalness: 0 }),
    );
    runner.rotation.x = -Math.PI / 2;
    runner.position.set(bx, 0.035, 0);
    runner.receiveShadow = true;
    this.scene.add(runner);
    for (const side of [-1, 1]) this.box([0.12, 0.02, 13.8], [bx + side * 1.65, 0.045, 0], "#c9a86a");
    this.box([20, 0.3, 15], [bx, 6.5, 0], "#6a5342", { emissive: "#33241a", emissiveIntensity: 0.8 });
    this.box([20, 6.5, 0.5], [bx, 3.25, -7.5], "#96754f");
    this.box([20, 6.5, 0.5], [bx, 3.25, 7.5], "#96754f");
    this.box([0.5, 6.5, 15], [bx - 10, 3.25, 0], "#96754f");
    this.box([0.5, 6.5, 15], [bx + 10, 3.25, 0], "#96754f");
    for (const bz of [-6, 0, 6]) this.box([19.6, 0.22, 0.3], [bx, 6.22, bz], "#4b3524");
    this.box([19.6, 0.22, 0.24], [bx, 6.1, -7.25], "#c9a86a");
    this.box([19.6, 0.22, 0.24], [bx, 6.1, 7.25], "#c9a86a");
    this.box([0.24, 0.22, 14.6], [bx - 9.75, 6.1, 0], "#c9a86a");
    this.box([0.24, 0.22, 14.6], [bx + 9.75, 6.1, 0], "#c9a86a");
    this.box([19.6, 0.26, 0.2], [bx, 0.12, -7.25], "#5a3f2a");
    this.box([19.6, 0.26, 0.2], [bx, 0.12, 7.25], "#5a3f2a");
    this.box([0.2, 0.26, 14.6], [bx - 9.75, 0.12, 0], "#5a3f2a");
    this.box([0.2, 0.26, 14.6], [bx + 9.75, 0.12, 0], "#5a3f2a");
    this.addCollider("classroom", bx, -7.5, 20, 0.9);
    this.addCollider("classroom", bx, 7.5, 20, 0.9);
    this.addCollider("classroom", bx - 10, 0, 0.9, 15);
    this.addCollider("classroom", bx + 10, 0, 0.9, 15);

    // Door back to the courtyard
    this.box([2.7, 4.3, 0.16], [bx, 2.15, 7.2], "#4a3527");
    this.box([0.16, 0.5, 0.14], [bx + 1.05, 1.9, 7.1], "#d9c27a", { metalness: 0.6, roughness: 0.3 });
    this.box([3.2, 0.35, 0.4], [bx, 4.55, 7.2], "#c9a86a");
    this.addInteractable("classroom", bx, 6.8, 1.1, "Leave the Chamber of Numbers", () =>
      this.openArea("courtyard", { x: -19.6, z: 3, yaw: -Math.PI / 2 }),
    );

    // Chalkboard and its lesson board
    this.box([9.4, 3.6, 0.16], [bx, 3.3, -7.12], "#22392e");
    this.box([9.9, 0.22, 0.3], [bx, 5.2, -7.05], "#c9a86a");
    this.box([9.9, 0.16, 0.36], [bx, 1.42, -7.0], "#c9a86a");
    this.box([0.18, 3.6, 0.3], [bx - 4.85, 3.3, -7.02], "#c9a86a");
    this.box([0.18, 3.6, 0.3], [bx + 4.85, 3.3, -7.02], "#c9a86a");
    const chalkboard = paintedPanel((ctx, w, h) => {
      ctx.fillStyle = "#22392e";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#4d6a58";
      ctx.lineWidth = 6;
      ctx.strokeRect(14, 14, w - 28, h - 28);
      ctx.textAlign = "left";
      ctx.fillStyle = "#efe9d2";
      ctx.font = "600 62px Segoe UI, system-ui, sans-serif";
      ctx.fillText("a² + b² = c²", 70, 112);
      ctx.fillText("3x + 7 = 22", 70, 208);
      ctx.fillStyle = "#bfe0ff";
      ctx.fillText("x = 5", 500, 208);
      ctx.fillStyle = "#f0cf8d";
      ctx.font = "600 48px Segoe UI, system-ui, sans-serif";
      ctx.fillText("Pattern → Rule → Proof", 70, 306);
    }, 9, 3.375);
    chalkboard.position.set(bx, 3.3, -7.02);
    this.scene.add(chalkboard);
    this.addInteractable("classroom", bx, -6.1, 2.2, "Read the chalkboard", () => {
      this.setOverlay(true);
      this.opts.onDialogue({
        name: "The chalkboard",
        role: "Chamber of Numbers",
        accent: "#bfe0ff",
        lines: [
          "Three lines, written in three different hands: a rule, an equation, and a promise.",
          "Professor Vane leaves the middle of every proof blank so a student has somewhere to stand.",
          "Today's question: if 3x + 7 = 22, what did you do first — and why was that allowed?",
        ],
      });
    });

    // Desks and chairs, facing the board
    for (const dz of [-1.8, 0.6, 3]) {
      for (const dx of [-3.4, 3.4]) {
        this.box([2.1, 0.12, 0.95], [bx + dx, 1.0, dz], "#7a5533");
        for (const [ox, oz] of [[-0.9, -0.38], [0.9, -0.38], [-0.9, 0.38], [0.9, 0.38]] as [number, number][]) {
          this.box([0.1, 0.95, 0.1], [bx + dx + ox, 0.48, dz + oz], "#5f4128");
        }
        this.addCollider("classroom", bx + dx, dz, 2.1, 0.95);
        this.box([0.72, 0.1, 0.7], [bx + dx, 0.55, dz + 0.95], "#6d4b2f");
        this.box([0.72, 0.7, 0.1], [bx + dx, 0.9, dz + 1.3], "#6d4b2f");
        for (const ox of [-0.26, 0.26]) this.box([0.1, 0.5, 0.1], [bx + dx + ox, 0.28, dz + 0.95], "#5f4128");
      }
    }

    // Lectern with an open lesson book
    this.box([1.1, 1.05, 0.7], [bx, 0.52, -4.4], "#6d4b2f");
    const lecternTop = this.box([1.5, 0.1, 0.9], [bx, 1.08, -4.35], "#8a6a4a");
    lecternTop.rotation.x = -0.24;
    for (const side of [-1, 1]) {
      const page = this.box([0.62, 0.03, 0.44], [bx + side * 0.3, 1.3, -4.23], "#f2e7cd");
      page.rotation.x = -0.38;
      page.rotation.z = side * -0.12;
    }
    this.addCollider("classroom", bx, -4.4, 1.2, 0.8);
    const lecternGlow = new THREE.PointLight("#ffe2ae", 3.2, 5, 2);
    lecternGlow.position.set(bx, 1.9, -4.1);
    this.scene.add(lecternGlow);
    this.addInteractable("classroom", bx, -3.4, 2.2, "Open the lesson lectern", () => {
      this.setOverlay(true);
      this.opts.onLesson();
    });

    // Warm lamps
    for (const lz of [-3.2, 3.4]) {
      for (const lx of [-4.6, 4.6]) {
        this.box([1.5, 0.12, 1.5], [bx + lx, 6.3, lz], "#4b3524");
        this.box([1.2, 0.08, 1.2], [bx + lx, 6.23, lz], "#ffe6b8", { emissive: "#ffcf82", emissiveIntensity: 1.8 });
        const fill = new THREE.PointLight("#ffd9a8", lz < 0 ? 18 : 12, 20, 1.5);
        fill.position.set(bx + lx, 5.9, lz);
        this.scene.add(fill);
      }
    }
    for (const z of [-3.4, 3.4]) {
      this.box([0.12, 2.2, 1.3], [bx - 9.7, 3.7, z], "#2f3350", { emissive: "#ffcf7a", emissiveIntensity: 0.65 });
    }
    const centerLamp = new THREE.PointLight("#ffe0b0", 12, 18, 1.6);
    centerLamp.position.set(bx, 5.4, 2);
    this.scene.add(centerLamp);

    // Hanging solids above the lectern
    const shapes = [new THREE.IcosahedronGeometry(0.36, 0), new THREE.OctahedronGeometry(0.34, 0), new THREE.TorusKnotGeometry(0.24, 0.07, 48, 8)];
    const colors = ["#d9c27a", "#8fd6ff", "#c9a7ff"];
    shapes.forEach((geometry, i) => {
      const mesh = new THREE.Mesh(geometry, this.mat(colors[i], { metalness: 0.55, roughness: 0.3, emissive: colors[i], emissiveIntensity: 0.2 }));
      mesh.position.set(bx - 1.3 + i * 1.3, 4.5 + (i % 2) * 0.4, -3.7);
      this.scene.add(mesh);
      this.ornaments.push({ mesh, speed: 0.25 + i * 0.12, baseY: mesh.position.y, phase: i * 1.7 });
    });
  }

  private buildPlayer() {
    this.hands = makeHands(this.appearance);
    this.camera.add(this.hands);
    this.scene.add(this.camera);
    this.camera.position.set(0, 1.66, 0);
  }

  private buildCompanion() {
    const robe = TUTOR_ROBES[this.opts.tutor.characterId] || "#6c5ce7";
    const companionAppearance: AdventureAppearance = { ...this.appearance, hairColor: "#4a2f22", skin: "#e8b894", outfit: "robes", outfitColor: robe };
    this.companion = makeAvatar(companionAppearance, { scale: 1.04 });
    this.companion.position.set(1.4, 0, 44);
    const tag = makeNameTag(this.opts.tutor.name, "Your tutor", "#f0e2ff");
    tag.position.set(0, 2.35, 0);
    this.companion.add(tag);
    this.scene.add(this.companion);
    this.companionTarget.copy(this.companion.position);
  }

  private buildNpcs() {
    for (const def of NPC_DEFS) {
      const appearance: AdventureAppearance = {
        ...this.appearance,
        skin: def.skin,
        hairColor: def.hair,
        outfit: "robes",
        outfitColor: def.robe,
        accessory: "none",
        freckles: false,
      };
      const group = makeAvatar(appearance, { scale: 1 });
      const start = def.routes.afternoon[0];
      group.position.set(start[0], 0, start[1]);
      const label = makeNameTag(def.name, def.tagRole || def.role, def.accent);
      label.position.set(0, 2.4, 0);
      group.add(label);
      this.scene.add(group);
      this.npcs.push({ def, group, routePhase: "afternoon", index: 0, wait: 0, label });
      this.addInteractable("courtyard", start[0], start[1], 3.2, `Talk to ${def.name}`, () => {
        this.setOverlay(true);
        this.addDiscovery(`npc:${def.id}`);
        this.opts.onDialogue({ name: def.name, role: def.role, accent: def.accent, lines: def.lines });
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Movement, interaction                                            */
  /* ---------------------------------------------------------------- */

  private teleport(area: AreaId, start?: Partial<AdventurePosition>) {
    const spawn =
      area === "library"
        ? { x: LIBRARY_BASE, z: 9, yaw: 0 }
        : area === "study"
          ? { x: 0, z: STUDY_BASE - 3.4, yaw: 0 }
          : area === "classroom"
            ? { x: CLASSROOM_BASE, z: 5, yaw: 0 }
            : { ...COURTYARD_SPAWN };
    this.area = area;
    this.pos.set(start?.x ?? spawn.x, 0, start?.z ?? spawn.z);
    this.yaw = start?.yaw ?? spawn.yaw;
    this.pitch = start?.pitch ?? 0;
    this.resolveSpawn();
    this.vel.set(0, 0, 0);
    this.yVel = 0;
    this.jumpY = 0;
    this.nearest = null;
    this.nearestKey = "";
    this.opts.onPrompt(null);
    this.opts.onArea(area, AREA_LABELS[area]);
  }

  /**
   * Saved and door positions can land inside a wall's collision margin; the
   * old behaviour then rejected every step, which felt like frozen controls.
   * Move out to the nearest walkable point instead.
   */
  private resolveSpawn() {
    if (!this.blocked(this.pos.x, this.pos.z)) return;
    for (let radius = 0.7; radius <= 9; radius += 0.5) {
      for (let i = 0; i < 24; i += 1) {
        const angle = (i / 24) * Math.PI * 2;
        const x = this.pos.x + Math.cos(angle) * radius;
        const z = this.pos.z + Math.sin(angle) * radius;
        if (!this.blocked(x, z)) {
          this.pos.x = x;
          this.pos.z = z;
          return;
        }
      }
    }
    const fallback =
      this.area === "library"
        ? { x: LIBRARY_BASE, z: 9 }
        : this.area === "study"
          ? { x: 0, z: STUDY_BASE - 3.4 }
          : this.area === "classroom"
            ? { x: CLASSROOM_BASE, z: 5 }
            : { x: COURTYARD_SPAWN.x, z: COURTYARD_SPAWN.z };
    this.pos.x = fallback.x;
    this.pos.z = fallback.z;
  }

  private openArea(area: AreaId, start?: Partial<AdventurePosition>) {
    // Walking through a door keeps pointer lock, so the transition is seamless.
    this.teleport(area, start);
    this.addDiscovery(`area:${area}`);
  }

  private openDoorNotice() {
    this.setOverlay(true);
    this.opts.onDialogue({
      name: "Great Hall",
      role: "Sealed for the next chapter",
      accent: "#f0cf8d",
      lines: [
        "The great doors are bound with silver thread. A smaller notice reads: \"The Chamber of Numbers is open west of the plaza. This hall follows.\"",
        "Through the keyhole you can see long tables, floating chalk, and a staircase winding up into warm light.",
        "The Chamber of Numbers is open now. The rest of the classrooms arrive with the next wing.",
      ],
    });
  }

  private blocked(x: number, z: number) {
    const radius = 0.42;
    if (this.area === "courtyard") {
      if (Math.abs(x) > 70 || Math.abs(z) > 70) return true;
    } else if (this.area === "library") {
      if (x < LIBRARY_BASE - 14.6 || x > LIBRARY_BASE + 14.6 || z < -12.6 || z > 12.6) return true;
    } else if (this.area === "classroom") {
      if (x < CLASSROOM_BASE - 9.5 || x > CLASSROOM_BASE + 9.5 || z < -7.1 || z > 7.1) return true;
    } else {
      if (Math.abs(x) > 5.6 || z < STUDY_BASE - 5.6 || z > STUDY_BASE + 5.6) return true;
    }
    for (const c of this.colliders[this.area]) {
      if (x > c.x1 - radius && x < c.x2 + radius && z > c.z1 - radius && z < c.z2 + radius) return true;
    }
    return false;
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (this.overlayOpen) return;
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    this.keys.add(key);
    if (key === "e") this.interact();
    if (key === "c") {
      this.setCompanionMode(this.companionMode === "follow" ? "wait" : "follow");
    }
    if (key === "j") {
      this.setOverlay(true);
      this.opts.onKey("journal");
    }
    if (key === "i") {
      this.setOverlay(true);
      this.opts.onKey("satchel");
    }
    if (key === "m") {
      this.setOverlay(true);
      this.opts.onKey("map");
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    this.keys.delete(event.key.toLowerCase());
  }

  private handleMouseMove(event: MouseEvent) {
    if (!this.locked || this.overlayOpen) return;
    const sensitivity = 0.0021 * this.settings.sensitivity;
    this.yaw -= event.movementX * sensitivity;
    this.pitch -= event.movementY * sensitivity * (this.settings.invertY ? -1 : 1);
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  private handlePointerDown(event: PointerEvent) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if (this.overlayOpen || this.locked) return;
    this.dragging = true;
    this.dragPointerId = event.pointerId;
    this.dragLast = { x: event.clientX, y: event.clientY };
    this.dragDistance = 0;
    this.canvas.classList.add("is-looking");
  }

  private handlePointerDrag(event: PointerEvent) {
    if (!this.dragging || this.locked || this.overlayOpen) return;
    if (this.dragPointerId !== null && event.pointerId !== this.dragPointerId) return;
    const dx = event.clientX - this.dragLast.x;
    const dy = event.clientY - this.dragLast.y;
    this.dragLast = { x: event.clientX, y: event.clientY };
    this.dragDistance += Math.abs(dx) + Math.abs(dy);
    const sensitivity = 0.0034 * this.settings.sensitivity;
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity * (this.settings.invertY ? -1 : 1);
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  private handlePointerUp(event: PointerEvent) {
    if (this.dragPointerId !== null && event.pointerId !== this.dragPointerId) return;
    this.dragging = false;
    this.dragPointerId = null;
    this.canvas.classList.remove("is-looking");
  }

  private handlePointerLock() {
    if (document.pointerLockElement === this.canvas) {
      this.locked = true;
      this.pauseOnUnlock = true;
      window.clearTimeout(this.lockTimer);
      this.opts.onLook("locked");
      this.opts.onPause(false);
    } else {
      const wasLocked = this.pauseOnUnlock;
      this.locked = false;
      this.pauseOnUnlock = false;
      this.keys.clear();
      // A denied request also fires this event in some browsers. Only a real
      // Esc/unlock after a successful capture should pause the game.
      if (wasLocked && !this.overlayOpen && !this.disposed) this.opts.onPause(true);
    }
  }

  private handleTouchStart(event: TouchEvent) {
    // Keep the first look finger even if a second one lands on the canvas.
    if (this.overlayOpen || this.touchLook) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    this.touchLook = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
  }

  private handleTouchMove(event: TouchEvent) {
    if (this.overlayOpen || !this.touchLook) return;
    for (const touch of Array.from(event.changedTouches)) {
      if (touch.identifier !== this.touchLook.id) continue;
      const dx = touch.clientX - this.touchLook.x;
      const dy = touch.clientY - this.touchLook.y;
      this.touchLook.x = touch.clientX;
      this.touchLook.y = touch.clientY;
      const sensitivity = 0.004 * this.settings.sensitivity;
      this.yaw -= dx * sensitivity;
      this.pitch -= dy * sensitivity * (this.settings.invertY ? -1 : 1);
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
      event.preventDefault();
    }
  }

  private handleTouchEnd(event: TouchEvent) {
    if (!this.touchLook) return;
    const id = this.touchLook.id;
    for (const touch of Array.from(event.changedTouches)) {
      if (touch.identifier === id) this.touchLook = null;
    }
  }

  private attachEvents() {
    window.addEventListener("resize", this.onResize);
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLock);
    document.addEventListener("pointerlockerror", this.onPointerLockError);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("click", this.onCanvasClick);
    this.canvas.addEventListener("touchstart", this.onTouchStart, { passive: true });
    this.canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    this.canvas.addEventListener("touchend", this.onTouchEnd);
  }

  private resize() {
    const parent = this.canvas.parentElement;
    const width = parent?.clientWidth || window.innerWidth;
    const height = parent?.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  private update(dt: number) {
    this.worldMinutes += dt * 2;
    const hour = (this.worldMinutes / 60) % 24;
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    this.lights.hemi.intensity = 0.32 + daylight * 0.85;
    this.lights.sun.intensity = 0.12 + daylight * 2.15;
    this.lights.sun.color.set(hour < 8 || hour > 17 ? "#ffcb8a" : "#fff4dc");
    this.lights.sun.position.set(Math.cos(((hour - 6) / 12) * Math.PI) * 60, 14 + daylight * 48, 28);
    this.skyTop.copy(this.skyTopNight).lerp(this.skyTopDay, 0.12 + daylight * 0.88);
    this.skyHorizon.copy(this.skyHorizonNight).lerp(this.skyHorizonDay, 0.08 + daylight * 0.92);
    const skyUniforms = (this.sky.material as THREE.ShaderMaterial).uniforms;
    skyUniforms.topColor.value.copy(this.skyTop);
    skyUniforms.horizonColor.value.copy(this.skyHorizon);
    skyUniforms.sunDir.value.copy(this.lights.sun.position).normalize();
    skyUniforms.glow.value = 0.12 + daylight * 0.95;
    this.fog.color.copy(this.skyHorizon);
    this.scene.fog = this.fog;
    this.cloudMat.color.copy(this.scratchColor.copy(this.cloudNight).lerp(this.cloudDay, daylight));
    for (const cloud of this.clouds) cloud.pivot.rotation.y += cloud.speed * dt;
    this.stars.visible = daylight < 0.32;
    this.lights.sun.castShadow = this.settings.quality !== "low" && this.area === "courtyard";
    if (this.stars.visible) {
      this.stars.children.forEach((star, i) => {
        (star as THREE.Mesh).position.y = 48 + ((i * 7) % 90) + Math.sin(this.clock.elapsedTime * 0.12 + i) * 0.6;
      });
    }

    // Movement
    let forward = 0;
    let strafe = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) forward += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) forward -= 1;
    if (this.keys.has("d")) strafe += 1;
    if (this.keys.has("a")) strafe -= 1;
    const turn = (this.keys.has("arrowleft") ? 1 : 0) - (this.keys.has("arrowright") ? 1 : 0);
    if (turn) this.yaw += turn * 2.05 * this.settings.sensitivity * dt;
    forward -= this.stick.y;
    strafe += this.stick.x;
    const magnitude = Math.hypot(forward, strafe);
    if (magnitude > 1) {
      forward /= magnitude;
      strafe /= magnitude;
    }
    this.running = this.keys.has("shift");
    const speed = (this.running ? 7.6 : 4.3) * this.settings.speed * (this.area === "library" ? 0.92 : 1);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const targetX = (-sin * forward + cos * strafe) * speed;
    const targetZ = (-cos * forward - sin * strafe) * speed;
    const damp = 1 - Math.exp(-11 * dt);
    this.vel.x += (targetX - this.vel.x) * damp;
    this.vel.z += (targetZ - this.vel.z) * damp;

    // If a position is already inside a collision margin, let the player walk
    // out instead of freezing on every axis.
    const stuck = this.blocked(this.pos.x, this.pos.z);
    const nx = this.pos.x + this.vel.x * dt;
    if (stuck || !this.blocked(nx, this.pos.z)) this.pos.x = nx;
    else this.vel.x = 0;
    const nz = this.pos.z + this.vel.z * dt;
    if (stuck || !this.blocked(this.pos.x, nz)) this.pos.z = nz;
    else this.vel.z = 0;

    if (this.keys.has(" ") && this.onGround) {
      this.yVel = 6.4;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.yVel -= 19 * dt;
      this.jumpY += this.yVel * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.yVel = 0;
        this.onGround = true;
      }
    }

    const moving = Math.hypot(this.vel.x, this.vel.z) > 0.6;
    this.bob += moving ? dt * (this.running ? 11 : 7.5) : dt * 1.2;
    const bobY = this.settings.motionReduction || !moving ? 0 : Math.sin(this.bob) * 0.032;
    this.camera.position.set(this.pos.x, 1.66 + this.jumpY + bobY, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, this.settings.motionReduction ? 0 : Math.sin(this.bob * 0.5) * 0.004 * (moving ? 1 : 0), "YXZ");
    this.hands.position.set(
      this.settings.motionReduction ? 0 : Math.sin(this.bob * 0.5) * 0.012,
      (this.settings.motionReduction ? 0 : Math.abs(Math.cos(this.bob)) * 0.014) - this.jumpY * 0.1,
      0,
    );

    // Floating books
    for (const object of this.floaters) {
      const orbit = object.userData.orbit as { radius: number; height: number; speed: number; offset: number };
      const t = this.clock.elapsedTime * orbit.speed + orbit.offset;
      object.position.set(Math.cos(t) * orbit.radius, orbit.height + Math.sin(t * 1.7) * 0.35, 4 + Math.sin(t) * orbit.radius);
      object.rotation.set(Math.sin(t) * 0.3, t, Math.cos(t * 0.7) * 0.2);
    }
    if (this.water) {
      this.water.rotation.y += dt * 0.06;
      this.water.position.y = 0.9 + Math.sin(this.clock.elapsedTime * 1.8) * 0.008;
    }
    for (const o of this.ornaments) {
      o.mesh.rotation.y += dt * o.speed;
      o.mesh.rotation.x += dt * o.speed * 0.4;
      o.mesh.position.y = o.baseY + Math.sin(this.clock.elapsedTime * 0.9 + o.phase) * 0.12;
    }

    this.updateNpcs(dt, hour, daylight);
    this.updateCompanion(dt, hour);
    this.updateInteractable();

    const stamp = Math.floor(this.worldMinutes);
    if (stamp - this.timeStamp >= 1) {
      this.timeStamp = stamp;
      this.opts.onTime(stamp);
    }
  }

  private updateNpcs(dt: number, hour: number, daylight: number) {
    const phase = phaseFor(hour);
    const playerNear = (npc: { group: THREE.Group }) => npc.group.position.distanceTo(new THREE.Vector3(this.pos.x, 0, this.pos.z)) < 4.6;
    for (const npc of this.npcs) {
      const route = npc.def.routes[phase];
      if (npc.routePhase !== phase) {
        npc.routePhase = phase;
        npc.index = 0;
        npc.wait = 0.6;
      }
      const target = route[npc.index % route.length];
      const dx = target[0] - npc.group.position.x;
      const dz = target[1] - npc.group.position.z;
      const distance = Math.hypot(dx, dz);
      const facingPlayer = playerNear(npc);
      if (facingPlayer) {
        const angle = Math.atan2(this.pos.x - npc.group.position.x, this.pos.z - npc.group.position.z);
        npc.group.rotation.y = angle;
      } else if (distance > 0.4) {
        const step = Math.min(distance, dt * 1.15);
        npc.group.position.x += (dx / distance) * step;
        npc.group.position.z += (dz / distance) * step;
        const angle = Math.atan2(dx, dz);
        npc.group.rotation.y += Math.atan2(Math.sin(angle - npc.group.rotation.y), Math.cos(angle - npc.group.rotation.y)) * Math.min(1, dt * 4);
        npc.group.position.y = Math.abs(Math.sin(this.clock.elapsedTime * 5 + npc.index)) * 0.045;
      } else {
        npc.wait -= dt;
        if (npc.wait <= 0) {
          npc.index = (npc.index + 1) % route.length;
          npc.wait = 1.8 + (npc.def.id.length % 3) * 0.9;
        }
        npc.group.position.y = 0;
      }
      // Keep each NPC's interaction point on their body.
      const item = this.interactables.find((entry) => entry.id.startsWith(`courtyard:Talk to ${npc.def.name}`));
      if (item) {
        item.x = npc.group.position.x;
        item.z = npc.group.position.z;
      }
      npc.label.visible = daylight > 0.25 || npc.group.position.distanceTo(this.pos) < 12;
    }
  }

  private updateCompanion(dt: number, hour: number) {
    const player = new THREE.Vector3(this.pos.x, 0, this.pos.z);
    if (this.companionMode === "wait") {
      const angle = Math.atan2(this.pos.x - this.companion.position.x, this.pos.z - this.companion.position.z);
      this.companion.rotation.y += Math.atan2(Math.sin(angle - this.companion.rotation.y), Math.cos(angle - this.companion.rotation.y)) * Math.min(1, dt * 3);
    } else {
      // Behind and to the right of the player, so the tutor never blocks the view.
      const offsetX = Math.cos(this.yaw) * 1.35 + Math.sin(this.yaw) * 1.55;
      const offsetZ = -Math.sin(this.yaw) * 1.35 + Math.cos(this.yaw) * 1.55;
      this.companionTarget.set(this.pos.x + offsetX, 0, this.pos.z + offsetZ);
      const dx = this.companionTarget.x - this.companion.position.x;
      const dz = this.companionTarget.z - this.companion.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 16) {
        this.companion.position.set(this.companionTarget.x, 0, this.companionTarget.z);
      } else if (distance > 0.55) {
        const step = Math.min(distance, dt * (distance > 5 ? 7.2 : 4.6));
        this.companion.position.x += (dx / distance) * step;
        this.companion.position.z += (dz / distance) * step;
        const angle = Math.atan2(dx, dz);
        this.companion.rotation.y += Math.atan2(Math.sin(angle - this.companion.rotation.y), Math.cos(angle - this.companion.rotation.y)) * Math.min(1, dt * 5);
        this.companion.position.y = Math.abs(Math.sin(this.clock.elapsedTime * 6)) * 0.04;
      } else {
        const angle = Math.atan2(this.pos.x - this.companion.position.x, this.pos.z - this.companion.position.z);
        this.companion.rotation.y += Math.atan2(Math.sin(angle - this.companion.rotation.y), Math.cos(angle - this.companion.rotation.y)) * Math.min(1, dt * 4);
        this.companion.position.y = Math.sin(this.clock.elapsedTime * 1.4) * 0.012;
      }
      if (distance > 16 || player.distanceTo(this.companion.position) > 16) {
        this.companion.position.set(this.companionTarget.x, 0, this.companionTarget.z);
      }
    }

    if (this.companionMode !== "quiet" && this.clock.elapsedTime - this.lastCompanionLine > 55) {
      const hourLabel = hour < 6 ? "the small hours" : hour < 12 ? "the morning" : hour < 17 ? "the afternoon" : hour < 21 ? "the evening" : "night";
      const lines = this.area === "library"
        ? [
            "Take your time. A book is only useful if it changes how you think, not how fast you turn pages.",
            "If a passage resists you, say it aloud. Your own voice is a surprisingly good teacher.",
            "I am here if you want to test an idea against me.",
          ]
        : [
            `The academy is quiet in ${hourLabel}. It is a good time to notice things.`,
            "You do not have to study every minute. Being somewhere is part of learning it.",
            "The library is open whenever you want to follow a question.",
          ];
      const line = lines[Math.floor(this.clock.elapsedTime / 55) % lines.length];
      this.lastCompanionLine = this.clock.elapsedTime;
      this.opts.onCompanion(line);
    }
  }

  private updateInteractable() {
    let best: Interactable | null = null;
    let bestDistance = Infinity;
    for (const item of this.interactables) {
      if (item.area !== this.area) continue;
      const dx = item.x - this.pos.x;
      const dz = item.z - this.pos.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= item.radius && distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    // The companion moves, so it cannot be a static interactable. Treat it as
    // the nearest candidate whenever it is close enough to talk to.
    if (this.companion) {
      const dx = this.companion.position.x - this.pos.x;
      const dz = this.companion.position.z - this.pos.z;
      const companionDistance = Math.hypot(dx, dz);
      if (companionDistance <= 3.4 && companionDistance < bestDistance) {
        best = {
          id: "companion:talk",
          area: this.area,
          x: this.companion.position.x,
          z: this.companion.position.z,
          radius: 3.4,
          label: `Talk to ${this.opts.tutor.name}`,
          run: () => {
            this.setOverlay(true);
            this.opts.onTutorChat();
          },
        };
        bestDistance = companionDistance;
      }
    }
    this.nearest = best;
    const key = best?.id || "";
    if (key !== this.nearestKey) {
      this.nearestKey = key;
      this.opts.onPrompt(best ? { label: best.label, key: "E" } : null);
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.overlayOpen) this.update(dt);
    else {
      this.camera.position.set(this.pos.x, 1.66 + this.jumpY, this.pos.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    }
    this.renderer.render(this.scene, this.camera);
  };

  private disposeGroup(group: THREE.Object3D) {
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
  }
}
