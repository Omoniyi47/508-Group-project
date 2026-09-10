const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Mutates objects/arrays in place instead of reassigning (Express 5's req.query
// is a getter with no setter, so `req.query = clean` would throw).
function stripDangerousKeys(value, depth = 0) {
  if (depth > 10 || value === null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    for (const item of value) stripDangerousKeys(item, depth + 1);
    return;
  }

  for (const key of Object.keys(value)) {
    if (BLOCKED_KEYS.has(key) || key.startsWith('$') || key.includes('.')) {
      delete value[key];
      continue;
    }
    stripDangerousKeys(value[key], depth + 1);
  }
}

export function sanitizeRequest(req, res, next) {
  stripDangerousKeys(req.body);
  stripDangerousKeys(req.params);
  stripDangerousKeys(req.query);
  next();
}
