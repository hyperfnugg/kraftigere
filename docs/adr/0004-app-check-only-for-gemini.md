---
status: accepted
---

# App Check only for Gemini: Firestore and Auth are not enforced, for launch speed

App Check, which proves that requests come from our app rather than a script, protects only Gemini (at first the fun fact, now the meal planner). It loads on the first Gemini call, not at launch, and it is not enforced for Cloud Firestore or Authentication (they stay in monitoring mode). App Check's reCAPTCHA weighs about 700 KB on a first visit, more than the whole app, and runs on every launch. Taking it off launch is part of making the installed app open fast (plan 11). Enforcing App Check for Firestore or Auth would put reCAPTCHA back in front of every launch, so they are protected by Google sign-in and the security rules alone: only signed-in Family Members on the allowlist can read or write, and only in the shapes the rules allow (ADR 0003).

**At the time of this decision, losing data was an accepted risk.** The only data is a shared shopping List: short-lived, cheap to rebuild, and with no backups. Without App Check on Firestore, anyone holding a Family Member's sign-in, or anyone running the public web config from a script, can talk to Firestore directly rather than through the app. The rules still apply, so outsiders get nothing, but a Family Member's account used outside the app (or a compromised one) can check off or Remove every Entry. We accepted that.

## Considered Options

- **Enforce App Check everywhere, loaded at launch.** Rejected: about 700 KB and a script run on every launch, for protection the rules mostly already give.
- **Enforce App Check everywhere, but defer Firestore until it's ready.** Rejected: the List would wait for reCAPTCHA on every launch, which is the delay we're removing.
- **Drop App Check entirely.** Rejected: Gemini calls use metered quota (rate-limited on the free tier, billed on a paid one) and have no protection other than App Check, since the API key is public.

## Consequences

- Never switch Firestore or Authentication to Enforced in the App Check console without revisiting this ADR: the List would stop loading.
- App Check's monitoring graphs show most Firestore and Auth requests as unverified. That's expected.
- Firestore and Auth quota can be consumed by scripts using the public config. On the free Spark plan that stops the app until the quota resets; on the paid Blaze plan it costs money, so set a budget alert there.
- Revisit before data that's costly to lose or misuse arrives: Templates, the Meal Plan, Personal Lists, and above all Oda ordering, which spends money. Options then include backups, enforcing App Check (with the launch cost) or moving sensitive writes behind a server.

## Notes

- 2026-10-23: Revisited before the Menu (plan 16). Guidelines and Weeks (Week Notes, Menus, Recipes) get the same accepted risk as the List: a Family Member's account used outside the app can overwrite or empty them, and there are no backups. They are a week's work at most and the AI can remake them. Gemini now writes a Menu and a Recipe per course, so more quota is spent per week, still protected by App Check alone. Oda ordering, which spends money, is revisited in plan 18.
- 2026-11-09: Revisited for Oda ordering (plan 29). The Oda callables now enforce App Check and start it on first use, not at launch, while Firestore and Auth stay unenforced. The reason hasn't changed: the List reads Firestore at launch and works offline, so enforcing there would put reCAPTCHA in front of every launch and every sync. What spends money is behind a server: the Oda Link's tokens are denied to every client, and the Basket changes only through the callables. Scripts using the public config to run up Firestore quota on Blaze are left to the soft budget and the kill switch. A Family Member's account used outside the app keeps the accepted risk above, since App Check wouldn't stop someone with a real browser and that sign-in.
- 2026-11-09: Gemini is behind the allowlist now (plan 31). Every Gemini call goes through the `generate` callable, which needs App Check and a Family Member's sign-in, and calls Gemini on Vertex AI as the functions' service account, with no API key. App Check is no longer Gemini's only protection: anyone could pass it from a real browser, but only Family Members get past `requireFamily`. Firebase AI Logic and the Gemini Developer API are turned off, their Gemini key and the App Check debug token deleted. Over-use by a Family Member is left to the budgets and the kill switch (ADR 0005). The decision on Firestore and Auth is unchanged.
