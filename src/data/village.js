/** Buildings you can rebuild at night. Each one brings a new cat home. */
export const BUILDINGS = Object.freeze({
  hut: {
    name: "Fisherman's Hut",
    cost: 40,
    description: 'Sells better rods, and rare fish start to bite.',
    bringsCat: 'scrap',
  },
  bakery: {
    name: 'Bakery',
    cost: 90,
    description: 'Bake treats with big Warmth bonuses.',
    bringsCat: 'marzipan',
  },
  library: {
    name: 'Library',
    cost: 140,
    description: 'Read the memories your cats give you.',
    bringsCat: 'moss',
  },
  observatory: {
    name: 'Rooftop Observatory',
    cost: 200,
    description: 'Your warmest cats catch sunbeams and earn Purrs each morning.',
    bringsCat: 'pudding',
  },
  greenhouse: {
    name: 'Greenhouse',
    cost: 260,
    description: 'Grow catnip from wild herbs.',
    bringsCat: 'tansy',
  },
});

/** Where each building stands in the panorama (x is the left edge, in world pixels). */
export const BUILDING_LAYOUT = Object.freeze([
  { id: 'hut', x: 452, w: 74, h: 44 },
  { id: 'bakery', x: 590, w: 78, h: 54 },
  { id: 'library', x: 930, w: 70, h: 70 },
  { id: 'observatory', x: 1056, w: 74, h: 58 },
  { id: 'greenhouse', x: 1172, w: 76, h: 40 },
]);

/** Houses whose shutters open as the village comes back to life. */
export const COTTAGES = Object.freeze([
  { x: 690, w: 62, h: 48 },
  { x: 846, w: 58, h: 46 },
  { x: 1010, w: 40, h: 38 },
]);

/** Fixed landmarks, in world coordinates. */
export const LANDMARKS = Object.freeze({
  /** Where you stand to fish. */
  lake: { x: 300, y: 236 },
  goat: { x: 1290, y: 196 },
  fire: { x: 820, y: 262 },
  fountain: { x: 730, y: 205 },
  /** Where you stand to inspect the Lantern; the tower itself is on the hill behind. */
  lantern: { x: 1420, y: 200 },
  lanternTower: { x: 1440, y: 112 },
  flag: { x: 772, y: 172 },
});

/** The lake: an ellipse you cannot walk into. */
export const LAKE = Object.freeze({ x: 220, y: 172, rx: 214, ry: 58 });

/** Shaded nooks you can build for summer, in build order. */
export const NOOKS = Object.freeze([
  { x: 690, y: 300 },
  { x: 785, y: 316 },
  { x: 880, y: 308 },
  { x: 955, y: 288 },
]);

export const DECOR = Object.freeze([
  {
    id: 'bedrose',
    name: 'Red wool cat bed',
    cost: 28,
    x: 700,
    y: 262,
    kind: 'bed',
    color: '#d8524c',
  },
  { id: 'bedmint', name: 'Loden cat bed', cost: 28, x: 905, y: 262, kind: 'bed', color: '#6f9a78' },
  {
    id: 'bedsky',
    name: 'Lake-blue cat bed',
    cost: 28,
    x: 860,
    y: 296,
    kind: 'bed',
    color: '#6fb0cc',
  },
  {
    id: 'postsisal',
    name: 'Sisal scratching post',
    cost: 24,
    x: 640,
    y: 232,
    kind: 'post',
    color: '#c9a877',
  },
  {
    id: 'posttall',
    name: 'Tall scratching post',
    cost: 36,
    x: 975,
    y: 230,
    kind: 'post',
    color: '#b98a5a',
  },
  {
    id: 'postdrift',
    name: 'Driftwood post',
    cost: 24,
    x: 560,
    y: 250,
    kind: 'post',
    color: '#a8a092',
  },
]);

/** The three repairs the Great Lantern needs before it can be lit. */
export const LANTERN_PARTS = Object.freeze([
  {
    id: 'wick',
    name: 'New wick',
    cost: 350,
    description: 'Plaited from shed cat fur and old ribbon.',
  },
  { id: 'lens', name: 'Mended lens', cost: 500, description: 'Reset the cracked glass.' },
  {
    id: 'stair',
    name: 'Rebuilt stair',
    cost: 650,
    description: 'So every cat can climb to the top.',
  },
]);

/** Winter fires. The bonfire is always available; the others need their building. */
export const FIRES = Object.freeze([
  { id: 'bonfire', name: 'Village bonfire', needs: null },
  { id: 'hut', name: 'Hut stove', needs: 'hut' },
  { id: 'bakery', name: 'Bakery oven', needs: 'bakery' },
  { id: 'library', name: 'Library hearth', needs: 'library' },
  { id: 'greenhouse', name: 'Greenhouse brazier', needs: 'greenhouse' },
]);
