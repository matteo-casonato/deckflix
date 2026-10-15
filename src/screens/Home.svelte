<script>
  // @ts-check
  // Home (docs/mockups/Home.html). Phase 1: logo and empty state; value card,
  // featured deck and recent additions arrive with the collection (Phases 3, 6, 7).
  import EmptyState from '../lib/ui/EmptyState.svelte';
  import { hrefFor } from '../lib/domain/routes.js';
</script>

<header class="top">
  <h1 class="logo">Deck<span>flix</span></h1>
</header>

<EmptyState title="Nessuna carta ancora" text="Scansiona le tue carte o inseriscile per numero.">
  <a class="btn light" href={hrefFor('scan')}>Scansiona</a>
  <span class="btn" aria-disabled="true" title="Arriva nella Fase 3">Inserimento rapido</span>
</EmptyState>

<section class="probe card">
  <h2>Collegamento a TCGdex</h2>
  <p>Carta di prova per controllare dati, prezzi e cache sul telefono.</p>
  <a class="btn" href={hrefFor('card', { lang: 'it', id: 'sv03.5-025' })}>Apri Pikachu · 025/165</a>
</section>

<style>
  .top {
    padding: 10px 20px 6px;
  }

  .logo {
    font-size: 28px;
    letter-spacing: -0.5px;
  }

  .logo span {
    color: var(--accent);
  }

  .probe {
    margin: 0 16px;
    padding: 18px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
  }

  .probe h2 {
    font-size: 19px;
    font-weight: 600;
  }

  .probe p {
    margin: 6px 0 14px;
    color: var(--muted);
    font-size: 14px;
  }
</style>
