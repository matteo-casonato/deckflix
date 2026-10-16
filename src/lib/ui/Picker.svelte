<script>
  // @ts-check
  // The app's select: a chip with the current choice opens a sheet with the options (Bits UI
  // Sheet: back gesture, focus). Options can show an icon (energy, rarity) or a flag (language);
  // those without one, like "Tutti", stay aligned to the left. SetPicker adds search for sets.
  import Sheet from './Sheet.svelte';
  import Flag from './Flag.svelte';

  /** @typedef {import('./options.js').Option} Option */

  /**
   * @type {{
   *   title: string, value: string, options: Option[], onchange: (value: string) => void,
   *   placeholder?: string, active?: boolean, label?: string | null, wide?: boolean, small?: boolean,
   * }}
   * label: fixed text on the chip (an action like "+ Copia in un'altra condizione") instead of the choice.
   */
  let { title, value, options, onchange, placeholder = '', active = false, label = null, wide = false, small = false } = $props();

  let open = $state(false);
  // No choice ("") shows the placeholder ("Tipo"), not the "all" option.
  const current = $derived(value === '' && placeholder ? null : (options.find((o) => o.value === value) ?? null));

  /** @param {string} v */
  function pick(v) {
    open = false;
    if (v !== value || label) onchange(v);
  }
</script>

{#snippet mark(/** @type {Option} */ o, /** @type {number} */ size)}
  {#if o.flag}
    <Flag lang={o.flag} width={Math.round(size * 1.15)} />
  {:else if o.icon}
    <span class="mark" class:tile={o.tile} style:width="{size}px" style:height="{size}px"><img src={o.icon} alt="" /></span>
  {/if}
{/snippet}

<button
  type="button"
  class="chip dropdown pick"
  class:on={active && !!value && !label}
  class:wide
  class:small
  aria-haspopup="dialog"
  aria-label={`${title}: ${label ?? current?.label ?? placeholder}`}
  onclick={() => (open = true)}
>
  {#if !label && current}{@render mark(current, 18)}{/if}
  <span class="txt">{label ?? current?.label ?? placeholder}</span>
</button>

<Sheet {open} {title} onclose={() => (open = false)}>
  <ul class="list" role="listbox" aria-label={title}>
    {#each options as o (o.value)}
      <li>
        <button type="button" role="option" aria-selected={!label && o.value === value} onclick={() => pick(o.value)}>
          {#if o.flag || o.icon}<span class="box" aria-hidden="true">{@render mark(o, 30)}</span>{/if}
          <span class="otxt">{o.label}{#if o.sub}<span>{o.sub}</span>{/if}</span>
        </button>
      </li>
    {/each}
  </ul>
</Sheet>

<style>
  .pick {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .pick .txt {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pick :global(.flag),
  .pick .mark {
    margin-left: -4px;
  }

  .pick.wide {
    width: 100%;
    max-width: none;
    justify-content: center;
  }

  .pick.small {
    min-height: 32px;
    padding-left: 10px;
    font-size: 12px;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 60dvh;
    overflow-y: auto;
  }

  .list button {
    width: 100%;
    min-height: 52px;
    padding: 6px 12px;
    border: 0;
    border-radius: 16px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 15px;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
  }

  .list button[aria-selected='true'] {
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  }

  /* Same square box as the set logos in SetPicker. */
  .box {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mark {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .mark img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  /* Rarity symbols are printed black: a light tile, as on the card screen. */
  .mark.tile {
    padding: 3px;
    border-radius: 6px;
    background: #f4f4f2;
  }

  .otxt {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .otxt span {
    font-size: 12px;
    color: var(--muted);
  }
</style>
