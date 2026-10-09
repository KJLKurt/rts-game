/** Select only complete, shipped visual sets. Gameplay and team/faction markings stay independent. */
export const VISUAL_THEMES = {
  christmas: {
    name: 'Christmas · Toy 3D',
    atlas: 'assets/render/frontier-atlas.json',
    attackAtlas: 'assets/render/frontier-combat-animation.json',
    directionalAtlas: null,
    additionalDirectionalAtlases: [],
  },
  mythic: {
    name: 'Mythic · Toy 3D',
    atlas: 'assets/render/themes/mythic-toon/atlas.json',
    attackAtlas: null,
    directionalAtlas: 'assets/render/themes/mythic-toon/ranger-directional.json',
    additionalDirectionalAtlases: [
      'assets/render/themes/mythic-toon/swordsman-directional.json',
      'assets/render/themes/mythic-toon/archer-directional.json',
      'assets/render/themes/mythic-toon/spearman-directional.json',
      'assets/render/themes/mythic-toon/cavalry-directional.json',
    ],
  },
  halloween: {
    name: 'Halloween · Toy 3D',
    atlas: 'assets/render/themes/halloween-toon/atlas.json',
    attackAtlas: null,
    directionalAtlas: null,
    additionalDirectionalAtlases: [],
  },
  space: {
    name: 'Space · Toy 3D',
    atlas: 'assets/render/themes/space-toon/atlas.json',
    attackAtlas: null,
    directionalAtlas: null,
    additionalDirectionalAtlases: [],
  },
} as const;

export type VisualThemeId = keyof typeof VISUAL_THEMES;

export function normalizeVisualTheme(value: unknown): VisualThemeId {
  return typeof value === 'string' && Object.hasOwn(VISUAL_THEMES, value)
    ? value as VisualThemeId
    : 'christmas';
}
