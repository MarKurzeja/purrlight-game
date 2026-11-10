/**
 * ESLint flat config. Rules are listed explicitly so linting needs no plugin packages.
 */
const browserGlobals = Object.fromEntries(
  [
    'window',
    'document',
    'console',
    'localStorage',
    'matchMedia',
    'requestAnimationFrame',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'ImageData',
    'ResizeObserver',
    'navigator',
    'AudioContext',
    'HTMLCanvasElement',
    'HTMLElement',
    'CanvasRenderingContext2D',
    'addEventListener',
    'devicePixelRatio',
    'performance',
  ].map((name) => [name, 'readonly']),
);
const nodeGlobals = Object.fromEntries(
  ['process', 'console', 'URL', 'setTimeout', 'clearTimeout', 'Buffer'].map((name) => [
    name,
    'readonly',
  ]),
);

const rules = {
  'no-undef': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-redeclare': 'error',
  'no-shadow-restricted-names': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-unreachable': 'error',
  'no-fallthrough': 'error',
  'no-self-assign': 'error',
  'no-self-compare': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-var': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'always'],
  curly: ['error', 'multi-line'],
  'default-param-last': 'error',
  'no-implicit-coercion': ['error', { allow: ['!!', '+'] }],
};

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: browserGlobals },
    rules,
  },
  {
    files: ['src/core/**/*.js', 'src/data/**/*.js'],
    rules: {
      // Core game rules must stay free of browser APIs so they can be unit-tested in Node.
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'navigator'],
    },
  },
  {
    // Browser tests run callbacks inside the page, so they see both sets of globals.
    files: ['tests/e2e/**/*.js', 'tools/screenshots.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...nodeGlobals, ...browserGlobals },
    },
    rules,
  },
  {
    files: ['tests/unit/**/*.js', 'tools/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: nodeGlobals },
    rules,
  },
];
