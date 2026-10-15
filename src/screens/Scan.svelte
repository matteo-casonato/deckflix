<script>
  // @ts-check
  // Full-screen scanner (Phase 5). Until then it points to the Phase 0 prototype.
  import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
  import Icon from '../lib/ui/Icon.svelte';
  import { hrefFor } from '../lib/domain/routes.js';
</script>

<div class="scan">
  <header>
    <a class="back" href={hrefFor('home')} aria-label="Esci dalla scansione">
      <Icon icon={ArrowLeft01Icon} size={20} />
    </a>
    <h1>Scansione</h1>
  </header>
  <p>La scansione integrata arriva nella Fase 5. Intanto puoi usare il prototipo della Fase 0.</p>
  <a class="btn light" href="./lab/scan/">Apri il prototipo di scansione</a>
</div>

<style>
  .scan {
    min-height: 100dvh;
    padding: calc(18px + var(--safe-top)) 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  h1 {
    font-size: 24px;
  }

  .back {
    width: 48px;
    height: 48px;
    border-radius: var(--r-card);
    background: var(--surface);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  p {
    margin: 0;
    color: var(--muted);
  }
</style>
