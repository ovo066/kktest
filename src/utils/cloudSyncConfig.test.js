import { describe, expect, it } from 'vitest'
import {
  extractCloudSyncConfigFromText,
  resolveCloudSyncFirebaseConfig
} from './cloudSyncConfig'

describe('extractCloudSyncConfigFromText', () => {
  it('parses a firebaseConfig object snippet', () => {
    const snippet = `
      const firebaseConfig = {
        apiKey: "AIzaSyDemoValue",
        authDomain: "demo-app.firebaseapp.com",
        projectId: "demo-app",
        storageBucket: "demo-app.firebasestorage.app",
        messagingSenderId: "1234567890",
        appId: "1:1234567890:web:abc123def456",
        measurementId: "G-DEMO123"
      }
    `

    const result = extractCloudSyncConfigFromText(snippet)

    expect(result.matchedCount).toBe(7)
    expect(result.config).toEqual({
      apiKey: 'AIzaSyDemoValue',
      authDomain: 'demo-app.firebaseapp.com',
      projectId: 'demo-app',
      storageBucket: 'demo-app.firebasestorage.app',
      appId: '1:1234567890:web:abc123def456',
      messagingSenderId: '1234567890',
      measurementId: 'G-DEMO123'
    })
  })

  it('parses env lines and preserves fallback fields', () => {
    const snippet = `
      VITE_FIREBASE_API_KEY=AIzaEnvValue
      VITE_FIREBASE_PROJECT_ID=env-project
      VITE_FIREBASE_MESSAGING_SENDER_ID=99887766
    `

    const result = extractCloudSyncConfigFromText(snippet, {
      authDomain: 'fallback.firebaseapp.com',
      storageBucket: 'fallback.firebasestorage.app',
      appId: '1:99887766:web:fallback',
      measurementId: 'G-FALLBACK'
    })

    expect(result.matchedKeys).toEqual([
      'apiKey',
      'projectId',
      'messagingSenderId'
    ])
    expect(result.config).toEqual({
      apiKey: 'AIzaEnvValue',
      authDomain: 'fallback.firebaseapp.com',
      projectId: 'env-project',
      storageBucket: 'fallback.firebasestorage.app',
      appId: '1:99887766:web:fallback',
      messagingSenderId: '99887766',
      measurementId: 'G-FALLBACK'
    })
  })

  it('does not mix partial custom values with a bundled config', () => {
    const originalEnv = { ...import.meta.env }

    import.meta.env.VITE_FIREBASE_API_KEY = 'AIzaBundled'
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = 'bundled.firebaseapp.com'
    import.meta.env.VITE_FIREBASE_PROJECT_ID = 'bundled-project'
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET = 'bundled.firebasestorage.app'
    import.meta.env.VITE_FIREBASE_APP_ID = '1:555:web:bundled'
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID = '555'

    const resolved = resolveCloudSyncFirebaseConfig({
      apiKey: 'AIzaPartialOnly'
    })

    expect(resolved).toEqual({
      apiKey: 'AIzaBundled',
      authDomain: 'bundled.firebaseapp.com',
      projectId: 'bundled-project',
      storageBucket: 'bundled.firebasestorage.app',
      appId: '1:555:web:bundled',
      messagingSenderId: '555',
      measurementId: ''
    })

    Object.assign(import.meta.env, originalEnv)
  })
})
