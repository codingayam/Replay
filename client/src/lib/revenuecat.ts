import { Purchases, type PurchasesConfig } from '@revenuecat/purchases-js';

type Nullable<T> = T | null | undefined;

let cachedInstance: Purchases | null = null;
let configuredUserId: string | null = null;
let pendingChange: Promise<Purchases | null> | null = null;

const importMetaEnv =
  (typeof import.meta !== 'undefined' && (import.meta as any).env) ||
  (globalThis as any).__REPLAY_IMPORT_META_ENV__ ||
  {};

const resolveEnvValue = (key: string): string | undefined => {
  const value = importMetaEnv[key] ?? process.env?.[key];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
};

const getPublicApiKey = (): string | undefined => {
  const apiKey = resolveEnvValue('VITE_REVENUECAT_PUBLIC_API_KEY');
  if (!apiKey) {
    console.warn('[RevenueCat] Missing VITE_REVENUECAT_PUBLIC_API_KEY env. Skipping configuration.');
  }
  return apiKey;
};

const withPending = (promise: Promise<Purchases | null>): Promise<Purchases | null> => {
  pendingChange = promise.finally(() => {
    if (pendingChange === promise) {
      pendingChange = null;
    }
  });
  return pendingChange;
};

const configureInstance = (config: PurchasesConfig): Purchases => {
  cachedInstance = Purchases.configure(config);
  configuredUserId = config.appUserId ?? null;
  return cachedInstance;
};

const ensureConfigured = async (appUserId: Nullable<string>): Promise<Purchases | null> => {
  const apiKey = getPublicApiKey();
  if (!apiKey) {
    return null;
  }

  const targetUserId = appUserId ?? Purchases.generateRevenueCatAnonymousAppUserId();

  if (!Purchases.isConfigured()) {
    return configureInstance({ apiKey, appUserId: targetUserId });
  }

  const instance = cachedInstance ?? Purchases.getSharedInstance();
  cachedInstance = instance;

  if (configuredUserId === targetUserId) {
    return instance;
  }

  try {
    await instance.changeUser(targetUserId);
    configuredUserId = targetUserId;
    return instance;
  } catch (error) {
    console.error('[RevenueCat] Failed to change user:', error);
    throw error;
  }
};

export const initializeRevenueCat = (appUserId: Nullable<string>): Promise<Purchases | null> => {
  if (pendingChange) {
    return pendingChange;
  }
  const promise = ensureConfigured(appUserId);
  return withPending(promise);
};

export const getRevenueCatInstance = (): Purchases | null => {
  if (!Purchases.isConfigured()) {
    return null;
  }
  cachedInstance = cachedInstance ?? Purchases.getSharedInstance();
  return cachedInstance;
};

export const resetRevenueCatUser = async (): Promise<void> => {
  if (!Purchases.isConfigured()) {
    cachedInstance = null;
    configuredUserId = null;
    return;
  }

  const anonUserId = Purchases.generateRevenueCatAnonymousAppUserId();
  if (configuredUserId === anonUserId) {
    return;
  }

  const instance = cachedInstance ?? Purchases.getSharedInstance();
  cachedInstance = instance;

  try {
    await instance.changeUser(anonUserId);
    configuredUserId = anonUserId;
  } catch (error) {
    console.error('[RevenueCat] Failed to reset user:', error);
  }
};

export const isRevenueCatReady = (): boolean => Purchases.isConfigured();
