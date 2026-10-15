<script>
  // @ts-check
  // Screen header with a back button (to the previous app screen, or `fallback`).
  import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
  import Icon from './Icon.svelte';
  import { back } from '../router.svelte.js';

  /** @type {{ title?: string, fallback: string, big?: boolean, children?: import('svelte').Snippet }} */
  let { title = '', fallback, big = false, children } = $props();
</script>

<header class="bar">
  <button class="round" aria-label="Indietro" onclick={() => back(fallback)}>
    <Icon icon={ArrowLeft01Icon} size={20} />
  </button>
  {#if title}
    {#if big}<h1>{title}</h1>{:else}<span class="title">{title}</span>{/if}
  {/if}
  <span class="end">{@render children?.()}</span>
</header>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px 4px;
  }

  .round {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    border: 0;
    border-radius: var(--r-card);
    background: var(--surface);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  h1 {
    font-size: 28px;
  }

  .title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 17px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .end {
    margin-left: auto;
    display: flex;
    gap: 8px;
  }

  @supports (corner-shape: squircle) {
    .round {
      corner-shape: squircle;
    }
  }
</style>
