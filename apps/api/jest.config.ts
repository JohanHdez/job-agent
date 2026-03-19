import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';

// Read paths from tsconfig.json — paths live directly in compilerOptions of the local tsconfig
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsconfig = require('./tsconfig.json') as {
  compilerOptions?: { paths?: Record<string, string[]> };
};
const tsPaths = tsconfig.compilerOptions?.paths ?? {};
const nameMapper = pathsToModuleNameMapper(tsPaths, { prefix: '<rootDir>/../' });

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.test\\.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: './tsconfig.json' }] },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    // Exclude barrel files
    '!**/index.(t|j)s',
    // Exclude bootstrap/wiring files — not unit-testable in isolation
    '!**/main.(t|j)s',
    '!**/app.module.(t|j)s',
    // Exclude NestJS module wiring files (tested indirectly via integration)
    '!**/*.module.(t|j)s',
    // Exclude constants files — plain re-exports with no logic
    '!**/*.constants.(t|j)s',
    // Exclude correlation interceptor — requires live HTTP context, covered by e2e tests
    '!**/correlation.interceptor.(t|j)s',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Strip .js extensions — ts-jest compiles .ts but imports use .js (Node16 module resolution)
    '^(\\.{1,2}/.*)\\.js$': '$1',
    ...(nameMapper ?? {}),
  },
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
  },
};

export default config;
