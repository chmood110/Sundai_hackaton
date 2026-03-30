import type { EmotionDrawingFeatures } from './types';

function fmt(value: number, decimals = 3): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(decimals));
}

export function buildEmotionDrawingSystemPrompt(): string {
  return [
    'Eres un asistente especializado en análisis expresivo e interpretativo de dibujos a partir de trazos digitales.',
    'Tu tarea es analizar rasgos visuales y compositivos del dibujo de forma experimental e interpretativa.',
    '',
    'RESTRICCIONES IMPORTANTES:',
    '- No emitas diagnósticos clínicos, psicológicos ni médicos.',
    '- No afirmes estados internos reales del autor.',
    '- Describe únicamente el tono expresivo aparente según los rasgos visuales.',
    '- La explanation debe ser breve (máximo 2 frases) y enfocada en lo más llamativo del dibujo.',
    '- visualSummary debe describir la composición en 1 frase corta.',
    '',
    'GUÍA DE TONOS:',
    '- alegre: trazos fluidos, ligeros, amplios, varios colores, baja tensión',
    '- tranquilo: trazos suaves, regulares, pocos cambios de dirección, baja densidad',
    '- triste: trazos cortos, lentos, presión baja o uniforme, colores oscuros, poca extensión',
    '- tenso: trazos cortos y rápidos, alta presión, muchos cambios de dirección, alta densidad',
    '- caotico: muchos trazos, alta superposición, dirección muy variable, gran velocidad',
    '- neutro: sin señales claras de ninguno de los anteriores',
    '',
    'Responde solo en JSON válido, sin texto adicional ni bloques de código.',
    'Estructura exacta:',
    '{',
    '  "expressiveTone": "alegre | tranquilo | triste | tenso | caotico | neutro",',
    '  "energyLevel": number,',
    '  "organizationLevel": number,',
    '  "confidence": number,',
    '  "visualSummary": string,',
    '  "explanation": string',
    '}',
    'energyLevel, organizationLevel y confidence deben estar en el rango [0, 1].',
  ].join('\n');
}

export function buildEmotionDrawingUserPrompt(features: EmotionDrawingFeatures): string {
  // Preparar indicadores interpretativos calculados
  const strokeDensityCategory =
    features.density < 0.0005 ? 'muy disperso' :
    features.density < 0.002  ? 'moderado' :
    features.density < 0.008  ? 'denso' : 'muy denso';

  const overlapCategory =
    features.overlapScore < 0.1  ? 'sin superposición' :
    features.overlapScore < 0.4  ? 'leve superposición' :
    features.overlapScore < 0.7  ? 'moderada superposición' : 'alta superposición';

  const directionCategory =
    features.normalizedDirectionChanges < 0.05 ? 'muy fluido' :
    features.normalizedDirectionChanges < 0.15 ? 'moderado' :
    features.normalizedDirectionChanges < 0.3  ? 'irregular' : 'muy caótico';

  const pressureNote = features.avgPressure > 0
    ? `avgPressure: ${fmt(features.avgPressure, 2)} (pressureVariance: ${fmt(features.pressureVariance, 4)})`
    : 'presión: no disponible';

  const speedNote = features.avgSpeed > 0
    ? `avgSpeed: ${fmt(features.avgSpeed, 4)} px/ms (speedVariance: ${fmt(features.speedVariance, 6)})`
    : 'velocidad: no disponible';

  return [
    'Analiza el siguiente dibujo a partir de sus rasgos extraídos del trazo.',
    'Devuelve solo JSON válido.',
    '',
    '--- COMPOSICIÓN ---',
    `strokeCount: ${features.strokeCount}`,
    `pointCount: ${features.pointCount}`,
    `colorCount: ${features.colorCount} (colores distintos usados)`,
    `width: ${fmt(features.width)} px, height: ${fmt(features.height)} px`,
    `aspectRatio: ${fmt(features.aspectRatio)} (ancho/alto)`,
    '',
    '--- LONGITUD Y DENSIDAD ---',
    `totalStrokeLength: ${fmt(features.totalStrokeLength)} px`,
    `averageStrokeLength: ${fmt(features.averageStrokeLength)} px`,
    `strokeLengthVariance: ${fmt(features.strokeLengthVariance, 1)} (varianza entre longitudes de trazo)`,
    `density: ${fmt(features.density, 6)} → ${strokeDensityCategory}`,
    '',
    '--- DISPERSIÓN Y SUPERPOSICIÓN ---',
    `spreadX: ${fmt(features.spreadX)}, spreadY: ${fmt(features.spreadY)} (desviación media del centro)`,
    `overlapScore: ${fmt(features.overlapScore, 3)} → ${overlapCategory}`,
    '',
    '--- DIRECCIÓN ---',
    `directionChanges: ${features.directionChanges}`,
    `normalizedDirectionChanges: ${fmt(features.normalizedDirectionChanges, 4)} → ${directionCategory}`,
    '',
    '--- PRESIÓN ---',
    pressureNote,
    '',
    '--- VELOCIDAD ---',
    speedNote,
    '',
    'Con base en estos rasgos, determina el tono expresivo aparente del dibujo.',
  ].join('\n');
}