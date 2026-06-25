# Prism Patch

Prism Patch is a mobile-first diamond painting app with a local development backend, App Store submission materials, and a Capacitor iOS wrapper path.

## Run The App

```bash
npm start
```

Open `http://127.0.0.1:4173`.

Demo login:

- Email: `demo@prismpatch.app`
- Password: `sparkle123`

## What Is Included

- Mobile and tablet app layout
- Login screen
- First-time profile setup with date of birth, gender, and optional location sharing
- Device-local account creation and saved project data when the hosted backend is not available
- Settings screen
- Home, projects, ideas, inventory, and community views
- Current project and possible-next-projects sections on Home
- Connection range preference and map in Settings
- Progress tracking by percentage, with optional completed-section and total-section calculation
- Local Node backend with no third-party dependencies
- Token-based auth, password hashing, and JSON persistence
- Health check plus create, update, and delete routes for core saved data
- Account deletion
- Report and block controls for community content
- Privacy policy, terms, support, and community guidelines pages
- Web app manifest for a future installable build
- Capacitor iOS project configuration
- App Store metadata, review notes, privacy label draft, and release checklist in `appstore/`
- iOS privacy manifest template in `native/ios/PrivacyInfo.xcprivacy` and copied into `ios/App/App/PrivacyInfo.xcprivacy`

## Build Web Assets

```bash
npm run build:web
```

This creates `www/`, which is the app bundle copied into the native iOS project.

## iOS App Path

```bash
npm run ios:sync
npm run ios:open
```

The generated iOS project lives in `ios/App`.

The app can be tested on iPhone or iPad before the production backend is live. If `https://api.prismpatch.app/api` is unavailable, users can create a device-local account and save projects, ideas, settings, and blocked community posts on that device. True multi-user syncing, community posts, and cross-device sign-in require the hosted backend.

Before App Store submission:

- Install full Xcode.
- Install CocoaPods.
- Open `ios/App/App.xcworkspace`.
- Set the Apple Developer Team.
- Confirm bundle ID `app.prismpatch.mobile`.
- Archive from Xcode and upload through Organizer or Transporter.

## Production Release Requirements

- Host the backend at `https://api.prismpatch.app/api`.
- Set `PRISM_PATCH_SECRET` to a long random value.
- Replace JSON persistence with a production database and backups.
- Add a moderation dashboard for reports.
- Replace placeholder support/privacy URLs with live public URLs.
- Complete legal review of terms and privacy policy.
- Test on physical iPhone and iPad.
- Upgrade Node to 22+ and Capacitor to 8+ before release to clear current Capacitor CLI audit warnings.

Useful files:

- `appstore/app-store-metadata.json`
- `appstore/privacy-nutrition-label.md`
- `appstore/review-notes.md`
- `appstore/release-checklist.md`
