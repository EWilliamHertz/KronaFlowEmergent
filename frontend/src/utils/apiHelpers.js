/**
 * Extract array from various API response formats
 * Handles: [array], {key: array}, {data: array}, {items: array}
 */
export function extractArray(response, fallbackKey = null) {
  if (Array.isArray(response)) return response;
  if (typeof response === 'object' && response !== null) {
    // Try fallback key first
    if (fallbackKey && Array.isArray(response[fallbackKey])) {
      return response[fallbackKey];
    }
    // Try common keys
    for (const key of ['data', 'items', 'results', fallbackKey]) {
      if (key && Array.isArray(response[key])) {
        return response[key];
      }
    }
  }
  console.warn('⚠️ API response not in expected array format:', response);
  return [];
}

/**
 * Extract nested property safely, return empty array if not found
 */
export function extractNestedArray(obj, path) {
  if (!obj || typeof obj !== 'object') return [];
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    current = current?.[key];
    if (!current) return [];
  }
  return Array.isArray(current) ? current : [];
}
