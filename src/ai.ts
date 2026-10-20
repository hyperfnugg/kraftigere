import type { GenerativeModel } from 'firebase/ai'
import { app, useEmulators } from './firebase'

let model: Promise<GenerativeModel> | undefined

// Loaded on the first fun fact, so App Check's reCAPTCHA and the AI SDK stay out of launch.
// App Check only protects Gemini; Firestore and Auth must not enforce it.
function loadModel() {
  model ??= (async () => {
    const [{ initializeAppCheck, ReCaptchaV3Provider }, { GoogleAIBackend, getAI, getGenerativeModel }] =
      await Promise.all([import('firebase/app-check'), import('firebase/ai')])
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider('6LdWdOosAAAAAD-CgahJPqpZb3pi8A06Bv5-rkh-'),
      isTokenAutoRefreshEnabled: true,
    })
    return getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), { model: 'gemini-2.5-flash' })
  })().catch((e) => {
    // Try again on the next tap, e.g. after being offline.
    model = undefined
    throw e
  })
  return model
}

export async function generate(prompt: string): Promise<string> {
  // Gemini has no emulator, and App Check is off with emulators.
  if (useEmulators) return 'Stub fun fact (dev).'
  const result = await (await loadModel()).generateContent(prompt)
  return result.response.text()
}
