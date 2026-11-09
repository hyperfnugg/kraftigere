import { type PackSize, packSizeOf } from './amounts'
import { callable, startAppCheck, useEmulators } from './firebase'
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

// Gemini, through the generate function, which only Family Members may call. It keeps the model
// and answers { stub: true } in the emulator, unless real Gemini is on there
// (functions/.env.local), and then the task's stub below answers.
const generate = callable<
  { prompt: string; schema: object; maxTokens: number },
  { stub: true } | { json: unknown }
>('generate', { timeout: 125_000 }) // A little past the function's own 120 s.

// Starts App Check when Middag first opens, so reCAPTCHA stays out of launch but is ready by the
// first AI call.
export function warmUp() {
  if (!useEmulators) startAppCheck().catch(() => {})
}

// Sends the prompt and returns Gemini's JSON answer, shaped by the JSON schema, or { stub: true }.
// maxTokens caps thinking and answer together, so a model stuck repeating itself stops early.
async function generateJson(prompt: string, maxTokens: number, schema: object) {
  return (await generate({ prompt, schema, maxTokens })).data
}

// JSON schema, with every property required.
const object = (properties: Record<string, object>) => ({ type: 'object', properties, required: Object.keys(properties) })
const array = (items: object, more?: object) => ({ type: 'array', items, ...more })
// No description: undefined would reach Gemini as null.
const string = (description?: string) => (description ? { type: 'string', description } : { type: 'string' })
const number = (type: 'number' | 'integer', description: string, nullable = false) => ({
  type: nullable ? [type, 'null'] : type,
  description,
})

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
  const answer = await generateJson(
    prompt,
    4000,
    object(
      Object.fromEntries(
        DAYS.map((d) => [d, array(string(), { description: `Rettene ${DAY_NAMES[d].toLowerCase()}`, maxItems: MAX_COURSES })]),
      ),
    ),
  )
  if ('stub' in answer) return stubMenu(change)
  const json = answer.json as Partial<Record<Day, unknown>>
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
    'Skriv hver ingrediens slik at det går fram hvor streng den er, for eksempel "melk, hel" eller "melk, hvilken som helst". Ta bare med det som gjør den til noe annet å kjøpe: "smør", ikke "smør, meieri", og "salt", ikke "salt, koksalt".',
    INGREDIENT_ORDER,
    contextPrompt(context),
    `Middagen ${DAY_NAMES[dish.day].toLowerCase()}: ${dish.meal.join(' + ')}`,
    `Retten: ${dish.course}`,
    change && `Nåværende oppskrift:\n${JSON.stringify(change.current)}`,
    change && `Endre oppskriften slik: ${change.instruction}\nBehold resten som det er.`,
  ]
    .filter(Boolean)
    .join('\n\n')
  const answer = await generateJson(
    prompt,
    12000,
    object({
      servings: number('integer', 'Antall porsjoner'),
      // No maxItems: nested limits made a schema Gemini refused (400). The answer is capped
      // below instead.
      steps: array(
        object({
          ingredients: array(
            object({
              text: string('Hva som trengs'),
              grams: number('number', 'Mengden i gram', true),
              measure: string('Kjøkkenmål, eller tomt'),
            }),
          ),
          instructions: array(string(), { description: 'Korte instruksjoner, i rekkefølge' }),
        }),
      ),
    }),
  )
  if ('stub' in answer) return stubRecipe(dish.course, change)
  const json = answer.json as { servings?: unknown; steps?: unknown }
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

// Singular, the thing first, so names read quickly and sort together on the shopping list.
const INGREDIENT_ORDER =
  'Skriv navnet i entall, med det viktigste ordet først og det som skiller det etter komma, også det som ellers er ett sammensatt ord: "løk, gul", "melk, hel", "kylling, bryst", "pølse, kjøttpølse", "fisk, filet, hvit, hyse eller torsk". Navn som hører sammen beholder rekkefølgen sin, som "panna cotta", "crème fraîche" og "spaghetti nr. 5".'

// A positive number, or none.
const quantity = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null)

// The Ware for each Ingredient wording, by name, in the same order, preferring the
// Family's own. A name that isn't theirs yet is a new one.
export async function makeMatches(wordings: string[], wares: string[]): Promise<string[]> {
  const prompt = [
    'Du gjør ingrediensene fra ukas oppskrifter om til en handleliste.',
    'For hver ingrediens, velg varen den skal kjøpes som. Varens navn er ingrediensens navn, uten det som ikke gjør den til noe annet å kjøpe. Behold det som skiller i butikken: "melk, hel", "løk, gul", "kylling, bryst". Ta bort resten: "salt, fin", "salt, hav" og "salt, koksalt" er alle "salt", og "smør, meieri" og "meierismør" er "smør".',
    'Se på alle ingrediensene samlet før du svarer. Det som er det samme å kjøpe, får nøyaktig samme vare, også når den er ny: "pølser, kjøttpølser" og "kjøttpølse" er begge "pølse, kjøttpølse".',
    'Bruk en av familiens varer når den er det samme å kjøpe, med nøyaktig samme navn. Ellers foreslå navnet på norsk bokmål, med liten forbokstav.',
    INGREDIENT_ORDER,
    `Familiens varer: ${wares.join(', ') || '(ingen)'}`,
    `Ingredienser, svar i samme rekkefølge:\n${wordings.map((w) => `- ${w}`).join('\n')}`,
  ].join('\n\n')
  const answer = await generateJson(
    prompt,
    6000,
    object({
      matches: array(object({ wording: string('Ingrediensen, som gitt'), name: string('Navnet på varen') }), {
        maxItems: wordings.length,
      }),
    }),
  )
  if ('stub' in answer) return wordings.map(wareFromWording)
  const json = answer.json as { matches?: unknown }
  const answers = Array.isArray(json.matches) ? (json.matches as Partial<Record<'wording' | 'name', unknown>>[]) : []
  return wordings.map((w, i) => {
    // By wording, as the order may slip.
    const a = answers.find((m) => clean(m.wording, 200).toLowerCase() === w.toLowerCase()) ?? answers[i]
    return clean(a?.name, 100) || wareFromWording(w)
  })
}

// The Pack Size of each Oda Product, in the same order, or null for one the answer gives none
// for. Kraft works out the Pack Count from it, so the AI only reads, and doesn't count.
export async function readPackSizes(products: { id: number; name: string; packText: string }[]): Promise<(PackSize | null)[]> {
  const prompt = [
    'Du leser hvor mye én pakning av hver vare i en nettbutikk inneholder, ut fra navnet og pakningsteksten.',
    'Oppgi vekten av hele pakningen i gram. Regn om det som er oppgitt i liter eller annet mål, omtrentlig (1 l melk er omtrent 1030 g, 1 l olje omtrent 920 g), og anslå vekten når bare antallet er oppgitt (12 egg er omtrent 720 g).',
    'Oppgi antall stykk i pakningen bare for det som kjøpes per stykk, som egg (12), en sitron (1) eller en løk (1). For det som kjøpes etter vekt eller volum, som melk, mel og smør, skal antall stykk være tomt.',
    `Varer:\n${products.map((p) => `- ${p.id}: ${p.name} (${p.packText || 'ingen pakningstekst'})`).join('\n')}`,
  ].join('\n\n')
  const answer = await generateJson(
    prompt,
    6000,
    object({
      products: array(
        object({
          id: number('integer', 'Varens nummer, som gitt'),
          grams: number('number', 'Vekten av én pakning i gram', true),
          pieces: number('integer', 'Antall stykk i én pakning, eller tomt', true),
        }),
        { maxItems: products.length },
      ),
    }),
  )
  if ('stub' in answer) return products.map(stubPackSize)
  const json = answer.json as { products?: unknown }
  const answers = Array.isArray(json.products) ? (json.products as Partial<Record<'id' | 'grams' | 'pieces', unknown>>[]) : []
  return products.map((p) => {
    const a = answers.find((a) => a.id === p.id)
    return a ? packSizeOf(a.grams, a.pieces) : null
  })
}

// Reads the plain cases, and none for pack text that names no amount, which is how tests see
// the AI failing.
function stubPackSize({ packText }: { packText: string }) {
  const m = /(\d+(?:,\d+)?)\s*(kg|g|l|dl|stk)\b/.exec(packText)
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  const grams = { kg: 1000, g: 1, l: 1000, dl: 100, stk: 60 }[m[2]] ?? 1
  return packSizeOf(n * grams, m[2] === 'stk' ? n : null)
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

// A Ware named as the wording. The stub's answer, and the fallback when Gemini leaves a
// wording out.
function wareFromWording(wording: string) {
  return wording.trim().slice(0, 100)
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
