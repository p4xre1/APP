import type { ResetRequest } from './storage'

/** A locked reset must survive a full day before anything is erased. */
export const RESET_WAIT_MS = 24 * 60 * 60 * 1000

/** performance.now() only ever moves forward, even if the phone clock is changed. */
export const monotonicNow = (): number =>
  typeof performance !== 'undefined' && typeof performance.timeOrigin === 'number' ? performance.timeOrigin + performance.now() : Number.NaN

/** A wall clock earlier than anything seen before is treated as the highest known value. */
export const trustedNow = (floor?: number) => Math.max(Date.now(), floor ?? 0)

/**
 * Elapsed time is the smaller of the wall-clock and monotonic readings, so moving the
 * phone clock forwards, backwards or across reboots can never shorten the wait.
 */
export function resetElapsedMs(request: ResetRequest, nowWall: number, nowMonotonic: number): number {
  const wall = Math.max(0, nowWall - request.requestedAt)
  const comparable = Number.isFinite(request.monotonicAt) && Number.isFinite(nowMonotonic)
  return comparable ? Math.min(wall, Math.max(0, nowMonotonic - request.monotonicAt)) : wall
}

export const resetRemainingMs = (request: ResetRequest, nowWall: number, nowMonotonic: number) =>
  Math.max(0, RESET_WAIT_MS - resetElapsedMs(request, nowWall, nowMonotonic))

export const resetReady = (request: ResetRequest | undefined, nowWall: number, nowMonotonic: number) =>
  !!request && resetRemainingMs(request, nowWall, nowMonotonic) === 0
