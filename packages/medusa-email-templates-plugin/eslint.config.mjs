import { globalIgnores } from 'eslint/config';
import globals from 'globals';
import neostandard from 'neostandard';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  globalIgnores([
    '.agents/**',
    '.cache/**',
    '.medusa/**',
    'build/**',
    'coverage/**',
    'dist/**',
    'node_modules/**',
    'patches/**',
    '**/.turbo/**',
    '**/.yalc/**',
  ]),
  ...neostandard({
    noStyle: true,
    ts: true,
  }),
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['src/admin/**/*.{ts,tsx}', 'vitest.config.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['src/admin/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: [
      'integration-tests/**/*.{ts,tsx}',
      'integration-tests/**/*.js',
      'src/admin/**/*.spec.{ts,tsx}',
      'src/admin/**/*.test.{ts,tsx}',
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
