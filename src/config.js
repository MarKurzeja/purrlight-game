/**
 * Global configuration and tuning numbers.
 * Gameplay balance lives here so it can be tweaked without touching any logic.
 */

/** Size of the low-resolution pixel canvas. Everything is drawn at this size and upscaled. */
export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 270;

/** The village is a side-scrolling panorama wider than the screen. */
export const WORLD_WIDTH = 1480;

/**
 * The village floor plan, in "world pixels" (10 per metre in 3D). x runs along the street,
 * y runs from the houses at the back (small y) towards the camera (large y).
 */
export const GROUND_TOP = 160;
export const GROUND_BOTTOM = 330;
/** Where the house fronts stand. */
export const BUILDING_LINE = 150;
/** 3D metres per world pixel, and the world point that sits at the 3D origin. */
export const METRES_PER_PIXEL = 0.1;
export const WORLD_ORIGIN = Object.freeze({ x: 740, y: 245 });

/** Real-time length of each phase, in seconds. Actions also spend time. */
export const DAWN_SECONDS = 110;
export const DAY_SECONDS = 230;

export const SAVE_KEY = "purrlight.save.v3";
export const SAVE_VERSION = 3;

export const BALANCE = Object.freeze({
  /** Below this Warmth a cat is a wary stray: it eats, but cannot be petted or played with. */
  waryBelow: 30,
  minWarmth: 5,
  maxWarmth: 100,
  /** Meals, petting sessions and games each cat accepts per day. */
  mealsPerDay: 2,
  petsPerDay: 2,
  gamesPerDay: 2,
  /** Spring makes every meal warm more. */
  springMealBonus: 1.25,
  /** The second meal of the day is less effective. */
  secondMealFactor: 0.55,
  /** Multiplier on food warmth by how much the cat likes it. */
  tasteFactor: { love: 1.9, like: 1.3, meh: 1, hate: 0.25 },
  tasteBond: { love: 2, like: 1, meh: 0.5, hate: -1 },
  /**
   * Short journeys (4-day seasons) earn Purrs and bond this much faster, so the story
   * still ends around the last day of winter. Checked by tools/simulate.js.
   */
  shortJourneyPace: 2.1,
  seasonDays: { full: 10, short: 4 },
  /** Overnight Warmth loss, reduced by one per piece of decor, with a floor. */
  overnightLoss: 11,
  overnightLossFloor: 4,
  summerSunLoss: 13,
  winterLitLoss: 5,
  winterColdLoss: 34,
  catsPerFire: 3,
  catsPerNook: 2,
  firewoodPerFire: 2,
  nookCost: 30,
  /** Stroking a cat in the village (hold with the hand tool). */
  strokeWarmthPerSecond: 3,
  strokeDailyCap: 10,
  strokeBondPerSecond: 0.3,
  /** Sitting quietly next to a cat. */
  coaxWarmthPerSecond: 1.4,
  coaxDailyCap: 12,
  sitBondPerSecond: 0.25,
  sitBondDailyCap: 1.5,
  /** A granted wish. */
  wishWarmth: 8,
  wishBond: 1.5,
  wishRepeatChance: 0.45,
  /** Evening fire. */
  memoryChance: 0.75,
  memoryMinWarmth: 50,
  memoriesPerCat: 5,
  memoriesForLantern: 20,
  /** Daily notes. */
  allNotesBonus: 10,
  lapWarmth: 12,
  lapBond: 1.5,
  petBond: 3,
  playBond: { favourite: 2, other: 1 },
  renameBond: 2,
  secretBond: 5,
  memoryReadBond: 1,
  /** Evening Purrs per warm cat: base + warmth / divisor + tier. */
  eveningBasePurrs: 2,
  eveningWarmthDivisor: 20,
  photoPurrs: 2,
  castsPerDay: 3,
});

/** Time cost, in in-game seconds, of each action. */
export const ACTION_SECONDS = Object.freeze({
  gather: 2,
  milk: 4,
  feed: 4,
  minigame: 10,
  hunt: 8,
  lap: 6,
});
