export class CoreError extends Error {
  code?: string;

  constructor(message: string, code?: string, causedBy?: Error) {
    super(message);
    this.name = 'CoreError';
    this.code = code;

    if (causedBy && causedBy.stack) {
      this.stack += `\n\nCaused by: \n${causedBy.stack}`;
    }
  }

  static isCoreError(e: Error): e is CoreError {
    return e.name === 'CoreError';
  }
}
