/** Colour palettes for the landscape, per season and time of day. */

export const SEASON_PALETTES = Object.freeze({
  spring: {
    snow: 1,
    rock: ["#4a5678", "#6a7898", "#93a0bb", "#b9c3d6"],
    forest: ["#2c5f58", "#3b7a62", "#54986f", "#74b47c"],
    meadow: ["#6fae62", "#8cc66a", "#a9da7c", "#c9ea92"],
    path: ["#b89f82", "#cdb898", "#e0cdae"],
    flowers: ["#f7d84e", "#ffffff", "#f29ab8", "#a78be0"],
    larches: false,
  },
  summer: {
    snow: 0.7,
    rock: ["#465274", "#667494", "#8f9cb6", "#b4bfd2"],
    forest: ["#245a50", "#30725a", "#468e66", "#62a872"],
    meadow: ["#5aa458", "#74bc5e", "#92d268", "#b4e47c"],
    path: ["#b89a7a", "#cfb48e", "#e4cca4"],
    flowers: ["#ef5a5a", "#ffffff", "#5f7fe0", "#f7d84e", "#c88be0"],
    larches: false,
  },
  autumn: {
    snow: 0.8,
    rock: ["#4e4f70", "#70708e", "#9896ad", "#bcb8c8"],
    forest: ["#3a5a4c", "#a8742e", "#d89a34", "#f0c04a"],
    meadow: ["#8d9a4a", "#aeb050", "#cbc05a", "#e4d578"],
    path: ["#a88e72", "#c0a686", "#d6c09e"],
    flowers: ["#c89ae0", "#f0c04a", "#ffffff"],
    larches: true,
  },
  winter: {
    snow: 1.6,
    rock: ["#5a6a90", "#7c8cb0", "#a4b2cc", "#c8d4e6"],
    forest: ["#4a6a84", "#6e8ca6", "#a8c0d6", "#dce8f4"],
    meadow: ["#c4d4ec", "#d8e4f4", "#ecf3fb", "#ffffff"],
    path: ["#b0bed8", "#c8d4e8", "#dfe7f4"],
    flowers: [],
    larches: false,
  },
});

export const SNOW_RAMP = Object.freeze([
  "#9cb2d8",
  "#b6cae6",
  "#d2e0f2",
  "#ecf3fb",
  "#ffffff",
]);
export const LARCH_RAMP = Object.freeze([
  "#b0702a",
  "#dc9c34",
  "#f2c44c",
  "#ffe07e",
]);

/**
 * Times of day. Each pre-rendered layer exists in four colour grades so day/night transitions
 * are a cross-fade between two images instead of per-frame recolouring.
 * `strength` 0 means "use the image as painted".
 */
export const TIME_GRADES = Object.freeze([
  { name: "dawn", strength: 0.42, shadow: "#5b4f96", highlight: "#ffd9c9" },
  { name: "day", strength: 0, shadow: "#000000", highlight: "#ffffff" },
  { name: "dusk", strength: 0.5, shadow: "#4c3478", highlight: "#ffbb7c" },
  { name: "night", strength: 0.82, shadow: "#10183c", highlight: "#8fa9dc" },
]);
export const GRADE = Object.freeze({ dawn: 0, day: 1, dusk: 2, night: 3 });

/** Sky gradients for each grade: [colour, position] stops. */
export const SKY_GRADIENTS = Object.freeze([
  [
    ["#6a7ec4", 0],
    ["#b79fd8", 0.35],
    ["#f4b8c0", 0.62],
    ["#ffdcb4", 0.8],
  ],
  [
    ["#4a9ee0", 0],
    ["#7cc0ee", 0.4],
    ["#bfe4f6", 0.7],
    ["#e6f4fb", 0.85],
  ],
  [
    ["#3c4a96", 0],
    ["#9060a8", 0.3],
    ["#ee8a82", 0.58],
    ["#ffc27e", 0.78],
  ],
  [
    ["#0c1136", 0],
    ["#1a2358", 0.45],
    ["#2c3a78", 0.78],
    ["#3a4a8c", 1],
  ],
]);

/** Tint applied to characters so they sit in the same light as the scenery. [r, g, b, alpha] */
export const ACTOR_TINTS = Object.freeze([
  [255, 170, 150, 0.14],
  [0, 0, 0, 0],
  [255, 130, 70, 0.22],
  [24, 30, 84, 0.56],
]);
