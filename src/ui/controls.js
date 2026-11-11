/**
 * Connects the HTML controls to the game. Every button carries a `data-action` (and maybe a
 * `data-value`); one delegated listener looks the action up in ACTIONS.
 */
import { assignFire, lightFire } from "../core/winter.js";
import {
  bake,
  buildBuilding,
  buildNook,
  buyDecor,
  buyHat,
  buyRod,
  plantHerb,
  repairLantern,
} from "../core/shop.js";
import { readMemory } from "../core/progress.js";
import {
  audioSettings,
  initAudio,
  playSound,
  setMusicEnabled,
} from "../engine/audio.js";
import { qs } from "../engine/dom.js";
import { itemIcon } from "../render/sprites.js";
import {
  feed,
  followToSecret,
  photograph,
  putOnHat,
  rename,
  sitOnLap,
  toggleFollow,
} from "../game/actions.js";
import { saveGame } from "../game/persistence.js";
import { currentState, game } from "../game/runtime.js";
import { setScene } from "../game/scenes.js";
import {
  beginNewGame,
  enterRelaxMode,
  goToEvening,
  goToNight,
  lightTheLantern,
  saveAndQuit,
  sleepUntilDawn,
  startDay,
  startGame,
} from "../game/session.js";
import { PettingScene } from "../scenes/petting.js";
import { BallScene, LaserScene, RibbonScene } from "../scenes/toys.js";
import {
  openCatMenu,
  openFeedMenu,
  openHatMenu,
  openRenameMenu,
  openToyMenu,
} from "./cat-menus.js";
import { toast } from "./feedback.js";
import { toggleGoals } from "./goals.js";
import { selectTool, toolHint } from "./tools.js";
import { refreshHud } from "./hud.js";
import { openHelp } from "./help.js";
import { openJournal, openMemoryLetter } from "./journal.js";
import { openLanternMenu } from "./lantern.js";
import { openNightMenu } from "./night.js";
import { closeSheet, hideSheet } from "./sheet.js";

const TOY_SCENES = { laser: LaserScene, ribbon: RibbonScene, ball: BallScene };

/** The selected cat. Menus always set it before showing cat actions. */
const cat = () => /** @type {string} */ (game.selectedCatId);

/**
 * Runs a night-time purchase, then refreshes the menu on the given tab.
 * @param {{ ok: boolean, reason?: string }} result
 */
function afterPurchase(result, tab, sound = "get") {
  if (result.ok) {
    playSound(/** @type {any} */ (sound));
    saveGame();
  } else if (result.reason) {
    toast(result.reason);
  }
  refreshHud();
  openNightMenu(tab);
}

/** @type {Record<string, (value: string) => void>} */
const ACTIONS = {
  close: () => closeSheet(),
  "toggle-goals": () => toggleGoals(),
  tool: (tool) => {
    selectTool(tool);
    const hint = toolHint();
    if (hint) toast(hint);
  },

  // Title and story
  continue: () => game.savedGame && startGame(game.savedGame),
  "new-game": (mode) => beginNewGame(mode === "short" ? "short" : "full"),
  begin: () => startGame(currentState()),
  "light-lantern": () => lightTheLantern(),
  relax: () => enterRelaxMode(),

  // One cat
  cat: () => openCatMenu(cat()),
  feed: () => openFeedMenu(cat()),
  eat: (food) => eat(food),
  pet: () => {
    hideSheet();
    setScene(PettingScene);
  },
  toys: () => openToyMenu(cat()),
  toy: (toy) => {
    hideSheet();
    setScene(TOY_SCENES[toy]);
  },
  follow: () => {
    const following = toggleFollow(cat());
    toast(
      following
        ? `${currentState().cats[cat()].name} trots along behind you.`
        : "You go your separate ways for now.",
    );
    closeSheet();
  },
  lap: () => {
    if (sitOnLap(cat())) {
      toast(
        `${currentState().cats[cat()].name} jumps onto your lap and settles. +12 Warmth.`,
      );
    }
    closeSheet();
  },
  secret: () => {
    followToSecret(cat());
    toast(
      `${currentState().cats[cat()].name} looks back at you and sets off. Stay close.`,
    );
    closeSheet();
  },
  photo: () => {
    const { isNew, pose } = photograph(cat());
    const name = currentState().cats[cat()].name;
    const label =
      {
        wary: "Wary",
        sit: "Sitting",
        loaf: "Loafing",
        sleep: "Sleeping",
        walk: "Walking",
      }[pose] ?? pose;
    toast(
      isNew
        ? `New photo: ${name}, ${label}. +2 Purrs for the album.`
        : `You already have ${name}, ${label}. Wait for another pose.`,
    );
    openCatMenu(cat());
  },
  hats: () => openHatMenu(cat()),
  wear: (hat) => {
    putOnHat(cat(), hat);
    openCatMenu(cat());
  },
  rename: () => openRenameMenu(cat()),

  // Journal and memories
  journal: (tab) => openJournal(tab || "cats"),
  read: (value) => {
    const [catId, index] = value.split(":");
    if (readMemory(currentState(), catId, Number(index)).isNew) saveGame();
    openMemoryLetter(catId, Number(index));
  },
  "toggle-music": () => {
    setMusicEnabled(!audioSettings.music);
    qs("#music-toggle").textContent = audioSettings.music
      ? "Music on"
      : "Music off";
    openJournal("options");
  },
  "toggle-sounds": () => {
    audioSettings.effects = !audioSettings.effects;
    openJournal("options");
  },
  "save-quit": () => saveAndQuit(),

  // Night
  night: (tab) => openNightMenu(tab),
  build: (id) =>
    afterPurchase(buildBuilding(currentState(), id), "build", "build"),
  "build-nook": () =>
    afterPurchase(buildNook(currentState()), "build", "build"),
  rod: (level) => afterPurchase(buyRod(currentState(), Number(level)), "hut"),
  bake: (index) => afterPurchase(bake(currentState(), Number(index)), "bakery"),
  plant: (plot) =>
    afterPurchase(plantHerb(currentState(), Number(plot)), "greenhouse"),
  "buy-hat": (hat) => afterPurchase(buyHat(currentState(), hat), "market"),
  "buy-decor": (id) => afterPurchase(buyDecor(currentState(), id), "market"),
  "light-fire": (fire) =>
    afterPurchase(
      lightFire(currentState(), fire)
        ? { ok: true }
        : { ok: false, reason: "You need more firewood." },
      "fires",
    ),
  lantern: () => openLanternMenu(),
  repair: (part) => {
    const result = repairLantern(currentState(), part);
    if (result.ok) {
      playSound("build");
      saveGame();
    } else toast(result.reason);
    refreshHud();
    openLanternMenu();
  },
  sleep: () => sleepUntilDawn(),
};

function eat(food) {
  const result = feed(cat(), food);
  refreshHud();
  if (!result.ok) {
    toast(result.reason);
    openCatMenu(cat());
  } else if (result.full) {
    toast(result.message);
    openCatMenu(cat());
  } else {
    openFeedMenu(cat(), result.message);
  }
}

/* ---------- Drag food into the bowl ---------- */

/** @type {{ food: string, startX: number, startY: number, ghost: HTMLImageElement | null } | null} */
let drag = null;
let suppressNextClick = false;

function overBowl(event) {
  const bowl = document.getElementById("bowl");
  if (!bowl) return false;
  const box = bowl.getBoundingClientRect();
  return (
    event.clientX > box.left &&
    event.clientX < box.right &&
    event.clientY > box.top &&
    event.clientY < box.bottom
  );
}

function bindDragToBowl() {
  document.addEventListener("pointerdown", (event) => {
    const source = /** @type {HTMLElement} */ (event.target).closest(
      "[data-drag]",
    );
    if (source instanceof HTMLElement) {
      drag = {
        food: source.dataset.drag ?? "",
        startX: event.clientX,
        startY: event.clientY,
        ghost: null,
      };
    }
  });
  document.addEventListener("pointermove", (event) => {
    if (!drag) return;
    if (
      !drag.ghost &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8
    ) {
      drag.ghost = document.createElement("img");
      drag.ghost.src = itemIcon(drag.food).toDataURL();
      drag.ghost.className = "drag-icon";
      document.body.append(drag.ghost);
    }
    if (drag.ghost) {
      drag.ghost.style.left = `${event.clientX}px`;
      drag.ghost.style.top = `${event.clientY}px`;
      document
        .getElementById("bowl")
        ?.classList.toggle("over", overBowl(event));
    }
  });
  document.addEventListener("pointerup", (event) => {
    if (!drag) return;
    const { ghost, food } = drag;
    drag = null;
    if (!ghost) return; // a plain tap: the click handler feeds
    ghost.remove();
    suppressNextClick = true;
    setTimeout(() => (suppressNextClick = false), 50);
    if (overBowl(event)) eat(food);
  });
}

/* ---------- Wiring ---------- */

/** Attaches every listener. Call once at start-up. */
export function bindControls() {
  document.addEventListener("click", (event) => {
    initAudio();
    const button = /** @type {HTMLElement} */ (event.target).closest(
      "[data-action]",
    );
    if (!(button instanceof HTMLElement) || button.hasAttribute("disabled")) {
      return;
    }
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    const action = button.dataset.action ?? "";
    if (action !== "eat") playSound("click");
    ACTIONS[action]?.(button.dataset.value ?? "");
  });

  document.addEventListener("submit", (event) => {
    event.preventDefault();
    if (/** @type {HTMLElement} */ (event.target).id !== "name-form") return;
    const input = /** @type {HTMLInputElement} */ (
      document.getElementById("cat-name")
    );
    const result = rename(cat(), input.value);
    if (!result.ok) return;
    refreshHud();
    openRenameMenu(
      cat(),
      result.suits
        ? `${result.name} perks up and trots over. This name suits.`
        : `${result.name} flicks an ear and looks elsewhere. Perhaps a different name.`,
    );
  });

  document.addEventListener("change", (event) => {
    const select = /** @type {HTMLSelectElement} */ (event.target);
    const catId = select.dataset?.cat;
    if (!catId) return;
    const result = assignFire(currentState(), catId, select.value);
    if (!result.ok) toast(result.reason);
    openNightMenu("fires");
  });

  bindDragToBowl();

  qs("#next").addEventListener("click", () => {
    const state = game.state;
    if (!state) return;
    if (game.scene?.name === "evening") goToNight();
    else if (game.scene?.name === "world" && !game.paused) {
      if (state.phase === "dawn") startDay();
      else if (state.phase === "day") goToEvening();
    }
    refreshHud();
  });
  qs("#help-button").addEventListener("click", () => openHelp());
  qs("#journal-button").addEventListener("click", () => {
    if (game.state && game.scene?.name === "world" && !game.paused) {
      openJournal();
    }
  });
  qs("#music-toggle").addEventListener("click", (event) => {
    initAudio();
    setMusicEnabled(!audioSettings.music);
    /** @type {HTMLElement} */ (event.currentTarget).textContent =
      audioSettings.music ? "Music on" : "Music off";
  });
}
