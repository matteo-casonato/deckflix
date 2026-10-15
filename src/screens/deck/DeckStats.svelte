<script>
  // @ts-check
  // Deck breakdown and opening-hand odds, like the Limitless deck builder.
  import { HAND_SIZE, deckBreakdown, openingHand } from '../../lib/domain/deck.js';
  import { hrefFor } from '../../lib/domain/routes.js';

  /** @type {{ rows: import('../../lib/data/decks.js').DeckRow[] }} */
  let { rows } = $props();

  const b = $derived(deckBreakdown(rows));
  const hand = $derived(openingHand(rows));
  const pct = (/** @type {number} */ x) => `${(x * 100).toFixed(2).replace('.', ',')}%`;

  const columns = $derived([
    { title: 'Pokémon', total: b.pokemon.total, items: [['Base', b.pokemon.basic], ['Evoluzioni', b.pokemon.other]] },
    {
      title: 'Allenatori',
      total: b.trainer.total,
      items: [['Strumenti', b.trainer.item], ['Aiuti', b.trainer.supporter], ['Stadi', b.trainer.stadium], ['Oggetti', b.trainer.tool]],
    },
    { title: 'Energie', total: b.energy.total, items: [['Base', b.energy.basic], ['Speciali', b.energy.special]] },
  ]);
</script>

<h2 class="section">Composizione</h2>
<div class="breakdown">
  {#each columns as c (c.title)}
    <section class="col card">
      <h3><span>{c.title}</span><span class="num">{c.total}</span></h3>
      <dl>
        {#each c.items as [label, n] (label)}
          <div class:zero={n === 0}><dt>{label}</dt><dd class="num">{n}</dd></div>
        {/each}
      </dl>
    </section>
  {/each}
</div>

{#if hand}
  <h2 class="section">Mano iniziale</h2>
  <section class="odds card">
    {#if hand.deck !== 60}
      <p class="note">Calcolate su {hand.deck} carte: il deck non è ancora da 60.</p>
    {/if}
    <table>
      <caption class="visually-hidden">Probabilità della mano iniziale di {HAND_SIZE} carte</caption>
      <tbody>
        <tr><th scope="row">Mulligan (nessun Pokémon Base)</th><td class="num" class:warn={hand.mulligan > 0.25}>{pct(hand.mulligan)}</td></tr>
        <tr><th scope="row">Esattamente 1 Pokémon Base</th><td class="num">{pct(hand.exactlyOne)}</td></tr>
        <tr><th scope="row">2 o più Pokémon Base</th><td class="num">{pct(hand.twoOrMore)}</td></tr>
      </tbody>
    </table>

    {#if hand.starters.length}
      <table class="starters">
        <caption class="visually-hidden">Probabilità di iniziare con ogni Pokémon Base</caption>
        <thead>
          <tr><th scope="col">Pokémon Base</th><th scope="col">Può iniziare</th><th scope="col">Inizia per forza</th></tr>
        </thead>
        <tbody>
          {#each hand.starters as s (s.cardId)}
            <tr>
              <th scope="row"><a href={hrefFor('card', { lang: 'en', id: s.cardId })}>{s.name}</a></th>
              <td class="num">{pct(s.possible)}</td>
              <td class="num">{pct(s.forced)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="note">
        Dopo un eventuale mulligan. “Inizia per forza” = è l’unico Pokémon Base in mano, quindi diventa il Pokémon attivo.
      </p>
    {/if}
  </section>
{/if}

<style>
  .section {
    margin: 22px 20px 8px;
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .breakdown {
    padding: 0 16px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .col {
    padding: 12px;
    border-radius: 20px;
    background: var(--surface);
    min-width: 0;
  }

  h3 {
    margin: 0 0 8px;
    display: flex;
    justify-content: space-between;
    gap: 4px;
    font-size: 13px;
    font-weight: 700;
  }

  h3 .num {
    font-family: var(--font-display);
    font-size: 18px;
  }

  dl {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  dl div {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    font-size: 12px;
    color: var(--muted);
  }

  dl div.zero {
    opacity: 0.6;
  }

  dt {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  dd {
    margin: 0;
    color: var(--text);
    font-weight: 700;
  }

  .odds {
    margin: 0 16px;
    padding: 6px 16px 14px;
    border-radius: var(--r-section);
    background: var(--surface);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th,
  td {
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
    text-align: left;
    font-weight: 400;
  }

  td {
    text-align: right;
    font-weight: 700;
    white-space: nowrap;
  }

  td.warn {
    color: var(--danger);
  }

  .starters {
    margin-top: 10px;
  }

  .starters thead th {
    font-size: 12px;
    color: var(--muted);
    font-weight: 700;
  }

  .starters thead th + th {
    text-align: right;
  }

  .starters td {
    font-weight: 500;
    padding-left: 8px;
  }

  .starters a {
    color: var(--text);
    text-decoration: none;
  }

  .note {
    margin: 10px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
</style>
