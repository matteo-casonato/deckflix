<script>
  // @ts-check
  // "Raccolte": the user's albums (cover = most valuable card) and the automatic ones.
  import { liveQuery } from 'dexie';
  import { Add01Icon } from '@hugeicons/core-free-icons';
  import { db } from '../../lib/db.js';
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { prefetchCards, liveCards } from '../../lib/data/catalog.js';
  import { createAlbum } from '../../lib/data/albums.js';
  import { AUTO_ALBUMS, albumCover, autoAlbum, ownedTiles } from '../../lib/domain/albums.js';
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

  /** First of the cards that has an image (TCGdex images can be missing). @param {(string | null)[]} ids */
  const img = (ids) => ids.map((id) => (id ? cardImage($cards?.get(id)) : null)).find(Boolean) ?? null;
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
  <div class="grid">
    {#each $albums ?? [] as a (a.id)}
      {@render tile(hrefFor('album', { id: a.id }), a.name, `${a.cards.length} ${a.cards.length === 1 ? 'carta' : 'carte'}`, img($cards ? [albumCover(a, $cards), ...a.cards.map((c) => c.cardId).reverse()] : []), false)}
    {/each}
  </div>
{/if}

<div class="head"><h2>Automatiche</h2></div>
<p class="intro">Si aggiornano da sole con la tua collezione.</p>
<div class="grid">
  {#each auto as a (a.id)}
    {@render tile(hrefFor('album', { id: a.id }), a.name, a.empty ? a.hint : a.sub, img(a.covers), a.empty)}
  {/each}
</div>

{#snippet tile(/** @type {string} */ href, /** @type {string} */ title, /** @type {string} */ sub, /** @type {string | null} */ src, /** @type {boolean} */ dim)}
  <a class="tile card" class:dim {href}>
    <span class="cover">
      {#if src}<img {src} alt="" loading="lazy" />{/if}
    </span>
    <span class="txt">
      <strong>{title}</strong>
      <span class="num">{sub}</span>
    </span>
  </a>
{/snippet}

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

  .grid {
    padding: 4px 16px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .tile {
    border-radius: var(--r-card);
    background: var(--surface);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    color: var(--text);
    text-decoration: none;
  }

  .tile.dim {
    opacity: 0.6;
  }

  .cover {
    height: 132px;
    background: var(--surface-2);
    overflow: hidden;
    display: block;
  }

  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 18%;
  }

  .txt {
    padding: 10px 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .txt strong {
    font-size: 15px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .txt span {
    font-size: 12px;
    color: var(--muted);
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
