import * as THREE from "three";
import type { AdventureAppearance } from "../lib/api";

export const SKIN_TONES = ["#f4d3bd", "#e8b894", "#d19a73", "#b97a4f", "#8d5a3b", "#5f3d2b"];
export const HAIR_COLORS = ["#2a1c16", "#4a2f22", "#7a4a2c", "#b57b3d", "#d9b46a", "#8b3a4a", "#5a3f8f", "#c9c9d6"];
export const OUTFIT_COLORS = ["#5b4b9e", "#2f6f8f", "#347a5c", "#9a4a63", "#8a5a2f", "#444a63"];
export const HAIR_STYLES: { id: AdventureAppearance["hairStyle"]; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "bob", label: "Bob" },
  { id: "braids", label: "Braids" },
  { id: "curly", label: "Curly" },
  { id: "long", label: "Long" },
  { id: "bun", label: "Bun" },
];
export const OUTFITS: { id: AdventureAppearance["outfit"]; label: string }[] = [
  { id: "uniform", label: "Academy uniform" },
  { id: "robes", label: "Scholar's robes" },
  { id: "casual", label: "Casual clothes" },
];
export const ACCESSORIES: { id: AdventureAppearance["accessory"]; label: string }[] = [
  { id: "none", label: "None" },
  { id: "glasses", label: "Glasses" },
  { id: "circlet", label: "Circlet" },
  { id: "scarf", label: "Scarf" },
];

export const DEFAULT_APPEARANCE: AdventureAppearance = {
  name: "",
  skin: SKIN_TONES[1],
  hairStyle: "short",
  hairColor: HAIR_COLORS[0],
  outfit: "uniform",
  outfitColor: OUTFIT_COLORS[0],
  accessory: "none",
  freckles: false,
};

function material(color: string, options: { roughness?: number; metalness?: number } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0.03,
  });
}

function shade(hex: string, amount: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(amount);
  return `#${c.getHexString()}`;
}

function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(x, y, z);
  return m;
}

/** Build a stylized humanoid, feet at y = 0, facing +Z. */
export function makeAvatar(appearance: AdventureAppearance, opts: { scale?: number; npc?: { robe?: string; skin?: string; hair?: string } } = {}) {
  const group = new THREE.Group();
  const skin = opts.npc?.skin || appearance.skin;
  const hairColor = opts.npc?.hair || appearance.hairColor;
  const outfitColor = opts.npc?.robe || appearance.outfitColor;
  const skinMat = material(skin, { roughness: 0.9 });
  const hairMat = material(hairColor, { roughness: 0.95 });
  const outfitMat = material(outfitColor);
  const trimMat = material(shade(outfitColor, 1.45));
  const trouserMat = material("#333247");
  const shoeMat = material("#262337", { roughness: 0.6 });
  const whiteMat = material("#f6f2ea");
  const eyeWhite = material("#ffffff", { roughness: 0.35 });
  const pupil = material("#241f35", { roughness: 0.4 });
  const mouthMat = material("#9a5a58");

  // Legs and shoes
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.BoxGeometry(0.155, 0.72, 0.18), trouserMat, side * 0.115, 0.48, 0));
    group.add(mesh(new THREE.BoxGeometry(0.17, 0.12, 0.3), shoeMat, side * 0.115, 0.08, 0.05));
  }

  if (appearance.outfit === "robes") {
    const robe = mesh(new THREE.CylinderGeometry(0.24, 0.43, 1.15, 16), outfitMat, 0, 0.805, 0);
    group.add(robe);
    group.add(mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.05, 16), trimMat, 0, 1.355, 0));
    group.add(mesh(new THREE.BoxGeometry(0.07, 0.5, 0.03), trimMat, 0, 1.05, 0.3));
  } else if (appearance.outfit === "casual") {
    group.add(mesh(new THREE.BoxGeometry(0.46, 0.6, 0.27), outfitMat, 0, 1.12, 0));
    group.add(mesh(new THREE.BoxGeometry(0.2, 0.26, 0.02), trimMat, 0, 1.16, 0.145));
    group.add(mesh(new THREE.BoxGeometry(0.48, 0.08, 0.29), trimMat, 0, 0.84, 0));
  } else {
    group.add(mesh(new THREE.BoxGeometry(0.48, 0.62, 0.28), outfitMat, 0, 1.14, 0));
    group.add(mesh(new THREE.BoxGeometry(0.2, 0.1, 0.02), whiteMat, 0, 1.36, 0.15));
    group.add(mesh(new THREE.ConeGeometry(0.045, 0.18, 3), trimMat, 0, 1.23, 0.155));
    group.add(mesh(new THREE.BoxGeometry(0.5, 0.06, 0.29), material(shade(appearance.outfitColor, 0.7)), 0, 0.86, 0));
  }

  // Arms
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.31, 1.31, 0);
    arm.rotation.z = side * -0.14;
    arm.add(mesh(new THREE.BoxGeometry(0.115, 0.46, 0.13), outfitMat, 0, -0.2, 0));
    arm.add(mesh(new THREE.SphereGeometry(0.075, 10, 8), skinMat, 0, -0.47, 0));
    group.add(arm);
  }

  // Head and face
  group.add(mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.09, 10), skinMat, 0, 1.48, 0));
  group.add(mesh(new THREE.SphereGeometry(0.2, 20, 16), skinMat, 0, 1.64, 0));
  group.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), skinMat, -0.195, 1.64, 0));
  group.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), skinMat, 0.195, 1.64, 0));
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.SphereGeometry(0.042, 10, 8), eyeWhite, side * 0.072, 1.66, 0.172));
    group.add(mesh(new THREE.SphereGeometry(0.021, 8, 8), pupil, side * 0.072, 1.66, 0.202));
  }
  group.add(mesh(new THREE.BoxGeometry(0.075, 0.018, 0.02), mouthMat, 0, 1.56, 0.192));

  // Hair. The crown stops at the hairline so the face stays clear, and a
  // separate back piece covers the nape without wrapping in front of the eyes.
  const cap = mesh(
    new THREE.SphereGeometry(0.214, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.4),
    hairMat,
    0, 1.65, -0.005,
  );
  cap.scale.set(1.02, 1.06, 1.03);
  group.add(cap);
  const nape = mesh(
    new THREE.SphereGeometry(0.212, 20, 14, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8, Math.PI * 0.24, Math.PI * 0.52),
    hairMat,
    0, 1.65, -0.005,
  );
  nape.scale.set(1.02, 1.03, 1.02);
  group.add(nape);

  if (appearance.hairStyle === "bob") {
    for (const side of [-1, 1]) group.add(mesh(new THREE.BoxGeometry(0.085, 0.3, 0.24), hairMat, side * 0.185, 1.52, -0.01));
  } else if (appearance.hairStyle === "braids") {
    for (const side of [-1, 1]) {
      group.add(mesh(new THREE.CapsuleGeometry(0.048, 0.4, 4, 8), hairMat, side * 0.2, 1.34, -0.03));
      group.add(mesh(new THREE.SphereGeometry(0.055, 8, 8), trimMat, side * 0.2, 1.1, -0.03));
    }
  } else if (appearance.hairStyle === "curly") {
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const radius = 0.16 + (i % 3) * 0.02;
      group.add(mesh(new THREE.SphereGeometry(0.075, 8, 8), hairMat, Math.cos(angle) * radius, 1.7 + Math.sin(i * 1.7) * 0.05, Math.sin(angle) * radius - 0.02));
    }
  } else if (appearance.hairStyle === "long") {
    group.add(mesh(new THREE.BoxGeometry(0.37, 0.6, 0.13), hairMat, 0, 1.4, -0.16));
    for (const side of [-1, 1]) group.add(mesh(new THREE.BoxGeometry(0.08, 0.36, 0.18), hairMat, side * 0.17, 1.5, 0.01));
  } else if (appearance.hairStyle === "bun") {
    group.add(mesh(new THREE.SphereGeometry(0.11, 12, 10), hairMat, 0, 1.8, -0.14));
    group.add(mesh(new THREE.TorusGeometry(0.055, 0.015, 6, 10), trimMat, 0, 1.75, -0.14));
  }

  if (appearance.accessory === "glasses") {
    for (const side of [-1, 1]) {
      group.add(mesh(new THREE.TorusGeometry(0.062, 0.008, 6, 14), material("#3d3350", { metalness: 0.5, roughness: 0.4 }), side * 0.073, 1.66, 0.205));
    }
    group.add(mesh(new THREE.BoxGeometry(0.03, 0.008, 0.008), material("#3d3350"), 0, 1.66, 0.21));
  } else if (appearance.accessory === "circlet") {
    const band = mesh(new THREE.TorusGeometry(0.2, 0.011, 6, 24), material("#d9c27a", { metalness: 0.75, roughness: 0.3 }), 0, 1.71, 0);
    band.rotation.x = Math.PI / 2;
    group.add(band);
    group.add(mesh(new THREE.OctahedronGeometry(0.035, 0), material("#8fd6ff", { metalness: 0.2, roughness: 0.2 }), 0, 1.71, 0.19));
  } else if (appearance.accessory === "scarf") {
    const scarf = mesh(new THREE.TorusGeometry(0.14, 0.045, 8, 16), material("#b34b6b"), 0, 1.42, 0);
    scarf.rotation.x = Math.PI / 2;
    group.add(scarf);
    group.add(mesh(new THREE.BoxGeometry(0.09, 0.26, 0.03), material("#b34b6b"), 0.08, 1.28, 0.13));
  }

  if (appearance.freckles) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        group.add(mesh(new THREE.SphereGeometry(0.011, 6, 6), material("#a86a4e"), side * (0.1 + i * 0.018), 1.6 - i * 0.016, 0.19));
      }
    }
  }

  if (opts.scale) group.scale.setScalar(opts.scale);
  return group;
}

/** First-person forearms, positioned in camera space. */
export function makeHands(appearance: AdventureAppearance) {
  const group = new THREE.Group();
  const skinMat = material(appearance.skin, { roughness: 0.85 });
  const sleeveMat = material(appearance.outfitColor);
  const cuffMat = material(shade(appearance.outfitColor, 1.35));
  const capsule = (radius: number, length: number) => new THREE.CapsuleGeometry(radius, length, 4, 10);

  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    // Low in the corners, tilted inward, so the rounded backs of the hands and
    // the thumbs read as hands instead of rectangular planks.
    arm.position.set(side * 0.3, -0.47, -0.6);
    arm.rotation.set(-0.1, side * 0.18, side * 0.02);

    // Sleeve runs out of frame behind the wrist, with a cuff at the opening.
    const sleeve = mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.2, 14), sleeveMat, 0, 0, 0.11);
    sleeve.rotation.x = Math.PI / 2;
    arm.add(sleeve);

    const cuff = mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.035, 14), cuffMat, 0, 0, 0.02);
    cuff.rotation.x = Math.PI / 2;
    arm.add(cuff);

    const wrist = mesh(capsule(0.028, 0.05), skinMat, 0, 0, 0);
    wrist.rotation.x = Math.PI / 2;
    arm.add(wrist);

    // Palm: a flattened capsule, wider than it is thick.
    const palm = mesh(capsule(0.036, 0.062), skinMat, 0, 0, -0.07);
    palm.rotation.x = Math.PI / 2;
    palm.scale.set(1.2, 0.88, 1);
    arm.add(palm);

    // Four slightly curled fingers reaching past the palm, with small gaps.
    const fingerOffsets = [-0.026, -0.0085, 0.0085, 0.026];
    const fingerLengths = [0.04, 0.05, 0.047, 0.037];
    fingerOffsets.forEach((offset, index) => {
      const finger = mesh(capsule(0.0088, fingerLengths[index]), skinMat, offset, -0.006, -0.165);
      finger.rotation.x = Math.PI / 2 + 0.2;
      finger.rotation.z = offset * 0.45;
      arm.add(finger);
    });

    // Thumb tucked along the inner edge of the palm.
    const thumb = mesh(capsule(0.011, 0.05), skinMat, side * -0.052, -0.002, -0.062);
    thumb.rotation.set(Math.PI / 2, 0, side * -0.8);
    arm.add(thumb);

    group.add(arm);
  }
  return group;
}

/**
 * Canvas-backed name tag used above NPC heads.
 *
 * The name and role are drawn on separate lines. The canvas is measured from
 * the real text (never sliced) and the sprite keeps that aspect ratio, so long
 * names stay legible instead of being cut mid-letter.
 */
export function makeNameTag(name: string, role: string, accent = "#f4e7c3") {
  const FONT = "Segoe UI, system-ui, -apple-system, sans-serif";
  const NAME_SIZE = 30;
  const ROLE_SIZE = 22;
  const PAD_X = 26;
  const PAD_Y = 14;
  const GAP = 3;
  const SUPERSAMPLE = 2;
  const SPRITE_HEIGHT = 0.3;

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `700 ${NAME_SIZE}px ${FONT}`;
  const nameWidth = Math.ceil(measure.measureText(name).width);
  measure.font = `500 ${ROLE_SIZE}px ${FONT}`;
  const roleWidth = role ? Math.ceil(measure.measureText(role).width) : 0;

  const nameLine = Math.ceil(NAME_SIZE * 1.2);
  const roleLine = role ? Math.ceil(ROLE_SIZE * 1.2) : 0;
  const width = Math.max(96, Math.max(nameWidth, roleWidth) + PAD_X * 2);
  const height = PAD_Y * 2 + nameLine + (role ? GAP + roleLine : 0);

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * SUPERSAMPLE);
  canvas.height = Math.ceil(height * SUPERSAMPLE);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "rgba(18, 14, 34, 0.66)";
  ctx.beginPath();
  ctx.roundRect(1, 1, width - 2, height - 2, Math.min(15, height / 2 - 1));
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fdf9ff";
  ctx.font = `700 ${NAME_SIZE}px ${FONT}`;
  ctx.fillText(name, width / 2, PAD_Y + nameLine / 2);
  if (role) {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.94;
    ctx.font = `500 ${ROLE_SIZE}px ${FONT}`;
    ctx.fillText(role, width / 2, PAD_Y + nameLine + GAP + roleLine / 2);
    ctx.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  material.toneMapped = false;
  const sprite = new THREE.Sprite(material);
  sprite.scale.set((SPRITE_HEIGHT * width) / height, SPRITE_HEIGHT, 1);
  sprite.renderOrder = 2;
  return sprite;
}
