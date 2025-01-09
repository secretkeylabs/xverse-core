import 'vitest';

declare module 'vitest' {
  interface JestAssertion<T = any> extends jest.Matchers<void, T> {
    toThrowCoreError: (error: string, code?: string) => void;
  }
}
