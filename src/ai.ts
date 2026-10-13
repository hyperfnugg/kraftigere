import { GoogleAIBackend, getAI, getGenerativeModel } from 'firebase/ai'
import { app, useEmulators } from './firebase'

const ai = getAI(app, { backend: new GoogleAIBackend() })
const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash' })

export async function generate(prompt: string): Promise<string> {
  // Gemini has no emulator, and App Check is off with emulators.
  if (useEmulators) return 'Stub fun fact (dev).'
  const result = await model.generateContent(prompt)
  return result.response.text()
}
