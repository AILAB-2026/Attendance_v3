# iOS — Production Build & App Store Submission

This guide covers building an iOS production app with EAS and submitting to App Store Connect.

Prereqs
- Apple Developer account with App Store Connect access
- Expo account and EAS CLI: `npm i -g eas-cli` (CLI version per `eas.json`: `>= 16.17.4`)
- macOS machine (for local signing/testing). EAS Cloud can build without macOS.
- Bundle ID reserved in App Store Connect (e.g., `com.company.attendance`)

Project Files
- Config: `app.json`, `eas.json`
- API Base URL: `EXPO_PUBLIC_API_BASE_URL` in `.env` used by `lib/api.ts` (Expo). `API_BASE_URL` is used by node scripts/tests.

1) Prepare Metadata
- Update `app.json`:
  - `expo.name`, `expo.slug`, `expo.ios.bundleIdentifier` (e.g., `com.company.attendance`)
  - Icons/splash in `assets/images/`
- Bump version:
  - `expo.version` (user-facing)
  - `expo.ios.buildNumber` (string, increment each App Store upload)

2) Configure EAS
```bash
eas login
# inside project root
EAS_NO_VCS=1 eas init --id attendance-app --non-interactive || eas init
```
- Ensure `eas.json` includes `production` profile (see repo):
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

3) Certificates & Provisioning Profiles
- Run:
```bash
eas build:configure
```
- Choose to let EAS manage credentials (recommended) or upload your own.

4) Set Environment Variables
- Ensure API URL is public:
  - `.env`: `EXPO_PUBLIC_API_BASE_URL=https://api.example.com`
- Optional non-Expo: `API_BASE_URL=https://api.example.com`
- Optionally store as secret:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value https://api.example.com
```

5) Build iOS (IPA)
```bash
eas build --platform ios --profile production
```
- This produces an `.ipa` (or an `.app` for simulator if configured). Use the EAS website to download.

6) Submit to App Store Connect
- Recommended automated submission:
```bash
eas submit --platform ios --latest --apple-id you@example.com --apple-app-specific-password ABCD-XXXX-YYYY-ZZZZ
```
- Or submit manually by downloading the `.ipa` and using Transporter.

7) TestFlight
- In App Store Connect, the uploaded build will appear under TestFlight.
- Add internal testers, collect feedback, and verify network/API access.

8) App Store Release
- Complete app information, screenshots, privacy policy, and content rights.
- Create a release under a version, add the approved build, and submit for review.

9) OTA Updates (Optional)
```bash
eas update:configure
EAS_NO_VCS=1 eas update --branch production --message "Bug fixes"
```

10) Troubleshooting
- Build failures: verify bundle identifier matches App Store Connect, and credentials are valid.
- Rejected binaries: ensure accurate descriptions, icons, screenshots; follow Apple HIG and privacy policies.
- API timeouts: verify `EXPO_PUBLIC_API_BASE_URL` and production server health.
- Device testing cannot reach local API: set both `API_BASE_URL` and `EXPO_PUBLIC_API_BASE_URL` to your machine LAN IP (e.g., `http://192.168.1.10:3000`). Ensure firewall allows inbound.

11) Rollback Strategy
- Keep a last-known-good build for quick re-submission if needed.
- For JS-only issues, push an EAS Update to the `production` branch.
