import { setGlobalOptions } from 'firebase-functions/v2'
import { onCall } from 'firebase-functions/v2/https'

// Close to the Family, and capped so a bug or a flood can't run up a bill.
setGlobalOptions({ region: 'europe-west1', maxInstances: 2 })

// Placeholder until the Oda Link functions land: proves the app reaches the emulator.
export const ping = onCall(() => ({ pong: true }))
