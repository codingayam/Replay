// Utility helpers for working with Replicate predictions

const URL_KEYS = ['audio', 'url', 'href'];

function resolveAudioUrl(value, seen = new Set()) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = resolveAudioUrl(item, seen);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return null;
    }
    seen.add(value);

    for (const key of URL_KEYS) {
      const candidate = value[key];
      if (typeof candidate === 'string' && candidate.length > 0) {
        return candidate;
      }
    }

    if (Object.prototype.hasOwnProperty.call(value, 'output')) {
      return resolveAudioUrl(value.output, seen);
    }
  }

  return null;
}

export function extractAudioUrlFromPrediction(prediction) {
  const url = resolveAudioUrl(prediction?.output);
  if (!url) {
    throw new Error('Replicate deployment response missing audio URL');
  }
  return url;
}

