/**
 * Cat personalities decide how a cat likes to be petted.
 * `strokeSpeed` is the range of hand speeds (pixels per second) the cat enjoys.
 * `sweetSpotMovesEvery` > 0 means the sweet spot wanders (in seconds).
 */
export const PERSONALITIES = Object.freeze({
  shy: {
    label: 'Shy one',
    rarity: 'Common',
    strokeSpeed: [20, 170],
    fright: 1.35,
    sweetSpotMovesEvery: 0,
    tip: 'Likes slow, careful touches and startles if you rush.',
  },
  lazy: {
    label: 'Lazybones',
    rarity: 'Common',
    strokeSpeed: [4, 110],
    fright: 0.65,
    sweetSpotMovesEvery: 0,
    tip: 'Wants the slowest strokes you can manage. Hard to scare.',
  },
  hunter: {
    label: 'Hunter',
    rarity: 'Common',
    strokeSpeed: [110, 700],
    fright: 1,
    sweetSpotMovesEvery: 0,
    tip: 'Wants quick, brisk scratches. Slow hands bore it.',
  },
  aristocrat: {
    label: 'Aristocrat',
    rarity: 'Rare',
    strokeSpeed: [40, 190],
    fright: 1.6,
    sweetSpotMovesEvery: 0,
    tip: 'Accepts measured strokes in exactly one place. Very easily offended.',
  },
  bandit: {
    label: 'Mad bandit',
    rarity: 'Rare',
    strokeSpeed: [50, 520],
    fright: 1.15,
    sweetSpotMovesEvery: 5.5,
    tip: 'The sweet spot moves around every few seconds. Stay alert.',
  },
  wise: {
    label: 'Wise old cat',
    rarity: 'Legendary',
    strokeSpeed: [50, 230],
    fright: 0.8,
    sweetSpotMovesEvery: 0,
    tip: 'Patient. Wants long, even strokes and rewards you for them.',
  },
});

/** Bond tiers, from strangers to soulmates, and the bond points needed for each. */
export const BOND_TIERS = Object.freeze([
  { name: 'Wary', min: 0, unlocks: '' },
  { name: 'Curious', min: 25, unlocks: 'Walk with me: they will follow you around the village.' },
  { name: 'Friendly', min: 70, unlocks: 'Lap time: once a day, a big Warmth boost.' },
  { name: 'Trusting', min: 140, unlocks: 'Gifts: they may leave presents at your door.' },
  { name: 'Soulmate', min: 240, unlocks: 'A secret: they will lead you somewhere hidden.' },
]);

/** Places on the big petting portrait (portrait coordinates). */
export const PET_ZONES = Object.freeze({
  ear: { name: 'behind the ear', x: 196, y: 82, r: 19 },
  cheek: { name: 'along the cheek', x: 146, y: 128, r: 15 },
  chin: { name: 'under the chin', x: 170, y: 164, r: 17 },
  back: { name: 'along the back', x: 280, y: 124, r: 30 },
  rump: { name: 'at the base of the tail', x: 345, y: 146, r: 20 },
});

/** Every cat hates having its belly touched. */
export const BELLY_ZONE = Object.freeze({ x: 268, y: 214, r: 38 });

/** Cats who live in the village from the first day. The others arrive as you rebuild. */
export const STARTING_CATS = Object.freeze(['biscuit', 'nettle', 'pim']);

/**
 * The cats of Purrwind Alp.
 * Tastes (`loves`, `likes`, `hates`), favourite toy and sweet spot are hidden from the player
 * and discovered through play.
 */
export const CATS = Object.freeze([
  {
    id: 'biscuit',
    name: 'Biscuit',
    personality: 'lazy',
    coat: {
      fur: '#eeb477',
      accent: '#d58a52',
      belly: '#fbe6c6',
      eye: '#5a4032',
      pattern: 'stripes',
    },
    loves: ['milk', 'milkbun'],
    likes: ['sardine', 'stone'],
    hates: ['herb'],
    favouriteToy: 'ball',
    sweetSpot: 'chin',
    secret: {
      x: 610,
      y: 214,
      hat: 'nightcap',
      text: 'Biscuit paws at a loose stone and pulls out a tiny striped nightcap, chewed at one end.',
    },
  },
  {
    id: 'nettle',
    name: 'Nettle',
    personality: 'hunter',
    coat: {
      fur: '#a7adb8',
      accent: '#6f7686',
      belly: '#dfe3ea',
      eye: '#7a9a4c',
      pattern: 'stripes',
    },
    loves: ['sardine', 'fishcake'],
    likes: ['trout', 'moonkoi'],
    hates: ['milk'],
    favouriteToy: 'laser',
    sweetSpot: 'ear',
    secret: {
      x: 1120,
      y: 212,
      hat: 'leafcap',
      text: 'Nettle digs under the old fence and drags out a little cap of stitched leaves, stiff with age.',
    },
  },
  {
    id: 'pim',
    name: 'Pim',
    personality: 'shy',
    coat: { fur: '#c9b6e0', accent: '#a48fc4', belly: '#efe7f7', eye: '#6a7fc0', pattern: 'none' },
    loves: ['herb', 'biscuit'],
    likes: ['milk'],
    hates: ['sardine', 'trout'],
    favouriteToy: 'ribbon',
    sweetSpot: 'cheek',
    secret: {
      x: 1380,
      y: 216,
      hat: 'bow',
      text: 'Pim creeps behind the Lantern steps and noses out a faded blue bow. A child must have tied it long ago.',
    },
  },
  {
    id: 'marzipan',
    name: 'Duchess Marzipan',
    personality: 'aristocrat',
    coat: { fur: '#f6f1ee', accent: '#e3cfd4', belly: '#ffffff', eye: '#6fa7c9', pattern: 'none' },
    loves: ['tart', 'moonkoi'],
    likes: ['milkbun', 'fishcake'],
    hates: ['stone', 'herb'],
    favouriteToy: 'ribbon',
    sweetSpot: 'back',
    secret: {
      x: 960,
      y: 214,
      hat: 'tiara',
      text: 'The Duchess leads you, unhurried, to a hollow in the wall, and allows you to find a very small tiara.',
    },
  },
  {
    id: 'scrap',
    name: 'Scrap',
    personality: 'bandit',
    coat: { fur: '#4c4658', accent: '#2f2b3a', belly: '#efe9e0', eye: '#e0b94e', pattern: 'tux' },
    loves: ['fishcake', 'catnip'],
    likes: ['sardine', 'tart', 'biscuit'],
    hates: ['milkbun'],
    favouriteToy: 'laser',
    sweetSpot: 'rump',
    secret: {
      x: 60,
      y: 214,
      hat: 'eyepatch',
      text: 'Scrap vanishes into the reeds, then returns wearing, briefly, a tiny eyepatch. He drops it at your feet like treasure.',
    },
  },
  {
    id: 'moss',
    name: 'Grandmother Moss',
    personality: 'wise',
    coat: {
      fur: '#ddd6c7',
      accent: '#b27a4b',
      belly: '#f2ecdf',
      eye: '#7f9a6a',
      pattern: 'calico',
    },
    loves: ['moonkoi', 'biscuit', 'nipcookie'],
    likes: ['herb', 'stone', 'milk'],
    hates: [],
    favouriteToy: 'ball',
    sweetSpot: 'back',
    secret: {
      x: 1030,
      y: 214,
      hat: 'spectacles',
      text: "Moss takes you to a stone marked with a lantern and a paw. Beneath it are a tiny pair of spectacles and a folded note: It was always everybody's turn.",
    },
  },
  {
    id: 'pudding',
    name: 'Pudding',
    personality: 'lazy',
    coat: { fur: '#b98f6f', accent: '#8c6a52', belly: '#ecd8c2', eye: '#c98a3a', pattern: 'point' },
    loves: ['catnip', 'nipcookie'],
    likes: ['milkbun', 'stone', 'milk'],
    hates: ['moonkoi'],
    favouriteToy: 'ball',
    sweetSpot: 'chin',
    secret: {
      x: 1110,
      y: 250,
      hat: 'sunhat',
      text: 'Pudding sits on a warm patch of ground until you dig. You find a tiny straw sunhat in a tin, packed with care.',
    },
  },
  {
    id: 'tansy',
    name: 'Tansy',
    personality: 'hunter',
    coat: {
      fur: '#efe2cf',
      accent: '#c8703f',
      belly: '#fffaf0',
      eye: '#58a58f',
      pattern: 'calico',
    },
    loves: ['catnip', 'trout'],
    likes: ['herb', 'sardine'],
    hates: ['milk', 'biscuit'],
    favouriteToy: 'ribbon',
    sweetSpot: 'ear',
    secret: {
      x: 1220,
      y: 214,
      hat: 'flower',
      text: 'Tansy pounces on nothing, twice, then shows you a dried crown of tansy flowers tucked under the greenhouse step.',
    },
  },
]);

/** Lookup table: cat id to cat definition. */
export const CAT_BY_ID = Object.freeze(Object.fromEntries(CATS.map((cat) => [cat.id, cat])));
