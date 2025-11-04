/**
 * No-operation utilities for cleaner error handling
 */

/**
 * No-op function that does nothing
 */
export const noop = (): void => {};

/**
 * No-op async function that resolves immediately
 */
export const noopAsync = async (): Promise<void> => {};

/**
 * Log error silently (for cases where we want to ignore errors but could log for debugging)
 */
export const logErrorSilently = (err: unknown, context?: string): void => {
  // In development, you might want to log these
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[Silent Error${context ? ` - ${context}` : ''}]`, err);
  }
  // Production: silently ignore
};

/**
 * Execute function with silent error handling
 */
export const executeSilently = async (
  fn: () => Promise<void> | void,
  context?: string
): Promise<void> => {
  try {
    await fn();
  } catch (err) {
    logErrorSilently(err, context);
  }
};

/**
 * Execute function with fallback value
 */
export const executeWithFallback = async <T>(
  fn: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    logErrorSilently(err, context);
    return fallback;
  }
};

/**
 * Safe execute - returns success flag and result
 */
export const safeExecute = async <T>(
  fn: () => Promise<T>,
  context?: string
): Promise<{ success: boolean; result?: T; error?: unknown }> => {
  try {
    const result = await fn();
    return { success: true, result };
  } catch (err) {
    logErrorSilently(err, context);
    return { success: false, error: err };
  }
};

/**
 * Continue on error utility - maps over array and continues on failures
 */
export const continueOnError = async <T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  context?: string
): Promise<Array<{ success: boolean; result?: R; error?: unknown; item: T }>> => {
  const results = [];
  
  for (const item of items) {
    const result = await safeExecute(() => fn(item), context);
    results.push({ ...result, item });
  }
  
  return results;
};
