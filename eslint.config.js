import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * Layer rules (CLAUDE.md A2) are enforced with @typescript-eslint/no-restricted-imports:
 * - src/sim/**      must not touch React, the DOM layer (src/ui) or content (src/content).
 * - src/content/**  may import simulation *types* only.
 * - src/ui/**       may import the simulation only through its public entry point src/sim/index.ts.
 */
const SIM_FORBIDDEN = {
  paths: [
    { name: 'react', message: 'src/sim must stay framework-free (CLAUDE.md A2).' },
    { name: 'react-dom', message: 'src/sim must stay framework-free (CLAUDE.md A2).' },
  ],
  patterns: [
    {
      regex: '(^|/)(ui|content)(/|$)',
      message:
        'src/sim must not depend on src/ui or src/content — pass data in through the engine.',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report', 'screenshots', 'docs'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/sim/**/*.ts'],
    ignores: ['src/sim/__tests__/**'],
    rules: { '@typescript-eslint/no-restricted-imports': ['error', SIM_FORBIDDEN] },
  },
  {
    // Tests may load real scenarios and guideline data from src/content, but never React/UI.
    files: ['src/sim/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: SIM_FORBIDDEN.paths,
          patterns: [
            { regex: '(^|/)ui(/|$)', message: 'Simulation tests must not depend on the UI.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/content/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'react', message: 'Content is plain data.' }],
          patterns: [
            {
              regex: '(^|/)sim(/|$)',
              allowTypeImports: true,
              message: 'Content may import simulation types only (use `import type`).',
            },
            { regex: '(^|/)ui(/|$)', message: 'Content must not depend on the UI.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}', 'src/App.tsx', 'src/main.tsx'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)sim/.+',
              message: 'The UI may import the simulation only through src/sim/index.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    // Context modules export a provider plus its hooks by design (HMR falls back to a full reload).
    files: ['src/ui/hooks/*Context.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.mjs', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
