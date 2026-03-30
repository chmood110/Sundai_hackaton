import type { EmotionDrawingElement } from './types';
import type { ExpressiveTone } from './types';

// ─── Constantes de diseño ────────────────────────────────────────────────────

const CARD = {
  width: 240,
  height: 118,
  radius: 12,
  padding: 12,
  border: 'rgba(15,23,42,0.13)',
  bg: 'rgba(255,255,255,0.97)',
} as const;

const SELECTION_DASH: [number, number] = [6, 5];
const SELECTION_COLOR = 'rgba(99, 102, 241, 0.55)';

// ─── Paleta por tono ─────────────────────────────────────────────────────────

interface ToneStyle {
  emoji: string;
  label: string;
  accentColor: string; // Color del chip de tono
  textColor: string;
}

const TONE_STYLES: Record<ExpressiveTone, ToneStyle> = {
  alegre:    { emoji: '😄', label: 'Alegre',    accentColor: '#fef08a', textColor: '#713f12' },
  tranquilo: { emoji: '😌', label: 'Tranquilo', accentColor: '#bbf7d0', textColor: '#14532d' },
  triste:    { emoji: '😢', label: 'Triste',    accentColor: '#bfdbfe', textColor: '#1e3a5f' },
  tenso:     { emoji: '😤', label: 'Tenso',     accentColor: '#fecaca', textColor: '#7f1d1d' },
  caotico:   { emoji: '🌀', label: 'Caótico',   accentColor: '#e9d5ff', textColor: '#4c1d95' },
  neutro:    { emoji: '😐', label: 'Neutro',    accentColor: '#f1f5f9', textColor: '#334155' },
};

// ─── Utilidades ──────────────────────────────────────────────────────────────

type BoundingBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function getBounds(element: EmotionDrawingElement): BoundingBox | null {
  const points = element.sourceStrokes.flatMap(
    (stroke) => stroke.inputs?.inputs?.map((p) => ({ x: p.x, y: p.y })) ?? []
  );
  if (points.length === 0) return null;

  let left = points[0].x;
  let top = points[0].y;
  let right = points[0].x;
  let bottom = points[0].y;

  for (const p of points) {
    if (p.x < left)   left   = p.x;
    if (p.y < top)    top    = p.y;
    if (p.x > right)  right  = p.x;
    if (p.y > bottom) bottom = p.y;
  }

  return { left, top, right, bottom };
}

/** Dibuja texto truncado con ellipsis si excede maxWidth. */
function fillTextEllipsis(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): void {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  ctx.fillText(truncated + '…', x, y);
}

/**
 * Dibuja una barra de progreso.
 * @param label  texto a la izquierda
 * @param value  valor [0, 1]
 * @param color  color de relleno de la barra
 */
function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: number,
  color: string,
  barWidth = 90
): void {
  const labelW = 70;
  const barH = 5;
  const barX = x + labelW;

  // Etiqueta
  ctx.fillStyle = '#475569';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y + barH);

  // Fondo barra
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(barX, y, barWidth, barH, 3);
  ctx.fill();

  // Relleno barra
  const fill = Math.max(2, value * barWidth);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(barX, y, fill, barH, 3);
  ctx.fill();

  // Porcentaje
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(value * 100)}%`, barX + barWidth + 22, y + barH);
  ctx.textAlign = 'left';
}

// ─── Render principal ────────────────────────────────────────────────────────

export function render(
  ctx: CanvasRenderingContext2D,
  element: EmotionDrawingElement
): void {
  const bounds = getBounds(element);
  if (!bounds) return;

  const { analysis } = element;
  const toneStyle = TONE_STYLES[analysis.expressiveTone] ?? TONE_STYLES.neutro;

  // Posición de la tarjeta: por encima del dibujo
  const drawingW = bounds.right - bounds.left;
  const drawingH = bounds.bottom - bounds.top;
  const cardX = bounds.left + drawingW / 2 - CARD.width / 2;
  const cardY = bounds.top - CARD.height - 14;

  ctx.save();

  // ── 1. Borde de selección alrededor del dibujo ──────────────────────────
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1.5;
  ctx.setLineDash(SELECTION_DASH);
  ctx.strokeRect(
    bounds.left - 8,
    bounds.top - 8,
    Math.max(16, drawingW + 16),
    Math.max(16, drawingH + 16)
  );
  ctx.setLineDash([]);

  // ── 2. Sombra de la tarjeta ──────────────────────────────────────────────
  ctx.shadowColor = 'rgba(0, 0, 0, 0.10)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;

  // ── 3. Fondo de la tarjeta ───────────────────────────────────────────────
  ctx.fillStyle = CARD.bg;
  ctx.strokeStyle = CARD.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, CARD.width, CARD.height, CARD.radius);
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const px = cardX + CARD.padding;
  const innerW = CARD.width - CARD.padding * 2;

  // ── 4. Chip de tono (emoji + label + fondo coloreado) ───────────────────
  const chipText = `${toneStyle.emoji} ${toneStyle.label}`;
  const chipFont = '600 11px sans-serif';
  ctx.font = chipFont;
  const chipTextW = ctx.measureText(chipText).width;
  const chipPadX = 8;
  const chipPadY = 3;
  const chipW = chipTextW + chipPadX * 2;
  const chipH = 18;
  const chipY = cardY + CARD.padding;

  ctx.fillStyle = toneStyle.accentColor;
  ctx.beginPath();
  ctx.roundRect(px, chipY, chipW, chipH, chipH / 2);
  ctx.fill();

  ctx.fillStyle = toneStyle.textColor;
  ctx.font = chipFont;
  ctx.textAlign = 'left';
  ctx.fillText(chipText, px + chipPadX, chipY + chipH - chipPadY - 1);

  // Confianza a la derecha del chip
  const confPct = Math.round(analysis.confidence * 100);
  ctx.font = '9px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  ctx.fillText(`conf. ${confPct}%`, cardX + CARD.width - CARD.padding, chipY + chipH - chipPadY - 1);
  ctx.textAlign = 'left';

  // ── 5. Barras de energía y organización ─────────────────────────────────
  const barY = chipY + chipH + 10;
  drawBar(ctx, px, barY,      'Energía',       analysis.energyLevel,       '#f97316', innerW - 26);
  drawBar(ctx, px, barY + 14, 'Organización',  analysis.organizationLevel, '#6366f1', innerW - 26);

  // ── 6. Texto de explicación ──────────────────────────────────────────────
  const explanation = analysis.explanation || analysis.visualSummary || 'Sin descripción';
  ctx.fillStyle = '#475569';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  fillTextEllipsis(ctx, explanation, px, cardY + CARD.height - 12, innerW);

  ctx.restore();
}