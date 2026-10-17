<script>
  // @ts-check
  // This phone and Drive both have data and it differs (SPEC § 7): never overwrite without
  // asking. Shows what differs, suggests a version when one has everything the other has, and
  // says the version not chosen stays on Drive (Profilo › Ripristina da Drive).
  import { account } from '../lib/stores/account.svelte.js';
  import { resolveChoice } from '../lib/sync/sync.js';
  import { countsLabel, relativeTime, suggestedVersion } from '../lib/domain/backup.js';

  const c = $derived(account.choice);
  const suggested = $derived(c?.diff ? suggestedVersion(c.diff) : null);
  /** @type {'local' | 'remote' | null} */
  let picked = $state(null);
  const keep = $derived(picked ?? suggested);

  /** @param {number} n */
  const cards = (n) => `${n} ${n === 1 ? 'carta' : 'carte'}`;
  const differences = $derived(
    c?.diff
      ? [
          c.diff.onlyLocal ? `Solo su questo telefono: ${cards(c.diff.onlyLocal)}` : null,
          c.diff.onlyRemote ? `Solo su Google Drive: ${cards(c.diff.onlyRemote)}` : null,
          c.diff.decks ? 'I deck sono diversi' : null,
          c.diff.wishlist ? 'I desideri sono diversi' : null,
          c.diff.albums ? 'Le raccolte sono diverse' : null,
        ].filter(Boolean)
      : [],
  );
</script>

{#if c}
  <div class="choice">
    <h1>Due versioni della collezione</h1>
    <p class="lead">
      {c.reason === 'first-sign-in'
        ? 'Su questo telefono e su Google Drive ci sono due collezioni diverse.'
        : 'Su Google Drive c’è una versione diversa da quella di questo telefono: può averla salvata un altro telefono o un altro browser con lo stesso account.'}
    </p>

    {#if differences.length}
      <section class="diff card">
        <strong>Cosa cambia</strong>
        <ul>
          {#each differences as d (d)}<li>{d}</li>{/each}
        </ul>
      </section>
    {/if}

    <div class="options" role="radiogroup" aria-label="Collezione da tenere">
      <button class="opt card" role="radio" aria-checked={keep === 'local'} onclick={() => (picked = 'local')}>
        <span class="head"><strong>Questo telefono</strong>{#if suggested === 'local'}<span class="tag">Consigliata</span>{/if}</span>
        <span class="num">{countsLabel(c.local)}</span>
        <span>Modificata ora</span>
      </button>
      <button class="opt card" role="radio" aria-checked={keep === 'remote'} onclick={() => (picked = 'remote')}>
        <span class="head"><strong>Google Drive</strong>{#if suggested === 'remote'}<span class="tag">Consigliata</span>{/if}</span>
        <span class="num">{countsLabel(c.remote)}</span>
        <span>Salvata {relativeTime(Date.parse(c.remoteFile.modifiedTime), Date.now())}</span>
      </button>
    </div>

    <p class="safe">
      <strong>Non perdi niente.</strong> La versione che non scegli resta salvata su Google Drive: se ti serve, la recuperi da
      Profilo › Ripristina da Drive › Versione scartata.
    </p>

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

  .opt > span:not(.head) {
    color: var(--muted);
    font-size: 14px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .tag {
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 12px;
    font-weight: 700;
  }

  .diff {
    padding: 14px 18px;
    border-radius: var(--r-card);
    background: var(--surface);
    border: 1px solid var(--line);
    font-size: 14px;
  }

  .diff ul {
    margin: 6px 0 0;
    padding-left: 18px;
    color: var(--muted);
    line-height: 1.5;
  }

  .safe {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--muted);
  }

  .safe strong {
    color: var(--text);
  }
</style>
