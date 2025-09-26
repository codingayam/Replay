import presets from 'ts-jest/presets/index.js';

const { defaultsESM } = presets;

export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js|jsx)',
    '**/*.(test|spec).(ts|tsx|js|jsx)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: '<rootDir>/tsconfig.jest.json',
    },
  },
  collectCoverageFrom: [
    'src/**/*.(ts|tsx)',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^../utils/api$': '<rootDir>/src/__mocks__/api.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'import.meta': {
      env: {
        VITE_API_URL: 'http://localhost:3001'
      }
    }
  },
};
