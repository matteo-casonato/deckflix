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
  apiCache: 'path, fetchedAt',
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
| `apiCache` | `path` | altre risposte TCGdex (edizioni, serie, ricerche) per percorso API + `fetchedAt` (scadenza 7 giorni, 24 h per le ricerche) |
| `syncQueue` | auto, indice `changedAt` (v2) | segnala che ci sono modifiche non ancora salvate su Drive (basta un flag + `changedAt`, non serve una coda per operazione); dopo un backup si cancellano solo le voci precedenti al suo inizio |
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
   - **Timbro Play! Pokémon**: è un riquadro con Poké Ball e sagoma, stampato sul bordo inferiore dell'illustrazione (a sinistra sui Pokémon, a destra sugli Allenatori). Si cerca con una correlazione (luminosità + "rossezza") solo in quelle due zone. Un modello disegnato da codice (forme geometriche, non il logo) basta a localizzarlo ma non a decidere; la decisione usa un modello ritagliato da una carta con timbro dell'utente ("Usa come modello del timbro"), salvato solo sul dispositivo: nessun asset nel repository. Misure del 15/10/2026: modello appreso 0,62–0,78 sulle carte con timbro non usate per crearlo, al massimo 0,58 su 40 carte senza timbro (scansioni e foto simulate); soglia 0,60. Margine stretto: da verificare su più carte. Se il timbro è rilevato, le stampe con `player-rewards-program` vengono preselezionate ed evidenziate; se TCGdex non le elenca si propone "Normale · timbro Play! Pokémon (non in elenco)".
   - Confronto generico foto/scansione ufficiale per trovare timbri qualsiasi: scartato (non distingue carte con e senza logo). Holo/Reverse dalla foto: non affidabile con un solo scatto; da valutare un confronto torcia spenta/accesa.
   - Mirino: area con le proporzioni della carta, cornice al 90% e zoom della fotocamera (se supportato) per tenere la carta a 15–20 cm, dove la messa a fuoco funziona.
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
- Le sigle sono esposte da TCGdex nell'oggetto edizione come `abbreviation.official` (es. `sv01` → `SVI`, `swsh6` → `CRE`) e si cercano lato server con `/en/sets?abbreviation.official=eq:SVI`; le Energie base sono nell'edizione `sve` (`SVE 4` → `sve-004`). Verificato il 15/10/2026 su una lista di 60 carte con edizioni dal 2022 (BRS, ASR, PGO, CRZ) al 2024: tutte le righe trovate, quindi niente tabella `setCodes.js` per ora.
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
- Offline: nessun tentativo; si riprova all'evento `online`. Se il browser si crede online ma Drive non risponde (Wi-Fi senza internet; su Android la modalità aereo può lasciare il Wi-Fi acceso), il pallino diventa grigio e si riprova da soli dopo 30 s, 1, 2 e poi ogni 5 minuti.
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

**Esito (15/10/2026)** — chiusa su decisione dell'utente, con meno carte di quelle previste:
- Tesseract dal telefono: numero quasi mai letto, 10–25 s per tentativo. Scartato come motore principale.
- OCR Google (`TextDetector`) dalla fotocamera: 15 scansioni su 15 con numero leggibile hanno trovato la carta giusta (quasi tutte al primo colpo), 0,6–2 s; circa 10 carte diverse, tutte italiane recenti (SV, Megaevoluzione). Foto caricate: 6 su 8.
- Errori tipici: Energia base senza numero (non trovata: serve la scelta manuale), stampe con timbro mancanti su TCGdex (Shaymin `sv10-010`), sigla incollata al codice lingua (`DRIT`, `JTGT`, `MEGIT`), CORS di `assets.tcgdex.net` a volte con intestazione doppia (`*, *`): le immagini si mostrano con `<img>` ma non si possono leggere da canvas, quindi niente confronti con la scansione ufficiale.
- Regolazioni utili: video 4K senza foto, cornice al 90% di un'area con le proporzioni della carta, zoom ×1,2, scatto toccando l'area dello scanner.
- **Decisione aperta prima della Fase 5**: `TextDetector` richiede su ogni telefono il flag di Chrome "Experimental Web Platform features" (una volta). Va bene per l'uso personale; se l'app deve servire ad altre persone senza questo passaggio, le alternative sono l'app nativa (Capacitor + ML Kit, oggi fuori ambito) o Google Cloud Vision (a pagamento oltre la quota gratuita). Senza OCR resta sempre l'inserimento rapido per numero.
- **Da riprendere** (prima o durante la Fase 5, con più carte): 30 carte di lingue ed epoche diverse per la soglia dell'85%; verifica del timbro Play! con modello appreso sul telefono e carte senza timbro; riconoscimento holo/reverse (idea: torcia spenta/accesa); carte d'epoca e Energie base.

**Fase 1 — Fondamenta**
Progetto Vite + Svelte 5, Vitest, workflow GitHub Actions per il deploy, fixture di risposte TCGdex reali in `tests/fixtures/` (una carta per lingua, una con prezzi, una senza immagine, un'edizione completa) usate dai test e da una modalità di sviluppo offline, token CSS, componente `Icon`, barra di navigazione, router a hash, schema Dexie, client TCGdex con cache.
✅ `npm run build` produce un sito statico che si apre su GitHub Pages; la navigazione funziona; una carta di prova si carica da TCGdex e, ricaricando senza rete, viene letta dalla cache Dexie.

**Esito (15/10/2026)**: app Svelte 5 in `src/` (router a hash, barra di navigazione, token e font locali, schema Dexie, client TCGdex con cache e regola "fresco / scaduto / offline" in `src/lib/domain/cache.js`), fixture reali in `tests/fixtures/tcgdex/` (`npm run fixtures` per aggiornarle) e modalità `npm run dev:offline` che le usa al posto della rete. Verificato: carta letta dalla rete, poi dalla cache dopo il ricaricamento; con TCGdex irraggiungibile la copia salvata viene mostrata con l'avviso offline. Il ricaricamento della pagina intera senza rete richiede il Service Worker (Fase 4).

**Fase 2 — Account Google e backup automatico**
Schermata Accesso, login GIS, token per Drive, ripristino automatico, salvataggio automatico con debounce e in background, gestione dei conflitti, pallino di stato nella barra, schermata Profilo (parte account), modalità senza account.
✅ Su un browser pulito: accedo, aggiungo una carta di prova, chiudo l'app; su un secondo browser accedo con lo stesso account e ritrovo la carta senza fare altro. Il pallino passa da giallo a verde dopo il salvataggio e diventa grigio senza rete.

**Esito (15/10/2026)**: superata con l'account vero (accesso, backup, ripristino sul secondo browser; l'avviso "Google non ha verificato questa app" è normale in modalità Test). Implementazione: implementata in `src/lib/sync/` (GIS, Drive `appDataFolder`, sincronizzazione) e `src/lib/domain/backup.js` (formato, scelte, stati; testati). Schermate Accesso, Ripristino, Scelta e Profilo; pallino sullo stato del backup nella barra. Verificato con Google e Drive simulati (`npm run dev:mock`): primo accesso con backup creato; carta di prova aggiunta → pallino giallo → verde dopo 10 s; "secondo browser" che ritrova la carta; conflitto con un salvataggio più recente di un altro telefono; accesso da rinnovare con "Continua"; uscita con e senza cancellazione dei dati. Da verificare con l'account vero: dopo il pulsante di Google il browser può bloccare la finestra del permesso per Drive, in quel caso serve un tocco su "Continua" (previsto). Il pulsante "Aggiungi alla collezione" nella schermata Carta è provvisorio, fino alla Fase 3.

**Fase 3 — Collezione (inserimento manuale)**
Cerca, dettaglio carta (prezzi, link Cardmarket, quantità), Collezione per edizione, Edizione, Desideri, Inserimento rapido per numero, stati vuoti e di errore, `navigator.storage.persist()`.
✅ Aggiungo una carta dalla ricerca, la ritrovo nella sua edizione con la quantità corretta, posso modificarla e spostarla nei desideri.

**Esito (15/10/2026)**: Collezione (per edizione, tutte, recenti), Edizione (raccoglitore con mancanti tratteggiate), Cerca (tutte o solo le mie, filtri edizione/tipo/rarità/lingua, offline tra le carte salvate), Desideri (totale, prezzo, recenti, in calo con media 7 giorni su 30), dettaglio carta (copie per lingua e variante, prezzi per stampa, data dei prezzi, Cardmarket, desideri, "Sposta nei desideri"), Inserimento rapido, lingua delle carte e protezione dei dati (`navigator.storage.persist()`) nel Profilo. Verificato nel browser: carta aggiunta dalla ricerca, ritrovata nell'edizione, quantità portata a 2, spostata nei desideri con conferma e "Annulla". Note sull'API: filtri lato server `name` (contiene), `set.id=eq:`, `types`, `rarity=eq:`, `pagination:page`/`pagination:itemsPerPage`; per il numero serve `eq:` perché `localId=025` trova anche "125"; i risultati non hanno il nome dell'edizione (si ricava dall'id della carta e da `/sets`). Gli id lingua di Cardmarket (`language`: 1 EN, 2 FR, 3 DE, 4 ES, 5 IT, 8 PT) restano da confermare su una ricerca vera.

**Fase 4 — PWA**
vite-plugin-pwa: manifest, precache dell'app shell, cache `CacheFirst` per le immagini TCGdex e `NetworkFirst` (timeout 5 s) per le risposte API (non `StaleWhileRevalidate`: Dexie ha già la sua cache con scadenza, e servire prima una risposta vecchia farebbe salvare come freschi prezzi di giorni prima), icone (192, 512, maskable), prompt di aggiornamento "Nuova versione disponibile · Aggiorna" (registrazione con `registerType: 'prompt'`).
✅ L'app si installa su Android e si apre offline mostrando la collezione.

**Esito (15/10/2026)**: vite-plugin-pwa 1.3.0 (la 2.0.0 era uscita da meno di due settimane); icone 192, 512 e maskable disegnate da codice (carte stilizzate, nessun asset Pokémon) in `public/icons/`; il prototipo `lab/` resta fuori dal precache; avviso "Nuova versione disponibile · Aggiorna · Più tardi" con controllo ogni ora; cache immagini nel Profilo (numero e svuota). Verificato con la build di produzione: Service Worker attivo, immagini in cache, app aperta a server spento con collezione, immagini e font; avviso di aggiornamento con il nuovo Service Worker in attesa. Da verificare sul telefono: installazione da Chrome ("Installa app") e apertura in modalità aereo.

**Fase 5 — Scansione**
Fotocamera (area dello scanner a forma di carta, tocco per scattare, zoom), OCR (riusando quanto imparato nella Fase 0: `lab/scan/`), riconoscimento, modalità Singola e Raffica, wake lock e vibrazione.
✅ Una carta italiana ben illuminata viene riconosciuta e aggiunta alla collezione; la seconda scansione della stessa carta incrementa la quantità.

**Esito (15/10/2026)**: scansione nell'app (`src/lib/scan/`: camera, ocr, matcher, pipeline, stamp; logica pura in `src/lib/domain/recognize.js` e `stamp.js`). Singola: tocco sull'inquadratura, pannello con carta, eventuali alternative (comprese le ristampe), lingua, variante con prezzo (timbro Play! suggerito se c'è il modello appreso; "usala come modello" dal pannello), "Ne hai già N → diventano N+1", Riprova / Aggiungi; il tasto indietro chiude prima il pannello. Raffica: scatto automatico quando la carta è ferma (differenza tra fotogrammi piccoli) e c'è contrasto (niente scatti sul tavolo vuoto), serve un movimento prima della carta successiva, niente doppioni ravvicinati, conferma e vibrazione (doppia per "da verificare"), coda, pausa, revisione con correzione di carta/lingua/variante e salvataggio con "Annulla". Pressione lunga sul pulsante della barra = Raffica. Schermo acceso (Wake Lock) e rilascio in background. Fotocamera negata: spiegazione + Inserimento rapido. Senza `TextDetector`: avviso del flag e ripiego su Tesseract. Verificato nel browser con una fotocamera simulata (immagini TCGdex): Pikachu 151 aggiunto e alla seconda scansione portato a 2; raffica con due carte, nessun doppione, revisione e salvataggio. Da verificare sul telefono con l'OCR di Google e luce reale; soglie di movimento (10/3,5) e contrasto (14) da tarare.

**Fase 6 — Deck**
Elenco deck, Deck List Creator, aggiunta dalla ricerca con "Solo Standard", stati posseduta/mancante/altra versione, mancanti ai desideri, import ed export delle liste in formato testo.
✅ Una lista da 60 carte incollata da un sito di tornei crea il deck e mostra correttamente i tre stati; l'export produce un testo reimportabile identico.

**Esito (15/10/2026)**: elenco deck (completamento, mancanti e costo), dettaglio (sezioni, valore, stati per carta, condividi lista con Web Share o appunti, mancanti ai desideri, elimina), Deck List Creator (griglia con posseduta/altra versione/mancante, avviso sulle altre versioni, massimo 4 copie tranne le Energie base, conteggio su 60), "Aggiungi al deck" dalla ricerca con "Solo Standard" (`legal.standard=true`), import con righe non trovate mostrate per la correzione. "Altra versione": per ogni carta del deck si cercano le stampe con lo stesso nome inglese (`/en/cards?name=eq:`), si incrociano con la collezione e si confrontano attacchi e abilità (solo il nome per Allenatori ed Energie). Verificato nel browser con una lista Miraidon ex da 60 carte: 26 righe su 26 trovate, stati corretti (Miraidon posseduta, Raikou V e Nest Ball altra versione, Iono "manca 2"), export → import → export identico. L'export scrive le Energie base come Pokémon TCG Live ("Basic {L} Energy").

**Fase 7 — Valore e statistiche**
Calcolo del valore, istantanee giornaliere, schermata Statistiche, card in Home.

**Esito (15/10/2026)**: valore = prezzo Cardmarket della variante × copie (reverse e holo usano il prezzo `-holo`); le copie senza prezzo non entrano nel totale e sono indicate. Istantanea del giorno all'avvio e all'apertura delle Statistiche, solo quando ci sono i dati di tutte le carte (così un avvio offline non registra un valore troppo basso); nella stessa giornata viene aggiornata. Statistiche: valore, variazione nel periodo (7 g, 30 g, 1 anno, Tutto; il punto di partenza è l'ultima istantanea prima del periodo), grafico con tocco per leggere il valore e tabella per i lettori di schermo, numeri chiave, le più preziose, in crescita (media 7 giorni su 30), per rarità e per lingua, data dei prezzi. Home: valore, variazione a 30 giorni e ultima aggiunta. Logica in `src/lib/domain/value.js` (testata). Verificato nel browser con istantanee simulate di 40 giorni (poi rimosse): variazioni a 7 e 30 giorni corrette, grafico e card in Home. Il grafico si riempie giorno dopo giorno: TCGdex non ha uno storico dei prezzi.

**Fase 8 — Esportazioni e rifiniture**
Esporta CSV, invito ad accedere per chi usa l'app senza account, copia di sicurezza del giorno precedente su Drive, revisione di accessibilità e stati vuoti su tutte le schermate.
✅ Il CSV si apre correttamente in un foglio di calcolo con accenti e separatori giusti.

**Esito (15/10/2026)**: Esporta CSV dal Profilo (collezione, desideri o un deck; colonne nome, edizione, numero, lingua, variante, quantità, prezzo trend; anteprima delle prime righe; Condividi con Web Share dove c'è, Salva file sempre). Formato per i fogli di calcolo in italiano: punto e virgola come separatore, virgola per i decimali, BOM UTF-8 per gli accenti, righe CRLF, celle con `;` o virgolette tra virgolette (`src/lib/domain/csv.js`, testato). La colonna "Prezzo d'acquisto" del mockup non c'è: l'app non chiede il prezzo d'acquisto, quindi sarebbe sempre vuota. Verificato: il file generato dalla collezione, con una riga di prova con accenti e `;` nel nome, si rilegge con 7 colonne su ogni riga e accenti corretti; da provare in Excel/Fogli sul telefono. Invito "Accedi con Google per non perdere la collezione" in Home senza account e senza esportazioni, con "Più tardi" (7 giorni). Copia `deckflix-backup-prev.json` su Drive al primo backup di ogni giorno (in caso di errore il backup principale prosegue). Tasto indietro di Android dalla prima Home: "Premi ancora Indietro per uscire", un secondo tocco entro 2,5 s esce. Voce "Liste deck" del Profilo attiva (porta ai deck), "Prezzo di riferimento" mostra il trend Cardmarket. Revisione: pulsanti solo icona con etichetta, stati vuoti presenti, movimento ridotto globale.

**Fase 9 — Proposte dell'utente (15/10/2026), dopo la Fase 8**
- Collezione come punto d'ingresso con tre riquadri grandi: **Edizioni** (l'attuale vista per edizione, con Tutte · Recenti · Statistiche), **Raccolte**, **Desideri**; ricerca in alto, che parte da "Tutte le carte" con le possedute evidenziate.
- Nell'edizione, le carte mancanti mostrano l'immagine in grigio e semitrasparente invece del solo numero (interruttore nel Profilo per risparmiare dati).
- **Raccolte** personali (non "set", che nel gioco significa edizione): manuali stile Pinterest, con "Aggiungi a raccolta" dalla scheda della carta e creazione al volo, copertina = carta più preziosa, salvate nel backup (nuovo store Dexie `albums`, schema v3); automatiche che si aggiornano da sole: le 10 più preziose, in crescita, full art e illustrazioni (rarità TCGdex), doppioni, holo e reverse, per Pokémon (`dexId`, vale in tutte le lingue), per illustratore.

**Esito (15/10/2026)**: Collezione con hub (ricerca su tutte le carte, riquadri Edizioni, Raccolte, Desideri con le copertine a ventaglio); ogni sezione si apre con il tasto indietro verso l'hub, i vecchi link `?view=` portano ancora a Edizioni. Nell'edizione le mancanti mostrano l'immagine in grigio al 30% con il numero sopra; interruttore "Carte mancanti in grigio" nel Profilo (salvato nel backup). Raccolte manuali: store Dexie `albums` (schema v3), segnalibro nella scheda carta con bottom sheet (spunta le raccolte, crea al volo con la carta dentro), anche carte non possedute (badge "Manca"), copertina = carta più preziosa con immagine, Modifica per togliere carte, rinominare o eliminare (con "Annulla"). Backup alla versione 2 del formato: contiene le raccolte; un'app vecchia rifiuta il backup nuovo invece di perdere le raccolte al salvataggio successivo, i backup v1 si leggono con raccolte vuote. Raccolte automatiche: le 10 più preziose, in crescita, full art e illustrazioni (rarità TCGdex in italiano e inglese, elenco in `src/lib/domain/albums.js`), doppioni, holo e reverse, per Pokémon (`dexId`, titolo = nome più corto del gruppo) e per illustratore, solo gruppi di almeno due carte. Ricerca: parte da "Tutte le carte" e le possedute hanno bordo e sfondo verdi. Corretto anche un difetto delle liste: la query delle carte in cache non si aggiornava quando cambiavano gli id (`liveCards` in `src/lib/data/catalog.js`). Verificato nel browser: hub con copertine, raccolta creata da Charizard ex, aggiunto Mewtwo non posseduto, modifica, raccolte automatiche, edizione 151 con 205 mancanti in grigio e con l'interruttore spento, ricerca "charizard" con la posseduta evidenziata.

**Aggiunte del 15/10/2026 (richieste dell'utente)**
- **Incolla da Limitless**: su Limitless “Copy to Clipboard” copia la lista nel formato di Pokémon TCG Live, che l'import già leggeva (verificato con il mazzo Dragapult ex di limitlesstcg.com/decks/list/29678: 24 righe su 24, 60 carte, sigle recenti ASC/POR/MEG/MEE comprese). Tasto “Incolla lista” nell'elenco deck (legge gli appunti nel tocco, apre l'import e controlla subito), “Incolla” nell'import che controlla da solo, e riquadro “Incolla lista” nel Deck List Creator quando il deck è vuoto. Nome suggerito: il Pokémon con regola (ex, V, VSTAR, VMAX, GX) con più copie, perché la lista copiata non contiene il nome del mazzo.
- **Statistiche del deck** come il builder di Limitless (my.limitlesstcg.com/builder), nel dettaglio del deck: composizione (Pokémon Base / evoluzioni; Allenatori: Strumenti, Aiuti, Stadi, Oggetti; Energie base / speciali, dai campi inglesi `stage`, `trainerType`, `energyType`) e mano iniziale di 7 carte con distribuzione ipergeometrica: mulligan, esattamente 1 o 2+ Pokémon Base (dopo il mulligan), e per ogni Pokémon Base la probabilità di poter iniziare e di dover iniziare (unico Base in mano). Numeri verificati identici a quelli di Limitless sul mazzo Dragapult ex (22,24% · 51,22% · 48,78%; Dreepy 51,38% / 22,72%).
- **Utility** nel Profilo: link ai siti utili scelti dall'utente (Pokémon.com, Limitless TCG, Pokémon Proxies), elenco in `src/lib/domain/links.js` per aggiungerne altri; si aprono in una nuova scheda, senza favicon da servizi esterni.

- **Ricerca intelligente** (`src/lib/domain/searchQuery.js`, `src/lib/data/search.js`): nel campo si possono scrivere nome, numero e sigla insieme. “Charizard 11/78” (numero e carte dell'edizione: trova Pokémon GO 011/78), “Charizard mew” o “Charizard sv03.5” (sigla stampata o id TCGdex dell'edizione), “svi 25”, “Raikou V GG41”, oppure il solo numero: “tg05”, “TG5”, “025” in tutte le edizioni. Il nome si cerca nella lingua delle carte e in inglese (“Iono” trova Kissara); le carte col nome esatto vengono prima. Una sigla da sola resta un nome (“mew” cerca Mew, non l'edizione 151). Sotto il conteggio l'app mostra cosa ha capito (edizione, numero, trovate col nome inglese). Note sull'API: `localId=eq:` funziona solo per i numeri con lettere scritti come stampati (“TG05”); per le cifre serve il filtro “contiene” (`localId=25` trova anche 125) e il risultato si filtra in locale. Stesse regole in “Solo le mie” e offline.

- **Carte vecchie e TCG Pocket**: TCGdex spesso non ha i dati italiani delle carte vecchie (es. EX Deoxys): la ricerca le mostra in inglese e la scheda carta ripiega sull'inglese. “16/107” trova Deoxys 16/107. Le edizioni di TCG Pocket (id con la maiuscola: A1, A2b, P-A) sono escluse perché digitali. Nella scheda carta “Cerca su Google” con nome e numero (“Deoxys 16/107 pokemon”), utile per le carte vecchie.
- **Cardmarket diretto**: TCGdex dà `pricing.cardmarket.idProduct` per carta e per stampa; il link `cardmarket.com/it/Pokemon/Products?idProduct={id}&language={lingua}` apre la pagina della carta (verificato dall'utente con Pikachu 151, 733620). Se possiedi una sola stampa in quella lingua si usa il suo prodotto (le stampe con timbro ne hanno uno proprio); senza id resta la ricerca per nome. Ids lingua confermati: 5 = italiano.
- **Lista del deck**: miniatura, nome, sotto il codice stampato “BRS 048/172 F” (sigla, numero/carte dell'edizione, regolamento), a destra “4” o “Manca 2/4”; mancanti e parziali in grigio. Vista Lista/Griglia come Limitless (carte con quantità e “Manca n”).
- **Play!** nel Profilo: più giocatori (nome e cognome, ID giocatore, anno di nascita), divisione Junior/Senior/Master dall'anno di nascita (stagione che cambia il 1° luglio: è un'ipotesi da confermare), codice QR per la lega. Il QR dell'app Pokémon contiene in base64 il JSON `{"pi":ID,"fn":nome,"li":iniziale cognome,"by":anno,"e":scadenza a 10 giorni}`, senza firma: l'app lo rigenera identico (verificato carattere per carattere) con un encoder QR scritto in `src/lib/domain/qr.js` (nessuna dipendenza), controllato decodificando i codici generati con CoreImage di macOS. Non è un codice ufficiale: se il negozio non lo accetta serve l'app Pokémon.
- **Foglio torneo** (dettaglio deck › Foglio torneo): impaginato come la lista RK9 per i judge (giocatore, ID, anno di nascita, divisione, formato, tabelle Pokémon con set/numero/regolamento, Allenatori ed Energie per nome, totale, firma), A4 in stampa; “Stampa o salva PDF” usa la stampa del browser, “Condividi” manda la lista come testo (WhatsApp, email).

- **Scelta dell'edizione con ricerca** (`src/lib/ui/SetPicker.svelte`) nella ricerca e nell'inserimento rapido: pannello con campo di ricerca per nome o id, sigla stampata (“SVI”, risolta su TCGdex), ultime usate in cima.
- **Numeri con lettere**: inserimento rapido accetta “TG25/TG30”, “SWSH302”, “GG41”; se il numero non è nell'edizione scelta lo cerca nella galleria collegata (su TCGdex le TG di swsh9 stanno in swsh9tg, le GG in swsh12.5gg) e poi in tutte le edizioni (`localId=eq:`), con scelta quando ce ne sono più di una (quattro TG25). La scansione (OCR di Google) riconosce “TG25/TG30”, “GG41/GG70”, “RC5/RC32”, “SV107/SV122” e le promo “SWSH302”, “SM164”, “XY39”, “BW95” (`parseSpecialNumber`) e sceglie tra le carte con quel numero per somiglianza del nome; il ripiego Tesseract legge ancora solo le cifre.
- **Miniature**: le immagini sono in cache come risposte opache, quindi un'immagine mancante una volta poteva restare rotta (Poké Vitale A); la miniatura ora riprova scavalcando la cache, poi l'immagine inglese, poi quella grande.

- **Home rinnovata**: valore con mini grafico a 30 giorni e variazione; scorciatoie (Scansiona, Raffica, Per numero, Cerca); deck in evidenza come nel mockup (ultimo deck modificato, tre Pokémon a ventaglio con prima quelli con regola, percentuale posseduta, mancanti con costo e tasto ai desideri, oppure Foglio torneo se è completo; senza deck invito a crearne uno); carta del giorno (una tua carta con immagine, la stessa per tutto il giorno, preferendo quelle che valgono almeno 1 €); strisce orizzontali “In salita” / “In discesa” (media 7 giorni su 30, esclusi i prezzi sotto 0,50 €) e “Desideri in calo”; aggiunte recenti in striscia; edizione in corso (più carte possedute tra quelle non complete) con barra. Logica in `src/lib/domain/home.js` (testata).

- **Sezione Play!** al posto di “Deck” nella barra: in alto i giocatori (foto, nome, ID, anno, divisione, tasto QR, aggiunta), sotto i deck. La foto si sceglie dalla galleria o si scatta, ritagliata quadrata a 192 px JPEG sul telefono (pochi KB, salvata con i giocatori e nel backup); senza foto le iniziali. Con la foto il QR usa la correzione d'errore H e la mostra al centro (24% della larghezza; verificato con CoreImage che il codice si legge fino al 30% coperto). Niente logo Play! Pokémon: è un marchio Pokémon e il repository non contiene asset Pokémon. Il QR ha gli stessi dati di quello ufficiale, ma non è garantito che il software della lega lo accetti: da provare una volta tenendo pronta l'app ufficiale.

## 9. Fuori ambito

Prezzi per lingua e per condizione, riconoscimento con IA a pagamento, notifiche push e backup a app chiusa (servirebbe un server), profili multipli sullo stesso telefono, backup su servizi diversi da Google Drive, pubblicazione sugli store, app nativa con Capacitor (piano B se la scansione web non basta).
