import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const memoizedComponentNames = [
  'AnalysisPanel',
  'AppModals',
  'InsightsBar',
  'LazyFallback',
  'LyricsView',
  'LyricDragHandle',
  'LyricInput',
  'LyricLineControls',
  'LyricTextArea',
  'MusicalInsightsBar',
  'RhymeSuggestPanel',
  'SectionAdaptControl',
  'SectionEditor',
  'SectionFooter',
  'SectionHeader',
  'SectionLineList',
  'SectionRow',
  'SectionVersionControl',
  'StructureSidebar',
];

export default [
  {
    ignores: ['vite.config.ts', 'tailwind.config.ts', 'dist/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-shadow': ['error', { ignoreOnInitialization: true, allow: memoizedComponentNames }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    files: ['api/**/*.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      '@typescript-eslint/no-shadow': ['error', { ignoreOnInitialization: true }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
];
