import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';

// Read paths from tsconfig.json — paths live directly in compilerOptions of the local tsconfig
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsconfig = require('./tsconfig.json') as {
  compilerOptions?: { paths?: Record<string, string[]> };
};
const tsPaths = tsconfig.compilerOptions?.paths ?? {};
const nameMapper = pathsToModuleNameMapper(tsPaths, { prefix: '<rootDir>/../../' });

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.test\\.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: './tsconfig.json' }] },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/index.(t|j)s',
    '!**/modules/auth/**',
    '!**/modules/users/**',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  ...(nameMapper ? { moduleNameMapper: nameMapper } : {}),
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
  },
};

export default config;
