# Deckflix — Specifica di prodotto

## 1. Obiettivo

App Android (PWA) per uso personale che permette di:

- scansionare le proprie carte con la fotocamera e catalogarle per edizione;
- conoscere il valore della collezione (prezzi Cardmarket) e il suo andamento;
- tenere una lista desideri;
- creare deck di gioco cercando in tutto il database delle carte, vedendo quali si possiedono e quali mancano;
- accedere con il proprio account Google per avere backup e ripristino automatici su Google Drive;
- esportare i dati (CSV, liste deck), senza alcun server.

Un solo utente per installazione. Profili multipli sullo stesso telefono sono fuori ambito in questa fase.

## 2. Fonte dati: TCGdex

Base URL: `https://api.tcgdex.net/v2/{lang}` con `lang` = `it`, `en`, `es`, `fr`, `de`, `pt`.

| Uso | Endpoint |
|---|---|
| Dettaglio carta | `/cards/{id}` (es. `/it/cards/sv03.5-025`) |
| Ricerca | `/cards?name={testo}` (verificare sulla documentazione la sintassi dei filtri aggiuntivi; `localId=eq:025` non restituisce risultati: per numero si usa `/sets/{id}`) |
| Edizioni | `/sets`, `/sets/{id}` (contiene l'elenco delle carte) |
| Serie | `/series` |

Campi utilizzati della carta:

- `id`, `localId` (numero nell'edizione), `name`, `set` (`id`, `name`, `cardCount`), `rarity`, `category` (Pokémon / Allenatore / Energia), `types`, `attacks`, `abilities`
- `image`: URL base, a cui si aggiunge `/{low|high}.{webp|png}` → liste con `low.webp`, dettaglio con `high.webp`. **Può mancare**: usare l'immagine della versione inglese come ripiego, altrimenti un segnaposto.
- `variants`: quali stampe esistono (`normal`, `reverse`, `holo`, `firstEdition`…). Ripiego quando manca `variants_detailed`.
- `variants_detailed[]`: **una voce per ogni stampa reale**, con `type` (Normale / Reverse / Olografica / Metallica), `stamp[]` (timbri: `30th-anniversary`, `player-rewards-program`, `set-logo`/"Logo set", `staff`, `snowflake`, `pokemon-together`, `30th-pokeday`…, in parte già tradotti nell'API italiana), `foil` (`cosmos`, `gold`, `rainbow`, `league`…), `variantId` e un proprio `pricing.cardmarket` con un prodotto Cardmarket distinto. Esempio `sv10-049` Gyarados di Misty: Normale 7,22 €, Olografica 0,33 €, Olografica con timbro Logo set 24,01 € (verificato il 15/10/2026).
- `legal.standard`, `legal.expanded`: legalità nei formati di gioco
- `pricing.cardmarket`: prezzi aggiornati una volta al giorno (l'oggetto ha anche `updated`, `unit`, `idProduct`). Per il valore di una copia si usa il prezzo della sua voce in `variants_detailed` (vedi § 4.3); il `pricing` della carta resta il ripiego. Campi: `avg`, `low`, `trend`, `avg1`, `avg7`, `avg30` e gli equivalenti con suffisso `-holo` (es. `trend-holo`, `low-holo`). **Può mancare.**

Limiti noti da comunicare nell'interfaccia:

- I prezzi Cardmarket sono un aggregato di **tutte le lingue** e non distinguono le condizioni. Nel dettaglio carta c'è sempre un link a Cardmarket per vedere il prezzo reale nella lingua della copia.
- Lo storico dei prezzi non è fornito: l'app salva un'istantanea al giorno in locale e costruisce lo storico nel tempo.

Link a Cardmarket: usare la pagina di ricerca `https://www.cardmarket.com/it/Pokemon/Products/Search?searchString={nome}` con, se possibile, il filtro lingua (parametro `language`: 1 = EN, 3 = DE, 4 = ES, 5 = IT; da verificare su un caso reale).

## 3. Modello dati (Dexie / IndexedDB)

Database `deckflix` definito in `src/lib/db.js` con `db.version(n).stores({...})` e funzioni `upgrade` per le migrazioni. Esempio di schema iniziale:

```js
db.version(1).stores({
  collection: 'key, setId, cardId, updatedAt',
  wishlist: 'cardId',
  decks: 'id, updatedAt',
  priceSnapshots: 'date',
  cardCache: '[lang+cardId]',
  syncQueue: '++id',
  settings: 'key',
});
```

| Store | Chiave | Contenuto |
|---|---|---|
| `collection` | `key` = `cardId|lang|variant` | `{ key, cardId, setId, lang, variant, qty, condition?, purchasePrice?, addedAt, updatedAt }` — `variant` è la chiave stabile della stampa (es. `normal`, `holo`, `holo+stamp-set-logo`, `reverse+foil-cosmos`), costruita da `variants_detailed` |
| `wishlist` | `cardId` | `{ cardId, lang?, variant?, priority?, addedAt }` |
| `decks` | `id` | `{ id, name, format: 'standard', cards: [{ cardId, qty }], createdAt, updatedAt }` |
| `priceSnapshots` | `date` | `{ date, totalValue }` — uno al giorno per lo storico del valore |
| `cardCache` | `[lang+cardId]` | risposta TCGdex + `fetchedAt` (scadenza 24 h per i prezzi) |
| `syncQueue` | auto | segnala che ci sono modifiche non ancora salvate su Drive (basta un flag + `changedAt`, non serve una coda per operazione) |
| `settings` | `key` | preferenze, account (`email`, `name`, `picture`), `lastBackupAt`, `lastRemoteBackupAt` |

Regole:

- **Copie uguali** = stessa carta + stessa lingua + stessa variante (finitura, foil e timbri) → si incrementa `qty`. Qualsiasi differenza crea una voce separata: una carta con timbro è una voce diversa dalla stessa carta senza timbro.
- `qty = 0` equivale a rimuovere la voce.
- Le immagini delle carte non si salvano nei dati: si mettono in cache con la Cache API quando vengono visualizzate.

## 4. Regole di dominio

### 4.1 Scansione e riconoscimento

1. Fotocamera con `getUserMedia` (camera posteriore), mirino con il rapporto di una carta (63 × 88).
2. **OCR**: motore principale è l'OCR di Google sul dispositivo tramite la Shape Detection API di Chrome (`TextDetector`, su Android usa il riconoscimento testo di Google Play Services / ML Kit): gratuito, offline, senza chiavi; legge la carta intera in un passaggio (~0,7–2 s). Oggi richiede in Chrome il flag "Experimental Web Platform features": l'app lo spiega quando il motore non è disponibile. Ripiego: Tesseract.js in un Web Worker, con passaggi solo cifre sugli angoli in basso (sinistro per le carte recenti, destro per le vecchie). Esito della Fase 0: con Tesseract il numero non veniva letto dal telefono; con l'OCR di Google 4 carte su 4 riconosciute dalla fotocamera.
3. **Lingua** dedotta da parole chiave: `PS` → it/es/pt, `HP` → en, `KP` → de, `PV` → fr (distinguere con altre parole come "Debolezza", "Weakness", "Schwäche", "Faiblesse", "Debilidad", "Fraqueza"). Le carte Scarlatto e Violetto stampano anche il codice lingua accanto al numero (`SVI EN 081/198`): è il segnale più affidabile.
4. Ricerca su TCGdex per numero + totale dell'edizione (`set.cardCount.official`) + nome come conferma; la sigla stampata sulle carte recenti (`SVI`) corrisponde a `set.abbreviation.official` e distingue edizioni con lo stesso totale. Se ci sono più corrispondenze, l'utente sceglie.
5. **Variante**: finitura, foil speciali e timbri non si distinguono in modo affidabile dalla fotocamera (i timbri sono quasi sempre simboli, es. il Pikachu del 30° anniversario o il logo dell'edizione). Si mostrano le voci di `variants_detailed` con il prezzo di ciascuna; se ce n'è una sola si imposta da sola, se il testo letto contiene una parola del timbro (`STAFF`, `PRERELEASE`) si preseleziona quella, altrimenti si preseleziona `normal` e l'utente cambia con un tocco.
   - Dati mancanti: TCGdex non elenca tutte le stampe con timbro (es. `sv10-010` Shaymin con timbro Play! Pokémon ha solo Normale e Reverse) e spesso le stampe Play! Pokémon non hanno prezzi. C'è sempre la voce manuale "Con timbro non in elenco" (prezzo non disponibile, link a Cardmarket).
   - Riconoscimento automatico dei timbri (sperimentale, non attivo): confronto della foto con la scansione ufficiale TCGdex (senza timbro) per trovare un logo in più. Su foto simulate non distingue in modo affidabile carte con e senza logo (testo piccolo, riflessi e sfocatura danno differenze simili): il prossimo passo è cercare ogni timbro solo nella posizione in cui viene stampato, tarandolo su ritagli reali. Holo/Reverse dalla foto: non affidabile con un solo scatto; da valutare un confronto torcia spenta/accesa.
5 bis. **Ristampe delle collezioni classiche** (`cel25cc` Celebrations Classic Collection, `30th-c` Collezione Classica del 30°): riportano il numero della carta originale (es. Jigglypuff di Erika `69/132`), quindi la ricerca per numero trova l'originale. Dopo la ricerca per numero si cercano anche per nome (`/cards?name=`) le carte omonime in queste edizioni e si propongono come "Ristampa".
6. La foto non viene mai salvata.
7. Modalità **Singola**: dopo il riconoscimento compare un pannello con lingua, variante, quantità ("Ne hai già 1 → aggiorna a 2") e i pulsanti Riprova / Aggiungi.
8. Modalità **Raffica**: scatto automatico quando la carta è a fuoco e ferma, messaggio di conferma, coda delle carte riconosciute; alla fine "Rivedi e salva N carte". Le carte con riconoscimento incerto vanno segnalate come "da verificare".
9. Durante la scansione lo schermo resta acceso (Screen Wake Lock API, con rilascio quando si esce o l'app va in background).
10. A ogni carta riconosciuta: breve vibrazione (`navigator.vibrate(30)`) e conferma visiva; vibrazione diversa (`[30, 60, 30]`) per "da verificare".

### 4.1 bis Inserimento rapido per numero

Alternativa alla fotocamera, accessibile dalla schermata di scansione e dalla pagina di un'edizione:

1. si sceglie l'edizione (ultime usate in cima) e la lingua;
2. si digita solo il numero (`25`, `025` o `25/165` sono equivalenti) su un tastierino numerico;
3. la carta compare con immagine e varianti; Invio aggiunge con la variante predefinita (`normal` se esiste), un tocco cambia variante;
4. il campo si svuota subito per la carta successiva. Elenco delle ultime aggiunte con "Annulla".

### 4.2 Deck e "altra versione"

- La ricerca per i deck mostra per impostazione predefinita solo le carte con `legal.standard === true` (filtro "Solo Standard" disattivabile).
- In un deck ogni carta ha uno di tre stati: **posseduta**, **mancante**, **altra versione** (non possiedi quella stampa ma ne possiedi una equivalente).
- Equivalenza tra carte:

```js
const sameCard = (a, b) =>
  a.name === b.name &&
  JSON.stringify(a.attacks ?? []) === JSON.stringify(b.attacks ?? []) &&
  JSON.stringify(a.abilities ?? []) === JSON.stringify(b.abilities ?? []);
```

  Per le carte Allenatore ed Energia basta il nome.
- Le carte mancanti di un deck si possono aggiungere alla lista desideri con un tocco.

### 4.2 bis Liste deck in formato testo

Import ed export nel formato testuale usato da Pokémon TCG Live e dai siti di tornei (es. Limitless):

```
Pokémon: 16
3 Miraidon ex SVI 81
2 Raikou V BRS 48
...
Trainer: 34
4 Professor's Research SVI 189
...
Energy: 10
10 Basic Lightning Energy SVE 4
```

- Ogni riga: quantità, nome (in inglese), sigla dell'edizione, numero.
- Le sigle sono esposte da TCGdex nell'oggetto edizione come `abbreviation.official` (es. `sv01` → `SVI`, `swsh6` → `CRE`; verificato il 15/10/2026). Per le edizioni in cui manca, mantenere una tabella di corrispondenza in `src/lib/domain/setCodes.js`.
- L'import cerca la carta in inglese, ne ricava l'`id` (uguale in tutte le lingue su TCGdex) e calcola subito i tre stati (posseduta / mancante / altra versione).
- Le righe non riconosciute vengono mostrate all'utente per la correzione manuale, mai scartate in silenzio.
- L'export copia il testo negli appunti o lo condivide con la Web Share API.
- Funzioni di parsing e serializzazione in `src/lib/domain/decklist.js`, con test.

### 4.3 Valore e statistiche

- Prezzo di riferimento configurabile (predefinito `trend`), preso dalla voce di `variants_detailed` della copia: per Reverse e Olografica che condividono il prodotto base si usa il campo `-holo` (es. `trend-holo`) se maggiore di zero; per le stampe con un prodotto proprio (timbri, foil speciali) si usa `trend`. Se la voce non ha prezzi, ripiego sul `pricing` della carta.
- Valore della collezione = somma di `prezzo × qty`.
- Al primo avvio della giornata si salva un'istantanea del valore totale.
- La data di aggiornamento dei prezzi è sempre visibile vicino ai valori ("Prezzi di oggi", "Prezzi del 12/10"); se i dati in cache hanno più di 3 giorni, segnalarlo.

### 4.4 Protezione dei dati sul dispositivo

- All'avvio chiamare `navigator.storage.persist()` per evitare che il browser cancelli IndexedDB quando lo spazio scarseggia; mostrare l'esito nelle Impostazioni.
- Se l'utente usa l'app **senza account** e non ha mai esportato nulla, mostrare in Home un avviso discreto "Accedi con Google per non perdere la collezione". L'avviso si può posticipare.

### 4.5 Stati vuoti e di errore

Ogni schermata deve gestire questi casi con un messaggio chiaro e un'azione:

| Caso | Messaggio e azione |
|---|---|
| Collezione vuota | "Nessuna carta ancora" → Scansiona / Inserimento rapido |
| Nessun deck | "Crea il tuo primo deck" → Nuovo deck / Importa lista |
| Desideri vuoti | Suggerimento: aggiungi dalle carte mancanti dei deck o da Cerca |
| Nessun risultato di ricerca | Suggerisce di togliere i filtri o di cercare in "Tutte le carte" |
| Offline | Banner "Sei offline: mostro i dati salvati"; ricerca solo tra le carte in cache |
| Prezzo non disponibile | "Prezzo non disponibile" al posto del valore; la carta non conta nel totale (indicato nelle Statistiche) |
| Immagine mancante | Segnaposto 63:88 con nome e numero |
| Fotocamera negata | Spiegazione su come riattivarla nelle impostazioni di Android + Inserimento rapido |
| Carta non riconosciuta | "Non riesco a leggere il numero" → Riprova / Inserimento rapido |
| Errore API | Messaggio breve con Riprova; mai schermate vuote senza spiegazione |

## 5. Navigazione e schermate

Router a hash. Barra di navigazione fluttuante, staccata dai bordi:

**Home · Collezione · [Scansiona] · Deck · {Account}**

- Voce attiva: sfondo a pillola `--line-2`, icona ed etichetta bianche. Voci inattive grigie.
- Scansiona: pulsante squircle bianco (`--text`) con icona scura, senza etichetta, dentro la barra. Tocco = modalità Singola; pressione prolungata = Raffica.
- Ultima voce: **foto dell'account Google** (tonda; iniziale come ripiego) con il nome di battesimo come etichetta. Senza account: icona utente generica ed etichetta "Profilo".
- Sull'avatar un **pallino di stato del backup** (vedi `StatiBackup.html`): verde = tutto salvato su Drive; giallo = modifiche in coda; grigio = offline o accesso da rinnovare. Il pallino ha un `aria-label` descrittivo sulla voce.

Icone Hugeicons: `Home04Icon`, `Cards02Icon`, `ScanIcon`, `PokeballIcon`. Altre usate nelle schermate: vedi `docs/hugeicons-used.json`.

| Schermata | Mockup | Contenuto |
|---|---|---|
| Caricamento | `Splash.html` | Loader dell'utente (`assets/loader.svg`) che si colora dal basso verso l'alto in base all'avanzamento reale (due copie sovrapposte: una in scala di grigi, una a colori con `clip-path: inset(...)` animato), logo, percentuale |
| Accesso | `AccessoGoogle.html` | Solo al primo avvio: "Accedi con Google" (pulsante ufficiale di Google Identity Services), link "Continua senza account", nota sulla cartella privata di Drive |
| Ripristino | `Ripristino.html` | Dopo il login, se su Drive esiste un backup: account, data e contenuto del backup, avanzamento del ripristino automatico. Se non esiste: si va direttamente in Home |
| Home | `Home.html` | Logo, saluto; card con valore, andamento e ultima scansione (porta alle Statistiche); deck in evidenza; aggiunte recenti |
| Collezione | `Collezione.html` | Titolo "Le mie carte"; schede **Possedute / Desideri**; ricerca nelle proprie carte; filtri **Per edizione · Tutte · Recenti · Statistiche**; elenco per edizione con avanzamento e valore |
| Statistiche | `Statistiche.html` | Dentro la Collezione (filtro "Statistiche"): valore, periodo (7 g / 30 g / 1 anno / tutto), grafico, numeri chiave, carte più preziose, in crescita, distribuzione per rarità e lingua |
| Desideri | `Desideri.html` | Scheda della Collezione: totale per completarla, ordinamenti, elenco con prezzo e andamento |
| Edizione | `Set.html` | Raccoglitore dell'edizione: tutte le carte in ordine di numero, possedute piene e mancanti tratteggiate; filtri tutte / possedute / mancanti |
| Cerca | `Cerca.html` | Aperta dalla ricerca della Collezione: tutte le carte o solo le mie, filtri edizione/tipo/rarità/lingua, stato di possesso, aggiungi a collezione o desideri |
| Scansione | `Raffica.html` | Fotocamera a schermo intero, scelta Singola/Raffica, coda |
| Deck | `Deck.html` | Elenco deck con completamento; ricerca carte per i deck; "+" nuovo deck |
| Deck creato | `DeckDettaglio.html` | Riepilogo (Pokémon/Allenatori/Energie, valore, completamento) e lista completa con stato di ogni carta |
| Deck List Creator | `DeckBuilder.html` | Griglia del deck con stati posseduta / mancante / altra versione, avviso sulle carte con altra versione, "Ai desideri" per le mancanti, conteggio 60 |
| Aggiungi al deck | `CercaCarte.html` | Ricerca in tutto il database con "Solo Standard" attivo, stato di possesso, "+" per aggiungere |
| Profilo | `Profilo.html` | Foto, nome ed email dell'account; stato del backup ("Salvato su Google Drive · 2 minuti fa") con "Salva ora"; Dati: Esporta CSV, Liste deck, Ripristina da Drive; App: lingua delle carte, prezzo di riferimento, cache immagini; "Esci dall'account". Senza account: invito ad accedere al posto del blocco account |
| Inserimento rapido | — (da disegnare) | Scelta edizione e lingua, tastierino numerico, anteprima carta, ultime aggiunte con Annulla (vedi § 4.1 bis) |
| Importa lista deck | — (da disegnare) | Area di testo, anteprima delle righe riconosciute e non riconosciute, nome del deck, Crea deck (vedi § 4.2 bis) |
| Esporta CSV | `Csv.html` | Sorgente (collezione, desideri, un deck), colonne selezionabili, anteprima, Condividi (Web Share API) o Salva |

## 6. Design system

Tema unico scuro. Riferimento visivo: `docs/mockups/`. Token in `src/styles/tokens.css`:

```css
:root {
  --bg: #0F1115;
  --surface: #191C23;
  --surface-2: #232733;
  --line: #262A35;
  --line-2: #2E3340;
  --text: #EEF0F4;
  --muted: #9AA1AE;
  --accent: #FFCB45;
  --on-accent: #14161B;
  --success: #5BD08A;
  --danger: #FF7A6B;

  --r-chip: 19px;
  --r-control: 22px;
  --r-card: 31px;
  --r-section: 36px;

  --font-display: 'Bricolage Grotesque', system-ui, sans-serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
}

@supports (corner-shape: squircle) {
  .card, .btn, .chip, .nav, .avatar { corner-shape: squircle; }
}
```

- Giallo solo per azioni principali, filtro attivo, badge "altra versione" e quantità. Nessun altro colore d'accento.
- Numeri e prezzi con `font-variant-numeric: tabular-nums`.
- Segnaposto carta (quando l'immagine manca o si sta caricando): rettangolo 63:88 `--surface-2`.

## 7. Account Google e backup automatico

Unico sistema di backup in questa fase. Nessun server: tutto avviene nel browser.

**Configurazione (una volta, gratuita)**
- Progetto Google Cloud con Drive API abilitata, schermata di consenso OAuth e un client OAuth di tipo *Web* con l'URL di GitHub Pages (e `http://localhost:5173` per lo sviluppo) tra le origini autorizzate.
- Scope: `https://www.googleapis.com/auth/drive.appdata` (cartella nascosta riservata all'app, scope non sensibile) più `openid email profile` per nome, email e foto.
- Il Client ID non è segreto: va in una variabile d'ambiente Vite (`VITE_GOOGLE_CLIENT_ID`) e nel workflow di deploy.

**Accesso**
- Google Identity Services (GIS): pulsante ufficiale "Accedi con Google" per l'identità e *token client* (`initTokenClient`) per ottenere l'access token di Drive.
- L'access token dura circa un'ora e non c'è refresh token lato client: rinnovarlo in silenzio (`prompt: ''`) quando serve; se il rinnovo fallisce, il pallino diventa grigio e al prossimo backup si chiede un tocco su "Continua".
- Il token resta solo in memoria, mai in IndexedDB.

**Ripristino al primo accesso**
1. Dopo il login si cerca nella `appDataFolder` il file `deckflix-backup.json`.
2. Se esiste: si mostra la schermata Ripristino e si importa tutto in automatico (in una transazione Dexie), poi si va in Home.
3. Se non esiste: si va in Home e si crea il primo backup.
4. Se l'utente aveva già dati locali (ha usato l'app senza account e poi accede) e su Drive esiste un backup: chiedere quale tenere, mostrando date e numero di carte di entrambi. Mai sovrascrivere senza chiedere.

**Salvataggio automatico**
- Ogni modifica (collezione, desideri, deck, impostazioni) segna "da sincronizzare" e porta il pallino a giallo.
- Il backup parte 10 secondi dopo l'ultima modifica (debounce) e quando l'app va in background (`visibilitychange` → `hidden`).
- Un solo file, sovrascritto a ogni backup (`files.update` con upload multipart). Opzionale: tenere anche una copia del giorno precedente (`deckflix-backup-prev.json`) come rete di sicurezza.
- Offline: nessun tentativo; si riprova all'evento `online`.
- Prima di sovrascrivere, confrontare `modifiedTime` del file su Drive con `lastRemoteBackupAt`: se su Drive c'è una versione più recente (salvata da un altro telefono), chiedere all'utente quale tenere.
- Il backup avviene **solo con l'app aperta**: va detto chiaramente nel Profilo ("automatico mentre usi l'app").

**Formato del file**
`{ app: 'deckflix', schemaVersion, exportedAt, device, collection, wishlist, decks, priceSnapshots, settings }` (senza `cardCache` né token). All'import, migrare se `schemaVersion` è più vecchio.

**Uscita dall'account**
Revoca del token (`google.accounts.oauth2.revoke`), i dati restano sul telefono; offrire anche "Esci e cancella i dati da questo telefono".

**Esportazioni (non sono backup)**
- **CSV**: collezione, desideri o un deck, colonne selezionabili, Condividi (Web Share API) o Salva.
- **Liste deck** in formato testo (§ 4.2 bis).

## 8. Piano di sviluppo

Ogni fase si chiude con i criteri di accettazione verificati.

**Fase 0 — Prova della scansione**
Prototipo isolato (una pagina, nessuna persistenza, `lab/scan/`): fotocamera, ritaglio delle zone, OCR (Google `TextDetector`, ripiego Tesseract.js), riconoscimento di numero, lingua, sigla e nome, ricerca su TCGdex, scelta della variante.
✅ Su 30 carte reali di edizioni, lingue e finiture diverse (comprese holo e reverse), almeno l'85% riconosciute correttamente in condizioni di luce normali. Annotare tempi, errori tipici e regolazioni utili (contrasto, soglia, area di ritaglio). Se la soglia non è raggiunta, fermarsi e discutere alternative prima della Fase 1.

**Fase 1 — Fondamenta**
Progetto Vite + Svelte 5, Vitest, workflow GitHub Actions per il deploy, fixture di risposte TCGdex reali in `tests/fixtures/` (una carta per lingua, una con prezzi, una senza immagine, un'edizione completa) usate dai test e da una modalità di sviluppo offline, token CSS, componente `Icon`, barra di navigazione, router a hash, schema Dexie, client TCGdex con cache.
✅ `npm run build` produce un sito statico che si apre su GitHub Pages; la navigazione funziona; una carta di prova si carica da TCGdex e, ricaricando senza rete, viene letta dalla cache Dexie.

**Fase 2 — Account Google e backup automatico**
Schermata Accesso, login GIS, token per Drive, ripristino automatico, salvataggio automatico con debounce e in background, gestione dei conflitti, pallino di stato nella barra, schermata Profilo (parte account), modalità senza account.
✅ Su un browser pulito: accedo, aggiungo una carta di prova, chiudo l'app; su un secondo browser accedo con lo stesso account e ritrovo la carta senza fare altro. Il pallino passa da giallo a verde dopo il salvataggio e diventa grigio senza rete.

**Fase 3 — Collezione (inserimento manuale)**
Cerca, dettaglio carta (prezzi, link Cardmarket, quantità), Collezione per edizione, Edizione, Desideri, Inserimento rapido per numero, stati vuoti e di errore, `navigator.storage.persist()`.
✅ Aggiungo una carta dalla ricerca, la ritrovo nella sua edizione con la quantità corretta, posso modificarla e spostarla nei desideri.

**Fase 4 — PWA**
vite-plugin-pwa: manifest, precache dell'app shell, cache `CacheFirst` per le immagini TCGdex e `StaleWhileRevalidate` per le risposte API, icone (192, 512, maskable), prompt di aggiornamento "Nuova versione disponibile · Aggiorna" (registrazione con `registerType: 'prompt'`).
✅ L'app si installa su Android e si apre offline mostrando la collezione.

**Fase 5 — Scansione**
Fotocamera, OCR in un worker (riusando quanto imparato nella Fase 0), riconoscimento, modalità Singola e Raffica, wake lock e vibrazione.
✅ Una carta italiana ben illuminata viene riconosciuta e aggiunta alla collezione; la seconda scansione della stessa carta incrementa la quantità.

**Fase 6 — Deck**
Elenco deck, Deck List Creator, aggiunta dalla ricerca con "Solo Standard", stati posseduta/mancante/altra versione, mancanti ai desideri, import ed export delle liste in formato testo.
✅ Una lista da 60 carte incollata da un sito di tornei crea il deck e mostra correttamente i tre stati; l'export produce un testo reimportabile identico.

**Fase 7 — Valore e statistiche**
Calcolo del valore, istantanee giornaliere, schermata Statistiche, card in Home.

**Fase 8 — Esportazioni e rifiniture**
Esporta CSV, invito ad accedere per chi usa l'app senza account, copia di sicurezza del giorno precedente su Drive, revisione di accessibilità e stati vuoti su tutte le schermate.
✅ Il CSV si apre correttamente in un foglio di calcolo con accenti e separatori giusti.

## 9. Fuori ambito

Prezzi per lingua e per condizione, riconoscimento con IA a pagamento, notifiche push e backup a app chiusa (servirebbe un server), profili multipli sullo stesso telefono, backup su servizi diversi da Google Drive, pubblicazione sugli store, app nativa con Capacitor (piano B se la scansione web non basta).
