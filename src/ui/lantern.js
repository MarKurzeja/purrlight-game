/** The Great Lantern: its repairs and, at the end, lighting it. */
import { BALANCE } from '../config.js';
import { lanternReady } from '../core/progress.js';
import { LANTERN_PARTS } from '../data/village.js';
import { currentState } from '../game/runtime.js';
import { actionButton } from './components.js';
import { openSheet } from './sheet.js';

export function openLanternMenu() {
  const state = currentState();
  if (state.lanternLit) {
    openSheet(
      '<h2>The Great Lantern</h2><p>It burns over the alp. In the valley, people look up.</p>',
    );
    return;
  }
  const atNight = state.phase === 'night';
  const parts = LANTERN_PARTS.map((part) => {
    const done = !!state.lantern[part.id];
    const right = done
      ? '<em>Done</em>'
      : atNight
        ? actionButton('repair', `${part.cost} Purrs`, {
            value: part.id,
            disabled: state.purrs < part.cost,
          })
        : `<em>${part.cost} Purrs, at night</em>`;
    return `<li class="${done ? 'ok' : ''}"><b>${part.name}</b> <span>${part.description}</span> ${right}</li>`;
  });
  const library = state.built.library ? '' : ' (a Library is needed to read them)';
  openSheet(`<h2>The Great Lantern</h2>
    <p>An old stone tower above the village, dark for years. The keeper’s plaque reads: Everyone takes a turn.</p>
    <ul class="list">${parts.join('')}</ul>
    <p class="note">Memories read: ${state.memoriesRead.length} of ${BALANCE.memoriesForLantern}${library}.</p>
    ${lanternReady(state) ? actionButton('light-lantern', 'Light the Lantern', { className: 'btn big' }) : ''}`);
}
