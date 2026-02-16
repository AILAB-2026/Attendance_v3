# Android — Production Build & Play Store Deployment

This guide walks through building a production Android app with Expo Application Services (EAS) and publishing it to Google Play.

Prereqs
- Expo account and EAS CLI: `npm i -g eas-cli` (CLI version per `eas.json`: `>= 16.17.4`)
- Google Play Console developer account
- App configured with Expo Router (already present) and `app.json`
- Ensure backend is reachable over the internet; set `EXPO_PUBLIC_API_BASE_URL` to your public API URL. For local/non-Expo tooling, use `API_BASE_URL`.

Project Files
- Config: `app.json`, `eas.json`
- API Base URL: `EXPO_PUBLIC_API_BASE_URL` in `.env` used by `lib/api.ts` (Expo). `API_BASE_URL` is used by node scripts/tests.

1) Prepare Metadata
- Update `app.json`:
  - `expo.name`, `expo.slug`, `expo.android.package` (e.g., `com.company.attendance`)
  - Icons/splash in `assets/images/`
- Bump version:
  - `expo.version` (user-facing)
  - `expo.android.versionCode` (integer; increment on every Play upload)

2) Configure EAS
- Log in and configure project:
```bash
eas login
# inside project root
EAS_NO_VCS=1 eas init --id attendance-app --non-interactive || eas init
```
- Check `eas.json` profiles (from repo):
```json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": { "autoIncrement": true }
  },
  "cli": { "version": ">= 16.17.4", "appVersionSource": "remote" }
}
```

3) Set Environment Variables
- In `.env` (and/or EAS secrets):
  - `EXPO_PUBLIC_API_BASE_URL=https://api.example.com`
  - Optional non-Expo: `API_BASE_URL=https://api.example.com`
- Push to EAS secrets (optional):
```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value https://api.example.com
```

4) Signing Keystore
- EAS can generate and manage your keystore automatically. Recommended:
```bash
eas build:configure
```
- Or bring your own keystore when prompted.

5) Build Android AAB
```bash
eas build --platform android --profile production
```
- Wait for build to complete. Download the `.aab` from the EAS build page.

Optional internal builds:
```bash
# Quick internal APK for sideload testing
eas build --platform android --profile preview
```

6) Internal Testing (Recommended)
- In Play Console, create an internal test track.
- Upload the `.aab`, add testers, roll out. Verify installs and API connectivity.

7) Production Release
- Complete store listing: app details, content rating, screenshots, privacy policy.
- Upload `.aab` to production track and submit for review.

Or use EAS Submit (after a successful build):
```bash
# Submit the latest Android build to Play Console
eas submit --platform android --latest
```

8) OTA Updates (Optional)
- Configure EAS Update for JS-only changes:
```bash
eas update:configure
# Create an update
EAS_NO_VCS=1 eas update --branch production --message "Bug fixes"
```

9) Troubleshooting
- White screen / network errors: confirm `EXPO_PUBLIC_API_BASE_URL` and server CORS.
- Play upload errors: increment `android.versionCode` and rebuild.
- Native crash on startup: verify minimum SDK, permissions, and binary built against supported Expo SDK.
- Device testing cannot reach local API: set both `API_BASE_URL` and `EXPO_PUBLIC_API_BASE_URL` to your machine LAN IP (e.g., `http://192.168.1.100:3000`). Ensure firewall allows inbound.

10) Rollback Strategy
- Keep an internal track build ready.
- For JS rollbacks, push an EAS update to `production` branch with the last known good commit.
