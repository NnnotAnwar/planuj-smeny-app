# iOS push notifications (APNs) — setup guide

Tracking: **#89**. Android push (FCM) is live; this brings the Apple side up.

## Why this needs native + external setup

The backend (`supabase/functions/send-push`) delivers via **FCM HTTP v1** using a
per-device **FCM registration token** stored in `device_tokens`. On Android the
Capacitor push plugin already yields an FCM token. On **iOS**, the stock
`@capacitor/push-notifications` plugin yields a raw **APNs** token, which FCM's
`messages:send` will reject. So iOS must run the **Firebase iOS SDK**, which
swizzles APNs and issues a real FCM token — keeping the backend unchanged (one
FCM path for both platforms).

Everything below the "Client code" section requires resources only the project
owner has: an **Apple Developer account** and the **Firebase console**, plus a
Mac with Xcode to build and device-test (the Simulator can't receive push).

Bundle identifier: `com.planujsmeny.app` (matches Android `applicationId`).

## 1. Apple Developer (external)

1. In the Apple Developer portal, enable the **Push Notifications** capability for
   the App ID `com.planujsmeny.app`.
2. Create an **APNs Auth Key** (`.p8`, Keys → +, APNs). Note the **Key ID** and
   your **Team ID**. Keep the `.p8` — you upload it to Firebase, not the repo.

## 2. Firebase console (external)

1. In the same Firebase project that powers Android, **Add app → iOS**, bundle id
   `com.planujsmeny.app`. Download **`GoogleService-Info.plist`**.
2. Project Settings → **Cloud Messaging → Apple app configuration**: upload the
   APNs `.p8` with its Key ID + Team ID.
3. Drop `GoogleService-Info.plist` into `ios/App/App/` (it is **gitignored** like
   `google-services.json` — never commit it).

## 3. Client code (in-repo — recommended: `@capacitor-firebase/messaging`)

The token retrieval is what differs. The cleanest unified approach is to use
`@capacitor-firebase/messaging`, which returns an **FCM token** on both iOS and
Android, replacing `@capacitor/push-notifications` for registration/token/
listeners.

```bash
yarn add @capacitor-firebase/messaging
npx cap sync
```

Then update `src/features/notifications/usePushNotifications.ts` to use
`FirebaseMessaging` (`requestPermissions`, `getToken`, and the
`tokenReceived` / `notificationReceived` / `notificationActionPerformed`
listeners) instead of `PushNotifications`. The stored token, deep-link routing,
and `saveDeviceToken(userId, token, platform)` all stay the same.

> ⚠️ This swap also changes the **Android** token path, so Android push must be
> re-tested on a device after the change. If you'd rather not touch Android,
> keep `@capacitor/push-notifications` and add a small AppDelegate bridge
> (§4) that hands Firebase the APNs token and surfaces the FCM token — but the
> `@capacitor-firebase/messaging` route is less custom Swift to maintain.

## 4. Xcode / native (external — needs Xcode)

1. **Signing & Capabilities** → add **Push Notifications** and **Background
   Modes → Remote notifications**. This writes `App.entitlements`
   (`aps-environment`) and the `remote-notification` `UIBackgroundModes` entry.
2. `FirebaseApp.configure()` in `AppDelegate.application(_:didFinishLaunching…)`
   (the `@capacitor-firebase/messaging` plugin documents the exact AppDelegate
   additions — APNs token forwarding is handled by the plugin/SDK).
3. `cd ios/App && pod install` (Firebase pods), then build to a **real device**.

## 5. Verify end-to-end

1. Sign in on the device; confirm a row lands in `device_tokens` with
   `platform = 'ios'`.
2. Trigger a notification (e.g. publish a schedule that targets that user) and
   confirm the push arrives, localized to the user's language (see #90), and
   that tapping it deep-links via `data.route`.

## Status

- **Client** (`usePushNotifications`) is already platform-agnostic; only the
  token-source plugin needs the swap in §3.
- Blocked on the **external** Apple Developer + Firebase iOS setup and an Xcode
  device build. Once `GoogleService-Info.plist` exists and the Firebase iOS app
  is registered, the §3 client change can be implemented and reviewed in-repo.
