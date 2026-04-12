import { toDateKey } from './beijingTime'

/**
 * Active timezone calendar date key in YYYY-MM-DD format.
 * Defaults to Beijing (Asia/Shanghai), configurable in settings.
 */
export function toLocalDateKey(date = new Date()) {
  return toDateKey(date)
}
