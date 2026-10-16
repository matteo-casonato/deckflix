<script>
  // @ts-check
  // "Aggiorna i tornei" from the tournaments list: the import steps without going to the settings.
  import Sheet from '../../lib/ui/Sheet.svelte';
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { hrefFor } from '../../lib/domain/routes.js';
  import TournamentImport from './TournamentImport.svelte';

  /** @type {{ open: boolean, onclose: () => void }} */
  let { open, onclose } = $props();
</script>

<Sheet {open} title="Aggiorna i tornei" {onclose}>
  {#if settings.homePlace}
    <TournamentImport ondone={onclose} />
    <a class="place" href={hrefFor('settings', { key: 'tornei' })}>{settings.homePlace.name} · {settings.eventRadius} km</a>
  {:else}
    <a class="btn primary" href={hrefFor('settings', { key: 'tornei' })}>Imposta la città</a>
  {/if}
</Sheet>

<style>
  .place {
    min-height: 44px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    font-size: 13px;
    color: var(--accent);
  }
</style>
