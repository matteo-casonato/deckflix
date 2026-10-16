<script>
  // @ts-check
  // After signing in (docs/mockups/Ripristino.html): Drive access, backup check and
  // automatic restore. Without a backup the app goes straight to Home.
  import { Tick02Icon } from '@hugeicons/core-free-icons';
  import Logo from '../lib/ui/Logo.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Avatar from '../lib/ui/Avatar.svelte';
  import { account } from '../lib/stores/account.svelte.js';
  import { connectDrive } from '../lib/sync/sync.js';
  import { countsLabel, relativeTime } from '../lib/domain/backup.js';

  const s = $derived(account.signIn);

  /** @param {string} iso */
  const when = (iso) => relativeTime(Date.parse(iso), Date.now());

  $effect(() => {
    // Done: show the result briefly, then Home.
    if (s?.step !== 'done') return;
    const t = setTimeout(() => {
      account.signIn = null;
      location.hash = '#/home';
    }, s.remote ? 1200 : 0);
    return () => clearTimeout(t);
  });
</script>

<div class="restore">
  <Logo size={22} />

  {#if account.user}
    <section class="card who">
      <Avatar user={account.user} size={52} />
      <span class="id">
        <strong>{account.user.name}</strong>
        <span>{account.user.email}</span>
      </span>
    </section>
  {/if}

  <section class="card status" aria-live="polite">
    {#if s?.step === 'drive'}
      {#if account.needsAuth}
        <h2>Collega Google Drive</h2>
        <p>Serve un tocco per permettere a Deckflix di usare la sua cartella su Drive.</p>
        {#if account.error}<p class="err">{account.error}</p>{/if}
        <button class="btn primary" onclick={connectDrive}>Continua</button>
      {:else}
        <h2>Collego Google Drive…</h2>
      {/if}
    {:else if s?.step === 'checking'}
      <h2>Cerco il backup su Drive…</h2>
      <div class="bar"><span style:width="10%"></span></div>
    {:else if s?.remote}
      <h2 class="found">
        <span class="ok"><Icon icon={Tick02Icon} size={18} /></span>
        Backup trovato su Drive
      </h2>
      <p>
        Ultimo salvataggio: {when(s.remote.modifiedTime)}<br />
        <span class="num">{countsLabel(s.remote)}</span>
      </p>
      <div class="progress">
        <span>{s.step === 'done' ? 'Ripristino completato' : 'Ripristino in corso…'}</span>
        <span class="num muted">{Math.round(s.progress * 100)}%</span>
      </div>
      <div class="bar"><span style:width="{s.progress * 100}%"></span></div>
    {:else}
      <h2>Preparo il primo backup…</h2>
    {/if}
  </section>

  <p class="note">Le immagini delle carte si scaricano poco alla volta mentre usi l’app.</p>
</div>

<style>
  .restore {
    min-height: 100dvh;
    max-width: 480px;
    margin-inline: auto;
    padding: calc(24px + var(--safe-top)) 16px 52px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }



  .card {
    padding: 20px;
    border-radius: var(--r-section);
    background: var(--surface);
    display: flex;
    gap: 14px;
  }

  .who {
    margin-top: 24px;
    align-items: center;
  }

  .id {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .id strong {
    font-family: var(--font-display);
    font-size: 17px;
  }

  .id span,
  p {
    font-size: 14px;
    color: var(--muted);
    overflow-wrap: anywhere;
  }

  .status {
    flex-direction: column;
  }

  h2 {
    font-size: 17px;
    font-weight: 700;
  }

  .found {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ok {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--success) 18%, var(--surface));
    color: var(--success);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  p {
    margin: 0;
  }

  .err {
    color: var(--danger);
  }

  .progress {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
  }

  .muted {
    color: var(--muted);
  }

  .bar {
    height: 8px;
    border-radius: 4px;
    background: var(--bg);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 4px;
    transition: width var(--dur) var(--ease);
  }

  .note {
    padding: 0 6px;
    font-size: 13px;
  }
</style>
