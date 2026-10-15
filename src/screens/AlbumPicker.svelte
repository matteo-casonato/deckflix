<script>
  // @ts-check
  // "Aggiungi a raccolta" from the card detail: tick the albums the card belongs to, or create
  // a new one with the card already inside.
  import { liveQuery } from 'dexie';
  import { Add01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
  import { db } from '../lib/db.js';
  import { createAlbum, toggleInAlbum } from '../lib/data/albums.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import Sheet from '../lib/ui/Sheet.svelte';
  import Icon from '../lib/ui/Icon.svelte';

  /** @type {{ open: boolean, cardId: string, cardName: string, onclose: () => void }} */
  let { open, cardId, cardName, onclose } = $props();

  const albums = liveQuery(() => db.albums.orderBy('updatedAt').reverse().toArray());
  let name = $state('');

  /** @param {import('../lib/db.js').Album} a */
  async function toggle(a) {
    const added = await toggleInAlbum(a.id, cardId);
    showToast(added ? `${cardName} in «${a.name}»` : `${cardName} tolta da «${a.name}»`, () => toggleInAlbum(a.id, cardId));
  }

  /** @param {SubmitEvent} e */
  async function create(e) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    await createAlbum(n, cardId);
    name = '';
    showToast(`Raccolta «${n}» creata con ${cardName}`);
  }
</script>

<Sheet {open} title="Aggiungi a raccolta" {onclose}>
  {#if $albums?.length}
    <ul class="list">
      {#each $albums as a (a.id)}
        {@const inside = a.cards.some((c) => c.cardId === cardId)}
        <li>
          <button class="row" role="checkbox" aria-checked={inside} onclick={() => toggle(a)}>
            <span class="txt">
              <strong>{a.name}</strong>
              <span class="num">{a.cards.length} {a.cards.length === 1 ? 'carta' : 'carte'}</span>
            </span>
            <span class="tick" class:on={inside}>{#if inside}<Icon icon={Tick02Icon} size={18} />{/if}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted">Le raccolte sono gruppi di carte scelti da te: le preferite, quelle da far gradare, un tema. Creane una.</p>
  {/if}
  <form class="new" onsubmit={create}>
    <label class="visually-hidden" for="album-name">Nome della nuova raccolta</label>
    <input id="album-name" placeholder="Nuova raccolta" bind:value={name} maxlength="40" enterkeyhint="done" />
    <button class="btn primary" type="submit" disabled={!name.trim()} aria-label="Crea raccolta">
      <Icon icon={Add01Icon} size={20} /> Crea
    </button>
  </form>
</Sheet>

<style>
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 45dvh;
    overflow-y: auto;
  }

  .row {
    width: 100%;
    min-height: 56px;
    padding: 0 10px 0 16px;
    border: 0;
    border-radius: var(--r-card);
    background: var(--surface-2);
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 10px;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .txt strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .txt span,
  .muted {
    font-size: 13px;
    color: var(--muted);
  }

  .muted {
    margin: 0;
    padding: 0 4px;
  }

  .tick {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 16px;
    border: 1.5px solid var(--line-2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tick.on {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
  }

  .new {
    display: flex;
    gap: 8px;
  }

  .new input {
    flex: 1;
    min-width: 0;
    min-height: 48px;
    padding: 0 16px;
    border: 1px solid var(--line-2);
    border-radius: var(--r-control);
    background: var(--bg);
    color: var(--text);
    font: inherit;
  }
</style>
