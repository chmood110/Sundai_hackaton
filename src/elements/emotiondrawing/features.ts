import type { Stroke } from '../../types/brush';
import { colorToRGBA } from '../../types/brush';
import type { EmotionDrawingFeatures } from './types';

type Point = {
  x: number;
  y: number;
  timeMillis?: number;
  pressure?: number;
};

function clampMin(value: number, min: number): number {
  return value < min ? min : value;
}

function getStrokePoints(stroke: Stroke): Point[] {
  return stroke.inputs?.inputs?.map((p) => ({
    x: p.x,
    y: p.y,
    timeMillis: p.timeMillis,
    pressure: p.pressure,
  })) ?? [];
}

function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getStrokeLength(points: Point[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distance(points[i - 1], points[i]);
  }
  return total;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

function getDirectionChanges(points: Point[]): number {
  if (points.length < 3) return 0;
  let changes = 0;

  for (let i = 2; i < points.length; i += 1) {
    const a = points[i - 2];
    const b = points[i - 1];
    const c = points[i];

    const v1x = b.x - a.x;
    const v1y = b.y - a.y;
    const v2x = c.x - b.x;
    const v2y = c.y - b.y;

    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (mag1 === 0 || mag2 === 0) continue;

    const dot = v1x * v2x + v1y * v2y;
    const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    const angle = Math.acos(cosTheta);

    // Cambio "notable" de dirección: ~30 grados o más
    if (angle > Math.PI / 6) {
      changes += 1;
    }
  }

  return changes;
}

function getBoundingBox(points: Point[]) {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;

  return { minX, minY, maxX, maxY, width, height, centerX: minX + width / 2, centerY: minY + height / 2 };
}

function getSpread(points: Point[], centerX: number, centerY: number) {
  if (points.length === 0) return { spreadX: 0, spreadY: 0 };
  let sumAbsX = 0;
  let sumAbsY = 0;
  for (const p of points) {
    sumAbsX += Math.abs(p.x - centerX);
    sumAbsY += Math.abs(p.y - centerY);
  }
  return { spreadX: sumAbsX / points.length, spreadY: sumAbsY / points.length };
}

function getOverlapScore(strokes: Point[][]): number {
  if (strokes.length < 2) return 0;
  const boxes = strokes.map(getBoundingBox);
  let comparisons = 0;
  let overlaps = 0;

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      comparisons += 1;
      const a = boxes[i];
      const b = boxes[j];
      const interWidth = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
      const interHeight = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
      const interArea = interWidth * interHeight;
      const areaA = Math.max(1, a.width * a.height);
      const areaB = Math.max(1, b.width * b.height);
      const minArea = Math.min(areaA, areaB);
      if (interArea / minArea > 0.15) overlaps += 1;
    }
  }

  return comparisons === 0 ? 0 : overlaps / comparisons;
}

/**
 * Extrae velocidad media y varianza por trazo a partir de timeMillis.
 * Si los puntos no tienen timestamps, devuelve 0 para ambos.
 */
function getSpeedMetrics(allPoints: Point[]): { avgSpeed: number; speedVariance: number } {
  const speeds: number[] = [];

  for (let i = 1; i < allPoints.length; i += 1) {
    const a = allPoints[i - 1];
    const b = allPoints[i];

    if (a.timeMillis == null || b.timeMillis == null) continue;
    const dt = b.timeMillis - a.timeMillis;
    if (dt <= 0) continue;

    const dist = distance(a, b);
    speeds.push(dist / dt);
  }

  if (speeds.length === 0) return { avgSpeed: 0, speedVariance: 0 };

  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  return { avgSpeed: avg, speedVariance: variance(speeds) };
}

/**
 * Extrae media y varianza de presión de todos los puntos.
 * Si ningún punto tiene presión, devuelve 0.
 */
function getPressureMetrics(allPoints: Point[]): { avgPressure: number; pressureVariance: number } {
  const pressures = allPoints
    .map((p) => p.pressure)
    .filter((v): v is number => v != null && Number.isFinite(v));

  if (pressures.length === 0) return { avgPressure: 0, pressureVariance: 0 };

  const avg = pressures.reduce((a, b) => a + b, 0) / pressures.length;
  return { avgPressure: avg, pressureVariance: variance(pressures) };
}

/**
 * Cuenta colores distintos entre los trazos (comparando el valor ARGB entero).
 */
function getColorCount(strokes: Stroke[]): number {
  const seen = new Set<number>();
  for (const stroke of strokes) {
    // Solo considera el canal RGB ignorando alpha para agrupar mejor
    const { r, g, b } = colorToRGBA(stroke.brush.color);
    // Cuantiza a 32 niveles por canal para evitar ruido de antialiasing
    const key = (Math.round(r / 8) << 10) | (Math.round(g / 8) << 5) | Math.round(b / 8);
    seen.add(key);
  }
  return seen.size;
}

export function extractEmotionDrawingFeatures(strokes: Stroke[]): EmotionDrawingFeatures {
  const strokePointArrays = strokes.map(getStrokePoints).filter((pts) => pts.length > 0);
  const allPoints = strokePointArrays.flat();

  if (allPoints.length === 0) {
    return {
      strokeCount: 0, pointCount: 0, width: 0, height: 0, aspectRatio: 0, area: 0,
      totalStrokeLength: 0, averageStrokeLength: 0, strokeLengthVariance: 0, density: 0,
      centerX: 0, centerY: 0, spreadX: 0, spreadY: 0,
      overlapScore: 0, directionChanges: 0, normalizedDirectionChanges: 0,
      avgPressure: 0, pressureVariance: 0,
      avgSpeed: 0, speedVariance: 0,
      colorCount: 0,
    };
  }

  const bbox = getBoundingBox(allPoints);
  const area = bbox.width * bbox.height;

  const strokeLengths = strokePointArrays.map(getStrokeLength);
  const totalStrokeLength = strokeLengths.reduce((acc, v) => acc + v, 0);
  const averageStrokeLength = strokeLengths.length > 0 ? totalStrokeLength / strokeLengths.length : 0;
  const strokeLengthVariance = variance(strokeLengths);

  const totalDirectionChanges = strokePointArrays.reduce(
    (acc, points) => acc + getDirectionChanges(points),
    0
  );

  const { spreadX, spreadY } = getSpread(allPoints, bbox.centerX, bbox.centerY);
  const density = totalStrokeLength / clampMin(area, 1);
  const { avgSpeed, speedVariance } = getSpeedMetrics(allPoints);
  const { avgPressure, pressureVariance } = getPressureMetrics(allPoints);
  const colorCount = getColorCount(strokes);

  return {
    strokeCount: strokePointArrays.length,
    pointCount: allPoints.length,
    width: bbox.width,
    height: bbox.height,
    aspectRatio: bbox.height === 0 ? bbox.width : bbox.width / bbox.height,
    area,
    totalStrokeLength,
    averageStrokeLength,
    strokeLengthVariance,
    density,
    centerX: bbox.centerX,
    centerY: bbox.centerY,
    spreadX,
    spreadY,
    overlapScore: getOverlapScore(strokePointArrays),
    directionChanges: totalDirectionChanges,
    normalizedDirectionChanges: allPoints.length > 0 ? totalDirectionChanges / allPoints.length : 0,
    avgPressure,
    pressureVariance,
    avgSpeed,
    speedVariance,
    colorCount,
  };
}