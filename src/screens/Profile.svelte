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
    LockIcon,
    GridViewIcon,
    LinkSquare02Icon,
    QrCodeIcon,
  } from '@hugeicons/core-free-icons';
  import Icon from '../lib/ui/Icon.svelte';
  import Avatar from '../lib/ui/Avatar.svelte';
  import ConfirmDialog from '../lib/ui/ConfirmDialog.svelte';
  import { account } from '../lib/stores/account.svelte.js';
  import { setSetting, settings } from '../lib/stores/settings.svelte.js';
  import { LANG_LABELS } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { USEFUL_LINKS, hostOf } from '../lib/domain/links.js';
  import { clearImageCache, imageCacheInfo } from '../lib/data/imageCache.js';
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
  let cache = $state(null);
  const refreshCache = () => imageCacheInfo().then((c) => (cache = c));
  $effect(() => {
    refreshCache();
  });

  /** @type {'restore' | 'signout' | 'wipe' | 'images' | null} */
  let confirm = $state(null);

  /** Interactive when Google needs a tap to renew access. */
  const saveNow = () => backupNow({ interactive: account.needsAuth });
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
  <button class="row" disabled={!account.user} onclick={() => (confirm = 'restore')}>
    <span class="ico"><Icon icon={CloudDownloadIcon} /></span>
    <span class="text"><strong>Ripristina da Drive</strong><span>Sostituisce i dati di questo telefono</span></span>
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
</section>

<h2 class="section">Utility</h2>
<section class="card list">
  {#each USEFUL_LINKS as l (l.url)}
    <a class="row" href={l.url} target="_blank" rel="noopener noreferrer">
      <span class="ico fav" aria-hidden="true">{l.name[0]}</span>
      <span class="text"><strong>{l.name}</strong><span>{l.text} · {hostOf(l.url)}</span></span>
      <span class="chev" aria-hidden="true"><Icon icon={LinkSquare02Icon} size={18} /></span>
      <span class="visually-hidden">(si apre in una nuova scheda)</span>
    </a>
  {/each}
</section>

<h2 class="section">App</h2>
<section class="card list">
  <label class="row">
    <span class="ico"><Icon icon={LanguageSkillIcon} /></span>
    <span class="text"><strong>Lingua delle carte</strong><span>Nomi, ricerca e immagini</span></span>
    <select class="chip" value={settings.cardLang} onchange={(e) => setSetting('cardLang', e.currentTarget.value)}>
      {#each Object.entries(LANG_LABELS) as [code, label] (code)}<option value={code}>{label}</option>{/each}
    </select>
  </label>
  <label class="row">
    <span class="ico"><Icon icon={GridViewIcon} /></span>
    <span class="text"><strong>Carte mancanti in grigio</strong><span>Nelle edizioni; spento mostra solo i numeri e risparmia dati</span></span>
    <input class="switch" type="checkbox" role="switch" checked={settings.missingImages} onchange={(e) => setSetting('missingImages', e.currentTarget.checked)} />
  </label>
  <div class="row static">
    <span class="ico"><Icon icon={Analytics01Icon} /></span>
    <span class="text"><strong>Prezzo di riferimento</strong><span>Trend Cardmarket, aggiornato ogni giorno</span></span>
  </div>
  <button class="row" onclick={() => (confirm = 'images')} disabled={!cache || cache.images === 0}>
    <span class="ico"><Icon icon={Image01Icon} /></span>
    <span class="text">
      <strong>Cache immagini</strong>
      <span>
        {!cache
          ? 'Calcolo…'
          : `${cache.images} ${cache.images === 1 ? 'immagine' : 'immagini'}${cache.usageMb != null ? ` · app ${cache.usageMb} MB in tutto` : ''}${cache.images ? ' · svuota' : ''}`}
      </span>
    </span>
  </button>
  <div class="row static">
    <span class="ico"><Icon icon={LockIcon} /></span>
    <span class="text">
      <strong>Dati protetti sul telefono</strong>
      <span>
        {settings.persisted === null
          ? 'Verifica in corso…'
          : settings.persisted
            ? 'Sì: il browser non li cancella quando manca spazio'
            : 'No: se manca spazio il browser potrebbe cancellarli. Installare l’app aiuta.'}
      </span>
    </span>
  </div>
</section>

{#if account.user}
  <button class="signout" onclick={() => (confirm = 'signout')}>Esci dall’account</button>
  <button class="signout subtle" onclick={() => (confirm = 'wipe')}>Esci e cancella i dati da questo telefono</button>
  <p class="foot">I dati restano su questo telefono finché non li cancelli.</p>
{/if}

<ConfirmDialog
  open={confirm === 'images'}
  title="Svuotare la cache delle immagini?"
  text="Le immagini delle carte verranno scaricate di nuovo quando le apri. La collezione non cambia."
  confirmLabel="Svuota"
  onconfirm={() => clearImageCache().then(refreshCache)}
  onclose={() => (confirm = null)}
/>
<ConfirmDialog
  open={confirm === 'restore'}
  title="Ripristinare da Drive?"
  text="I dati di questo telefono verranno sostituiti con l’ultimo backup salvato su Google Drive."
  confirmLabel="Ripristina"
  danger
  onconfirm={restoreFromDrive}
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

  .row .chip {
    max-width: 130px;
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

  .foot {
    margin: 8px 24px 0;
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }
</style>
