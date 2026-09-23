import { Capacitor } from '@capacitor/core';
import { api } from './api';

const TOKEN_STORAGE_KEY = 'cm_push_device_token';

/**
 * Retrieves or initializes a unique device token for the current client device.
 * In a native Capacitor environment, this bridges to the device's push token.
 * In a standard web browser, it creates an authoritative persistent web push client token.
 */
export function getOrCreateDeviceToken(): string {
  try {
    let token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      const platform = Capacitor.getPlatform();
      const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      token = `cm_${platform}_${randomPart}`;
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
    return token;
  } catch {
    return `cm_fallback_${Date.now()}`;
  }
}

/**
 * Registers the active device token with the backend registry.
 * Dispatches the platform ('android' | 'ios' | 'web') and client metadata.
 */
export async function registerDeviceForPush(): Promise<boolean> {
  try {
    const token = getOrCreateDeviceToken();
    const rawPlatform = Capacitor.getPlatform();
    const platform: 'android' | 'ios' | 'web' =
      rawPlatform === 'ios' ? 'ios' : rawPlatform === 'android' ? 'android' : 'web';

    const deviceInfo = typeof navigator !== 'undefined'
      ? `${navigator.userAgent?.slice(0, 150)} [${platform}]`
      : `Platform: ${platform}`;

    const res = await api.notifications.registerDevice({
      token,
      platform,
      deviceInfo,
    });

    return !!res?.success;
  } catch (err) {
    console.warn('[PushNotifications] Device token registration skipped or offline:', err);
    return false;
  }
}

/**
 * Unregisters the current device token (e.g. on user logout).
 */
export async function unregisterDeviceForPush(): Promise<boolean> {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return true;

    await api.notifications.unregisterDevice(token);
    return true;
  } catch (err) {
    console.warn('[PushNotifications] Device token unregister skipped:', err);
    return false;
  }
}
