<script>
  // @ts-check
  // Profile (docs/mockups/Profilo.html): account and backup, data (CSV, deck lists,
  // restore) and app preferences.
  import {
    ArrowRight01Icon,
    CloudDownloadIcon,
    Csv01Icon,
    FileImportIcon,
    Image01Icon,
    LanguageSkillIcon,
    Analytics01Icon,
    GridViewIcon,
    LinkSquare02Icon,
    QrCodeIcon,
    Location01Icon,
  } from '@hugeicons/core-free-icons';
  import Icon from '../lib/ui/Icon.svelte';
  import Avatar from '../lib/ui/Avatar.svelte';
  import ConfirmDialog from '../lib/ui/ConfirmDialog.svelte';
  import Sheet from '../lib/ui/Sheet.svelte';
  import { account } from '../lib/stores/account.svelte.js';
  import { settings } from '../lib/stores/settings.svelte.js';
  import { LANG_LABELS } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { ABOUT, USEFUL_LINKS } from '../lib/domain/links.js';
  import { backupState, relativeTime } from '../lib/domain/backup.js';
  import { backupNow, isConfigured, restoreFromDrive, signOut } from '../lib/sync/sync.js';

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

  /** @type {'restore' | 'signout' | 'wipe' | 'images' | null} */
  let confirm = $state(null);

  /** Interactive when Google needs a tap to renew access. */
  const saveNow = () => backupNow({ interactive: account.needsAuth });


  /** Settings pages: [key, icon, title, summary]. */
  const SETTINGS = $derived(
    /** @type {[string, any, string, string][]} */ ([
      ['lingua', LanguageSkillIcon, 'Lingua delle carte', LANG_LABELS[settings.cardLang] ?? settings.cardLang],
      ['qualita', Analytics01Icon, 'Qualità e prezzi', 'Come si stima il valore in base alla condizione'],
      ['edizioni', GridViewIcon, 'Edizioni', settings.missingImages ? 'Carte mancanti in grigio' : 'Carte mancanti solo col numero'],
      ['immagini', Image01Icon, 'Immagini e spazio', 'Cache delle immagini, dati protetti'],
    ]),
  );

  let restoreSheet = $state(false);
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
  <a class="row" href={hrefFor('deck')}>
    <span class="ico"><Icon icon={FileImportIcon} /></span>
    <span class="text"><strong>Liste deck</strong><span>Importa una lista o condividi quella di un deck</span></span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </a>
  <button class="row" disabled={!account.user} onclick={() => (restoreSheet = true)}>
    <span class="ico"><Icon icon={CloudDownloadIcon} /></span>
    <span class="text"><strong>Ripristina da Drive</strong><span>Ultimo backup o quello del giorno prima</span></span>
    <span class="chev"><Icon icon={ArrowRight01Icon} size={20} /></span>
  </button>
</section>

<h2 class="section">Play!</h2>
<section class="card list">
  <a class="row" href={hrefFor('deck')}>
    <span class="ico"><Icon icon={QrCodeIcon} /></span>
    <span class="text">
      <strong>ID giocatori</strong>
      <span>{settings.players.length ? `${settings.players.map((p) => p.name.split(' ')[0]).join(', ')} · ora nella sezione Play!` : 'Nella sezione Play! della barra in basso'}</span>
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
</section>

{#if account.user}
  <button class="signout" onclick={() => (confirm = 'signout')}>Esci dall’account</button>
  <button class="signout subtle" onclick={() => (confirm = 'wipe')}>Esci e cancella i dati da questo telefono</button>
  <p class="foot">I dati restano su questo telefono finché non li cancelli.</p>
{/if}

<h2 class="section">Il progetto</h2>
<section class="card about">
  <p>
    <strong>Deckflix è gratuita e lo resterà</strong>, finché resteranno gratuiti i servizi su cui si appoggia: TCGdex
    per carte e prezzi, Google Drive per il backup, GitHub per la pubblicazione.
  </p>
  <p>
    È nata per passione del gioco e del collezionismo. Niente pubblicità e nessun dato venduto: le tue carte restano
    sul telefono e nel tuo Google Drive.
  </p>
  {#if ABOUT.contactEmail || ABOUT.donateUrl}
    <p>Hai un’idea o hai trovato un errore? Scrivimi. E se l’app ti è utile, puoi offrirmi un caffè.</p>
    <div class="about-actions">
      {#if ABOUT.donateUrl}
        <a class="btn primary" href={ABOUT.donateUrl} target="_blank" rel="noopener noreferrer">☕ Offrimi un caffè</a>
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
  </div>
</Sheet>

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

  .switch {
    appearance: none;
    flex-shrink: 0;
    width: 52px;
    height: 32px;
    margin: 0;
    border-radius: 16px;
    background: var(--line-2);
    position: relative;
    cursor: pointer;
    transition: background 150ms;
  }

  .switch::after {
    content: '';
    position: absolute;
    top: 4px;
    left: 4px;
    width: 24px;
    height: 24px;
    border-radius: 12px;
    background: var(--muted);
    transition: transform 150ms;
  }

  .switch:checked {
    background: var(--accent);
  }

  .switch:checked::after {
    background: var(--on-accent);
    transform: translateX(20px);
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

  .signout {
    display: block;
    width: calc(100% - 32px);
    margin: 22px 16px 0;
    min-height: 52px;
    border: 0;
    border-radius: 26px;
    background: transparent;
    color: var(--danger);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
  }

  .signout.subtle {
    margin-top: 0;
    font-weight: 500;
    font-size: 14px;
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

  .about .legal {
    margin-top: 4px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-size: 11px;
    line-height: 1.45;
  }

  .foot {
    margin: 8px 24px 0;
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }
</style>
