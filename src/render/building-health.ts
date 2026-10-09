import type {Entity} from '../sim/types';
import type {SpriteBounds} from './SpriteAtlas';
import type {VisualThemeId} from './visualThemes';

/** Space's shorter structures keep their health and queue bars attached to the
 * ready sprite footprint. Other themes and unavailable artwork keep their
 * established coordinates. SpriteAtlas.bounds supplies only loaded frames. */
export function buildingHealthY(theme: VisualThemeId, type: Entity['type'], bounds?: SpriteBounds): number {
  if (theme === 'space' && bounds && Number.isFinite(bounds.y)) return bounds.y - 20;
  return type === 'keep' ? -133 : type === 'tower' ? -107 : -98;
}
