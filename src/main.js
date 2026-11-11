/**
 * Entry point: sets up the screen, input and audio, then runs the frame loop.
 */
import { currentSeason } from "./core/state.js";
import { initAudio, setAudioPaused, setMusicContext } from "./engine/audio.js";
import {
  clearOverlay,
  fitStage,
  fractalNoise,
  initDisplay,
  valueNoise,
} from "./engine/canvas.js";
import { qs } from "./engine/dom.js";
import { bindInput, endInputFrame } from "./engine/input.js";
import { paperTextureUrl } from "./render/effects.js";
import { initStage, stageError } from "./render/stage.js";
import { connectCloudSave } from "./game/persistence.js";
import { startProgressTracking } from "./game/progress.js";
import { game } from "./game/runtime.js";
import { showTitle } from "./game/session.js";
import { toggleSitting } from "./scenes/world.js";
import { bindControls } from "./ui/controls.js";
import { refreshHud } from "./ui/hud.js";
import { showTitleMenu } from "./ui/letters.js";
import { openHelp } from "./ui/help.js";
import { openNightMenu } from "./ui/night.js";
import { closeSheet, isSheetOpen, setDefaultCloseHandler } from "./ui/sheet.js";

const MAX_FRAME_SECONDS = 0.05;
let lastTimestamp = 0;
let lastHudRefresh = 0;

function frame(timestamp) {
  const dt = Math.min(
    MAX_FRAME_SECONDS,
    (timestamp - (lastTimestamp || timestamp)) / 1000,
  );
  lastTimestamp = timestamp;
  game.time += dt;
  game.dt = dt;
  clearOverlay();
  const scene = game.scene;
  try {
    if (scene && (!game.paused || scene.runsWhilePaused)) scene.update?.(dt);
    if (scene) scene.draw?.();
    if (game.time - lastHudRefresh > 0.5) {
      lastHudRefresh = game.time;
      refreshHud();
    }
  } catch (error) {
    console.error(error); // keep the loop alive; one bad frame should not freeze the game
  }
  endInputFrame();
  requestAnimationFrame(frame);
}

function boot() {
  const pixelCanvas = /** @type {HTMLCanvasElement} */ (qs("#pixels"));
  const overlayCanvas = /** @type {HTMLCanvasElement} */ (qs("#overlay"));
  const stage = qs("#stage");
  const container = qs("#stage-wrap");
  initDisplay(pixelCanvas, overlayCanvas);
  if (!initStage(/** @type {HTMLCanvasElement} */ (qs("#world3d")))) {
    console.warn(`3D unavailable: ${stageError()}`);
    document.body.classList.add("no-webgl");
  }
  const fit = () => fitStage(container, stage, overlayCanvas);
  fit();
  addEventListener("resize", fit);
  new ResizeObserver(fit).observe(container);

  bindInput(stage, overlayCanvas, {
    onGesture: initAudio,
    onKey: (key) => {
      if (
        key === "Escape" &&
        isSheetOpen() &&
        document.querySelector("#sheet .close")
      ) {
        closeSheet();
      } else if (key === "h" && game.state && !isSheetOpen()) {
        openHelp();
      } else {
        game.scene?.onKey?.(key);
      }
    },
  });
  bindControls();
  qs("#sit").addEventListener("click", () => toggleSitting());
  startProgressTracking();
  setDefaultCloseHandler(() => {
    if (game.state?.phase === "night" && game.scene?.name === "world")
      openNightMenu();
  });
  setMusicContext(() => ({
    phase: game.state?.phase ?? "night",
    season: game.state ? currentSeason(game.state).id : "summer",
  }));
  qs("#paper").style.backgroundImage =
    `url(${paperTextureUrl((x, y) => fractalNoise(x * 0.03, y * 0.03) * 200 + valueNoise(x * 0.5, y * 0.5) * 55)})`;

  // Sound pauses with the tab (the frame loop already does: hidden tabs get no frames).
  document.addEventListener("visibilitychange", () =>
    setAudioPaused(document.hidden),
  );

  showTitle();
  connectCloudSave((newer) => {
    game.savedGame = newer;
    if (game.scene?.name === "title") showTitleMenu();
  });
  // A read-only handle for automated tests and debugging in the console.
  /** @type {any} */ (window).__PURRLIGHT__ = { game };
  requestAnimationFrame(frame);
}

const fontsReady = document.fonts?.ready ?? Promise.resolve();
fontsReady.then(boot, boot);
