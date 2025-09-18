import { randomUUID } from 'node:crypto';

const redact = (value) => {
  if (value == null) return value;
  if (typeof value === 'string' && value.length > 256) {
    return `${value.slice(0, 256)}…`;
  }
  return value;
};

export const createLogContext = (base = {}) => ({
  requestId: randomUUID(),
  ...base
});

export const log = (level, message, context = {}) => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...Object.fromEntries(Object.entries(context).map(([key, value]) => [key, redact(value)]))
  };

  if (level === 'error' || level === 'warn') {
    console.error(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
};

export const logInfo = (message, context) => log('info', message, context);
export const logWarn = (message, context) => log('warn', message, context);
export const logError = (message, context) => log('error', message, context);
export const logDebug = (message, context) => {
  if (process.env.LOG_LEVEL === 'debug') {
    log('debug', message, context);
  }
};
