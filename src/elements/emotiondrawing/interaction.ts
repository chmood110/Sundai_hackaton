import type { Stroke } from '../../types/brush';
import type { EmotionDrawingElement } from './types';
import { getBounds } from './renderer';
import { analyzeEmotionDrawing } from './analyze';
import { extractEmotionDrawingFeatures } from './features';

/** Margen de proximidad para considerar nuevos trazos como parte del dibujo (px). */
const PROXIMITY_MARGIN = 60;

/**
 * Devuelve true si algún punto del trazo cae dentro de los bounds ampliados del elemento.
 */
function isStrokeNearElement(
  stroke: Stroke,
  bounds: { left: number; top: number; right: number; bottom: number }
): boolean {
  const expandedLeft   = bounds.left   - PROXIMITY_MARGIN;
  const expandedTop    = bounds.top    - PROXIMITY_MARGIN;
  const expandedRight  = bounds.right  + PROXIMITY_MARGIN;
  const expandedBottom = bounds.bottom + PROXIMITY_MARGIN;

  for (const p of stroke.inputs?.inputs ?? []) {
    if (
      p.x >= expandedLeft &&
      p.x <= expandedRight &&
      p.y >= expandedTop  &&
      p.y <= expandedBottom
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Indica si el elemento está interesado en los nuevos trazos.
 * Acepta trazos que caigan dentro o cerca del dibujo original.
 */
export function isInterestedIn(
  element: EmotionDrawingElement,
  strokes: Stroke[]
): boolean {
  const bounds = getBounds(element);
  if (!bounds) return false;
  return strokes.some((s) => isStrokeNearElement(s, bounds));
}

/**
 * Re-analiza el dibujo combinando los trazos originales con los nuevos.
 * Los nuevos trazos se incorporan al elemento actualizado.
 */
export async function acceptInk(
  element: EmotionDrawingElement,
  strokes: Stroke[]
): Promise<{
  updatedElement: EmotionDrawingElement;
  consumedStrokes: Stroke[];
} | null> {
  const bounds = getBounds(element);
  if (!bounds) return null;

  const nearStrokes = strokes.filter((s) => isStrokeNearElement(s, bounds));
  if (nearStrokes.length === 0) return null;

  const combinedStrokes = [...element.sourceStrokes, ...nearStrokes];

  const { features, analysis } = await analyzeEmotionDrawing(combinedStrokes);

  const updatedElement: EmotionDrawingElement = {
    ...element,
    sourceStrokes: combinedStrokes,
    features,
    analysis,
  };

  return {
    updatedElement,
    consumedStrokes: nearStrokes,
  };
}