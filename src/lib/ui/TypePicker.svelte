<script>
  // @ts-check
  // Pokémon type chooser, like SetPicker: a chip with the chosen type (icon and name) opens a
  // sheet with the types in the game's order, each with its energy icon.
  import Sheet from './Sheet.svelte';
  import { sortTypes, typeIcon } from '../domain/types.js';

  /** @type {{ types: string[], value: string, onchange: (type: string) => void }} */
  let { types, value, onchange } = $props();

  let open = $state(false);
  const sorted = $derived(sortTypes(types));
  /** @param {string} t */
  const src = (t) => (typeIcon(t) ? `${import.meta.env.BASE_URL}types/${typeIcon(t)}.png` : null);

  /** @param {string} t */
  function pick(t) {
    onchange(t);
    open = false;
  }
</script>

<button type="button" class="chip dropdown pick" class:on={!!value} aria-haspopup="dialog" aria-label={`Tipo: ${value || 'tutti'}`} onclick={() => (open = true)}>
  {#if value && src(value)}<img class="mini" src={src(value)} alt="" />{/if}
  <span>{value || 'Tipo'}</span>
</button>

<Sheet {open} title="Tipo" onclose={() => (open = false)}>
  <ul class="list" role="listbox" aria-label="Tipi">
    <li>
      <button type="button" role="option" aria-selected={!value} onclick={() => pick('')}>
        <span class="icon" aria-hidden="true"></span>Tutti i tipi
      </button>
    </li>
    {#each sorted as t (t)}
      <li>
        <button type="button" role="option" aria-selected={value === t} onclick={() => pick(t)}>
          <span class="icon" aria-hidden="true">{#if src(t)}<img src={src(t)} alt="" />{/if}</span>{t}
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

  .mini {
    width: 18px;
    height: 18px;
    margin-left: -4px;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
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
  .icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon img {
    width: 32px;
    height: 32px;
  }
</style>
