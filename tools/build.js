/**
 * Builds the game into self-contained HTML files:
 *   dist/index.html            a complete page you can open directly or host anywhere
 *   dist/purrlight.artifact.html  the same page as a fragment (no <html>/<head>/<body>),
 *                              the format Claude artifacts expect
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "./bundler.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "src/styles.css"), "utf8");
const { code, modules } = bundle(resolve(root, "src/main.js"));

const STYLE_LINK = '<link rel="stylesheet" href="src/styles.css" />';
const MODULE_SCRIPT = '<script type="module" src="src/main.js"></script>';
for (const marker of [STYLE_LINK, MODULE_SCRIPT]) {
  if (!html.includes(marker)) {
    throw new Error(`index.html is missing: ${marker}`);
  }
}
const safeCode = code.replace(/<\/script/gi, "<\\/script");
const page = html
  .replace(STYLE_LINK, () => `<style>\n${css}</style>`)
  .replace(MODULE_SCRIPT, () => `<script>\n${safeCode}</script>`);

/** The artifact format: head content and body content, without the document wrapper. */
function toFragment(document) {
  const head = document.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";
  const body = document.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? "";
  const keptHead = head
    .split("\n")
    .filter((line) => !/<meta charset|<meta name="viewport"/.test(line))
    .join("\n");
  return `${keptHead.trim()}\n${body.trim()}\n`;
}

mkdirSync(resolve(root, "dist"), { recursive: true });
writeFileSync(resolve(root, "dist/index.html"), page);
writeFileSync(resolve(root, "dist/purrlight.artifact.html"), toFragment(page));
const kb = (Buffer.byteLength(page) / 1024).toFixed(0);
console.log(
  `Bundled ${modules.length} modules into dist/index.html (${kb} KB).`,
);
