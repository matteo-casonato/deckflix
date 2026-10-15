<script>
  // @ts-check
  // "Raccolte": the user's albums (cover = most valuable card) and the automatic ones.
  import { liveQuery } from 'dexie';
  import { Add01Icon } from '@hugeicons/core-free-icons';
  import { db } from '../../lib/db.js';
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { prefetchCards, liveCards } from '../../lib/data/catalog.js';
  import { createAlbum } from '../../lib/data/albums.js';
  import { AUTO_ALBUMS, autoAlbum, bestPrice, ownedTiles, stackIds } from '../../lib/domain/albums.js';
  import StackRow from '../../lib/ui/StackRow.svelte';
  import { cardImage } from '../../lib/api/tcgdex.js';
  import { hrefFor } from '../../lib/domain/routes.js';
  import { navigate } from '../../lib/router.svelte.js';
  import Icon from '../../lib/ui/Icon.svelte';
  import Sheet from '../../lib/ui/Sheet.svelte';

  const albums = liveQuery(() => db.albums.orderBy('updatedAt').reverse().toArray());
  const entries = liveQuery(() => db.collection.toArray());

  const ids = $derived(
    [...new Set([...($entries ?? []).map((e) => e.cardId), ...($albums ?? []).flatMap((a) => a.cards.map((c) => c.cardId))])].sort(),
  );
  const cards = $derived(liveCards(ids, settings.cardLang));
  $effect(() => {
    if (ids.length) prefetchCards(ids, settings.cardLang);
  });

  const auto = $derived.by(() => {
    if (!$cards) return [];
    const tiles = ownedTiles($entries ?? [], $cards);
    return AUTO_ALBUMS.map(([id, name, sub]) => {
      const groups = autoAlbum(id, tiles, $cards);
      const count = groups.reduce((n, g) => n + g.tiles.length, 0);
      return { id, name, sub: groups.length > 1 ? `${groups.length} gruppi` : `${count} ${count === 1 ? 'carta' : 'carte'}`, hint: sub, covers: groups.flatMap((g) => g.tiles.map((t) => t.cardId)), empty: count === 0 };
    });
  });

  let creating = $state(false);
  let name = $state('');

  /** @param {SubmitEvent} e */
  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const id = await createAlbum(name);
    creating = false;
    name = '';
    navigate(hrefFor('album', { id }));
  }

  /**
   * Two preview images, the cover first (long press inside the album, or the first card).
   * @param {string} key album id
   * @param {string[]} ordered card ids, preferred first
   */
  const stack = (key, ordered) =>
    stackIds(ordered, settings.covers[`album:${key}`], (cid) => !!$cards?.get(cid)?.image).map((cid) => cardImage($cards?.get(cid)));

  /** Manual album cards, most valuable first. @param {import('../../lib/db.js').Album} a */
  const byValue = (a) => a.cards.map((c) => c.cardId).sort((x, y) => bestPrice($cards?.get(y)) - bestPrice($cards?.get(x)));
</script>

<div class="head">
  <h2>Le tue raccolte</h2>
  <button class="btn" onclick={() => (creating = true)}><Icon icon={Add01Icon} size={18} /> Nuova</button>
</div>

{#if $albums && $albums.length === 0}
  <p class="intro">
    Raggruppa le carte come vuoi tu: le preferite, quelle da far gradare, un tema. Dalla scheda di una carta tocca
    il segnalibro per aggiungerla, anche se non la possiedi.
  </p>
{:else}
  <ul class="rows">
    {#each $albums ?? [] as a (a.id)}
      {@const owned = a.cards.filter((c) => ($entries ?? []).some((e) => e.cardId === c.cardId)).length}
      <li>
        <StackRow
          href={hrefFor('album', { id: a.id })}
          images={stack(a.id, byValue(a))}
          title={a.name}
          sub={`${a.cards.length} ${a.cards.length === 1 ? 'carta' : 'carte'}${a.cards.length ? ` · ${owned} possedute` : ''}`}
          percent={a.cards.length ? Math.round((owned / a.cards.length) * 100) : null}
          done={!!a.cards.length && owned === a.cards.length}
        >
          <span class="tag">Tua</span>
        </StackRow>
      </li>
    {/each}
  </ul>
{/if}

<div class="head"><h2>Automatiche</h2></div>
<p class="intro">Si aggiornano da sole con la tua collezione.</p>
<ul class="rows">
  {#each auto as a (a.id)}
    <li class:dim={a.empty}>
      <StackRow href={hrefFor('album', { id: a.id })} images={stack(a.id, a.covers)} title={a.name} sub={a.empty ? a.hint : a.sub}>
        <span class="tag accent">Automatica</span>
      </StackRow>
    </li>
  {/each}
</ul>

<Sheet open={creating} title="Nuova raccolta" onclose={() => (creating = false)}>
  <form class="new" onsubmit={create}>
    <label class="visually-hidden" for="new-album">Nome della raccolta</label>
    <!-- svelte-ignore a11y_autofocus -->
    <input id="new-album" placeholder="Es. Preferite, Da gradare" bind:value={name} maxlength="40" autofocus enterkeyhint="done" />
    <button class="btn primary" type="submit" disabled={!name.trim()}>Crea</button>
  </form>
</Sheet>

<style>
  .head {
    padding: 18px 20px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    font-size: 19px;
    font-weight: 600;
  }

  .intro {
    margin: 0 20px 8px;
    font-size: 13px;
    color: var(--muted);
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 4px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .rows .dim {
    opacity: 0.6;
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
