import nock from 'nock';
import { expect } from 'vitest';

import { CoreError } from '../utils/coreError';

// disable all network requests to ensure tests fail if they are not mocked
nock.disableNetConnect();

expect.extend({
  toThrowCoreError: (received: unknown, message: string, code: string) => {
    if (!(received instanceof Error)) {
      return {
        message: () => `Expected function to throw CoreError`,
        pass: false,
      };
    }
    if (!CoreError.isCoreError(received)) {
      return {
        message: () => `Expected function to throw CoreError`,
        pass: false,
      };
    }
    if (received.message !== message) {
      return {
        message: () => 'Expected different CoreError message',
        pass: false,
        expected: message,
        received: received.message,
      };
    }
    if (received.code !== code) {
      return {
        message: () => 'Expected different CoreError code',
        pass: false,
        expected: code,
        received: received.code,
      };
    }

    return {
      message: () => `Expected error matches`,
      pass: true,
    };
  },
});
