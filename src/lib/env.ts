/** Typed access to VITE_* env vars (inlined at build time; never secrets). */
export const env = {
  /** Mocks are ON unless the flag is explicitly "false". */
  useMocks: import.meta.env.VITE_USE_MOCKS !== 'false',
  /** With mocks off, dev builds talk to the emulator suite unless explicitly "false". */
  useEmulators: import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== 'false',
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'auto-rafiki.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'auto-rafiki',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  },
  functionsRegion: import.meta.env.VITE_FUNCTIONS_REGION ?? 'europe-west1',
  mapsApiKey: import.meta.env.VITE_MAPS_API_KEY ?? '',
} as const;
