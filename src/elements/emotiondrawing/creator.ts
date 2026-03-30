import type { Stroke } from '../../types/brush';
import { generateId, IDENTITY_MATRIX } from '../../types/primitives';
import { analyzeEmotionDrawing } from './analyze';
import { extractEmotionDrawingFeatures } from './features';
import type { EmotionDrawingElement } from './types';

/** Mínimo de trazos para activar la creación. */
const MIN_STROKES = 3;
/** Mínimo de puntos totales. */
const MIN_POINTS = 30;
/** Mínima extensión del dibujo en al menos un eje (px). */
const MIN_DIMENSION = 30;

export function canCreate(strokes: Stroke[]): boolean {
  if (strokes.length < MIN_STROKES) return false;

  const features = extractEmotionDrawingFeatures(strokes);

  if (features.pointCount < MIN_POINTS) return false;
  if (features.width < MIN_DIMENSION && features.height < MIN_DIMENSION) return false;

  return true;
}

export async function createFromInk(strokes: Stroke[]) {
  if (!canCreate(strokes)) {
    return null;
  }

  const { features, analysis } = await analyzeEmotionDrawing(strokes);

  const element: EmotionDrawingElement = {
    type: 'emotiondrawing',
    id: generateId(),
    transform: IDENTITY_MATRIX,
    sourceStrokes: strokes,
    features,
    analysis,
  };

  return {
    elements: [element],
    consumedStrokes: strokes,
    confidence: analysis.confidence ?? 0.7,
  };
}