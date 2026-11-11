/**
 * The flow of a play session: title screen, new games, the phases of each day,
 * and the ending.
 */
import { tierOf } from "../core/bond.js";
import { beginDay, beginEvening, beginNight } from "../core/clock.js";
import { passNight } from "../core/day-cycle.js";
import { createDailyNotes } from "../core/notes.js";
import {
  createInitialState,
  currentSeason,
  presentCats,
} from "../core/state.js";
import { rollWishes } from "../core/wishes.js";
import { invalidateStage } from "../render/stage.js";
import { SEASONS } from "../data/seasons.js";
import { EveningScene } from "../scenes/evening.js";
import { FinaleScene } from "../scenes/finale.js";
import { TitleScene } from "../scenes/title.js";
import { WorldScene } from "../scenes/world.js";
import { showBanner, toast } from "../ui/feedback.js";
import { setHudVisible } from "../ui/hud.js";
import { showIntroLetter, showTitleMenu } from "../ui/letters.js";
import { openNightMenu } from "../ui/night.js";
import { closeSheet, showMessage } from "../ui/sheet.js";
import { ensureCatEntities, spawnPickups } from "./world.js";
import { loadLocalSave, saveGame } from "./persistence.js";
import { currentState, game } from "./runtime.js";
import { setScene } from "./scenes.js";

/** Clears everything about the previous session that is not saved. */
function resetRuntime() {
  Object.assign(game.player, {
    x: 800,
    y: 240,
    direction: "down",
    walkTarget: null,
    goal: null,
    moving: false,
  });
  game.cats = {};
  game.particles = [];
  game.floatingTexts = [];
  game.leadingCatId = null;
  game.sitting = false;
  game.wishTimers = {};
  game.strokingCatId = null;
  game.butterflies = [];
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
}

export function showTitle() {
  game.state = null;
  game.savedGame = loadLocalSave();
  setHudVisible(false);
  setScene(TitleScene);
  showTitleMenu();
}

/** @param {'full' | 'short'} mode */
export function beginNewGame(mode) {
  const state = createInitialState(mode);
  rollWishes(state, game.rng);
  createDailyNotes(state, game.rng);
  game.state = state;
  showIntroLetter();
}

/** Starts playing a new or loaded game. */
export function startGame(state) {
  game.state = state;
  resetRuntime();
  invalidateStage();
  if (state.phase === "evening") state.phase = "night"; // never resume mid-gathering
  if (!state.tasks || state.tasks.day !== state.day)
    createDailyNotes(state, game.rng);
  if (presentCats(state).every((c) => state.cats[c.id].wish === null))
    rollWishes(state, game.rng);
  for (const c of presentCats(state)) {
    const cat = state.cats[c.id];
    cat.tierSeen = Math.max(cat.tierSeen, tierOf(cat.bond)); // don't celebrate old tiers again
  }
  ensureCatEntities();
  spawnPickups();
  closeSheet();
  setHudVisible(true);
  setScene(WorldScene);
  if (state.phase === "night") {
    openNightMenu();
    return;
  }
  showBanner(
    currentSeason(state).name,
    `Day ${state.seasonDay}: ${state.phase}`,
  );
  if (state.day === 1 && state.phase === "dawn") {
    toast("Dawn. Gather food before the day begins: try the lake first.");
    setTimeout(
      () =>
        toast("The notes in the corner will guide you through your first day."),
      4000,
    );
  }
}

export function startDay() {
  beginDay(currentState());
  showBanner("Day", "Care for your cats");
  saveGame();
}

export function goToEvening() {
  beginEvening(currentState());
  setScene(EveningScene);
}

export function goToNight() {
  beginNight(currentState());
  setScene(WorldScene);
  saveGame();
  openNightMenu();
}

/** Sleeps through the night and shows what the morning brought. */
export function sleepUntilDawn() {
  const state = currentState();
  const { notes, newSeason } = passNight(state, game.rng);
  for (const entity of Object.values(game.cats)) entity.following = false;
  resetRuntime();
  ensureCatEntities();
  spawnPickups();
  closeSheet();
  saveGame();
  showBanner(currentSeason(state).name, `Day ${state.seasonDay}: dawn`);

  const showMorning = () => {
    if (notes.length) showMessage("This morning", notes, "Go out");
  };
  if (newSeason) {
    const season = SEASONS[state.season];
    showMessage(
      `${season.name} comes to Purrwind Alp`,
      [season.rule],
      "Begin the season",
      showMorning,
    );
  } else {
    showMorning();
  }
}

export function lightTheLantern() {
  closeSheet();
  setScene(FinaleScene);
}

/** After the finale: an endless village with no timers. */
export function enterRelaxMode() {
  const state = currentState();
  Object.assign(state, {
    relaxMode: true,
    lanternLit: true,
    phase: "day",
    clock: 0,
  });
  closeSheet();
  setScene(WorldScene);
  showBanner("Purrwind Alp", "Relax mode: no timers, no pressure");
  saveGame();
}

export function saveAndQuit() {
  saveGame();
  closeSheet();
  showTitle();
}
