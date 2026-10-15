<script>
  // @ts-check
  // "Le mie carte" (docs/mockups/Collezione.html, Desideri.html): owned cards and wishlist tabs.
  import { liveQuery } from 'dexie';
  import { db } from '../lib/db.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { replace } from '../lib/router.svelte.js';
  import Segmented from '../lib/ui/Segmented.svelte';
  import Owned from './collection/Owned.svelte';
  import Wishlist from './collection/Wishlist.svelte';

  /** @type {{ query: Record<string, string> }} */
  let { query } = $props();

  const tab = $derived(query.tab === 'wishlist' ? 'wishlist' : 'owned');
  const copies = liveQuery(async () => (await db.collection.toArray()).reduce((n, e) => n + e.qty, 0));
  const wishes = liveQuery(() => db.wishlist.count());
</script>

<header class="top"><h1>Le mie carte</h1></header>

<div class="pad">
  <Segmented
    label="Sezione"
    value={tab}
    options={[
      { value: 'owned', label: `Possedute · ${$copies ?? 0}` },
      { value: 'wishlist', label: `Desideri · ${$wishes ?? 0}` },
    ]}
    onchange={(v) => replace(hrefFor('collection', {}, { tab: v === 'wishlist' ? 'wishlist' : null }))}
  />
</div>

{#if tab === 'owned'}
  <Owned {query} copies={$copies ?? 0} />
{:else}
  <Wishlist {query} />
{/if}

<style>
  .top {
    padding: 20px 16px 4px;
  }

  h1 {
    font-size: 28px;
  }

  .pad {
    padding: 12px 16px 0;
  }
</style>
