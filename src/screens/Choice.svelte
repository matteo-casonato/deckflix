<script>
  // @ts-check
  // This phone and Drive both have data (SPEC § 7): never overwrite without asking.
  import { account } from '../lib/stores/account.svelte.js';
  import { resolveChoice } from '../lib/sync/sync.js';
  import { countsLabel, relativeTime } from '../lib/domain/backup.js';

  const c = $derived(account.choice);
  /** @type {'local' | 'remote' | null} */
  let keep = $state(null);

  const counts = countsLabel;
</script>

{#if c}
  <div class="choice">
    <h1>Quale collezione tieni?</h1>
    <p class="lead">
      {c.reason === 'first-sign-in'
        ? 'Su questo telefono e su Google Drive ci sono due collezioni diverse.'
        : 'Su Google Drive c’è una versione salvata da un altro telefono dopo l’ultimo backup di questo.'}
      Quella che non scegli verrà sostituita.
    </p>

    <div class="options" role="radiogroup" aria-label="Collezione da tenere">
      <button class="opt card" role="radio" aria-checked={keep === 'local'} onclick={() => (keep = 'local')}>
        <strong>Questo telefono</strong>
        <span class="num">{counts(c.local)}</span>
        <span>Modificata ora</span>
      </button>
      <button class="opt card" role="radio" aria-checked={keep === 'remote'} onclick={() => (keep = 'remote')}>
        <strong>Google Drive</strong>
        <span class="num">{counts(c.remote)}</span>
        <span>Salvata {relativeTime(Date.parse(c.remoteFile.modifiedTime), Date.now())}</span>
      </button>
    </div>

    <button class="btn primary" disabled={!keep} onclick={() => keep && resolveChoice(keep)}>
      {keep === 'remote' ? 'Usa quella di Drive' : keep === 'local' ? 'Tieni questo telefono' : 'Scegli una delle due'}
    </button>
  </div>
{/if}

<style>
  .choice {
    min-height: 100dvh;
    max-width: 480px;
    margin-inline: auto;
    padding: calc(28px + var(--safe-top)) 16px 40px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  h1 {
    font-size: 28px;
  }

  .lead {
    margin: 0;
    color: var(--muted);
  }

  .options {
    display: grid;
    gap: 12px;
  }

  .opt {
    padding: 18px;
    border-radius: var(--r-card);
    border: 2px solid var(--line);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    cursor: pointer;
  }

  .opt[aria-checked='true'] {
    border-color: var(--accent);
  }

  .opt strong {
    font-family: var(--font-display);
    font-size: 18px;
  }

  .opt span {
    color: var(--muted);
    font-size: 14px;
  }
</style>
