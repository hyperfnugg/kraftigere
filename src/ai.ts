import type { Schema as SchemaType } from 'firebase/ai'
import { initializeApp } from 'firebase/app'
import { app, firebaseConfig, useEmulators } from './firebase'
import { DAYS, DAY_NAMES, MAX_COURSES, type Day, type Ingredient, type Menu, type Recipe } from './weeks'

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
    'En middag kan ha flere retter (for eksempel forrett, hovedrett og dessert), men som regel én.',
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
    'Mengder i gram (enhet "g") med mindre noe annet er naturlig, som "stk", "dl", "ss" eller "ts". Bruk tom mengde for "etter smak".',
    'Skriv hver ingrediens slik at det går fram hvor streng den er, for eksempel "helmelk" eller "melk, hvilken som helst".',
    'Fremgangsmåten er nummererte steg, ett per linje.',
    contextPrompt(context),
    `Middagen ${DAY_NAMES[dish.day].toLowerCase()}: ${dish.meal.join(' + ')}`,
    `Retten: ${dish.course}`,
    change && `Nåværende oppskrift:\n${JSON.stringify(change.current)}`,
    change && `Endre oppskriften slik: ${change.instruction}\nBehold resten som det er.`,
  ]
    .filter(Boolean)
    .join('\n\n')
  const json = (await generateJson(prompt, 8000, (Schema) =>
    Schema.object({
      properties: {
        servings: Schema.integer({ description: 'Antall porsjoner' }),
        ingredients: Schema.array({
          maxItems: 60,
          items: Schema.object({
            properties: {
              text: Schema.string({ description: 'Hva som trengs' }),
              amount: Schema.number({ nullable: true }),
              unit: Schema.string(),
            },
          }),
        }),
        steps: Schema.string({ description: 'Fremgangsmåten, ett steg per linje' }),
      },
    }),
  )) as { servings?: unknown; ingredients?: unknown; steps?: unknown }
  return {
    course: dish.course,
    servings: Math.min(50, Math.max(1, Math.round(Number(json.servings) || 4))),
    ingredients: (Array.isArray(json.ingredients) ? json.ingredients : [])
      .map((i: Partial<Record<keyof Ingredient, unknown>>) => ({
        text: clean(i.text, 200),
        amount: typeof i.amount === 'number' && Number.isFinite(i.amount) ? i.amount : null,
        unit: clean(i.unit, 20),
      }))
      .filter((i) => i.text)
      .slice(0, 60),
    steps: clean(json.steps, 10000),
  }
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
    sat: ['Lammestek', 'Sjokolademousse'],
    sun: ['Pannekaker'],
  }
}

function stubRecipe(course: string, change?: { current: Recipe; instruction: string }): Recipe {
  if (change) return { ...change.current, steps: `Stub: ${change.instruction}` }
  return {
    course,
    servings: 4,
    ingredients: [
      { text: 'løk', amount: 200, unit: 'g' },
      { text: 'salt', amount: null, unit: '' },
    ],
    steps: `1. Lag ${course.toLowerCase()}.`,
  }
}
