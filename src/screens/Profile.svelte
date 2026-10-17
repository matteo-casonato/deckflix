<script>
  // @ts-check
  // Profile (docs/mockups/Profilo.html): account and backup, data (CSV, deck lists,
  // restore) and app preferences.
  import {
    Analytics01Icon,
    ArrowRight01Icon,
    CloudDownloadIcon,
    Csv01Icon,
    FileImportIcon,
    GridViewIcon,
    Idea01Icon,
    Image01Icon,
    LanguageSkillIcon,
    LegalDocument01Icon,
    LicenseIcon,
    LinkSquare02Icon,
    Location01Icon,
    LockIcon,
    QrCodeIcon,
    ScanIcon,
    Settings02Icon,
    UserAccountIcon,
  } from '@hugeicons/core-free-icons';
  import { hasGoogleOcr } from '../lib/scan/ocr.js';
  import Icon from '../lib/ui/Icon.svelte';
  import Avatar from '../lib/ui/Avatar.svelte';
  import ConfirmDialog from '../lib/ui/ConfirmDialog.svelte';
  import Sheet from '../lib/ui/Sheet.svelte';
  import QrCode from '../lib/ui/QrCode.svelte';
  import { account } from '../lib/stores/account.svelte.js';
  import { settings } from '../lib/stores/settings.svelte.js';
  import { LANG_LABELS } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { ABOUT, USEFUL_LINKS } from '../lib/domain/links.js';
  import { CREDITS } from '../lib/domain/credits.js';
  import { backupState, relativeTime } from '../lib/domain/backup.js';
  import { backupFromTap, isConfigured, restoreFromDrive, signOut } from '../lib/sync/sync.js';

  const status = $derived(
    backupState({
      signedIn: !!account.user,
      online: account.online,
      needsAuth: account.needsAuth,
      pending: account.pending || account.saving,
      conflict: !!account.choice,
    }),
  );

  // Refresh "2 minuti fa" every 30 s.
  let now = $state(Date.now());
  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(t);
  });

  const title = $derived(
    account.saving
      ? 'Salvataggio su Google Drive…'
      : status === 'saved'
        ? 'Salvato su Google Drive'
        : status === 'pending'
          ? 'Modifiche da salvare'
          : !account.online
            ? 'Offline: salvo quando torna la rete'
            : account.needsAuth
              ? 'Accesso a Drive da rinnovare'
              : 'Backup in pausa',
  );
  const subtitle = $derived(
    account.lastBackupAt ? `${relativeTime(account.lastBackupAt, now)} · automatico mentre usi l’app` : 'Automatico mentre usi l’app',
  );

  /** @type {{ images: number, usageMb: number | null } | null} */

  /** @type {'restore' | 'restorePrev' | 'restoreReplaced' | 'signout' | 'wipe' | 'images' | null} */
  let confirm = $state(null);

  /** Interactive when Google needs a tap to renew access. */
  const saveNow = () => backupFromTap();


  /** Settings pages: [key, icon, title, summary]. */
  const SETTINGS = $derived(
    /** @type {[string, any, string, string][]} */ ([
      ['lingua', LanguageSkillIcon, 'Lingua delle carte', LANG_LABELS[settings.cardLang] ?? settings.cardLang],
      ['qualita', Analytics01Icon, 'Qualità e prezzi', settings.priceField === 'low' ? 'Prezzo più basso di Cardmarket, stima per condizione' : 'Tendenza di Cardmarket, stima per condizione'],
      ['edizioni', GridViewIcon, 'Edizioni', settings.missingImages ? 'Carte mancanti in grigio' : 'Carte mancanti solo col numero'],
      ['immagini', Image01Icon, 'Immagini e spazio', 'Cache delle immagini, dati protetti'],
      ['scansione', ScanIcon, 'Scansione', hasGoogleOcr ? 'Riconoscimento di Google attivo' : 'Come renderla più veloce in Chrome'],
    ]),
  );

  let restoreSheet = $state(false);

  /** Address of the app (the published site; the dev server in development). */
  const APP_URL = `${location.origin}${import.meta.env.BASE_URL}`;
  // Set by Vite at build time (vite.config.js): commit count and last commit's date.
  // @ts-ignore -- build-time constants
  const VERSION = __APP_VERSION__;
  // @ts-ignore -- build-time constants
  const BUILT = new Date(__BUILD_TIME__).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  let shareSheet = $state(false);
  let licenseSheet = $state(false);
  let accountSheet = $state(false);
  const canShare = typeof navigator.share === 'function';
  function shareLink() {
    navigator.share({ title: 'Deckflix', text: 'Le tue carte Pokémon: collezione, valore, deck e tornei.', url: APP_URL }).catch(() => {});
  }
</script>

<header class="top"><h1>Profilo</h1></header>

{#if account.user}
  <section class="card account">
    <div class="who">
      <Avatar user={account.user} size={64} />
      <span class="id">
        <strong>{account.user.name}</strong>
        <span>{account.user.email}</span>
      </span>
    </div>
    <div class="backup" aria-live="polite">
      <span class="dot {status}" aria-hidden="true"></span>
      <span class="text">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </span>
      <button class="btn small" onclick={saveNow} disabled={account.saving || !account.online}>
        {account.needsAuth ? 'Continua' : 'Salva ora'}
      </button>
    </div>
    {#if account.error}<p class="err" role="alert">{account.error}</p>{/if}
  </section>
{:else}
  <section class="card invite">
    <h2>Accedi con Google</h2>
    <p>Il backup automatico su Google Drive tiene al sicuro la collezione e la ritrova su un altro telefono.</p>
    {#if isConfigured()}
      <button class="btn primary" onclick={() => (account.firstRunDone = false)}>Accedi</button>
    {:else}
      <p class="muted">Accesso con Google non ancora configurato.</p>
    {/if}
  </section>
{/if}

<h2 class="section">Dati</h2>
<section class="card list">
  <a class="row" href={hrefFor('csv')}>
    <span class="ico"><Icon icon={Csv01Icon} /></span>
    <span class="text"><strong>Esporta CSV</strong><span>Collezione, desideri o un deck</span></span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </a>
  <a class="row" href={hrefFor('deck', {}, { tab: 'decks' })}>
    <span class="ico"><Icon icon={FileImportIcon} /></span>
    <span class="text"><strong>Liste deck</strong><span>Importa una lista o condividi quella di un deck</span></span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </a>
  <button class="row" disabled={!account.user} onclick={() => (restoreSheet = true)}>
    <span class="ico"><Icon icon={CloudDownloadIcon} /></span>
    <span class="text"><strong>Ripristina da Drive</strong><span>Ultimo backup o quello del giorno prima</span></span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </button>
  {#if account.user}
    <button class="row" onclick={() => (accountSheet = true)}>
      <span class="ico"><Icon icon={UserAccountIcon} /></span>
      <span class="text"><strong>Account</strong><span>Esci o cancella i dati da questo telefono</span></span>
      <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
    </button>
  {/if}
</section>

<Sheet open={accountSheet} title="Account" onclose={() => (accountSheet = false)}>
  <div class="acct">
    {#if account.user}<p class="muted">Collegato come <strong>{account.user.email}</strong></p>{/if}
    <button class="btn danger-outline" onclick={() => ((accountSheet = false), (confirm = 'signout'))}>Esci dall’account</button>
    <p class="muted">La collezione resta su questo telefono; il backup automatico su Drive si ferma finché non accedi di nuovo.</p>
    <button class="btn danger" onclick={() => ((accountSheet = false), (confirm = 'wipe'))}>Esci e cancella i dati</button>
    <p class="muted">Collezione, deck e impostazioni spariscono da questo telefono; il backup su Drive resta e si può ripristinare accedendo di nuovo.</p>
  </div>
</Sheet>

<h2 class="section">Play!</h2>
<section class="card list">
  <a class="row" href={hrefFor('deck', {}, { tab: 'players' })}>
    <span class="ico"><Icon icon={QrCodeIcon} /></span>
    <span class="text">
      <strong>ID giocatori</strong>
      <span>{settings.players.length ? `${settings.players.map((p) => p.name.split(' ')[0]).join(', ')} · in Play! › Giocatori` : 'In Play! › Giocatori'}</span>
    </span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </a>
  <a class="row" href={hrefFor('settings', { key: 'tornei' })}>
    <span class="ico"><Icon icon={Location01Icon} /></span>
    <span class="text">
      <strong>Tornei vicino a te</strong>
      <span>{settings.homePlace ? `${settings.homePlace.name} · ${settings.eventRadius} km` : 'Imposta la tua città'}</span>
    </span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </a>
</section>

<h2 class="section">Impostazioni</h2>
<section class="card list">
  {#each SETTINGS as [key, icon, title, sub] (key)}
    <a class="row" href={hrefFor('settings', { key })}>
      <span class="ico"><Icon {icon} /></span>
      <span class="text"><strong>{title}</strong><span>{sub}</span></span>
      <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
    </a>
  {/each}
</section>

<h2 class="section">Altro</h2>
<section class="card list">
  <a class="row" href={hrefFor('links')}>
    <span class="ico"><Icon icon={LinkSquare02Icon} /></span>
    <span class="text"><strong>Link utili</strong><span>{USEFUL_LINKS.map((l) => l.name).join(', ')}</span></span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </a>
  <a class="row" href={hrefFor('settings', { key: 'roadmap' })}>
    <span class="ico"><Icon icon={Idea01Icon} /></span>
    <span class="text"><strong>Roadmap</strong><span>Le idee in arrivo e quelle da valutare</span></span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </a>
  <button class="row" onclick={() => (account.setup = true)}>
    <span class="ico"><Icon icon={Settings02Icon} /></span>
    <span class="text"><strong>Configurazione iniziale</strong><span>Lingua, città, giocatore e prima carta</span></span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </button>
  <button class="row" onclick={() => (shareSheet = true)}>
    <span class="ico"><Icon icon={QrCodeIcon} /></span>
    <span class="text"><strong>Condividi Deckflix</strong><span>Il codice QR per installarla su un altro telefono</span></span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </button>
  <a class="row" href={hrefFor('settings', { key: 'privacy' })}>
    <span class="ico"><Icon icon={LockIcon} /></span>
    <span class="text"><strong>Privacy</strong><span>Quali dati usa l’app e come cancellarli</span></span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </a>
  <a class="row" href={hrefFor('settings', { key: 'termini' })}>
    <span class="ico"><Icon icon={LegalDocument01Icon} /></span>
    <span class="text"><strong>Termini di servizio</strong><span>Uso dell’app, prezzi indicativi, garanzie</span></span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </a>
  <button class="row" onclick={() => (licenseSheet = true)}>
    <span class="ico"><Icon icon={LicenseIcon} /></span>
    <span class="text"><strong>Licenza e crediti</strong><span>© 2026 Matteo e Alessio Casonato · fonti</span></span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </button>
</section>

<Sheet open={licenseSheet} title="Licenza e crediti" onclose={() => (licenseSheet = false)}>
  <div class="license">
    <p>
      <strong>© 2026 Matteo Casonato e Alessio Casonato. Tutti i diritti riservati.</strong> L’app si usa liberamente e gratis, e puoi condividerne
      il link. Il codice, la grafica e i testi di Deckflix non si possono copiare, modificare, ripubblicare né usare a fini
      commerciali senza il permesso degli autori.
    </p>
    <p class="muted">
      Pokémon, i nomi delle carte e le relative immagini sono di The Pokémon Company, Nintendo, Creatures e Game Freak.
      Deckflix è un progetto non ufficiale, non affiliato né approvato da loro.
    </p>
    <h3>Crediti</h3>
    <ul class="credits">
      {#each CREDITS as c (c.name)}
        <li>
          <a href={c.url} target="_blank" rel="noopener noreferrer"><strong>{c.name}</strong></a>
          <span>{c.what}</span>
          <span class="muted">{c.terms}</span>
        </li>
      {/each}
    </ul>
    <a class="btn" href="https://github.com/matteo-casonato/deckflix/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">Testo completo della licenza</a>
    <div class="legal-links">
      <a href={hrefFor('settings', { key: 'privacy' })} onclick={() => (licenseSheet = false)}>Informativa sulla privacy</a>
      <a href={hrefFor('settings', { key: 'termini' })} onclick={() => (licenseSheet = false)}>Termini di servizio</a>
    </div>
  </div>
</Sheet>

<Sheet open={shareSheet} title="Condividi Deckflix" onclose={() => (shareSheet = false)}>
  <div class="share">
    <div class="qr-box"><QrCode text={APP_URL} label={`Codice QR del sito di Deckflix, ${APP_URL}`} size={220} /></div>
    <p class="url num">{APP_URL.replace(/^https:\/\//, '')}</p>
    <p class="hint">
      Inquadrala con la fotocamera del telefono e apri il link in Chrome: dal menu ⋮ scegli <strong>Installa app</strong>
      (su iPhone, in Safari: Condividi › Aggiungi alla schermata Home). È gratuita e si aggiorna da sola.
    </p>
    {#if canShare}<button class="btn primary" onclick={shareLink}>Invia il link</button>{/if}
  </div>
</Sheet>

<h2 class="section">Il progetto</h2>
<section class="card about">
  <p>
    <strong>👋 Ciao, sono Matteo.</strong> Deckflix è la web app che ho creato per tenere in ordine le carte Pokémon di mio
    figlio Alessio e trovare più facilmente i tornei vicini, tutto nella stessa app.
  </p>
  <p>
    È gratuita e lo resterà finché lo saranno i servizi su cui si appoggia (TCGdex, Google Drive, GitHub). Niente
    pubblicità, nessun dato venduto: le tue carte restano sul telefono e nel tuo Google Drive.
  </p>
  {#if ABOUT.contactEmail || ABOUT.donateUrl}
    <p>
      Non pretende di essere perfetta: è nata dalla passione per il gioco e cresce con i suggerimenti, a partire da quelli
      di Alessio. Se trovi un errore o hai un’idea, scrivimi. E se ti è utile e vuoi supportare il progetto, puoi sempre
      offrirmi un caffè.
    </p>
    <div class="about-actions">
      {#if ABOUT.donateUrl}
        <a class="btn primary" href={ABOUT.donateUrl} target="_blank" rel="noopener noreferrer">☕ Supporta il progetto</a>
      {/if}
      {#if ABOUT.contactEmail}
        <a class="btn" href={`mailto:${ABOUT.contactEmail}?subject=${encodeURIComponent('Deckflix: suggerimento')}`}>Scrivimi un suggerimento</a>
      {/if}
    </div>
  {/if}
  <p class="legal">
    Deckflix è un progetto personale, non affiliato a The Pokémon Company, Nintendo, Creatures o Game Freak.
    Pokémon e i nomi delle carte sono marchi dei rispettivi titolari; immagini e dati arrivano da TCGdex.
  </p>
</section>

<p class="version num">Versione {VERSION} · {BUILT}</p>

<ConfirmDialog
  open={confirm === 'restore'}
  title="Ripristinare da Drive?"
  text="I dati di questo telefono verranno sostituiti con l’ultimo backup salvato su Google Drive."
  confirmLabel="Ripristina"
  danger
  onconfirm={() => restoreFromDrive()}
  onclose={() => (confirm = null)}
/>
<Sheet open={restoreSheet} title="Ripristina da Drive" onclose={() => (restoreSheet = false)}>
  <p class="sheet-note">I dati di questo telefono vengono sostituiti con la copia che scegli. Prima ti chiedo conferma.</p>
  <div class="choices">
    <button class="choice" onclick={() => ((restoreSheet = false), (confirm = 'restore'))}>
      <strong>Ultimo backup</strong>
      <span>La copia salvata più di recente, anche da un altro telefono.{account.lastBackupAt ? ` Da questo telefono: ${relativeTime(account.lastBackupAt, Date.now())}.` : ''}</span>
    </button>
    <button class="choice" onclick={() => ((restoreSheet = false), (confirm = 'restorePrev'))}>
      <strong>Backup del giorno prima</strong>
      <span>La copia che Drive conserva dal giorno precedente: serve ad annullare una giornata sbagliata, come un ripristino o una cancellazione per errore.</span>
    </button>
    <button class="choice" onclick={() => ((restoreSheet = false), (confirm = 'restoreReplaced'))}>
      <strong>Versione scartata</strong>
      <span>Quella che non hai scelto l’ultima volta che l’app ti ha chiesto quale collezione tenere.</span>
    </button>
  </div>
</Sheet>

<ConfirmDialog
  open={confirm === 'restoreReplaced'}
  title="Ripristinare la versione scartata?"
  text="I dati di questo telefono verranno sostituiti con la versione che non avevi scelto. Le modifiche fatte dopo andranno perse."
  confirmLabel="Ripristina"
  danger
  onconfirm={() => restoreFromDrive({ replaced: true })}
  onclose={() => (confirm = null)}
/>

<ConfirmDialog
  open={confirm === 'restorePrev'}
  title="Ripristinare il giorno prima?"
  text="I dati di questo telefono verranno sostituiti con la copia che Drive conserva dal giorno precedente (salvata al primo backup di ogni giorno). Le modifiche fatte dopo andranno perse."
  confirmLabel="Ripristina"
  danger
  onconfirm={() => restoreFromDrive({ previous: true })}
  onclose={() => (confirm = null)}
/>
<ConfirmDialog
  open={confirm === 'signout'}
  title="Uscire dall’account?"
  text="Il backup automatico si ferma. La collezione resta su questo telefono."
  confirmLabel="Esci"
  onconfirm={() => signOut({ wipe: false })}
  onclose={() => (confirm = null)}
/>
<ConfirmDialog
  open={confirm === 'wipe'}
  title="Uscire e cancellare i dati?"
  text="Collezione, desideri, deck e impostazioni verranno cancellati da questo telefono. Il backup su Google Drive non viene toccato."
  confirmLabel="Esci e cancella"
  danger
  onconfirm={() => signOut({ wipe: true })}
  onclose={() => (confirm = null)}
/>

<style>
  .sheet-note {
    margin: 0;
    padding: 0 4px;
    font-size: 13px;
    color: var(--muted);
  }

  .choices {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .choice {
    width: 100%;
    padding: 14px 16px;
    border: 1px solid var(--line-2);
    border-radius: var(--r-card);
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 4px;
    cursor: pointer;
  }

  .choice span {
    font-size: 13px;
    color: var(--muted);
  }

  .top {
    padding: 10px 16px 4px;
  }

  h1 {
    font-size: 28px;
  }

  .card {
    margin: 12px 16px 0;
    border-radius: var(--r-section);
    background: var(--surface);
  }

  .account,
  .invite {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .who {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .id {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .id strong {
    font-family: var(--font-display);
    font-size: 22px;
  }

  .id span,
  .text span {
    font-size: 13px;
    color: var(--muted);
    overflow-wrap: anywhere;
  }

  .backup {
    padding: 14px;
    border-radius: 29px;
    background: var(--bg);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--idle);
  }

  .dot.saved {
    background: var(--success);
  }

  .dot.pending {
    background: var(--accent);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-width: 0;
    text-align: left;
  }

  .text strong {
    font-size: 15px;
  }

  .btn.small {
    min-height: 44px;
    padding: 0 14px;
    font-size: 13px;
  }

  .invite h2 {
    font-size: 20px;
  }

  .invite p {
    margin: 0;
    color: var(--muted);
  }

  .err {
    margin: 0;
    color: var(--danger);
    font-size: 14px;
  }

  .section {
    margin: 22px 20px 8px;
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .list {
    margin-top: 0;
    padding: 4px;
  }

  .row {
    width: 100%;
    min-height: 64px;
    padding: 10px 14px 10px 10px;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 0;
    background: transparent;
    border-radius: 28px;
    cursor: pointer;
    color: inherit;
    text-decoration: none;
  }


  .row.static {
    cursor: default;
  }


  .row.disabled,
  .row:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .ico {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: var(--surface-2);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .fav {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 18px;
    color: var(--accent);
  }

  .chev {
    color: var(--muted);
    display: flex;
  }



  .about {
    margin: 0 16px;
    padding: 18px 18px 16px;
    border-radius: var(--r-section);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--muted);
  }

  .about p {
    margin: 0;
  }

  .about strong {
    color: var(--text);
  }

  /* One button per line, full width: the labels don't wrap. */
  .about-actions {
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .about-actions .btn {
    width: 100%;
  }

  .version {
    margin: 20px 0 8px;
    text-align: center;
    font-size: 12px;
    color: var(--muted);
  }

  .about .legal {
    margin-top: 4px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-size: 11px;
    line-height: 1.45;
  }


  .share {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }

  .qr-box {
    padding: 14px;
    border-radius: 24px;
    background: #fff;
  }

  .url {
    margin: 0;
    font-weight: 700;
  }

  .hint {
    margin: 0;
    max-width: 340px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--muted);
  }

  .share .btn {
    width: 100%;
  }

  .license {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 14px;
    line-height: 1.45;
  }

  .license p {
    margin: 0;
  }

  .license .muted {
    color: var(--muted);
    font-size: 13px;
  }

  .license h3 {
    margin: 6px 0 0;
    font-size: 16px;
  }

  .credits {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .credits li {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .credits a,
  .legal-links a {
    color: var(--accent);
  }

  .legal-links {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 14px;
  }

  .legal-links a {
    min-height: 44px;
    display: flex;
    align-items: center;
  }

  .acct {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .acct p {
    margin: 0 4px 6px;
    font-size: 13px;
    line-height: 1.45;
  }

  .acct strong {
    color: var(--text);
  }

  .btn.danger-outline {
    color: var(--danger);
  }

  .btn.danger {
    background: color-mix(in srgb, var(--danger) 16%, var(--surface));
    color: var(--danger);
  }
</style>
