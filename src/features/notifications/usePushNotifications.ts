import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { useQueryClient } from '@tanstack/react-query';
import { saveDeviceToken } from './pushService';

/**
 * --- usePushNotifications ---
 * Native-only push registration: requests permission, registers with FCM/APNs,
 * stores the device token (per user), and routes a tapped notification to the
 * screen named in its `data.route`. A foreground push just refreshes the
 * in-app notification feed so the bell stays in sync. No-op on web.
 */
export function usePushNotifications(userId: string | undefined): void {
    const navigate = useNavigate();
    const qc = useQueryClient();

    useEffect(() => {
        if (!userId || !Capacitor.isNativePlatform()) return;

        const handles: PluginListenerHandle[] = [];
        let active = true;

        (async () => {
            const { PushNotifications } = await import('@capacitor/push-notifications');

            let perm = await PushNotifications.checkPermissions();
            if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
                perm = await PushNotifications.requestPermissions();
            }
            if (perm.receive !== 'granted' || !active) return;

            await PushNotifications.register();

            handles.push(
                await PushNotifications.addListener('registration', (token) => {
                    void saveDeviceToken(userId, token.value, Capacitor.getPlatform());
                }),
                await PushNotifications.addListener('registrationError', (err) => {
                    console.warn('[push] registration error', err);
                }),
                // Foreground delivery: keep the in-app feed fresh.
                await PushNotifications.addListener('pushNotificationReceived', () => {
                    void qc.invalidateQueries({ queryKey: ['notifications'] });
                }),
                // Tap: deep-link to the route carried in the payload, if any.
                await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                    const route = action.notification?.data?.route;
                    if (typeof route === 'string' && route.startsWith('/')) navigate(route);
                }),
            );
        })();

        return () => {
            active = false;
            handles.forEach((h) => h.remove());
        };
    }, [userId, navigate, qc]);
}
