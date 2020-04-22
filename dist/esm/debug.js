/** Object mapping keys to debugged values */
const data = {};
/**
 * Stores a debugged value under a certain key
 *
 * @param key - The key to store the value under
 * @param val - The value
 */
export const debug = (key, val) => {
    if (process.env.NODE_ENV === 'test') {
        data[key] = val;
    }
};
/**
 * Gets a stored debugged value
 *
 * @param key - The key under which a value is stored
 */
export const getDebug = (key) => {
    if (!(key in data)) {
        throw new Error(`key ${key} doesn't exist in debug data`);
    }
    return data[key];
};
//# sourceMappingURL=debug.js.map