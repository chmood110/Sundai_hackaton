import type { EmotionDrawingElement } from './types';
import type { ElementPlugin } from '../registry/ElementPlugin';
import { registerPlugin } from '../registry/ElementRegistry';
import { canCreate, createFromInk } from './creator';
import { isInterestedIn, acceptInk } from './interaction';
import { render, getBounds } from './renderer';

const emotionDrawingPlugin: ElementPlugin<EmotionDrawingElement> = {
  elementType: 'emotiondrawing',
  name: 'EmotionDrawing',

  // Creation
  canCreate,
  createFromInk,

  // Interaction
  isInterestedIn,
  acceptInk,

  // Rendering
  render,
  getBounds,
};

registerPlugin(emotionDrawingPlugin);

export { emotionDrawingPlugin };