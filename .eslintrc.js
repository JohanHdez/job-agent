// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolve } = require('path');

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: [
      './packages/*/tsconfig.json',
      './apps/*/tsconfig.json',
      './apps/web/tsconfig.app.json',
      './apps/microservices/*/tsconfig.json',
    ],
    tsconfigRootDir: resolve(__dirname),
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  rules: {
    // Forbid explicit `any` — use `unknown` + type guards instead
    '@typescript-eslint/no-explicit-any': 'error',

    // Forbid implicit `any` via unsafe member access, calls, etc.
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',

    // Forbid console.log in application code (use structured logger)
    'no-console': 'error',

    // Enforce typed catch clauses
    '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',

    // Enforce consistent void handling
    '@typescript-eslint/no-floating-promises': 'error',
    // Allow async functions as Express/Node callbacks and multer properties (standard pattern)
    '@typescript-eslint/no-misused-promises': ['error', {
      checksVoidReturn: { arguments: false, properties: false },
    }],

    // Keep require() out of TS files
    '@typescript-eslint/no-require-imports': 'error',

    // Allow _-prefixed variables to be unused (intentional placeholder params, e.g. Express error handlers)
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
  },
  overrides: [
    {
      // CLI launcher uses chalk (console-like) — allow process.stdout writes
      files: ['apps/cli/src/**/*.ts'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      // Config and build scripts at repo root may use require/console
      files: ['*.js', '*.cjs'],
      env: { node: true },
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '*.tsbuildinfo',
    'output/',
    'cv/',
  ],
};
