import js from '@eslint/js';
import globals from 'globals';

const recommendedConfig = js.configs.recommended;

export default [
  {
    ignores: ['data/**', 'logs/**', 'temp/**']
  },
  {
    ...recommendedConfig,
    files: ['**/*.js'],
    languageOptions: {
      ...recommendedConfig.languageOptions,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...(recommendedConfig.languageOptions?.globals ?? {}),
        ...globals.node
      }
    },
    rules: {
      ...recommendedConfig.rules,
      'no-console': 'off',
      'no-unused-vars': ['warn', { args: 'none', argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'all', caughtErrorsIgnorePattern: '^_' }]
    }
  }
];
