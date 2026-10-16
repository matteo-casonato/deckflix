<script>
  // @ts-check
  // "Rivedi e salva N carte" (SPEC § 4.1.8): fix the card, language or print of each queued
  // scan, remove wrong ones, then save all. Uncertain ones are marked "Da verificare".
  import { Delete02Icon } from '@hugeicons/core-free-icons';
  import Icon from '../../lib/ui/Icon.svelte';
  import { LANG_LABELS, euro } from '../../lib/domain/cards.js';
  import { printsFor } from '../../lib/scan/pipeline.js';

  /**
   * @typedef {{ id: number, rec: import('../../lib/scan/pipeline.js').Recognition, chosen: number, lang: string,
   *   variant: string, options: import('../../lib/domain/variants.js').VariantOption[] }} Item
   * @type {{ items: Item[], onsave: () => void, onback: () => void, onremove: (id: number) => void }}
   */
  let { items, onsave, onback, onremove } = $props();

  /** @param {Item} item @param {number} index */
  async function pick(item, index) {
    item.chosen = index;
    const p = await printsFor(item.rec.candidates[index], item.rec);
    item.options = p.options;
    item.variant = p.preselect;
  }

  const uncertain = $derived(items.filter((i) => i.rec.uncertain).length);
</script>

<div class="review">
  <header>
    <button class="btn" onclick={onback}>Torna alla scansione</button>
  </header>
  <h1>Rivedi {items.length} {items.length === 1 ? 'carta' : 'carte'}</h1>
  {#if uncertain}
    <p class="muted">{uncertain === 1 ? '1 carta da verificare' : `${uncertain} carte da verificare`}: controlla che siano quelle giuste.</p>
  {/if}

  <ul>
    {#each items as item (item.id)}
      {@const c = item.rec.candidates[item.chosen]}
      <li class="row card" class:warn={item.rec.uncertain}>
        <div class="top">
          {#if c?.image}<img src={`${c.image}/low.webp`} alt="" />{:else}<span class="ph"></span>{/if}
          <span class="txt">
            <strong>{c?.name}</strong>
            <span class="muted num">{c?.setName} · {c?.localId}/{c?.official || '?'}</span>
            {#if item.rec.uncertain}<span class="badge">Da verificare</span>{/if}
          </span>
          <button class="icon" aria-label={`Togli ${c?.name} dalla coda`} onclick={() => onremove(item.id)}>
            <Icon icon={Delete02Icon} size={20} />
          </button>
        </div>
        <div class="selects">
          {#if item.rec.candidates.length > 1}
            <select class="chip" aria-label="Carta" value={item.chosen} onchange={(e) => pick(item, Number(e.currentTarget.value))}>
              {#each item.rec.candidates.slice(0, 6) as cand, i (cand.id)}
                <option value={i}>{cand.name} · {cand.setCode ?? cand.setName} {cand.localId}</option>
              {/each}
            </select>
          {/if}
          <select class="chip" aria-label="Lingua" bind:value={item.lang}>
            {#each Object.entries(LANG_LABELS) as [code, label] (code)}<option value={code}>{label}</option>{/each}
          </select>
          {#if item.options.length > 1}
            <select class="chip" aria-label="Variante" bind:value={item.variant}>
              {#each item.options as v (v.key)}
                <option value={v.key}>{v.label}{v.price != null ? ` · ${euro(v.price)}` : ''}</option>
              {/each}
            </select>
          {/if}
        </div>
      </li>
    {/each}
  </ul>

  <div class="bottom">
    <button class="btn primary" disabled={!items.length} onclick={onsave}>
      Salva {items.length} {items.length === 1 ? 'carta' : 'carte'} nella collezione
    </button>
  </div>
</div>

<style>
  .review {
    min-height: 100dvh;
    max-width: 560px;
    margin-inline: auto;
    padding: calc(14px + var(--safe-top)) 16px calc(100px + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  h1 {
    font-size: 26px;
  }

  .muted {
    color: var(--muted);
    margin: 0;
    font-size: 13px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .row {
    padding: 12px;
    border-radius: var(--r-card);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .row.warn {
    border-color: var(--accent);
  }

  .top {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  img,
  .ph {
    width: 48px;
    aspect-ratio: 63 / 88;
    border-radius: var(--r-cardimg);
    background: var(--surface-2);
    object-fit: cover;
    flex-shrink: 0;
  }

  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .badge {
    align-self: flex-start;
    height: 20px;
    padding: 0 8px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--accent) 18%, var(--surface));
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
  }

  .icon {
    width: 48px;
    height: 48px;
    border: 0;
    border-radius: 16px;
    background: var(--surface-2);
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .selects {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .bottom {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(16px + var(--safe-bottom));
    max-width: 528px;
    margin-inline: auto;
  }

  .bottom .btn {
    width: 100%;
    min-height: 56px;
    font-size: 16px;
  }
</style>
