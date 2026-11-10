/** Everything a cat can eat. `warmth` is the base Warmth a neutral meal gives. */
export const FOODS = Object.freeze({
  sardine: { name: 'Sardine', description: 'A small silver fish from the lake.', warmth: 14 },
  trout: { name: 'Speckled trout', description: 'Needs a good rod and steady timing.', warmth: 20 },
  moonkoi: { name: 'Moon koi', description: 'A rare pale fish that glows faintly.', warmth: 30 },
  herb: {
    name: 'Wild herbs',
    description: 'Thyme and cat-mint from the alpine verges.',
    warmth: 11,
  },
  milk: { name: 'Goat milk', description: 'Still warm from Clover the goat.', warmth: 15 },
  stone: { name: 'Warm stone', description: 'Holds the sun. Works on any cat.', warmth: 12 },
  catnip: { name: 'Catnip', description: 'Grown in the greenhouse. Causes zoomies.', warmth: 32 },
  biscuit: { name: 'Herb biscuit', description: 'Crumbly and fragrant.', warmth: 24 },
  fishcake: { name: 'Fish cake', description: 'Sardine and herbs, pan-crisped.', warmth: 30 },
  milkbun: { name: 'Milk bun', description: 'A soft, sweet roll.', warmth: 30 },
  tart: { name: 'Golden tart', description: 'Trout custard. Oddly, cats adore it.', warmth: 40 },
  nipcookie: { name: 'Catnip cookie', description: 'For very good cats.', warmth: 44 },
});

/** All bag items: every food, plus firewood. */
export const ITEMS = Object.freeze({
  wood: { name: 'Firewood', description: 'Two logs light one winter fire.' },
  ...FOODS,
});

/** Bakery recipes. */
export const RECIPES = Object.freeze([
  { output: 'biscuit', ingredients: { herb: 2 } },
  { output: 'fishcake', ingredients: { sardine: 1, herb: 1 } },
  { output: 'milkbun', ingredients: { milk: 2 } },
  { output: 'tart', ingredients: { trout: 1, milk: 1 } },
  { output: 'nipcookie', ingredients: { catnip: 1, milk: 1 } },
]);

/** Fishing rods sold at the Fisherman's Hut. Index = rod level. */
export const RODS = Object.freeze([
  { name: 'Bamboo rod', cost: 0, description: 'Catches sardines.' },
  { name: 'Willow rod', cost: 40, description: 'Wider timing. Speckled trout will bite.' },
  { name: 'Moonthread rod', cost: 120, description: 'Widest timing. Moon koi will bite.' },
]);

export const TOYS = Object.freeze({
  laser: 'Laser pointer',
  ribbon: 'Ribbon wand',
  ball: 'Yarn ball',
});

/** Hats. Hats with a cost of 0 cannot be bought: soulmate cats lead you to them. */
export const HATS = Object.freeze({
  bow: { name: 'Blue bow', cost: 18 },
  straw: { name: 'Straw hat', cost: 20 },
  beret: { name: 'Beret', cost: 24 },
  acorn: { name: 'Acorn cap', cost: 16 },
  crown: { name: 'Paper crown', cost: 40 },
  nightcap: { name: 'Striped nightcap', cost: 0 },
  leafcap: { name: 'Leaf cap', cost: 0 },
  tiara: { name: 'Tiny tiara', cost: 0 },
  eyepatch: { name: 'Tiny eyepatch', cost: 0 },
  spectacles: { name: 'Tiny spectacles', cost: 0 },
  sunhat: { name: 'Tin sunhat', cost: 0 },
  flower: { name: 'Tansy crown', cost: 0 },
});
