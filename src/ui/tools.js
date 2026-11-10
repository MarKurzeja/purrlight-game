/**
 * The tool bar at the bottom of the village: Look (open a cat's card), Hand (hold a cat to
 * stroke it) and the foods in your bag (click a cat to feed it). Keys 1-7 select a tool.
 */
import { FOODS } from '../data/items.js';
import { IS_TOUCH, escapeHtml, qs } from '../engine/dom.js';
import { game } from '../game/runtime.js';
import { toolIconSvg } from './icons.js';

const MAX_FOOD_SLOTS = 5;
let lastToolsHtml = '';

/** The tools currently on the bar, in key order. */
export function availableTools() {
  const state = game.state;
  const foods = state
    ? Object.keys(FOODS)
        .filter((f) => (state.bag[f] ?? 0) > 0)
        .slice(0, MAX_FOOD_SLOTS)
    : [];
  return [
    { id: 'look', label: 'Look', count: 0 },
    { id: 'hand', label: 'Pet', count: 0 },
    ...foods.map((f) => ({ id: f, label: FOODS[f].name, count: state?.bag[f] ?? 0 })),
  ];
}

/** One line under the tool bar: what the selected tool does. */
export function toolDescription(tool) {
  const use = IS_TOUCH ? 'Tap' : 'Click';
  if (tool === 'look') return `<b>Look</b> ${use} a cat to see how it feels and what it wants.`;
  if (tool === 'hand') {
    return `<b>Pet</b> ${IS_TOUCH ? 'Press and hold' : 'Hold the mouse or E'} on a friendly cat to stroke it.`;
  }
  const food = FOODS[tool];
  if (!food) return '';
  return `<b>${escapeHtml(food.name)}</b> ${use} a cat to feed it. ${escapeHtml(food.description)}`;
}

/** A short explanation of what clicking a cat does with the selected tool. */
export function toolHint() {
  if (game.tool === 'hand') return 'Pet: press and hold on a cat to stroke it.';
  if (FOODS[game.tool]) return `${FOODS[game.tool].name}: click a cat to give it some.`;
  return '';
}

export function refreshTools() {
  const bar = qs('#tools');
  const state = game.state;
  const visible =
    !!state &&
    game.scene?.name === 'world' &&
    (state.phase === 'dawn' || state.phase === 'day' || state.relaxMode);
  bar.hidden = !visible;
  if (!visible) return;
  const tools = availableTools();
  if (!tools.some((t) => t.id === game.tool)) game.tool = 'look'; // the food ran out
  const buttons = tools
    .map((t, i) => {
      const on = game.tool === t.id;
      const count = t.count ? `<span class="tool-count">×${t.count}</span>` : '';
      return `<button class="tool${on ? ' on' : ''}" data-action="tool" data-value="${t.id}" aria-pressed="${on}" title="${escapeHtml(t.label)} (${i + 1})">
        ${toolIconSvg(t.id)}<span class="tool-key">${i + 1}</span>${count}
        <span class="tool-name">${escapeHtml(shortName(t.label))}</span></button>`;
    })
    .join('');
  const html = `<div class="tool-row">${buttons}</div><div class="tool-help">${toolDescription(game.tool)}</div>`;
  if (html !== lastToolsHtml) {
    lastToolsHtml = html;
    bar.innerHTML = html;
  }
}

/** Long food names shortened to fit under an icon ("Speckled trout" -> "Trout"). */
function shortName(label) {
  const words = label.split(' ');
  return label.length > 9 ? words[words.length - 1].replace(/^./, (c) => c.toUpperCase()) : label;
}

/** @param {string} tool */
export function selectTool(tool) {
  game.tool = tool;
  refreshTools();
}

/** Selects the tool on key 1-7. */
export function selectToolByNumber(n) {
  const tool = availableTools()[n - 1];
  if (tool) selectTool(tool.id);
}
