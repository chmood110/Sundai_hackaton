import type { Stroke } from '../../types/brush';
import type { TransformableElement } from '../../types/primitives';

export type ExpressiveTone =
  | 'alegre'
  | 'tranquilo'
  | 'triste'
  | 'tenso'
  | 'caotico'
  | 'neutro';

export interface EmotionDrawingFeatures {
  // Composición básica
  strokeCount: number;
  pointCount: number;
  width: number;
  height: number;
  aspectRatio: number;
  area: number;

  // Longitud y densidad
  totalStrokeLength: number;
  averageStrokeLength: number;
  strokeLengthVariance: number;   // Varianza de longitudes entre trazos (novedad)
  density: number;

  // Posición y dispersión
  centerX: number;
  centerY: number;
  spreadX: number;
  spreadY: number;

  // Superposición y dirección
  overlapScore: number;
  directionChanges: number;
  normalizedDirectionChanges: number; // directionChanges / pointCount (novedad)

  // Presión (si disponible, 0 si no)
  avgPressure: number;           // Media de presión en [0,1] (novedad)
  pressureVariance: number;      // Varianza de presión (novedad)

  // Velocidad de trazo (si hay timeMillis)
  avgSpeed: number;              // Velocidad media en px/ms (novedad)
  speedVariance: number;         // Varianza de velocidad entre segmentos (novedad)

  // Color
  colorCount: number;            // Número de colores distintos usados (novedad)
}

export interface EmotionDrawingAnalysis {
  expressiveTone: ExpressiveTone;
  energyLevel: number;        // 0 a 1
  organizationLevel: number;  // 0 a 1
  confidence: number;         // 0 a 1
  visualSummary: string;
  explanation: string;
}

export interface EmotionDrawingElement extends TransformableElement {
  type: 'emotiondrawing';
  sourceStrokes: Stroke[];
  features: EmotionDrawingFeatures;
  analysis: EmotionDrawingAnalysis;
}

export const VALID_TONES: ExpressiveTone[] = [
  'alegre', 'tranquilo', 'triste', 'tenso', 'caotico', 'neutro',
];

export function isValidTone(value: unknown): value is ExpressiveTone {
  return typeof value === 'string' && VALID_TONES.includes(value as ExpressiveTone);
}