const IS_PRODUCTION = import.meta.env.PROD

/** Log an error in development, silenced in production builds. */
export function logError(message: string, error?: unknown): void {
  if (IS_PRODUCTION) return
  console.error(message, error)
}

/** Log a warning in development, silenced in production builds. */
export function logWarn(message: string, ...args: unknown[]): void {
  if (IS_PRODUCTION) return
  console.warn(message, ...args)
}
