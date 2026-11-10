/**
 * Saving and loading. Saves go to localStorage and, when the page runs as a Claude artifact
 * with a signed-in viewer, to a private per-user cloud document as well.
 */
import { SAVE_KEY } from '../config.js';
import { parseSave, serializeState } from '../core/save.js';
import { game } from './runtime.js';

/** Older keys to migrate from, newest first. */
const LEGACY_KEYS = ['purrlight.save.v2'];

/** @type {{ set: (doc: object) => Promise<void> } | null} */
let cloudDocument = null;

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage can be blocked (private mode); the game still runs
  }
}

/** The locally saved game, migrated to the current format, or null. */
export function loadLocalSave() {
  for (const key of [SAVE_KEY, ...LEGACY_KEYS]) {
    const state = parseSave(readStorage(key));
    if (state) return state;
  }
  return null;
}

/** Saves the current game everywhere it can. */
export function saveGame() {
  if (!game.state) return;
  const json = serializeState(game.state, Date.now());
  try {
    localStorage.setItem(SAVE_KEY, json);
  } catch {
    /* ignore: see readStorage */
  }
  cloudDocument?.set({ json, ts: game.state.savedAt }).catch(() => {});
}

/**
 * Connects to cloud saves if the host offers them. Calls `onNewerSave` when the cloud has a
 * more recent game than this browser.
 * @param {(state: import('../core/state.js').GameState) => void} onNewerSave
 */
export async function connectCloudSave(onNewerSave, attempt = 0) {
  const host = /** @type {any} */ (window).claude;
  if (!host?.use) {
    if (attempt === 0) setTimeout(() => connectCloudSave(onNewerSave, 1), 1200);
    return;
  }
  try {
    const [db, user] = await Promise.all([host.use('db'), host.use('user')]);
    if (!db || !user) return;
    const userId = await user.id();
    if (!userId) return;
    cloudDocument = db.collection(`data/users/${userId}`).doc('save');
    const snapshot = await /** @type {any} */ (cloudDocument).get();
    if (!snapshot.exists) return;
    const remote = parseSave(snapshot.data().json);
    if (remote && remote.savedAt > (game.savedGame?.savedAt ?? 0)) onNewerSave(remote);
  } catch {
    /* cloud saves are a bonus; local saves keep working */
  }
}
