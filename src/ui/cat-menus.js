/** Everything you can do with one cat: its card, the feeding bowl, toys, hats and names. */
import { tierOf, tierProgress } from '../core/bond.js';
import { availableActions } from '../core/care.js';
import { isWary } from '../core/state.js';
import { WISHES } from '../core/wishes.js';
import { BOND_TIERS, CAT_BY_ID, PERSONALITIES } from '../data/cats.js';
import { FOODS, HATS, TOYS } from '../data/items.js';
import { playSound } from '../engine/audio.js';
import { escapeHtml } from '../engine/dom.js';
import { catPicture } from '../render/portraits.js';
import { itemIconHtml } from '../render/sprites.js';
import { currentState, game } from '../game/runtime.js';
import { actionButton, meter } from './components.js';
import { openSheet } from './sheet.js';

const NEXT_UNLOCK_HINTS = [
  'Curious unlocks walks. ',
  'Friendly unlocks lap time. ',
  'Trusting brings gifts. ',
  'Soulmate leads you to a secret. ',
  '',
];
const TASTE_LABELS = { love: 'loves', like: 'likes', meh: 'okay', hate: 'refused' };

/** The cat's card: portrait, meters, wish and every available action. */
export function openCatMenu(catId) {
  const state = currentState();
  const cat = state.cats[catId];
  const def = CAT_BY_ID[catId];
  const traits = PERSONALITIES[def.personality];
  const tier = tierOf(cat.bond);
  const wary = isWary(state, catId);
  const actions = availableActions(state, catId);
  game.selectedCatId = catId;
  playSound('click');

  const btn = (action, label, option) =>
    actionButton(action, label, { disabled: !option.ok, reason: option.reason });
  const waryNote = wary
    ? '<p class="note">Below 30% Warmth this stray won’t let you touch it. Fill its bowl, or sit quietly nearby (Q) and let it come to you.</p>'
    : '';
  const wishNote = cat.wish
    ? `<p class="wish"><b>Wish today:</b> ${WISHES[cat.wish].label}. Grant it for a Warmth and Bond bonus.</p>`
    : '';
  const buttons = [
    btn('feed', 'Feed', actions.feed),
    btn('pet', 'Pet', actions.pet),
    btn('toys', 'Play', actions.play),
    actions.walk.unlocked
      ? btn(
          'follow',
          game.cats[catId]?.following ? 'Stop walking together' : 'Walk with me',
          actions.walk,
        )
      : '',
    actions.lap.unlocked ? btn('lap', 'Lap time', actions.lap) : '',
    actions.secret.unlocked ? btn('secret', 'Follow me: a secret', actions.secret) : '',
    actionButton('photo', 'Take a photo'),
    actionButton('hats', 'Hat'),
    actionButton('rename', 'Rename'),
  ].join('');

  openSheet(`
    <div class="card">
      <img class="portrait" alt="" src="${catPicture(def, { hat: cat.hat, wary, size: 120 })}">
      <div class="meta">
        <h2>${escapeHtml(cat.name)}</h2>
        <p class="tag">${traits.label} · ${traits.rarity}</p>
        <label class="stat">Warmth ${meter(cat.warmth, wary ? '#9db4c8' : '#f3a982')}<em>${Math.round(cat.warmth)}%</em></label>
        <label class="stat">Bond ${meter(tierProgress(cat.bond) * 100, '#a4dcc4')}<em>${BOND_TIERS[tier].name}</em></label>
      </div>
    </div>
    ${waryNote}${wishNote}
    <div class="actions">${buttons}</div>
    <p class="dim">${NEXT_UNLOCK_HINTS[tier]}${traits.tip}</p>`);
}

/** The feeding bowl. Food can be dragged onto the bowl or tapped. */
export function openFeedMenu(catId, message = '') {
  const state = currentState();
  const cat = state.cats[catId];
  const foods = Object.keys(FOODS).filter((k) => (state.bag[k] ?? 0) > 0);
  const tray = foods.length
    ? foods
        .map((food) => {
          const known = cat.tastes[food];
          return `<button class="food" data-action="eat" data-value="${food}" data-drag="${food}">${itemIconHtml(food)}<b>${FOODS[food].name}</b><small>×${state.bag[food]}${known ? ` · ${TASTE_LABELS[known]}` : ''}</small></button>`;
        })
        .join('')
    : '<p class="note">Your bag has no food. Forage at dawn: fish the lake, gather herbs, milk Clover.</p>';
  openSheet(
    `<h2>Feed ${escapeHtml(cat.name)}</h2>
    <p class="dim">Drag food to the bowl, or tap it. Every cat has hidden tastes. Spring meals warm 25% more.</p>
    <div class="feed"><div id="bowl" class="bowl" aria-label="Bowl"><span>${message ? escapeHtml(message) : 'bowl'}</span></div><div class="tray">${tray}</div></div>
    ${actionButton('cat', `Back to ${escapeHtml(cat.name.split(' ').pop() ?? '')}`)}`,
    { onClose: () => {} },
  );
}

export function openToyMenu(catId) {
  const cat = currentState().cats[catId];
  const favourite = cat.knowsToy
    ? `Favourite: ${TOYS[CAT_BY_ID[catId].favouriteToy]}.`
    : 'Find out which toy this cat likes best.';
  openSheet(`<h2>Play with ${escapeHtml(cat.name)}</h2><p class="dim">${favourite}</p>
    <div class="actions">${Object.entries(TOYS)
      .map(([id, name]) => actionButton('toy', name, { value: id }))
      .join('')}</div>
    ${actionButton('cat', 'Back', { className: 'btn ghost' })}`);
}

export function openHatMenu(catId) {
  const state = currentState();
  const cat = state.cats[catId];
  const owned = state.hats.map((h) => actionButton('wear', HATS[h].name, { value: h })).join('');
  const none = state.hats.length
    ? ''
    : '<p class="note">You own no hats yet. The night market sells them, and soulmate cats may lead you to rarer ones.</p>';
  openSheet(`<h2>Hats for ${escapeHtml(cat.name)}</h2><div class="actions">${actionButton('wear', 'No hat', { value: '' })}${owned}</div>${none}
    ${actionButton('cat', 'Back', { className: 'btn ghost' })}`);
}

export function openRenameMenu(catId, message = '') {
  const cat = currentState().cats[catId];
  const help = message
    ? `<p class="note">${escapeHtml(message)}</p>`
    : '<p class="dim">Say a name and watch the reaction. Each personality has its own taste in names.</p>';
  openSheet(`<h2>Rename</h2>
    <form id="name-form" class="name-form"><label for="cat-name">Cat’s name</label>
    <input id="cat-name" maxlength="20" value="${escapeHtml(cat.name)}" autocomplete="off">
    <button class="btn" type="submit">Try this name</button></form>${help}
    ${actionButton('cat', 'Back', { className: 'btn ghost' })}`);
}
