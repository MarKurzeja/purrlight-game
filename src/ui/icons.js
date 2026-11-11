/**
 * Hand-drawn vector icons for the tool bar: Look, Stroke and every food. Flat colours with a
 * soft highlight and a warm brown outline, matching the chalet-style UI.
 */

const O = "#3b2c25";
const line = `stroke="${O}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"`;

/** A fish facing right. */
const fishIcon = (body, back, belly, extra = "") => `
  <path d="M5 16c4-6 13-8 20-3l3-4v14l-3-4c-7 5-16 3-20-3z" fill="${body}" ${line}/>
  <path d="M7 15c4-4 11-5 17-2" fill="none" stroke="${back}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M8 18.5c5 2.5 11 2 15-.5" fill="none" stroke="${belly}" stroke-width="2" stroke-linecap="round"/>
  ${extra}
  <circle cx="10" cy="14.6" r="1.3" fill="${O}"/>
  <path d="M14 13.5v5" stroke="${O}" stroke-width="1" stroke-linecap="round" opacity=".5"/>`;

/** A round baked thing with a highlight. */
const bakedIcon = (fill, edge, top = "") => `
  <ellipse cx="16" cy="19" rx="11" ry="8" fill="${edge}" ${line}/>
  <ellipse cx="16" cy="17" rx="10" ry="6.5" fill="${fill}"/>
  <path d="M9 14.5c2-2 5-3 8-3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>
  ${top}`;

/** @type {Record<string, string>} */
const ICONS = {
  look: `
    <path d="M3 16c4-6 8.5-9 13-9s9 3 13 9c-4 6-8.5 9-13 9S7 22 3 16z" fill="#fffaf0" ${line}/>
    <circle cx="16" cy="16" r="6" fill="#6fb0cc" ${line}/>
    <circle cx="16" cy="16" r="2.8" fill="${O}"/>
    <circle cx="18" cy="13.8" r="1.4" fill="#fff"/>`,
  hand: `
    <path d="M10 27c-3-2-5-6-5-9 0-2 2-2.5 3-1l2 2.5V8.5c0-1.6 2.6-1.6 2.6 0V15V6.5c0-1.6 2.7-1.6 2.7 0V15V7.5c0-1.6 2.7-1.6 2.7 0V15.5V10c0-1.6 2.6-1.6 2.6 0v9c0 4-2 8-6 8z" fill="#f6d3b6" ${line}/>
    <path d="M12.6 21c1.5 1 4.5 1 6 0" fill="none" stroke="#e8a98a" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M24 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#f08aa8"/>`,
  sardine: fishIcon("#c9d4e2", "#8fa0b8", "#eef3f8"),
  trout: fishIcon(
    "#b9c48a",
    "#7d8a52",
    "#f2c9b8",
    '<g fill="#5e6a3a"><circle cx="16" cy="13.2" r=".8"/><circle cx="19" cy="14" r=".8"/><circle cx="21.5" cy="13" r=".8"/></g><path d="M9 16.8c5 1.2 10 1 14-.6" stroke="#e98a8a" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  ),
  moonkoi: `
    <circle cx="16" cy="16" r="13" fill="#fff4c8" opacity=".55"/>
    ${fishIcon("#fbf8f2", "#f2a65a", "#ffffff", '<path d="M15 12.5c2 1 4 1 5-.5M17 18.5c1.5-.6 3-.4 4 .4" stroke="#e36a3c" stroke-width="2" fill="none" stroke-linecap="round"/>')}`,
  herb: `
    <path d="M16 28V12" stroke="#4f7a3a" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M16 20c-6 0-9-4-9-8 5 0 9 3 9 8z" fill="#7fb85c" ${line}/>
    <path d="M16 17c6 0 9-4 9-8-5 0-9 3-9 8z" fill="#96c96c" ${line}/>
    <path d="M16 12c-3-1-4-5-2-8 3 2 3 5 2 8z" fill="#6aa64e" ${line}/>
    <circle cx="22" cy="21" r="1.6" fill="#f7d84e"/><circle cx="10" cy="23" r="1.3" fill="#f7d84e"/>`,
  milk: `
    <path d="M12 4h8v4l3 4v14a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V12l3-4z" fill="#fbfbf8" ${line}/>
    <path d="M10 15h12v11a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1z" fill="#f4ecd8"/>
    <rect x="11.5" y="3" width="9" height="3.5" rx="1" fill="#c8423c" ${line}/>
    <path d="M12 18h8" stroke="#6fb0cc" stroke-width="2" stroke-linecap="round"/>
    <path d="M12.5 12.5v9" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".9"/>`,
  stone: `
    <ellipse cx="16" cy="18" rx="12" ry="9" fill="#a8a29a" ${line}/>
    <ellipse cx="14" cy="15.5" rx="7" ry="4.5" fill="#c4beb4"/>
    <path d="M11 22c3 1.5 8 1.5 11-1" stroke="#f3a25a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M10 6c1 1.5-1 2.5 0 4M16 5c1 1.5-1 2.5 0 4M22 6c1 1.5-1 2.5 0 4" stroke="#f3a25a" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  catnip: `
    <path d="M8 21h16l-2 8H10z" fill="#c8703f" ${line}/>
    <rect x="7" y="19" width="18" height="3.5" rx="1" fill="#d8834e" ${line}/>
    <path d="M16 19c-5 0-7-4-7-7 4 0 7 3 7 7zM16 19c5 0 7-4 7-7-4 0-7 3-7 7z" fill="#7fb85c" ${line}/>
    <path d="M16 19V7" stroke="#4f7a3a" stroke-width="1.6"/>
    <g fill="#b48be0" stroke="${O}" stroke-width="1"><circle cx="16" cy="5.5" r="2"/><circle cx="14.5" cy="8.5" r="1.7"/><circle cx="17.5" cy="8.5" r="1.7"/></g>`,
  biscuit: bakedIcon(
    "#e6b866",
    "#c98c42",
    '<g fill="#5e8a3a"><circle cx="12" cy="17" r="1.1"/><circle cx="18" cy="15" r="1.1"/><circle cx="20" cy="19" r="1.1"/><circle cx="14" cy="20" r="1.1"/></g>',
  ),
  fishcake: bakedIcon(
    "#e9a35a",
    "#b8692e",
    '<path d="M11 17c3-3 7-3 9 0-2 3-6 3-9 0zM20 17l3-2v4z" fill="#f6d39a" stroke="#b8692e" stroke-width="1"/>',
  ),
  milkbun: `
    <path d="M5 22c0-8 5-13 11-13s11 5 11 13z" fill="#f5dfb4" ${line}/>
    <path d="M5 22h22v2a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#d9a865" ${line}/>
    <path d="M10 15c2-3 5-4 8-4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>
    <g fill="#fffaf0"><circle cx="13" cy="18" r=".9"/><circle cx="17" cy="16" r=".9"/><circle cx="21" cy="18" r=".9"/></g>`,
  tart: `
    <path d="M4 17h24l-3 9H7z" fill="#d49a52" ${line}/>
    <path d="M7 17v8M11 17v9M15 17v9M19 17v9M23 17v8" stroke="#b77a3a" stroke-width="1"/>
    <ellipse cx="16" cy="17" rx="12" ry="4.5" fill="#f2c94c" ${line}/>
    <ellipse cx="13" cy="16" rx="5" ry="1.6" fill="#fbe08a"/>
    <circle cx="20" cy="16.5" r="1.6" fill="#e8607e"/>`,
  nipcookie: bakedIcon(
    "#e6b866",
    "#c98c42",
    '<g fill="#6b4a32"><ellipse cx="16" cy="18.5" rx="2.6" ry="2.1"/><circle cx="12.6" cy="15.6" r="1.2"/><circle cx="15" cy="14.2" r="1.2"/><circle cx="17.4" cy="14.2" r="1.2"/><circle cx="19.6" cy="15.6" r="1.2"/></g><path d="M22 9c2-2 5-2 6 0-2 2-4 2-6 0z" fill="#7fb85c" stroke="#3b2c25" stroke-width="1"/>',
  ),
};

/** The fallback for anything without its own icon: a little parcel. */
const PARCEL = `
  <rect x="6" y="9" width="20" height="16" rx="2" fill="#d8b98a" ${line}/>
  <path d="M16 9v16M6 15h20" stroke="#c8423c" stroke-width="2"/>`;

/** Inline SVG markup for a tool or food. @param {string} id */
export function toolIconSvg(id) {
  return `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${ICONS[id] ?? PARCEL}</svg>`;
}

/** Whether there is a dedicated icon for this id (used by tests). */
export const hasToolIcon = (id) => id in ICONS;
