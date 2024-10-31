export type SafeError<TName extends string = string, TData = unknown> = {
  readonly name: TName;
  readonly message: string;
  readonly data?: TData;
};

type SuccessResult<Data = unknown> = [null, Data];
type ErrorResult<Error extends SafeError = SafeError> = [Error, null];
export type Result<Data = unknown, Error extends SafeError = SafeError> = SuccessResult<Data> | ErrorResult<Error>;

export function success<Data>(data: Data): Result<Data, never> {
  return [null, data];
}

export function error<const E extends SafeError>(errorArg: E): Result<never, E> {
  return [errorArg, null];
}

export async function safePromise<T>(promise: Promise<T>): Promise<Result<T, SafeError<'SafeError'>>> {
  try {
    return success(await promise);
  } catch (e) {
    return error({ name: 'SafeError', message: 'Promise rejected.', data: e });
  }
}
