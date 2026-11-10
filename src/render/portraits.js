/**
 * Pictures of cats for menus, cards and the journal: rendered from the 3D model when WebGL is
 * available, otherwise the 2D pixel sprite.
 */
import { dustyCoat } from './models.js';
import { catPictureUrl } from './sprites.js';
import { catPortrait, stageReady } from './stage.js';

/**
 * @param {{ id: string, coat: import('./models.js').Coat }} def
 * @param {{ pose?: string, hat?: string | null, wary?: boolean, size?: number }} [options]
 */
export function catPicture(def, { pose = 'sit', hat = null, wary = false, size = 96 } = {}) {
  if (!stageReady()) {
    return catPictureUrl(def, { pose, hat, wary, scale: Math.max(2, Math.round(size / 20)) });
  }
  return catPortrait(wary ? dustyCoat(def.coat) : def.coat, {
    pose,
    hat: wary ? null : hat,
    size,
    key: `${def.id}${wary ? ':wary' : ''}`,
  });
}
