/** Full-screen story moments: the title menu, the opening letter and the finale letter. */
import { CAT_BY_ID } from "../data/cats.js";
import { SEASONS } from "../data/seasons.js";
import { FINALE_LETTER, INTRO_LETTER } from "../data/story.js";
import { escapeHtml } from "../engine/dom.js";
import { memoryIllustration } from "../render/vignette.js";
import { game } from "../game/runtime.js";
import { actionButton } from "./components.js";
import { openSheet } from "./sheet.js";

/** @param {{ from: string, paragraphs: readonly string[] }} letter */
const letterHtml = (letter, illustration = "") =>
  `<div class="letter">${illustration}<p class="from">${escapeHtml(letter.from)}</p>${letter.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</div>`;

export function showTitleMenu() {
  const saved = game.savedGame;
  const resume = saved
    ? actionButton(
        "continue",
        `Continue, ${SEASONS[saved.season].name} day ${saved.seasonDay}`,
        {
          className: "btn big",
        },
      )
    : "";
  openSheet(
    `<div class="title"><h1>Purrlight</h1><p>A quiet Alpine village, a few wary cats, and a lantern to relight.</p>
    <div class="title-buttons">${resume}
      ${actionButton("new-game", "New journey: 10-day seasons", { value: "full", className: saved ? "btn" : "btn big" })}
      ${actionButton("new-game", "Short journey: 4-day seasons", { value: "short" })}</div>
    <p class="dim">One day takes about 6 minutes. Music starts with your first click.</p></div>`,
    { className: "bare", closable: false },
  );
}

export function showIntroLetter() {
  openSheet(
    `${letterHtml(INTRO_LETTER)}${actionButton("begin", "Take the mountain road", { className: "btn big" })}`,
    {
      className: "paper",
      closable: false,
    },
  );
}

export function showFinaleLetter() {
  const picture = `<img alt="" class="vignette" src="${memoryIllustration(CAT_BY_ID.moss, 3)}">`;
  openSheet(
    `${letterHtml(FINALE_LETTER, picture)}<p class="note">The shutters are open. The cats have found their laps. The village is yours.</p>
    ${actionButton("relax", "Stay in the village (relax mode)", { className: "btn big" })}`,
    { className: "paper", closable: false },
  );
}
