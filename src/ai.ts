import type { Schema as SchemaType } from 'firebase/ai'
import { initializeApp } from 'firebase/app'
import { app, firebaseConfig, useEmulators } from './firebase'
import {
  DAYS,
  DAY_NAMES,
  MAX_COURSES,
  MAX_STEPS,
  MAX_STEP_INGREDIENTS,
  MAX_STEP_INSTRUCTIONS,
  type Day,
  type Ingredient,
  type Menu,
  type Recipe,
} from './weeks'

// Flash-Lite for its free tier: about 500 requests a day, where 3.x Flash gets 20 and a
// week's planning takes 10–20. On 2026-10-23, 3.8 Flash hung past a minute at LOW once,
// and 3.5 Flash was fast.
const MODEL = 'gemini-3.5-flash-lite'

// Gemini has no emulator. With an App Check debug token in .env.development.local,
// `npm run dev` calls the real Gemini through its own app on the real project, while Auth
// and Firestore stay on the emulators. Without one (and in e2e), stubs answer instead.
const debugToken: string | undefined = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN
const realAi = !useEmulators || !!debugToken

type Sdk = typeof import('firebase/ai')
let sdk: Promise<{ sdk: Sdk; ai: ReturnType<Sdk['getAI']> }> | undefined

// Loaded when Middag first opens (see warmUp), so App Check's reCAPTCHA and the AI SDK stay
// out of launch but are ready by the first AI call. App Check only protects Gemini;
// Firestore and Auth must not enforce it (ADR 0004).
function load() {
  sdk ??= (async () => {
    const [{ initializeAppCheck, ReCaptchaV3Provider }, ai] = await Promise.all([
      import('firebase/app-check'),
      import('firebase/ai'),
    ])
    const aiApp = useEmulators ? initializeApp(firebaseConfig, 'ai') : app
    if (useEmulators) Object.assign(self, { FIREBASE_APPCHECK_DEBUG_TOKEN: debugToken })
    initializeAppCheck(aiApp, {
      provider: new ReCaptchaV3Provider('6LdWdOosAAAAAD-CgahJPqpZb3pi8A06Bv5-rkh-'),
      isTokenAutoRefreshEnabled: true,
    })
    return { sdk: ai, ai: ai.getAI(aiApp, { backend: new ai.GoogleAIBackend() }) }
  })().catch((e) => {
    // Try again on the next call, e.g. after being offline.
    sdk = undefined
    throw e
  })
  return sdk
}

export function warmUp() {
  if (realAi) load().catch(() => {})
}

// Sends the prompt and returns Gemini's JSON answer, shaped by the schema. maxTokens caps
// thinking and answer together, so a model stuck repeating itself stops early.
async function generateJson(
  prompt: string,
  maxTokens: number,
  schema: (s: Sdk['Schema']) => SchemaType,
): Promise<unknown> {
  const { sdk, ai } = await load()
  const model = sdk.getGenerativeModel(
    ai,
    {
      model: MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema(sdk.Schema),
        maxOutputTokens: maxTokens,
        // Gemini 3 thinks by default. Planning dinners needs a little, not much.
        thinkingConfig: { thinkingLevel: sdk.ThinkingLevel.MEDIUM },
      },
    },
    // Until the answer starts arriving.
    { timeout: 60_000 },
  )
  // Streamed only to log when the answer starts and ends, to find where time goes.
  const start = performance.now()
  const ms = () => Math.round(performance.now() - start)
  const result = await model.generateContentStream(prompt)
  let first: number | undefined
  let usage
  for await (const chunk of result.stream) {
    first ??= ms()
    // Token counts come with the last part; the combined response leaves them out.
    usage = chunk.usageMetadata ?? usage
  }
  const response = await result.response
  const finish = response.candidates?.[0]?.finishReason
  console.info(
    `Gemini ${MODEL}: first part after ${first} ms, done after ${ms()} ms, finished ${finish}, ` +
      `${usage?.thoughtsTokenCount ?? 0} thinking and ${usage?.candidatesTokenCount ?? 0} answer tokens`,
  )
  if (finish === 'MAX_TOKENS') {
    console.warn('Gemini answer, cut off:', response.text().slice(0, 1000))
    throw new Error(`Gemini ran past ${maxTokens} tokens`)
  }
  return JSON.parse(response.text())
}

export type Context = { guidelines: string; dayNotes: Partial<Record<Day, string>>; weekLabel: string }

function contextPrompt({ guidelines, dayNotes, weekLabel }: Context) {
  const notes = DAYS.filter((d) => dayNotes[d]).map((d) => `${DAY_NAMES[d]}: ${dayNotes[d]}`)
  return [
    `Føringer (gjelder alle uker):\n${guidelines || '(ingen)'}`,
    `Notater for dagene i ${weekLabel}:\n${notes.join('\n') || '(ingen)'}`,
  ].join('\n\n')
}

function menuText(menu: Menu) {
  return DAYS.map((d) => `${DAY_NAMES[d]}: ${menu[d].join(' + ') || '(ingen middag)'}`).join('\n')
}

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '')

// A Menu: dinner for each day of the week, each a list of courses. With a current Menu and
// an instruction, the Menu is remade from them.
export async function makeMenu(context: Context, change?: { current: Menu; instruction: string }): Promise<Menu> {
  if (!realAi) return stubMenu(change)
  const prompt = [
    'Du planlegger middager for en familie, én middag for hver dag i uka, mandag til søndag.',
    'Hver middag er én rett.',
    'En dag kan stå uten middag hvis føringene eller notatene tilsier det.',
    'Skriv på norsk bokmål. Gi hver rett et kort navn, uten oppskrift.',
    contextPrompt(context),
    change && `Nåværende meny:\n${menuText(change.current)}`,
    change && `Endre menyen slik: ${change.instruction}\nBehold resten som det er.`,
  ]
    .filter(Boolean)
    .join('\n\n')
  const json = (await generateJson(prompt, 4000, (Schema) =>
    Schema.object({
      properties: Object.fromEntries(
        DAYS.map((d) => [d, Schema.array({
            description: `Rettene ${DAY_NAMES[d].toLowerCase()}`,
            maxItems: MAX_COURSES,
            items: Schema.string(),
          })]),
      ),
    }),
  )) as Partial<Record<Day, unknown>>
  return Object.fromEntries(
    DAYS.map((d) => {
      const courses = Array.isArray(json[d]) ? json[d] : []
      return [d, courses.map((c) => clean(c, 200)).filter(Boolean).slice(0, MAX_COURSES)]
    }),
  ) as Menu
}

// A Recipe for one course of a day's Meal. With a current Recipe and an instruction, the
// Recipe is remade from them.
export async function makeRecipe(
  context: Context,
  dish: { day: Day; meal: string[]; course: string },
  change?: { current: Recipe; instruction: string },
): Promise<Recipe> {
  if (!realAi) return stubRecipe(dish.course, change)
  const prompt = [
    'Du skriver en oppskrift på én rett til en familiemiddag.',
    'Skriv på norsk bokmål.',
    'Finn antall porsjoner ut fra føringene og notatene: hvem som spiser den dagen.',
    'Oppskriften er satt opp som i Modernist Cuisine: en liste med steg i den rekkefølgen de gjøres. Hvert steg er en gruppe ingredienser som tas i bruk sammen, med én eller flere korte instruksjoner for dem.',
    'Hver instruksjon er én handling i en setning eller to, konkret, med temperatur og tid der det trengs, for eksempel "Hakk løken fint." og "Stek på middels varme til den er myk, ca. 5 min."',
    'En ingrediens står i steget der den brukes. Brukes den i flere steg, står den i hvert av dem med mengden som brukes der. Et steg kan være uten ingredienser, for eksempel når noe skal hvile eller serveres.',
    'Oppgi mengden i gram for alt som har en mengde, også det som telles eller måles med skje, anslått (1 egg er omtrent 60 g, 1 ts salt omtrent 6 g). La gram stå tomt bare for det som er etter smak.',
    'Et kjøkkenmål er fritekst som "2 dl", "1 ss", "en klype", "2 fedd" eller "etter smak". Ta det med bare når det hjelper på kjøkkenet, og la det stå tomt når gram holder, som for kjøttdeig.',
    'For det som kjøpes per stykk, som egg, løk, paprika og sitron, er kjøkkenmålet antallet, som "2 stk". Hvitløk kjøpes som hele hoder, så hvitløk måles i fedd, ikke stk.',
    'Skriv hver ingrediens slik at det går fram hvor streng den er, for eksempel "helmelk" eller "melk, hvilken som helst".',
    contextPrompt(context),
    `Middagen ${DAY_NAMES[dish.day].toLowerCase()}: ${dish.meal.join(' + ')}`,
    `Retten: ${dish.course}`,
    change && `Nåværende oppskrift:\n${JSON.stringify(change.current)}`,
    change && `Endre oppskriften slik: ${change.instruction}\nBehold resten som det er.`,
  ]
    .filter(Boolean)
    .join('\n\n')
  const json = (await generateJson(prompt, 12000, (Schema) =>
    Schema.object({
      properties: {
        servings: Schema.integer({ description: 'Antall porsjoner' }),
        // No maxItems: nested limits make a schema Gemini refuses (400). The answer is
        // capped below instead.
        steps: Schema.array({
          items: Schema.object({
            properties: {
              ingredients: Schema.array({
                items: Schema.object({
                  properties: {
                    text: Schema.string({ description: 'Hva som trengs' }),
                    grams: Schema.number({ nullable: true, description: 'Mengden i gram' }),
                    measure: Schema.string({ description: 'Kjøkkenmål, eller tomt' }),
                  },
                }),
              }),
              instructions: Schema.array({ items: Schema.string(), description: 'Korte instruksjoner, i rekkefølge' }),
            },
          }),
        }),
      },
    }),
  )) as { servings?: unknown; steps?: unknown }
  return {
    course: dish.course,
    servings: Math.min(50, Math.max(1, Math.round(Number(json.servings) || 4))),
    steps: (Array.isArray(json.steps) ? json.steps : [])
      .map((s: { ingredients?: unknown; instructions?: unknown }) => ({
        ingredients: (Array.isArray(s.ingredients) ? s.ingredients : [])
          .map((i: Partial<Record<keyof Ingredient, unknown>>) => ({
            text: clean(i.text, 200),
            grams: quantity(i.grams),
            measure: clean(i.measure, 50),
          }))
          .filter((i) => i.text)
          .slice(0, MAX_STEP_INGREDIENTS),
        instructions: (Array.isArray(s.instructions) ? s.instructions : [])
          .map((t) => clean(t, 500))
          .filter(Boolean)
          .slice(0, MAX_STEP_INSTRUCTIONS),
      }))
      .filter((s) => s.instructions.length > 0 || s.ingredients.length > 0)
      .slice(0, MAX_STEPS),
  }
}

// A positive number, or none.
const quantity = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null)

// What an Ingredient's wording goes to Groceries as: a Staple (whatever the Family usually
// buys will do) or a Ware (exactly this), by name.
export type Match = { kind: 'staple' | 'ware'; name: string }

// The Staple or Ware for each Ingredient wording, in the same order, preferring the
// Family's own. A name that isn't theirs yet is a new one.
export async function makeMatches(wordings: string[], family: { staples: string[]; wares: string[] }): Promise<Match[]> {
  if (!realAi) return wordings.map(stapleFromWording)
  const prompt = [
    'Du gjør ingrediensene fra ukas oppskrifter om til en handleliste.',
    'For hver ingrediens, velg enten en basisvare eller en vare:',
    '- En basisvare er noe familien pleier å kjøpe, der det de vanligvis kjøper holder, for eksempel "melk", "løk" eller "salt". Ingredienser som "melk, hvilken som helst" er basisvarer.',
    '- En vare er akkurat det oppskriften trenger, når ingrediensen sier hvilken type, for eksempel "helmelk" eller "spaghetti nr. 5".',
    'Bruk en av familiens basisvarer eller varer når en passer, med nøyaktig samme navn. Ellers foreslå et kort navn på norsk bokmål, slik en familie ville sagt det, med liten forbokstav.',
    `Familiens basisvarer: ${family.staples.join(', ') || '(ingen)'}`,
    `Familiens varer: ${family.wares.join(', ') || '(ingen)'}`,
    `Ingredienser, svar i samme rekkefølge:\n${wordings.map((w) => `- ${w}`).join('\n')}`,
  ].join('\n\n')
  const json = (await generateJson(prompt, 6000, (Schema) =>
    Schema.object({
      properties: {
        matches: Schema.array({
          maxItems: wordings.length,
          items: Schema.object({
            properties: {
              wording: Schema.string({ description: 'Ingrediensen, som gitt' }),
              kind: Schema.enumString({ enum: ['staple', 'ware'], description: 'staple for basisvare, ware for vare' }),
              name: Schema.string({ description: 'Navnet på basisvaren eller varen' }),
            },
          }),
        }),
      },
    }),
  )) as { matches?: unknown }
  const answers = Array.isArray(json.matches) ? (json.matches as Partial<Record<keyof Match | 'wording', unknown>>[]) : []
  return wordings.map((w, i) => {
    // By wording, as the order may slip.
    const a = answers.find((m) => clean(m.wording, 200).toLowerCase() === w.toLowerCase()) ?? answers[i]
    const name = clean(a?.name, 100)
    return name ? { kind: a?.kind === 'ware' ? 'ware' : 'staple', name } : stapleFromWording(w)
  })
}

// The stubs answer at once with fixed content, and an instruction shows up in what they
// return.
function stubMenu(change?: { current: Menu; instruction: string }): Menu {
  if (change) return { ...change.current, thu: [`Stub: ${change.instruction}`.slice(0, 200)] }
  return {
    mon: ['Fiskesuppe'],
    tue: ['Taco'],
    wed: ['Pasta med kjøttsaus'],
    thu: [],
    fri: ['Pizza'],
    sat: ['Lammestek'],
    sun: ['Pannekaker'],
  }
}

// A Staple named after the wording up to any comma: "melk, hvilken som helst" is melk.
// The stub's answer, and the fallback when Gemini leaves a wording out.
function stapleFromWording(wording: string): Match {
  return { kind: 'staple', name: wording.split(',')[0].trim().slice(0, 100) || wording.slice(0, 100) }
}

function stubRecipe(course: string, change?: { current: Recipe; instruction: string }): Recipe {
  if (change) {
    const [first, ...rest] = change.current.steps
    const changed = { ingredients: first?.ingredients ?? [], instructions: [`Stub: ${change.instruction}`] }
    return { ...change.current, steps: [changed, ...rest] }
  }
  return {
    course,
    servings: 4,
    steps: [
      {
        ingredients: [
          // A bare number is pieces.
          { text: 'løk', grams: 200, measure: '2' },
          { text: 'salt', grams: null, measure: 'etter smak' },
        ],
        instructions: [`Lag ${course.toLowerCase()}.`],
      },
      { ingredients: [], instructions: ['La det hvile.', 'Server.'] },
    ],
  }
}
