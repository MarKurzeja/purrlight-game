/**
 * A small scope-hoisting bundler for this project's ES modules, so the game can ship as one
 * self-contained HTML file with no build dependencies.
 *
 * It supports the subset of module syntax the project uses, and fails loudly on anything else:
 *   import { a, b } from './x.js';     named imports only, relative paths, no renaming
 *   export function / const / class    named declarations only
 *
 * All modules are concatenated into one function scope in dependency order, so every top-level
 * name in the project must be unique. The bundler checks that, and that every imported name is
 * actually exported by its module.
 */
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import vm from "node:vm";

const IMPORT_RE =
  /^import\s*\{([^}]*)\}\s*from\s*['"](\.{1,2}\/[^'"]+)['"];?\s*$/gm;
const DECLARATION_RE =
  /^(export\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;
const FORBIDDEN = [
  [/^export\s+default\b/m, "default exports"],
  [/^export\s*\{/m, "export lists"],
  [/^export\s*\*/m, "re-exports"],
  [/^export\s+let\b/m, "exported let (live bindings are not supported)"],
  [/^import\s+[^{\s]/m, "default or namespace imports"],
  [/\bimport\s*\(/, "dynamic import()"],
];

/**
 * @typedef {{ path: string, source: string, imports: { names: string[], from: string }[],
 *   declared: string[], exported: string[] }} ModuleInfo
 */

/** Removes block and line comments, so JSDoc types such as import('x') are not mistaken for code. */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** @param {string} path @returns {ModuleInfo} */
function readModule(path) {
  const source = readFileSync(path, "utf8");
  const code = withoutComments(source);
  for (const [pattern, what] of FORBIDDEN) {
    if (pattern.test(code)) {
      throw new Error(`${path}: ${what} are not supported by the bundler`);
    }
  }
  const imports = [...source.matchAll(IMPORT_RE)].map((m) => {
    const names = m[1]
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    const renamed = names.find((n) => /\sas\s/.test(n));
    if (renamed) {
      throw new Error(`${path}: renamed import "${renamed}" is not supported`);
    }
    return { names, from: resolve(dirname(path), m[2]) };
  });
  const declarations = [...source.matchAll(DECLARATION_RE)];
  return {
    path,
    source,
    imports,
    declared: declarations.map((m) => m[2]),
    exported: declarations.filter((m) => m[1]).map((m) => m[2]),
  };
}

/**
 * Bundles an entry module and everything it imports.
 * @param {string} entry Path to the entry module.
 * @returns {{ code: string, modules: string[] }}
 */
export function bundle(entry) {
  /** @type {Map<string, ModuleInfo>} */
  const modules = new Map();
  /** @type {string[]} Modules in dependency order (dependencies first). */
  const order = [];

  const visit = (path) => {
    if (modules.has(path)) return;
    const info = readModule(path);
    modules.set(path, info);
    for (const dep of info.imports) visit(dep.from);
    order.push(path);
  };
  visit(resolve(entry));

  const root = dirname(resolve(entry));
  const name = (path) => relative(root, path);
  const errors = [];

  /** @type {Map<string, string>} top-level name to the module that declares it */
  const owners = new Map();
  for (const path of order) {
    for (const declared of modules.get(path)?.declared ?? []) {
      const owner = owners.get(declared);
      if (owner) {
        errors.push(
          `"${declared}" is declared in both ${owner} and ${name(path)}`,
        );
      } else owners.set(declared, name(path));
    }
  }
  for (const path of order) {
    for (const { names, from } of modules.get(path)?.imports ?? []) {
      const exported = modules.get(from)?.exported ?? [];
      for (const n of names) {
        if (!exported.includes(n)) {
          errors.push(
            `${name(path)} imports "${n}" but ${name(from)} does not export it`,
          );
        }
      }
    }
  }
  if (errors.length) {
    throw new Error(`Bundling failed:\n  ${errors.join("\n  ")}`);
  }

  const body = order
    .map((path) => {
      const source = /** @type {ModuleInfo} */ (modules.get(path)).source
        .replace(IMPORT_RE, "")
        .replace(/^export\s+/gm, "");
      return `// ---- ${name(path)} ----\n${source.trim()}\n`;
    })
    .join("\n");
  const code = `(() => {\n'use strict';\n${body}\n})();\n`;
  new vm.Script(code, { filename: "bundle.js" }); // throws on a syntax error
  return { code, modules: order.map(name) };
}
