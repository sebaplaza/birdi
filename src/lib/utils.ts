/**
 * General-purpose utility functions.
 */

/**
 * Formats a duration in milliseconds as `MM:SS`.
 * @param ms - Duration in milliseconds.
 * @returns Formatted time string (e.g. "02:35").
 */
export function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
