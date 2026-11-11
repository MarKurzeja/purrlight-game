/** The "How to play" card: controls and the shape of a day, one keypress away (H). */
import { IS_TOUCH } from "../engine/dom.js";
import { isSheetOpen, openSheet } from "./sheet.js";

const KEYS = [
  ["WASD / arrows, or click", "Walk"],
  ["E or Space", "Use what is in front of you"],
  ["1 to 7", "Pick a tool: look, stroke, or a food"],
  ["Hold E (stroke tool)", "Stroke a friendly cat"],
  ["Q", "Sit quietly so wary cats come closer"],
  ["J", "Journal: cats, memories and album"],
  ["Esc", "Close a menu, stand up, stop stroking"],
  ["H", "This card"],
];

const TOUCH = [
  ["Tap the ground", "Walk there"],
  ["Tap a cat, item, the lake or the goat", "Walk over and use it"],
  ["Tool bar", "Look, stroke, or feed a food directly"],
  ["Sit quietly", "Wary cats slowly come closer"],
];

/** Opens the help card, unless another menu is already open. */
export function openHelp() {
  if (isSheetOpen()) return;
  const rows = (IS_TOUCH ? TOUCH : KEYS)
    .map(
      ([key, what]) =>
        `<tr><th scope="row"><kbd>${key}</kbd></th><td>${what}</td></tr>`,
    )
    .join("");
  openSheet(
    `<h2>How to play</h2>
    <table class="keys">${rows}</table>
    <h3>A day in the village</h3>
    <ol class="day-shape">
      <li><b>Dawn.</b> Forage: fish the lake, milk Clover, pick up herbs and stones.</li>
      <li><b>Day.</b> Care for the cats. Speech bubbles show what each one wants.</li>
      <li><b>Evening.</b> Cats who trust you gather at the fire and give you Purrs.</li>
      <li><b>Night.</b> Spend Purrs to rebuild the village; each building brings a new cat home.</li>
    </ol>
    <p class="dim">Wary cats won't let you touch them yet. Feed them, or sit quietly nearby.</p>`,
    { className: "small" },
  );
}
