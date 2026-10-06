import js from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const HEX = /#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})/.source;

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'functions/lib', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    // Test helpers are never hot-reloaded.
    files: ['src/test/**', 'src/**/__tests__/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Theming rule: no hardcoded colours in app code. Hex values live in the token files;
    // Google map styles are JSON and cannot read tokens.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**', 'src/lib/maps/**', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=/^${HEX}$/]`,
          message: 'Hardcoded hex colour. Use a Tailwind token class (bg-surface, text-muted, …).',
        },
        {
          selector: `TemplateElement[value.raw=/${HEX}\\b/]`,
          message: 'Hardcoded hex colour. Use a Tailwind token class (bg-surface, text-muted, …).',
        },
        {
          selector: 'Literal[value=/^(rgba?|hsla?)\\(/]',
          message: 'Hardcoded colour. Use a Tailwind token class.',
        },
      ],
    },
  },
  // Must come last: disables formatting rules that conflict with Prettier and reports
  // Prettier differences as lint errors.
  prettierRecommended,
]);
