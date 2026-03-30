/**
 * View3D.tsx
 * Modal de visualización 3D para EmotionDrawingElement.
 *
 * Mapeo de trazos a 3D:
 *   X, Y del canvas → X, Y en espacio 3D (normalizados al espacio del dibujo)
 *   Z              → combinación de: índice del trazo + progreso temporal + presión
 *
 * Cada trazo se renderiza como un tubo 3D (TubeGeometry + CatmullRomCurve3).
 * El color y grosor provienen del brush original.
 * El entorno (fondo, luces) refleja el tono expresivo analizado.
 *
 * Dependencias: three (npm install three @types/three)
 */

import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { EmotionDrawingElement, ExpressiveTone } from './types';
import { colorToRGBA } from '../../types/brush';

// ─── Tipos internos ──────────────────────────────────────────────────────────

interface View3DProps {
  element: EmotionDrawingElement;
  onClose: () => void;
}

// ─── Constantes de entorno por tono ─────────────────────────────────────────

interface ToneEnvironment {
  background: number;
  ambientColor: number;
  ambientIntensity: number;
  dirLightColor: number;
  dirLightIntensity: number;
  accentLightColor: number;
  accentLightIntensity: number;
  fogColor?: number;
  fogNear?: number;
  fogFar?: number;
}

const TONE_ENVIRONMENTS: Record<ExpressiveTone, ToneEnvironment> = {
  alegre: {
    background: 0xfff7ed,
    ambientColor: 0xfde68a,
    ambientIntensity: 0.9,
    dirLightColor: 0xfbbf24,
    dirLightIntensity: 1.4,
    accentLightColor: 0xf97316,
    accentLightIntensity: 0.8,
    fogColor: 0xfef3c7,
    fogNear: 15,
    fogFar: 50,
  },
  tranquilo: {
    background: 0xe0f2fe,
    ambientColor: 0xbae6fd,
    ambientIntensity: 1.0,
    dirLightColor: 0x7dd3fc,
    dirLightIntensity: 1.2,
    accentLightColor: 0x38bdf8,
    accentLightIntensity: 0.6,
    fogColor: 0xdbeafe,
    fogNear: 20,
    fogFar: 60,
  },
  triste: {
    background: 0x0f172a,
    ambientColor: 0x334155,
    ambientIntensity: 0.5,
    dirLightColor: 0x60a5fa,
    dirLightIntensity: 0.7,
    accentLightColor: 0x1d4ed8,
    accentLightIntensity: 0.5,
    fogColor: 0x1e293b,
    fogNear: 12,
    fogFar: 35,
  },
  tenso: {
    background: 0x1c0505,
    ambientColor: 0xff3333,
    ambientIntensity: 0.6,
    dirLightColor: 0xef4444,
    dirLightIntensity: 1.6,
    accentLightColor: 0xdc2626,
    accentLightIntensity: 1.2,
    fogColor: 0x3b0000,
    fogNear: 10,
    fogFar: 30,
  },
  caotico: {
    background: 0x050010,
    ambientColor: 0x7c3aed,
    ambientIntensity: 0.7,
    dirLightColor: 0xa855f7,
    dirLightIntensity: 1.2,
    accentLightColor: 0xec4899,
    accentLightIntensity: 1.0,
    fogColor: 0x0d001a,
    fogNear: 8,
    fogFar: 25,
  },
  neutro: {
    background: 0xf8fafc,
    ambientColor: 0xe2e8f0,
    ambientIntensity: 1.0,
    dirLightColor: 0xffffff,
    dirLightIntensity: 1.0,
    accentLightColor: 0x94a3b8,
    accentLightIntensity: 0.4,
    fogColor: 0xf1f5f9,
    fogNear: 25,
    fogFar: 70,
  },
};

const TONE_LABELS: Record<ExpressiveTone, string> = {
  alegre: '😄 Alegre',
  tranquilo: '😌 Tranquilo',
  triste: '😢 Triste',
  tenso: '😤 Tenso',
  caotico: '🌀 Caótico',
  neutro: '😐 Neutro',
};

// ─── Utilidades de geometría ─────────────────────────────────────────────────

/** Convierte un color ARGB packed integer a THREE.Color. */
function argbToThreeColor(argb: number): THREE.Color {
  const { r, g, b } = colorToRGBA(argb);
  return new THREE.Color(r / 255, g / 255, b / 255);
}

interface StrokePoint3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Construye los puntos 3D de un trazo.
 * - X, Y se normalizan al espacio [-worldHalf, +worldHalf]
 * - Z combina: offsetBase (índice del trazo) + progreso temporal + presión
 */
function buildStrokePoints3D(
  stroke: import('../../types/brush').Stroke,
  strokeIndex: number,
  strokeCount: number,
  normalize: (x: number, y: number) => { nx: number; ny: number }
): StrokePoint3D[] {
  const inputs = stroke.inputs?.inputs ?? [];
  if (inputs.length === 0) return [];

  const minT = inputs[0].timeMillis;
  const maxT = inputs[inputs.length - 1].timeMillis;
  const timeRange = Math.max(1, maxT - minT);

  // Base Z: cada trazo en un plano ligeramente diferente
  const baseZ = (strokeIndex / Math.max(1, strokeCount - 1) - 0.5) * 3.0;

  return inputs.map((p) => {
    const { nx, ny } = normalize(p.x, p.y);

    // Progreso temporal del punto dentro de su trazo [0, 1]
    const tProgress = (p.timeMillis - minT) / timeRange;

    // Presión [0, 1] — contribuye a sacar el punto hacia el espectador
    const pressure = p.pressure ?? 0.5;

    const z = baseZ + tProgress * 0.4 + (pressure - 0.5) * 1.2;

    return { x: nx, y: ny, z };
  });
}

/**
 * Genera el mesh de tubo 3D para un trazo.
 * Devuelve null si el trazo no tiene suficientes puntos.
 */
function buildStrokeMesh(
  points3D: StrokePoint3D[],
  brushColor: number,
  brushSize: number
): THREE.Mesh | null {
  // Necesitamos al menos 2 puntos distintos
  if (points3D.length < 2) return null;

  // Deduplicar puntos consecutivos idénticos (evita problemas en CatmullRomCurve3)
  const deduped: StrokePoint3D[] = [points3D[0]];
  for (let i = 1; i < points3D.length; i++) {
    const prev = deduped[deduped.length - 1];
    const curr = points3D[i];
    const d = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2 + (curr.z - prev.z) ** 2);
    if (d > 0.001) deduped.push(curr);
  }

  if (deduped.length < 2) return null;

  // Submuestrear si hay demasiados puntos (rendimiento)
  const MAX_POINTS = 120;
  const sampled: StrokePoint3D[] = deduped.length > MAX_POINTS
    ? deduped.filter((_, i) => i % Math.ceil(deduped.length / MAX_POINTS) === 0 || i === deduped.length - 1)
    : deduped;

  const threePoints = sampled.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(threePoints, false, 'catmullrom', 0.5);

  const tubularSegments = Math.max(8, sampled.length * 3);
  const radius = Math.max(0.015, Math.min(0.12, brushSize * 0.008));
  const radialSegments = 6;

  let geometry: THREE.BufferGeometry;
  try {
    geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  } catch {
    return null;
  }

  const color = argbToThreeColor(brushColor);
  const material = new THREE.MeshPhongMaterial({
    color,
    shininess: 60,
    specular: new THREE.Color(0.3, 0.3, 0.3),
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

// ─── Componente principal ────────────────────────────────────────────────────

export function View3D({ element, onClose }: View3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    animFrameId: number;
  } | null>(null);

  // Cerrar con Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Montar la escena Three.js
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const W = container.clientWidth;
    const H = container.clientHeight;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // ── Scene ──
    const scene = new THREE.Scene();
    const env = TONE_ENVIRONMENTS[element.analysis.expressiveTone] ?? TONE_ENVIRONMENTS.neutro;

    scene.background = new THREE.Color(env.background);
    if (env.fogColor != null) {
      scene.fog = new THREE.Fog(env.fogColor, env.fogNear ?? 20, env.fogFar ?? 60);
    }

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 2, 12);
    camera.lookAt(0, 0, 0);

    // ── Lights ──
    const ambient = new THREE.AmbientLight(env.ambientColor, env.ambientIntensity);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(env.dirLightColor, env.dirLightIntensity);
    dirLight.position.set(5, 8, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.setScalar(1024);
    scene.add(dirLight);

    const accentLight = new THREE.PointLight(env.accentLightColor, env.accentLightIntensity, 25);
    accentLight.position.set(-4, -3, 4);
    scene.add(accentLight);

    // Extra luz de relleno para tono caótico (luces de colores adicionales)
    if (element.analysis.expressiveTone === 'caotico') {
      const extra1 = new THREE.PointLight(0x00ffcc, 0.8, 15);
      extra1.position.set(4, 2, -3);
      scene.add(extra1);
      const extra2 = new THREE.PointLight(0xff6600, 0.6, 12);
      extra2.position.set(-3, -4, 2);
      scene.add(extra2);
    }

    // ── Plano de suelo (sutil) ──
    if (element.analysis.expressiveTone !== 'caotico') {
      const groundGeo = new THREE.PlaneGeometry(30, 30);
      const groundMat = new THREE.MeshPhongMaterial({
        color: new THREE.Color(env.background).multiplyScalar(0.92),
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -3.5;
      ground.receiveShadow = true;
      scene.add(ground);
    }

    // ── Normalización de coordenadas ──
    const { features } = element;
    const worldSize = 8; // tamaño total del mundo
    const scaleX = features.width  > 0 ? worldSize / features.width  : 1;
    const scaleY = features.height > 0 ? worldSize / features.height : 1;
    const scale  = Math.min(scaleX, scaleY);

    const normalize = (x: number, y: number) => ({
      nx: (x - features.centerX) * scale,
      ny: -(y - features.centerY) * scale, // invertir Y (canvas Y hacia abajo)
    });

    // ── Construcción de trazos 3D ──
    const strokeCount = element.sourceStrokes.length;
    const strokeGroup = new THREE.Group();

    for (let i = 0; i < strokeCount; i++) {
      const stroke = element.sourceStrokes[i];
      const points3D = buildStrokePoints3D(stroke, i, strokeCount, normalize);
      const mesh = buildStrokeMesh(points3D, stroke.brush.color, stroke.brush.size);
      if (mesh) {
        mesh.castShadow = true;
        strokeGroup.add(mesh);
      }
    }

    scene.add(strokeGroup);

    // ── OrbitControls ──
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.8;
    controls.minDistance = 3;
    controls.maxDistance = 30;
    controls.autoRotate = true;
    controls.autoRotateSpeed = element.analysis.expressiveTone === 'caotico' ? 3.5 :
                               element.analysis.expressiveTone === 'tenso'   ? 2.0 :
                               element.analysis.expressiveTone === 'alegre'  ? 1.5 : 0.8;

    // Detener auto-rotate cuando el usuario interactúa
    controls.addEventListener('start', () => { controls.autoRotate = false; });

    // ── Resize handler ──
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ── Render loop ──

    let animFrameId = 0;
    const tick = () => {
    animFrameId = requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
    };
    tick();

    sceneRef.current = { renderer, scene, camera, controls, animFrameId };
    

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      // Limpiar geometrías y materiales
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, [element]);

  const { analysis } = element;
  const isDark = ['triste', 'tenso', 'caotico'].includes(analysis.expressiveTone);

  return (
    <div style={styles.overlay} onClick={onClose}>
      {/* Canvas container — stopPropagation para no cerrar al interactuar */}
      <div
        ref={containerRef}
        style={styles.canvas}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Header flotante */}
      <div style={{ ...styles.header, ...(isDark ? styles.headerDark : styles.headerLight) }}
           onClick={(e) => e.stopPropagation()}>
        <div style={styles.headerInfo}>
          <span style={{ ...styles.toneChip, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {TONE_LABELS[analysis.expressiveTone]}
          </span>
          <span style={{ ...styles.metaText, color: isDark ? '#94a3b8' : '#64748b' }}>
            Energía {Math.round(analysis.energyLevel * 100)}%
            &nbsp;·&nbsp;
            Org. {Math.round(analysis.organizationLevel * 100)}%
            &nbsp;·&nbsp;
            {element.sourceStrokes.length} trazos
          </span>
        </div>
        <button style={styles.closeBtn} onClick={onClose} title="Cerrar (Esc)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Hint de controles */}
      <div style={{ ...styles.hint, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
        Arrastra para rotar · Scroll para zoom · Click fuera para cerrar
      </div>
    </div>
  );
}

// ─── Estilos inline ──────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    width: 'min(90vw, 1100px)',
    height: 'min(85vh, 700px)',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
    position: 'relative',
  },
  header: {
    position: 'fixed',
    top: '5vh',
    left: '50%',
    transform: 'translateX(-50%)',
    borderRadius: '40px',
    padding: '8px 16px 8px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    zIndex: 1001,
    userSelect: 'none',
  },
  headerLight: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(0,0,0,0.1)',
  },
  headerDark: {
    backgroundColor: 'rgba(15,23,42,0.85)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  toneChip: {
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'sans-serif',
  },
  metaText: {
    fontSize: '11px',
    fontFamily: 'sans-serif',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    color: '#64748b',
    transition: 'background 0.15s',
  },
  hint: {
    position: 'fixed',
    bottom: '7vh',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '12px',
    fontFamily: 'sans-serif',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 1001,
  },
};