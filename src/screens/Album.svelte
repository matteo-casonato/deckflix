<script>
  // @ts-check
  // One album: a manual board (cards may be owned or not; edit to rename, remove cards or
  // delete it) or an automatic album computed from the collection, grouped when needed.
  import { liveQuery } from 'dexie';
  import { Cancel01Icon } from '@hugeicons/core-free-icons';
  import { db } from '../lib/db.js';
  import { settings, toggleCover } from '../lib/stores/settings.svelte.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import { prefetchCards, liveCards } from '../lib/data/catalog.js';
  import { deleteAlbum, renameAlbum, restoreAlbum, toggleInAlbum } from '../lib/data/albums.js';
  import { AUTO_ALBUMS, autoAlbum, bestPrice, isAutoAlbum, ownedTiles } from '../lib/domain/albums.js';
  import { euro, setIdOf, variantBadge } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { navigate } from '../lib/router.svelte.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import CardTile from '../lib/ui/CardTile.svelte';
  import ConfirmDialog from '../lib/ui/ConfirmDialog.svelte';
  import EmptyState from '../lib/ui/EmptyState.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Sheet from '../lib/ui/Sheet.svelte';

  /** @type {{ id: string }} */
  let { id } = $props();

  const auto = isAutoAlbum(id);
  const meta = AUTO_ALBUMS.find(([k]) => k === id);
  const album = liveQuery(() => (auto ? Promise.resolve(undefined) : db.albums.get(id)));
  const entries = liveQuery(() => db.collection.toArray());

  const ids = $derived(
    auto ? [...new Set(($entries ?? []).map((e) => e.cardId))].sort() : ($album?.cards ?? []).map((c) => c.cardId),
  );
  const cards = $derived(liveCards(ids, settings.cardLang));
  $effect(() => {
    if (ids.length) prefetchCards(ids, settings.cardLang);
  });

  const owned = $derived(new Map(ownedTiles($entries ?? [], $cards ?? new Map()).map((t) => [t.cardId, t])));

  /** @type {{ title: string, tiles: { cardId: string, qty: number, unit: number, variants: string[] }[] }[]} */
  const groups = $derived.by(() => {
    if (!$cards) return [];
    if (auto) return autoAlbum(id, [...owned.values()], $cards);
    // Manual: newest first; cards not owned keep their best print price.
    const tiles = [...($album?.cards ?? [])]
      .reverse()
      .map(({ cardId }) => owned.get(cardId) ?? { cardId, qty: 0, unit: bestPrice($cards.get(cardId)), value: 0, variants: [] });
    return tiles.length ? [{ title: '', tiles }] : [];
  });

  const count = $derived(groups.reduce((n, g) => n + g.tiles.length, 0));
  const ownedCount = $derived(groups.reduce((n, g) => n + g.tiles.filter((t) => t.qty > 0).length, 0));

  let editing = $state(false);
  let renaming = $state(false);
  let confirmDelete = $state(false);
  let name = $state('');

  /** @param {string} cardId */
  async function remove(cardId) {
    await toggleInAlbum(id, cardId);
    showToast(`${$cards?.get(cardId)?.name ?? 'Carta'} tolta dalla raccolta`, () => toggleInAlbum(id, cardId));
  }

  async function removeAlbum() {
    const deleted = await deleteAlbum(id);
    navigate(hrefFor('collection', {}, { tab: 'albums' }));
    if (deleted) showToast(`Raccolta «${deleted.name}» eliminata`, () => restoreAlbum(deleted));
  }

  /** @param {SubmitEvent} e */
  async function rename(e) {
    e.preventDefault();
    await renameAlbum(id, name);
    renaming = false;
  }

  /**
   * Long press: the card becomes the cover of this album in the Raccolte list.
   * @param {Event} e
   * @param {string} cardId
   */
  async function chooseCover(e, cardId) {
    e.preventDefault();
    const next = await toggleCover(`album:${id}`, cardId);
    navigator.vibrate?.(20);
    const name = $cards?.get(cardId)?.name ?? cardId;
    showToast(next ? `Copertina: ${name}` : 'Copertina automatica', () => toggleCover(`album:${id}`, cardId));
  }

  /** @param {{ cardId: string, qty: number, unit: number, variants: string[] }} t */
  function tileProps(t) {
    const card = $cards?.get(t.cardId);
    return {
      starred: settings.covers[`album:${id}`] === t.cardId,
      onhold: editing ? null : (/** @type {Event} */ e) => chooseCover(e, t.cardId),
      name: card?.name ?? t.cardId,
      localId: card?.localId ?? t.cardId.slice(setIdOf(t.cardId).length + 1),
      image: card?.image ?? null,
      qty: t.qty,
      badge: t.qty === 0 ? 'Manca' : t.variants.length === 1 ? variantBadge(t.variants[0]) : null,
      price: t.unit > 0 ? euro(t.unit) : null,
      href: hrefFor('card', { lang: settings.cardLang, id: t.cardId }),
    };
  }

  const title = $derived(auto ? (meta?.[1] ?? '') : ($album?.name ?? ''));
</script>

<BackHeader title={title} big fallback={hrefFor('collection', {}, { tab: 'albums' })}>
  {#if !auto && $album}
    <button class="chip" aria-pressed={editing} onclick={() => (editing = !editing)}>{editing ? 'Fine' : 'Modifica'}</button>
  {/if}
</BackHeader>

{#if !auto && $album === undefined && $entries}
  <EmptyState title="Raccolta non trovata" text="Forse è stata eliminata.">
    <a class="btn" href={hrefFor('collection', {}, { tab: 'albums' })}>Le tue raccolte</a>
  </EmptyState>
{:else}
  <p class="sub num">
    {#if auto}{meta?.[2]} · {/if}{count} {count === 1 ? 'carta' : 'carte'}{!auto && count ? ` · ${ownedCount} ${ownedCount === 1 ? 'posseduta' : 'possedute'}` : ''}
  </p>

  {#if count && !editing}<p class="hint">Tieni premuta una carta per sceglierla come copertina ★.</p>{/if}

  {#if editing}
    <div class="edit">
      <button class="btn" onclick={() => ((name = $album?.name ?? ''), (renaming = true))}>Rinomina</button>
      <button class="btn danger" onclick={() => (confirmDelete = true)}>Elimina raccolta</button>
    </div>
  {/if}

  {#if $cards && count === 0}
    <p class="empty">
      {auto
        ? 'Per ora nessuna carta della tua collezione rientra qui. La raccolta si riempie da sola quando aggiungi carte.'
        : 'Raccolta vuota. Apri una carta e tocca il segnalibro in alto per aggiungerla qui.'}
    </p>
  {/if}

  {#each groups as g (g.title)}
    {#if g.title}<h2 class="group">{g.title} <span class="num">{g.tiles.length}</span></h2>{/if}
    <div class="grid3">
      {#each g.tiles as t (t.cardId)}
        <div class="cell">
          <CardTile {...tileProps(t)} />
          {#if editing}
            <button class="remove" aria-label={`Togli ${$cards?.get(t.cardId)?.name ?? t.cardId} dalla raccolta`} onclick={() => remove(t.cardId)}>
              <Icon icon={Cancel01Icon} size={16} />
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
{/if}

<Sheet open={renaming} title="Rinomina raccolta" onclose={() => (renaming = false)}>
  <form class="new" onsubmit={rename}>
    <label class="visually-hidden" for="rename-album">Nome della raccolta</label>
    <input id="rename-album" bind:value={name} maxlength="40" enterkeyhint="done" />
    <button class="btn primary" type="submit" disabled={!name.trim()}>Salva</button>
  </form>
</Sheet>

<ConfirmDialog
  open={confirmDelete}
  title="Eliminare la raccolta?"
  text={`«${$album?.name ?? ''}» sparisce; le carte restano nella collezione.`}
  confirmLabel="Elimina"
  danger
  onconfirm={removeAlbum}
  onclose={() => (confirmDelete = false)}
/>

<style>
  .hint {
    margin: 8px 20px 0;
    font-size: 12px;
    color: var(--muted);
  }

  .sub {
    margin: 0 20px;
    font-size: 13px;
    color: var(--muted);
  }

  .edit {
    padding: 12px 16px 0;
    display: flex;
    gap: 8px;
  }

  .btn.danger {
    color: var(--danger);
  }

  .empty {
    margin: 24px 20px;
    font-size: 14px;
    color: var(--muted);
  }

  .group {
    margin: 22px 20px 10px;
    font-size: 17px;
    font-weight: 700;
  }

  .group span {
    color: var(--muted);
    font-weight: 500;
  }

  .grid3 {
    padding: 12px 16px 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 10px;
  }

  .group + .grid3 {
    padding-top: 0;
  }

  .cell {
    position: relative;
    min-width: 0;
  }

  .remove {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 48px;
    height: 48px;
    border: 0;
    background: transparent;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 0;
    cursor: pointer;
    color: var(--on-accent);
  }

  .remove :global(svg) {
    width: 28px;
    height: 28px;
    padding: 6px;
    border-radius: 14px;
    background: var(--text);
    box-sizing: border-box;
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
