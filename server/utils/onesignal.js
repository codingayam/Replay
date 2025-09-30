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
  console.log('[OneSignal] sendOneSignalNotification called:', {
    externalId,
    subscriptionId,
    headings,
    channel
  });

  if (!isConfigured()) {
    console.log('[OneSignal] Not configured, skipping notification');
    return { skipped: true, reason: 'not_configured' };
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
    console.log('[OneSignal] Targeting by external_id:', externalId);
  } else if (subscriptionId) {
    payload.include_player_ids = [subscriptionId];
    console.log('[OneSignal] Targeting by subscription_id:', subscriptionId);
  } else {
    console.log('[OneSignal] No target specified (no externalId or subscriptionId)');
    return { skipped: true, reason: 'no_target' };
  }

  if (url) {
    payload.url = url;
  }

  console.log('[OneSignal] Sending notification with payload:', payload);

  try {
    const result = await callOneSignal('/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    console.log('[OneSignal] Notification sent successfully:', result);
    return result;
  } catch (error) {
    console.error('[OneSignal] Notification send failed:', {
      payload,
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
}

export async function updateOneSignalUser(externalId, tags = {}) {
  console.log('[OneSignal] updateOneSignalUser called:', { externalId, tags });

  if (!isConfigured()) {
    console.log('[OneSignal] Not configured, skipping tag update');
    return { skipped: true, reason: 'not_configured' };
  }

  if (!externalId) {
    console.log('[OneSignal] No externalId provided');
    return { skipped: true, reason: 'no_external_id' };
  }

  if (!tags || Object.keys(tags).length === 0) {
    console.log('[OneSignal] No tags provided');
    return { skipped: true, reason: 'no_tags' };
  }

  const cleanedTags = Object.entries(tags).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }
    acc[key] = String(value);
    return acc;
  }, {});

  if (Object.keys(cleanedTags).length === 0) {
    console.log('[OneSignal] All tags filtered out (null/undefined)');
    return { skipped: true, reason: 'all_tags_filtered' };
  }

  console.log('[OneSignal] Sending tags to OneSignal:', {
    externalId,
    cleanedTags,
    endpoint: `/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${encodeURIComponent(externalId)}`
  });

  try {
    const result = await callOneSignal(`/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${encodeURIComponent(externalId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ tags: cleanedTags }),
    });

    console.log('[OneSignal] Tag update successful:', result);
    return result;
  } catch (error) {
    console.error('[OneSignal] Tag update failed:', {
      externalId,
      tags: cleanedTags,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
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
  console.log('[OneSignal] attachExternalIdToSubscription called:', {
    subscriptionId,
    externalId
  });

  if (!isConfigured()) {
    console.log('[OneSignal] Not configured, skipping alias attachment');
    return { skipped: true, reason: 'not_configured' };
  }

  if (!subscriptionId || !externalId) {
    console.log('[OneSignal] Missing subscriptionId or externalId');
    return { skipped: true, reason: 'missing_parameters' };
  }

  try {
    const result = await callOneSignal(`/apps/${ONESIGNAL_APP_ID}/subscriptions/${subscriptionId}/user/identity`, {
      method: 'PATCH',
      body: JSON.stringify({ identity: { external_id: externalId } }),
    });
    console.log('[OneSignal] Alias attachment successful:', result);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('409')) {
      console.log('[OneSignal] Alias already exists (409 conflict) - this is expected');
      return { skipped: true, reason: 'alias_exists' };
    }
    console.error('[OneSignal] Alias attachment failed:', {
      subscriptionId,
      externalId,
      error: error instanceof Error ? error.message : error
    });
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
