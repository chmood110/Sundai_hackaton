import type { Stroke } from '../../types/brush';
import { extractEmotionDrawingFeatures } from './features';
import { buildEmotionDrawingSystemPrompt, buildEmotionDrawingUserPrompt } from './prompt';
import { chatCompletionJSON } from '../../ai/OpenRouterService';
import type { EmotionDrawingAnalysis, ExpressiveTone } from './types';
import { isValidTone } from './types';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Fallback rule-based analysis usado cuando la API falla.
 * Es menos preciso que el modelo pero nunca bloquea la creación.
 */
function ruleBased(features: ReturnType<typeof extractEmotionDrawingFeatures>): EmotionDrawingAnalysis {
  // Energía: basada en densidad, velocidad y longitud
  const energyFromDensity = Math.min(1, features.density / 0.008);
  const energyFromSpeed = features.avgSpeed > 0 ? Math.min(1, features.avgSpeed / 2) : 0.5;
  const energyLevel = clamp01((energyFromDensity + energyFromSpeed) / 2);

  // Organización: baja superposición y poca varianza de dirección → más organizado
  const disorderFromOverlap = features.overlapScore;
  const disorderFromDirection = Math.min(1, features.normalizedDirectionChanges / 0.3);
  const organizationLevel = clamp01(1 - (disorderFromOverlap + disorderFromDirection) / 2);

  // Tono por reglas simples
  let expressiveTone: ExpressiveTone = 'neutro';
  if (features.overlapScore > 0.6 && features.normalizedDirectionChanges > 0.2) {
    expressiveTone = 'caotico';
  } else if (features.avgPressure > 0.7 || features.normalizedDirectionChanges > 0.25) {
    expressiveTone = 'tenso';
  } else if (energyLevel > 0.65 && features.colorCount > 2) {
    expressiveTone = 'alegre';
  } else if (organizationLevel > 0.7 && energyLevel < 0.4) {
    expressiveTone = 'tranquilo';
  } else if (energyLevel < 0.25 && features.strokeCount < 5) {
    expressiveTone = 'triste';
  }

  return {
    expressiveTone,
    energyLevel,
    organizationLevel,
    confidence: 0.35, // baja confianza al ser rule-based
    visualSummary: 'Análisis basado en rasgos visuales.',
    explanation: 'No se pudo conectar con el servicio de análisis. Resultado estimado localmente.',
  };
}

export async function analyzeEmotionDrawing(strokes: Stroke[]): Promise<{
  features: ReturnType<typeof extractEmotionDrawingFeatures>;
  analysis: EmotionDrawingAnalysis;
}> {
  const features = extractEmotionDrawingFeatures(strokes);

  let raw: Partial<EmotionDrawingAnalysis> = {};
  let usedFallback = false;

  try {
    raw = await chatCompletionJSON<EmotionDrawingAnalysis>(
      [
        { role: 'system', content: buildEmotionDrawingSystemPrompt() },
        { role: 'user', content: buildEmotionDrawingUserPrompt(features) },
      ],
      {
        model: 'google/gemini-2.5-flash',
        temperature: 0.2,
        maxTokens: 300,
      }
    );
  } catch (err) {
    console.warn('[EmotionDrawing] API call failed, using rule-based fallback:', err);
    usedFallback = true;
  }

  if (usedFallback) {
    return { features, analysis: ruleBased(features) };
  }

  // Validar y sanitizar la respuesta del modelo
  const expressiveTone: ExpressiveTone = isValidTone(raw.expressiveTone)
    ? raw.expressiveTone
    : 'neutro';

  const analysis: EmotionDrawingAnalysis = {
    expressiveTone,
    energyLevel: clamp01(raw.energyLevel ?? 0.5),
    organizationLevel: clamp01(raw.organizationLevel ?? 0.5),
    confidence: clamp01(raw.confidence ?? 0.5),
    visualSummary: String(raw.visualSummary ?? '').trim() || 'Sin resumen.',
    explanation: String(raw.explanation ?? '').trim() || 'Sin descripción.',
  };

  return { features, analysis };
}