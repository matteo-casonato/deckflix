# Deckflix

App personale (PWA Android) per catalogare carte Pokémon e costruire deck. Specifica: [docs/SPEC.md](docs/SPEC.md).

## Sviluppo

```bash
npm install
npm run dev          # http://localhost:5173/deckflix/
npm run dev:offline  # come dev, ma i dati TCGdex arrivano da tests/fixtures (niente rete)
npm run dev:mock     # http://localhost:5174/deckflix/ con Google e Drive simulati (accesso, backup, conflitti)
npm test
npm run build
npm run fixtures     # riscarica le risposte TCGdex usate da test e modalità offline
```

Per l'accesso Google vero in sviluppo: copia `.env.example` in `.env.local` e inserisci il Client ID.

Struttura: `src/` app Svelte 5 (schermate in `src/screens`, logica pura in `src/lib/domain`, client TCGdex in `src/lib/api`), `lab/scan/` prototipo di scansione della Fase 0, `docs/` specifica e mockup.

### Provare la fotocamera dal telefono (HTTPS locale)

La fotocamera funziona solo su HTTPS (o `localhost`). Per provarla dal telefono sulla stessa rete Wi-Fi:

```bash
mkcert -install                     # una volta: crea la CA locale (chiede la password del Mac)
mkdir -p .certs && mkcert -cert-file .certs/cert.pem -key-file .certs/key.pem localhost 127.0.0.1 $(ipconfig getifaddr en0)
npm run dev:https                   # apri https://<ip-del-mac>:5173/deckflix/ dal telefono
```

Sul telefono Chrome mostrerà un avviso sul certificato (la CA di mkcert non è installata su Android): "Avanzate → Procedi". In alternativa usa la versione pubblicata.

## Installare l'app sul telefono

Apri https://matteo-casonato.github.io/deckflix/ in Chrome per Android → menu ⋮ → **Installa app** (o "Aggiungi a schermata Home"). Dopo la prima apertura funziona anche senza rete.

## Fase 0 — prova della scansione

Pagina: `lab/scan/` (`/deckflix/lab/scan/`). Per ogni carta: inquadra, "Scatta e riconosci", scegli la carta giusta se non è la prima, segna **Corretta** o **Sbagliata** (con una nota su finitura e luce). In alto c'è l'accuratezza; "Copia registro (JSON)" esporta i risultati.

## Licenza

© 2026 Matteo Casonato. Tutti i diritti riservati: l'app pubblicata si può usare liberamente, il codice non si può copiare né riutilizzare senza permesso. Bandiere Flagpack (MIT) e immagini Pokémon restano dei rispettivi titolari. Dettagli in [LICENSE](LICENSE).
