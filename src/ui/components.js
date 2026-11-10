/** Small HTML building blocks shared by the menus. */
import { clamp } from '../core/math.js';
import { escapeHtml } from '../engine/dom.js';

/** A horizontal meter, 0-100. */
export function meter(value, color) {
  return `<span class="meter"><i style="width:${clamp(value / 100) * 100}%;background:${color}"></i></span>`;
}

/**
 * A button wired to a UI action (see ui/controls.js).
 * @param {string} action
 * @param {string} label
 * @param {{ value?: string | number, disabled?: boolean, reason?: string, className?: string }} [options]
 */
export function actionButton(
  action,
  label,
  { value, disabled = false, reason = '', className = 'btn' } = {},
) {
  const valueAttr = value === undefined ? '' : ` data-value="${escapeHtml(value)}"`;
  const why = disabled && reason ? `<small>${escapeHtml(reason)}</small>` : '';
  return `<button class="${className}" data-action="${action}"${valueAttr}${disabled ? ' disabled' : ''}>${label}${why}</button>`;
}

/** A row of tab buttons. @param {[string, string][]} tabs [id, label] pairs. */
export function tabBar(action, tabs, active, extra = '') {
  return `<div class="tabs" role="tablist">${tabs
    .map(
      ([id, label]) =>
        `<button class="${id === active ? 'on' : ''}" role="tab" aria-selected="${id === active}" data-action="${action}" data-value="${id}">${label}</button>`,
    )
    .join('')}${extra}</div>`;
}

/** A purchasable row: name, description, and a button or a status. */
export function shopRow(title, description, right) {
  return `<div class="buy"><div><b>${title}</b>${description ? `<small>${description}</small>` : ''}</div>${right}</div>`;
}
