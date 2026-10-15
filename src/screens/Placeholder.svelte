<script>
  // @ts-check
  // Screens not built yet: title plus the empty state from SPEC § 4.5.
  import EmptyState from '../lib/ui/EmptyState.svelte';

  /** @type {{ title: string, emptyTitle: string, emptyText: string, phase: string }} */
  let { title, emptyTitle, emptyText, phase } = $props();
</script>

<header class="top">
  <h1>{title}</h1>
</header>

<EmptyState title={emptyTitle} text={emptyText} />
<p class="phase">In arrivo nella {phase}.</p>

<style>
  .top {
    padding: 16px 20px 0;
  }

  h1 {
    font-size: 28px;
  }

  .phase {
    margin: 0 20px;
    color: var(--muted);
    font-size: 13px;
    text-align: center;
  }
</style>
