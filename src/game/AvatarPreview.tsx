import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AdventureAppearance } from "../lib/api";
import { makeAvatar } from "./avatar";

/** A small, self-contained 3D turntable used by character creation and the dressing room. */
export function AvatarPreview({ appearance, className = "" }: { appearance: AdventureAppearance; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
    camera.position.set(0, 1.22, 4.1);
    camera.lookAt(0, 1.05, 0);

    scene.add(new THREE.HemisphereLight("#e3efff", "#5d5445", 1.35));
    const key = new THREE.DirectionalLight("#fff1d8", 2.3);
    key.position.set(2.4, 4.4, 3.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#a9c8ff", 1.1);
    rim.position.set(-3, 2.6, -2);
    scene.add(rim);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.25, 0.16, 40),
      new THREE.MeshStandardMaterial({ color: "#7c6a9c", roughness: 0.6, metalness: 0.1 }),
    );
    pedestal.position.y = 0.08;
    scene.add(pedestal);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.22, 0.025, 8, 60),
      new THREE.MeshStandardMaterial({ color: "#d9c27a", metalness: 0.75, roughness: 0.3 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.17;
    scene.add(ring);

    const avatar = makeAvatar(appearance);
    scene.add(avatar);

    const resize = () => {
      const parent = canvas.parentElement;
      const width = parent?.clientWidth || 260;
      const height = parent?.clientHeight || 300;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    let raf = 0;
    const start = performance.now();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = (performance.now() - start) / 1000;
      avatar.rotation.y = Math.sin(t * 0.35) * 0.5;
      avatar.position.y = Math.sin(t * 1.2) * 0.012;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      observer.disconnect();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
      renderer.dispose();
    };
  }, [appearance]);

  return <canvas ref={canvasRef} className={`adv-preview-canvas ${className}`} aria-label="Your character preview" />;
}
