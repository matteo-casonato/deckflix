# Deckflix — istruzioni per Claude Code

App personale (PWA Android) per scansionare, catalogare e valutare carte del GCC Pokémon e costruire deck. Uso esclusivamente personale, nessuna pubblicazione sugli store, costo zero.

La specifica completa è in `docs/SPEC.md`. I mockup di riferimento sono in `docs/mockups/` (HTML statico: leggi il markup per colori, spaziature e struttura; non si aprono correttamente nel browser perché manca il runtime del canvas).

## Vincoli non negoziabili

- **Nessun backend, nessun database remoto, nessun costo.** Tutti i dati vivono sul dispositivo (IndexedDB). L'unico servizio esterno per i dati dell'utente è il backup automatico su **Google Drive** (cartella privata `appDataFolder`) dopo l'accesso con Google; l'app deve funzionare anche senza account.
- **Un solo utente per installazione**: niente profili multipli, niente PIN.
- Il risultato della build è un sito **statico** pubblicato su GitHub Pages.
- **Nessuna immagine o asset Pokémon nel repository.** Immagini e dati delle carte arrivano a runtime dall'API TCGdex. L'unica eccezione è l'SVG del caricamento, che fornirà l'utente (`public/loader.svg`; finché manca, usa un cerchio segnaposto).
- Testi dell'interfaccia in **italiano**; codice, nomi di variabili e commenti in **inglese**.
- Non aggiungere dipendenze oltre a quelle elencate sotto senza chiedermelo.

## Stack

| Ambito | Scelta |
|---|---|
| UI | **Svelte 5** (runes: `$state`, `$derived`, `$effect`, `$props`), senza SvelteKit |
| Componenti interattivi | **Bits UI** (headless, senza stile) per dialog, bottom sheet, tabs, menu, select, switch, toggle group. Lo stile è sempre nostro, con i token CSS |
| Build e sviluppo | **Vite** |
| PWA | **vite-plugin-pwa** (Workbox): manifest, Service Worker, cache |
| Database locale | **Dexie.js** (IndexedDB) con `liveQuery` per l'aggiornamento automatico dell'interfaccia |
| Dati carte | TCGdex API v2 — `https://api.tcgdex.net/v2/{lang}/...` |
| Prezzi | Campo `pricing.cardmarket` delle carte TCGdex |
| OCR | **OCR di Google sul dispositivo** via `TextDetector` di Chrome (Shape Detection API); ripiego **Tesseract.js** in un Web Worker (vedi SPEC § 4.1) |
| Icone | `@hugeicons/core-free-icons` (stile stroke rounded, licenza MIT), renderizzate da un componente `Icon.svelte` |
| Linguaggio | JavaScript con **JSDoc** e `// @ts-check` (niente TypeScript) |
| Font | Bricolage Grotesque (titoli, numeri), DM Sans (testo) — self-hosted in `public/fonts/` |
| Account e backup | Google Identity Services (login + token client) e Drive API v3 via `fetch`, senza SDK aggiuntivi |
| Deploy | GitHub Actions → GitHub Pages (`VITE_GOOGLE_CLIENT_ID` come variabile del workflow) |

Fissa le versioni esatte in `package.json` (niente `^` o `~`) e scegli versioni stabili pubblicate da almeno due settimane.

## Struttura del progetto

```
index.html
vite.config.js            base: '/<nome-repo>/', plugin svelte + pwa
package.json
public/                   icone PWA, fonts, loader.svg
src/
  main.js
  App.svelte              splash, primo avvio, router, nav
  styles/                 tokens.css, base.css
  lib/
    router.svelte.js      hash router (#/home, #/collection, #/set/:id, ...)
    db.js                 schema Dexie + migrazioni
    stores/               account.svelte.js (utente, stato del backup), settings.svelte.js
    api/                  tcgdex.js (fetch + cache), prices.js
    domain/               sameCard, collectionKey, value, ecc. (funzioni pure, testate)
    scan/                 camera.js, ocr.worker.js, matcher.js
    sync/                 google-auth.js (GIS), drive.js (appDataFolder), sync.js (debounce, conflitti, stato)
    ui/                   Nav, Icon, CardTile, Chip, Segmented, Sheet, Toast, Avatar
  screens/                un componente per schermata (Home.svelte, Collection.svelte, ...)
tests/                    test Vitest delle funzioni in lib/domain
.github/workflows/deploy.yml
docs/                     SPEC.md, mockups/
```

## Convenzioni

- Componenti piccoli; la logica di dominio sta in `src/lib/domain/` come funzioni pure, non dentro i componenti.
- Le liste lette dal database usano `liveQuery` di Dexie, così l'interfaccia si aggiorna da sola quando cambiano quantità, deck o desideri.
- Stato globale minimo: account, stato del backup e preferenze nei moduli `*.svelte.js` con `$state`.
- L'access token di Google resta solo in memoria, mai salvato. Il Client ID non è segreto e arriva da `import.meta.env.VITE_GOOGLE_CLIENT_ID`.
- Stili: solo variabili CSS di `src/styles/tokens.css`, CSS con scope nei componenti. Gli angoli usano `border-radius` + `corner-shape: squircle` dentro `@supports (corner-shape: squircle)`.
- Accessibilità: target toccabili ≥ 48 px (vedi linee guida UI), `aria-label` sui pulsanti solo icona, rispetto di `prefers-reduced-motion`.
- Ogni chiamata a TCGdex passa da `src/lib/api/tcgdex.js`, che mette in cache le risposte in Dexie; le immagini si mettono in cache con una strategia Workbox `CacheFirst`.
- Gestisci sempre lo stato offline e i campi mancanti dell'API (immagine, prezzi, varianti possono mancare).
- Test con **Vitest** per le funzioni di dominio (chiave delle copie, equivalenza tra carte, calcolo del valore, riconoscimento della lingua).

## Linee guida UI (Material Design 3 come riferimento)

Non usiamo librerie Material: l'aspetto è definito dai mockup e dai token. Di Material 3 rispettiamo le regole di usabilità:

- **Target toccabili** di almeno 48 × 48 dp, anche quando l'elemento visibile è più piccolo (estendi l'area con padding).
- **Barra di navigazione**: massimo 5 destinazioni, sempre visibile nelle sezioni principali, nascosta nelle schermate a tutto schermo (scansione) e nei flussi di primo avvio.
- **Gerarchia dei pulsanti**: una sola azione principale per schermata (pulsante pieno con l'accento), le altre secondarie o tonali.
- **Bottom sheet** per azioni contestuali (conferma scansione, scelta variante, filtri), **dialog** solo per conferme distruttive (rimuovi carta, elimina deck o profilo).
- **Feedback**: snackbar/toast per conferme brevi con eventuale "Annulla", indicatori di caricamento per operazioni oltre 300 ms, skeleton per le liste.
- **Movimento**: transizioni brevi (150–300 ms), coerenti con la direzione di navigazione; tutto disattivato con `prefers-reduced-motion`.
- **Contrasto** almeno 4.5:1 per il testo normale e 3:1 per testo grande e icone.
- **Tasto indietro di Android**: chiude prima sheet e dialog, poi torna alla schermata precedente; dalla Home non esce senza conferma.
- **Insets di sistema**: rispetta `env(safe-area-inset-*)` sotto la barra di stato e sopra la barra dei gesti.

## Comandi

- `npm run dev` — sviluppo (per provare la fotocamera dal telefono serve HTTPS: usa `vite --host` con un certificato locale oppure prova sulla versione pubblicata).
- `npm run build` — build statica in `dist/`.
- `npm test` — test Vitest.

## Come lavorare

1. Procedi per le fasi descritte in `docs/SPEC.md` § "Piano di sviluppo", una alla volta, partendo dalla Fase 0 (prova della scansione). Alla fine di ogni fase verifica i criteri di accettazione e fermati per un mio controllo.
2. Prima di implementare una schermata, apri il mockup corrispondente in `docs/mockups/` e rispettane struttura, gerarchia e token.
3. Se un dettaglio dell'API TCGdex non corrisponde a quanto scritto nella specifica (nomi dei campi, filtri), verifica sulla documentazione ufficiale (https://tcgdex.dev) e aggiorna `docs/SPEC.md`.
