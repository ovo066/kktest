# Firebase Cloud Sync Setup

This app stores cloud-sync metadata in Firestore and the actual backup ZIP in Firebase Storage.

Data model:
- Firestore: `users/{uid}/sync/latest`
- Storage: `users/{uid}/latest/aichat_cloud_backup.zip`

Repository setup already included:
- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `firebase-tools` in `devDependencies`

Minimal setup after logging into Firebase:

1. Log in:
   `npm run firebase:login`
2. Create or choose a Firebase project.
3. Create a Web app in that project.
4. Get the Web SDK config and fill the `VITE_FIREBASE_*` env vars.
5. Enable Authentication providers:
   - Anonymous
   - Google
6. Create Firestore and Cloud Storage in the Firebase console.
7. Deploy rules:
   `npm run firebase:deploy:rules -- --project <your-project-id>`

Notes:
- If you bundle `VITE_FIREBASE_*` values into the app before deploy, end users only need to enable cloud sync and optionally bind Google.
- Without a bundled config, the settings page still supports pasting a full Firebase config object.
