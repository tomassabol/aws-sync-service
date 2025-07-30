type Success<T> = {
  data: T;
  error: null;
};

type Failure<E> = {
  data: null;
  error: E;
};

type Result<T, E = Error> = Success<T> | Failure<E>;

async function tryCatchAsync<T, E = Error>(
  promise: Promise<T>
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as E };
  }
}

function tryCatchSync<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    const data = fn();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as E };
  }
}

export function tryCatch<T, E = Error>(
  promise: Promise<T>
): Promise<Result<T, E>>;
export function tryCatch<T, E = Error>(fn: () => T): Result<T, E>;

export function tryCatch<T, E = Error>(
  input: Promise<T> | (() => T)
): Result<T, E> | Promise<Result<T, E>> {
  if (input instanceof Promise) {
    return tryCatchAsync<T, E>(input);
  } else {
    return tryCatchSync<T, E>(input);
  }
}
