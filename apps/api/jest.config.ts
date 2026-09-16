import type { Config } from 'jest';

const base: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          moduleResolution: 'node',
          target: 'ES2022',
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          strictPropertyInitialization: false,
        },
      },
    ],
  },
};

const unit: Config = {
  ...base,
  displayName: 'unit',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '\\.int-spec\\.ts$'],
};

const integration: Config = {
  ...base,
  displayName: 'integration',
  testMatch: ['<rootDir>/test/**/*.int-spec.ts'],
};

const config: Config = {
  ...base,
  projects: [unit, integration],
};

export default config;
