const deliveryTotals = new Map();
const tokenRegistrations = new Map();
let schedulerLagSeconds = 0;
let retryQueueDepth = 0;

const makeKey = (parts) => parts.filter(Boolean).join('::');

export const recordDelivery = ({ channel, type, status, durationSeconds }) => {
  const key = makeKey([channel, type, status]);
  const current = deliveryTotals.get(key) || { count: 0, totalDuration: 0 };
  deliveryTotals.set(key, {
    count: current.count + 1,
    totalDuration: current.totalDuration + (Number(durationSeconds) || 0)
  });
};

export const recordTokenRegistration = ({ channel, browser, status }) => {
  const key = makeKey([channel, browser, status]);
  tokenRegistrations.set(key, (tokenRegistrations.get(key) || 0) + 1);
};

export const updateSchedulerLag = (lagSeconds) => {
  if (typeof lagSeconds === 'number' && !Number.isNaN(lagSeconds)) {
    schedulerLagSeconds = lagSeconds;
  }
};

export const updateRetryQueueDepth = (depth) => {
  if (typeof depth === 'number' && depth >= 0) {
    retryQueueDepth = depth;
  }
};

export const getMetricsSnapshot = () => {
  const deliveries = Array.from(deliveryTotals.entries()).map(([key, value]) => {
    const [channel, type, status] = key.split('::');
    return {
      channel,
      type,
      status,
      count: value.count,
      averageDurationSeconds: value.count ? value.totalDuration / value.count : 0
    };
  });

  const registrations = Array.from(tokenRegistrations.entries()).map(([key, count]) => {
    const [channel, browser, status] = key.split('::');
    return { channel, browser, status, count };
  });

  return {
    generatedAt: new Date().toISOString(),
    deliveries,
    tokenRegistrations: registrations,
    schedulerLagSeconds,
    retryQueueDepth
  };
};

export const resetMetrics = () => {
  deliveryTotals.clear();
  tokenRegistrations.clear();
  schedulerLagSeconds = 0;
  retryQueueDepth = 0;
};
