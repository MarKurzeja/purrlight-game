/** The four seasons, in order. Each lasts a number of days set by the journey length. */
export const SEASONS = Object.freeze([
  {
    id: "spring",
    name: "Spring",
    rule: "The cats are skittish and startle easily, but food lures them: every meal warms 25% more.",
  },
  {
    id: "summer",
    name: "Summer",
    rule: "The cats look for shade. Each shaded nook covers two cats. Cats left in the sun lose Warmth overnight.",
  },
  {
    id: "autumn",
    name: "Autumn",
    rule: "The cats are hunting. Look for rustling leaf piles around the village and join a mini-hunt.",
  },
  {
    id: "winter",
    name: "Winter",
    rule: "Warmth drains fast. Gather firewood, light the fires and split your cats into groups each night.",
  },
]);
