// Flat ESLint config (ESLint 9). Dev-only quality gate — not shipped in the app bundle.
// Built on Expo's official ruleset; extra rules below target dead/redundant code.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  {
    // Never lint generated output, build artifacts, or vendored data.
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'database/**',
      'scripts/**',
      '**/*.generated.ts',
    ],
  },
  ...expoConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Surface redundant code the user explicitly wants to avoid.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },
];
