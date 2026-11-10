# Debts — ديوني

A small installable web app (PWA) for keeping track of what you owe: to friends, to the corner shop that held your change, on a card, on a loan. Each debt can have a **place** (a map pin, or just a name) and a **payoff plan** tells you when you will be debt-free.

A cartoon man on the home screen carries your debt in a green sack. The sack is the jar: it fills with what you still owe, measured against the *peak* on its tag (the most you have owed since everything was last paid off). How he carries it shows how you are doing.

Arabic and English (RTL/LTR), light and dark. Works offline. Everything stays in your browser.

## Run it

```bash
node tools/serve.js
```

Open http://localhost:5180. On localhost the service worker is **off**, so your edits show on reload. Add `?sw` (http://localhost:5180/?sw) to turn it on and test installing and working offline.

After any change to a file, run:

```bash
node tools/build-sw.js
```

This rewrites `VERSION` and `PRECACHE` in `sw.js` from a hash of the files, so installed copies offer «Update now».

The install dialog's screenshots (`assets/img/screens/`, listed under `screenshots` in the manifest) are taken from sample debts by headless Chrome, with the server running:

```bash
node tools/screens.js
```

It uses a throwaway browser profile, so your own data is never touched. They are not precached. It is a static site with no build step otherwise, and can be served as-is (e.g. GitHub Pages; `.nojekyll` is there).

## Screens

| Hash | What it shows |
|---|---|
| `#/` | The man and his sack, what is still owed, the debt-free date, this month's payments, debts near you, the list (sortable), paid-off debts |
| `#/debt/<id>` | One debt: balance, progress, payments and extra borrowing, its place on a small map with directions, history |
| `#/plan` | Monthly budget, strategy (snowball, avalanche, due dates, your own order), debt-free date, chart, what the other strategies would change, the order with this month's amounts |
| `#/map` | Every debt with a place, on one map, with distances when location is allowed |
| `#/settings` | Language, theme, currency, «remind me when I'm near», export JSON/CSV, import, erase |
| `#/add` | Opens the add form (the home-screen shortcut) |

## The man's levels

`app.js` (`level()`) works out a level from the plan, and `jar.js` draws it:

| Level | When | How he looks |
|---|---|---|
| 0 | Nothing owed | Standing, arms up, jumping; the empty sack at his feet |
| 1 | Plan done in ≤ 2 months | Small sack, smiling |
| 2 | ≤ 8 months, or no budget set yet | Like the original cartoon |
| 3 | ≤ 24 months | Bigger sack, bent, sweating, gritted teeth |
| 4 | Longer, or the budget can't keep up with interest | Squashed, shaking, stress marks |

An overdue debt adds one level. Adding or borrowing drops the sack on him («Oof!»), a payment lifts it («Phew!»), paying a debt off throws confetti, and tapping him gets a line. These moments are off when the system asks for reduced motion.

## Files

| File | What it does |
|---|---|
| `index.html` | The one page: header, the stage, the screen, the tab bar, the sheet (`<dialog>`) |
| `assets/js/i18n.js` | `L(ar, en)`, language and direction, money, dates and spans in the current language and currency |
| `assets/js/store.js` | All the data, saved to `localStorage`, plus export and import |
| `assets/js/plan.js` | The month-by-month payoff simulation and the strategy comparison |
| `assets/js/places.js` | Device location, Leaflet maps (picker, overview, mini map), nearby debts, distances |
| `assets/js/jar.js` | The SVG man and sack, levels, reactions, speech bubble, confetti |
| `assets/js/notify.js` | Toast notes with optional buttons |
| `assets/js/app.js` | Routing, the screens, forms, reminders (due soon, near you) |
| `assets/js/pwa.js` | Service worker registration, «Update now», install key, offline/online notes |
| `assets/css/app.css` | All styles; colours are tokens on `:root`, the man's colours too |
| `sw.js` | Precaches the app; keeps fonts, Leaflet and the map tiles you have seen |
| `manifest.webmanifest` | Install details, icons, shortcuts |
| `tools/build-sw.js` | Rewrites the service worker's version and file list |
| `tools/serve.js` | A small local static server |

## Data

Saved under the `localStorage` key `debts-state` (see the header of `store.js`):

```js
{
  version: 1,
  settings: { lang, theme, currency, budget, strategy, order, nearby },
  debts: [{
    id, name, kind,            // kind: person | store | card | loan | other
    amount,                    // what was first borrowed
    apr, minPay, due, note,
    place,                     // { lat, lng, label }: coordinates, a name, or both; or null
    entries: [{ id, type, amount, date, note }],   // type: pay | borrow
    created, updated, closed
  }],
  meta: { peak, created }      // peak: the most owed since it last went to zero
}
```

The balance is `amount + borrowed − paid`, never below zero, and is always worked out from the entries. Interest is used only by the plan's estimate. It is not added to balances. Export makes `{ app: 'debts', version, exported, state }`. Import takes that file back and replaces what is on the device.

## Outside the app

- Maps: [Leaflet](https://leafletjs.com) 1.9.4 from unpkg, with OpenStreetMap tiles. They load the first time a map is opened and are cached after that. Without them, places are still saved by name and coordinates.
- Font: Baloo Bhaijaan 2 from Google Fonts.
- Location is read only when you tap «Use where I am» or turn on «remind me when I'm near», and it never leaves the device.
