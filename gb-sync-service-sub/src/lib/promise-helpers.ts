/**
 * Check that result of Promise.allSettled is fulfilled
 */

export function isFulfilled<T>(
  promiseSettledResult: PromiseSettledResult<T>,
): promiseSettledResult is PromiseFulfilledResult<T> {
  return promiseSettledResult.status === "fulfilled"
}

/**
 * Check that result of Promise.allSettled is rejected
 */

export function isRejected<T>(
  promiseSettledResult: PromiseSettledResult<T>,
): promiseSettledResult is PromiseRejectedResult {
  return promiseSettledResult.status === "rejected"
}

/**
 * Filter and map Promise.allSettled result to an array of resolved values.
 */

export function getFulfilledValues<T>(
  promiseSettledResults: PromiseSettledResult<T>[],
): T[] {
  return promiseSettledResults.filter(isFulfilled).map((item) => item.value)
}

/**
 * Filter and map Promise.allSettled result to an array of rejected values.
 */

export function getRejectedReasons<T>(
  promiseSettledResults: PromiseSettledResult<T>[],
): unknown[] {
  return promiseSettledResults.filter(isRejected).map((item) => item.reason)
}

type Success<T> = {
  data: T
  error: null
}

type Failure<E> = {
  data: null
  error: E
}

type Result<T, E = Error> = Success<T> | Failure<E>

// Main wrapper function
export async function tryCatch<T, E = Error>(
  promise: Promise<T>,
): Promise<Result<T, E>> {
  try {
    const data = await promise
    return { data, error: null }
  } catch (error) {
    return { data: null, error: error as E }
  }
}

export function tryCatchSync<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    const data = fn()
    return { data, error: null } as const
  } catch (error) {
    return { data: null, error: error as E } as const
  }
}
