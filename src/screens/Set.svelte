<script>
  // @ts-check
  // Set binder (docs/mockups/Set.html): every card in number order, owned ones full,
  // missing ones greyed out (or dashed, see Profile); filters all / owned / missing.
  import { liveQuery } from 'dexie';
  import { KeyboardIcon } from '@hugeicons/core-free-icons';
  import { db } from '../lib/db.js';
  import { getSet } from '../lib/api/tcgdex.js';
  import { settings, toggleCover } from '../lib/stores/settings.svelte.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import { prefetchCards, liveCards } from '../lib/data/catalog.js';
  import { copyPrice, euro, guessImage, setProgress, variantBadge } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { replace } from '../lib/router.svelte.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import Segmented from '../lib/ui/Segmented.svelte';
  import CardTile from '../lib/ui/CardTile.svelte';
  import Icon from '../lib/ui/Icon.svelte';

  /** @type {{ id: string, query: Record<string, string> }} */
  let { id, query } = $props();

  const filter = $derived(['owned', 'missing'].includes(query.show) ? query.show : 'all');

  /** @type {Promise<any>} */
  let request = $state(new Promise(() => {}));
  $effect(() => {
    request = getSet(settings.cardLang, id)
      .catch(() => getSet('en', id))
      .then((r) => r.data);
  });

  const entries = $derived(liveQuery(() => db.collection.where('setId').equals(id).toArray()));
  const ownedIds = $derived([...new Set(($entries ?? []).map((e) => e.cardId))]);
  const cards = $derived(liveCards(ownedIds, settings.cardLang));
  $effect(() => {
    if (ownedIds.length) prefetchCards(ownedIds, settings.cardLang);
  });

  /** @param {string} cardId */
  const copiesOf = (cardId) => ($entries ?? []).filter((e) => e.cardId === cardId);
  const value = $derived(($entries ?? []).reduce((s, e) => s + (copyPrice($cards?.get(e.cardId), e.variant) ?? 0) * e.qty, 0));

  /**
   * Long press on an owned card: it becomes the cover of this set in the Edizioni list.
   * @param {Event} e
   * @param {{ id: string, name: string }} c
   */
  async function chooseCover(e, c) {
    e.preventDefault();
    const next = await toggleCover(`set:${id}`, c.id);
    navigator.vibrate?.(20);
    showToast(next ? `Copertina dell’edizione: ${c.name}` : 'Copertina automatica', () => toggleCover(`set:${id}`, c.id));
  }

  /** @param {any} set */
  function view(set) {
    const progress = setProgress({ official: set.cardCount?.official ?? set.cards?.length ?? 0 }, $entries ?? []);
    const tiles = (set.cards ?? []).map((/** @type {any} */ c) => {
      const copies = copiesOf(c.id);
      const qty = copies.reduce((s, e) => s + e.qty, 0);
      const variants = new Set(copies.map((e) => e.variant));
      return {
        id: c.id,
        props: {
          name: c.name,
          localId: c.localId,
          image: c.image ?? guessImage(c.id, c.localId, settings.cardLang),
          qty,
          missing: qty === 0,
          ghost: settings.missingImages,
          starred: settings.covers[`set:${id}`] === c.id,
          onhold: qty > 0 ? (/** @type {Event} */ e) => chooseCover(e, c) : null,
          badge: variants.size === 1 ? variantBadge([...variants][0]) : null,
          href: hrefFor('card', { lang: settings.cardLang, id: c.id }),
        },
      };
    });
    const shown = tiles.filter((t) => (filter === 'owned' ? !t.props.missing : filter === 'missing' ? t.props.missing : true));
    return { progress, tiles, shown, ownedCount: tiles.filter((t) => !t.props.missing).length };
  }

  const R = 26;
  const C = 2 * Math.PI * R;
</script>

{#await request}
  <BackHeader fallback={hrefFor('collection', {}, { tab: 'owned' })} />
  <p class="muted pad" aria-busy="true">Carico l’edizione…</p>
{:then set}
  {@const v = view(set)}
  <BackHeader title={set.name} fallback={hrefFor('collection', {}, { tab: 'owned' })}>
    <a class="round" href={hrefFor('quick', {}, { set: id })} aria-label="Inserimento rapido in questa edizione">
      <Icon icon={KeyboardIcon} size={20} />
    </a>
  </BackHeader>

  <section class="summary card">
    <svg class="ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={R} class="track" />
      <circle cx="32" cy="32" r={R} class="fill" stroke-dasharray={`${(v.progress.percent / 100) * C} ${C}`} />
      <text x="32" y="36" text-anchor="middle" class="num">{v.progress.percent}%</text>
    </svg>
    <span class="facts">
      <strong class="num">{v.progress.owned} di {v.progress.total} carte</strong>
      <span class="num">{v.progress.missing} mancanti · {v.progress.duplicates} doppioni</span>
      <span class="num">Valore {euro(value)}</span>
    </span>
  </section>

  <div class="pad">
    <Segmented
      label="Mostra"
      value={filter}
      options={[
        { value: 'all', label: `Tutte ${v.tiles.length}` },
        { value: 'owned', label: `Possedute ${v.ownedCount}` },
        { value: 'missing', label: `Mancanti ${v.tiles.length - v.ownedCount}` },
      ]}
      onchange={(f) => replace(hrefFor('set', { id }, { show: f === 'all' ? null : f }))}
    />
  </div>

  <p class="hint">Tieni premuta una tua carta per sceglierla come copertina ★ dell’edizione.</p>

  <div class="grid4">
    {#each v.shown as t (t.id)}
      <CardTile {...t.props} />
    {/each}
  </div>
{:catch}
  <BackHeader fallback={hrefFor('collection', {}, { tab: 'owned' })} />
  <section class="error card">
    <p>Non riesco a caricare questa edizione. Se sei offline, riprova quando torna la rete.</p>
    <button class="btn" onclick={() => (request = getSet(settings.cardLang, id).then((r) => r.data))}>Riprova</button>
  </section>
{/await}

<style>
  .hint {
    margin: 10px 20px 0;
    font-size: 12px;
    color: var(--muted);
  }

  .pad {
    padding: 12px 16px 0;
  }

  .muted {
    color: var(--muted);
  }

  .round {
    width: 48px;
    height: 48px;
    border-radius: var(--r-card);
    background: var(--surface);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .summary {
    margin: 12px 16px 0;
    padding: 16px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .ring {
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    transform: rotate(-90deg);
  }

  .ring text {
    transform: rotate(90deg);
    transform-origin: 32px 32px;
    fill: var(--text);
    font-size: 13px;
    font-weight: 700;
    font-family: var(--font-body);
  }

  .track,
  .fill {
    fill: none;
    stroke-width: 7;
  }

  .track {
    stroke: var(--bg);
  }

  .fill {
    stroke: var(--accent);
    stroke-linecap: round;
  }

  .facts {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
    color: var(--muted);
  }

  .facts strong {
    font-size: 16px;
    color: var(--text);
  }

  .grid4 {
    padding: 14px 16px 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px 8px;
  }

  .error {
    margin: 16px;
    padding: 20px;
    border-radius: var(--r-section);
    background: var(--surface);
    text-align: center;
  }
</style>
