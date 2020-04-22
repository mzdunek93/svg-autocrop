/** Object mapping keys to debugged values */
const data: { [key: string]: unknown } = {}

/**
 * Stores a debugged value under a certain key
 *
 * @param key - The key to store the value under
 * @param val - The value
 */
export const debug = (key: string, val: unknown) => {
  if (process.env.NODE_ENV === 'test') {
    data[key] = val
  }
}

/**
 * Gets a stored debugged value
 *
 * @param key - The key under which a value is stored
 */
export const getDebug = (key: string) => {
  if (!(key in data)) {
    throw new Error(`key ${key} doesn't exist in debug data`)
  }

  return data[key]
}
