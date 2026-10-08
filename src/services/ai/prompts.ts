import type { SpaceType, TextureCategory } from '../../db/schema';

/** The six scenes, in the order they are shown. */
export const SPACE_ORDER: SpaceType[] = [
  'living_room_floor',
  'bedroom_floor',
  'kitchen',
  'bathroom',
  'staircase',
  'feature_wall',
];

const SCENES: Record<SpaceType, { scene: string; where: string }> = {
  living_room_floor: {
    scene: 'a spacious, elegant living room seen at eye level, with a sofa, coffee table and large windows; most of the floor is clearly visible',
    where: 'The entire floor',
  },
  bedroom_floor: {
    scene: 'a calm, inviting bedroom with a made bed and bedside tables; a large area of the floor is clearly visible',
    where: 'The entire floor',
  },
  kitchen: {
    scene: 'a modern kitchen with cabinets, an island and pendant lights',
    where: 'The kitchen countertops, island top and the floor',
  },
  bathroom: {
    scene: 'a luxurious bathroom with a vanity, a large mirror and a walk-in shower',
    where: 'The bathroom floor and the walls',
  },
  staircase: {
    scene: 'an interior staircase in a modern home, viewed from slightly below so the steps are clearly visible',
    where: 'Every stair tread (the flat step) and riser (the vertical face)',
  },
  feature_wall: {
    scene: 'a stylish living area with one large statement wall behind a sofa or TV unit',
    where: 'That one full feature wall',
  },
};

const LAYING: Record<TextureCategory, string> = {
  marble: 'large polished slabs with natural, continuous veining',
  granite: 'large polished slabs',
  stone: 'large natural stone slabs',
  tile: 'tiles at a realistic size with neat, thin grout lines',
  wood: 'planks at a realistic size',
};

const DEFAULT_STYLE = 'an elegant, modern home with soft natural daylight';

/**
 * Builds the instruction sent to the AI for one space.
 * The sample photo is attached to the request as the reference image.
 */
export function buildMasterPrompt(
  space: SpaceType,
  sample: { name: string; category: TextureCategory },
  userPrompt: string,
): string {
  const { scene, where } = SCENES[space];
  const style = userPrompt.trim() || DEFAULT_STYLE;
  return [
    `The attached image is a close-up photo of a ${sample.category} surface sample called "${sample.name}".`,
    `Create a new, photorealistic interior photograph of ${scene}.`,
    `${where} must be finished in exactly this material, laid as ${LAYING[sample.category]}.`,
    'Match the sample’s colour, pattern, veining, texture and shine as closely as possible, at a natural, realistic scale.',
    'Do not show the sample photo itself. No text, logos, watermarks or people.',
    'Professional architectural interior photography, realistic lighting and reflections, sharp detail.',
    `Style: ${style}.`,
  ].join(' ');
}
