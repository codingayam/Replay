const ONESIGNAL_API_BASE = process.env.ONESIGNAL_API_BASE || 'https://api.onesignal.com';
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const ONESIGNAL_ENABLED_FLAG = process.env.ONESIGNAL_ENABLED;
const ONESIGNAL_CUSTOM_EVENTS_FLAG = process.env.ONESIGNAL_CUSTOM_EVENTS;

function isTestEnvironment() {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || process.env.JEST_WORKER_ID !== undefined;
}

function isConfigured() {
  if (isTestEnvironment()) {
    return false;
  }

  if (ONESIGNAL_ENABLED_FLAG && ['false', '0'].includes(ONESIGNAL_ENABLED_FLAG.toLowerCase())) {
    return false;
  }

  return Boolean(ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY);
}

async function callOneSignal(path, { method = 'GET', body, headers = {} } = {}) {
  if (!isConfigured()) {
    return { skipped: true };
  }

  if (typeof fetch !== 'function') {
    throw new Error('Global fetch API is not available; OneSignal call aborted');
  }

  const url = `${ONESIGNAL_API_BASE}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      ...headers,
    },
    body,
  });

  if (!response || typeof response.ok !== 'boolean') {
    throw new Error('Invalid response object returned from fetch');
  }

  if (!response.ok) {
    let errorText = response.statusText;
    if (typeof response.text === 'function') {
      errorText = await response.text().catch(() => response.statusText);
    }
    throw new Error(`OneSignal ${method} ${path} failed: ${response.status} ${errorText}`);
  }

  if (response.status === 204) {
    return null;
  }

  if (typeof response.json === 'function') {
    return response.json().catch(() => null);
  }

  return null;
}

export function onesignalEnabled() {
  return isConfigured();
}

export function onesignalCustomEventsEnabled() {
  return isConfigured() && ONESIGNAL_CUSTOM_EVENTS_FLAG === 'true';
}

export async function sendOneSignalNotification({
  externalId,
  subscriptionId,
  headings,
  contents,
  data,
  url,
  channel = 'push',
}) {
  if (!isConfigured()) {
    return { skipped: true };
  }

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    target_channel: channel,
    headings,
    contents,
    data,
  };

  if (externalId) {
    payload.include_aliases = { external_id: [externalId] };
  } else if (subscriptionId) {
    payload.include_player_ids = [subscriptionId];
  } else {
    return { skipped: true };
  }

  if (url) {
    payload.url = url;
  }

  return callOneSignal('/notifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOneSignalUser(externalId, tags = {}) {
  if (!isConfigured() || !externalId || !tags || Object.keys(tags).length === 0) {
    return { skipped: true };
  }

  const cleanedTags = Object.entries(tags).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }
    acc[key] = String(value);
    return acc;
  }, {});

  if (Object.keys(cleanedTags).length === 0) {
    return { skipped: true };
  }

  return callOneSignal(`/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${encodeURIComponent(externalId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ tags: cleanedTags }),
  });
}

export async function sendOneSignalEvent(externalId, name, payload = {}) {
  if (!onesignalCustomEventsEnabled() || !externalId || !name) {
    return { skipped: true };
  }

  const body = {
    events: [
      {
        external_id: externalId,
        name,
        payload,
      },
    ],
  };

  return callOneSignal(`/apps/${ONESIGNAL_APP_ID}/integrations/custom_events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function sendOneSignalEvents(events = []) {
  if (!onesignalCustomEventsEnabled()) {
    return { skipped: true };
  }

  const filtered = events
    .filter((event) => event && event.external_id && event.name)
    .map(({ external_id, name, payload = {} }) => ({ external_id, name, payload }));

  if (filtered.length === 0) {
    return { skipped: true };
  }

  return callOneSignal(`/apps/${ONESIGNAL_APP_ID}/integrations/custom_events`, {
    method: 'POST',
    body: JSON.stringify({ events: filtered }),
  });
}

export async function attachExternalIdToSubscription(subscriptionId, externalId) {
  if (!isConfigured() || !subscriptionId || !externalId) {
    return { skipped: true };
  }

  try {
    return await callOneSignal(`/apps/${ONESIGNAL_APP_ID}/subscriptions/${subscriptionId}/user/identity`, {
      method: 'PATCH',
      body: JSON.stringify({ identity: { external_id: externalId } }),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('409')) {
      return { skipped: true, reason: 'alias_exists' };
    }
    throw error;
  }
}

export default {
  onesignalEnabled,
  onesignalCustomEventsEnabled,
  sendOneSignalNotification,
  updateOneSignalUser,
  sendOneSignalEvent,
  sendOneSignalEvents,
  attachExternalIdToSubscription,
};
