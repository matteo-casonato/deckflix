<script>
  // @ts-check
  // Tournament deck list for judges, laid out like the RK9 Labs sheet: player, Player ID,
  // birth year, age division, format, then Pokémon (set, number, regulation mark), Trainers
  // and Energy. Print or save as PDF (browser print), or share the text list.
  import { liveQuery } from 'dexie';
  import Logo from '../lib/ui/Logo.svelte';
  import Picker from '../lib/ui/Picker.svelte';
  import { db } from '../lib/db.js';
  import { deckRows, exportDecklist, ownedMap } from '../lib/data/decks.js';
  import { setDetails } from '../lib/data/catalog.js';
  import { tournamentSheet } from '../lib/domain/deck.js';
  import { ageDivision } from '../lib/domain/players.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { settings } from '../lib/stores/settings.svelte.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';

  /** @type {{ id: string }} */
  let { id } = $props();

  const deck = liveQuery(() => db.decks.get(id));
  /** @type {ReturnType<typeof tournamentSheet> | null} */
  let sheet = $state(null);
  $effect(() => {
    const d = $deck;
    if (!d) return;
    ownedMap()
      .then((own) => deckRows(d, own))
      .then(async (rows) => {
        const sets = await setDetails([...new Set(rows.map((r) => r.card?.set?.id).filter(Boolean))], 'en');
        sheet = tournamentSheet(rows, sets);
      });
  });

  let playerKey = $state(settings.players[0]?.id ?? '');
  const player = $derived(settings.players.find((p) => p.id === playerKey) ?? null);
  const division = $derived(player ? ageDivision(player.birthYear, Date.now()) : null);
  const today = new Date().toLocaleDateString('it-IT');

  async function share() {
    if (!$deck) return;
    const head = player
      ? `${player.name} · ID ${player.playerId} · ${player.birthYear}${division ? ` (${division})` : ''}\nFormato: Standard\n\n`
      : '';
    const text = head + (await exportDecklist($deck));
    if (navigator.share) {
      try {
        await navigator.share({ title: `${$deck.name} · lista per il torneo`, text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('Lista copiata negli appunti');
    } catch {
      showToast('Non riesco a copiare la lista');
    }
  }

  const check = (/** @type {boolean} */ on) => (on ? '☒' : '☐');
</script>

<div class="screen-only">
  <BackHeader title="Stampa" big fallback={hrefFor('deckDetail', { id })} />
  <div class="pad">
    {#if settings.players.length}
      <label class="field">
        <span>Giocatore</span>
        <Picker
          title="Giocatore"
          value={playerKey}
          options={[...settings.players.map((p) => ({ value: p.id, label: p.name, sub: `ID ${p.playerId}`, icon: p.avatar ?? null })), { value: '', label: 'Nessuno (da compilare a mano)' }]}
          onchange={(k) => (playerKey = k)}
        />
      </label>
    {:else}
      <p class="muted">Aggiungi il tuo ID giocatore in <a href={hrefFor('deck', {}, { tab: 'players' })}>Play! › Giocatori</a> per compilare il foglio da solo.</p>
    {/if}
    <div class="actions">
      <button class="btn primary" disabled={!sheet} onclick={() => window.print()}>Stampa o salva PDF</button>
      <button class="btn" disabled={!$deck} onclick={share}>Condividi</button>
    </div>
    <p class="muted">
      “Stampa o salva PDF” apre la stampa del telefono: scegli “Salva come PDF” e poi mandalo via WhatsApp o email.
      “Condividi” invia la lista come testo.
    </p>
  </div>
</div>

{#if sheet}
  <article class="sheet" aria-label="Anteprima del foglio">
    <header>
      <Logo size={20} />
      <h1>Pokémon TCG · Lista del mazzo</h1>
      <span class="date">{today}</span>
    </header>
    <dl class="player">
      <div class="wide"><dt>Nome giocatore</dt><dd>{player?.name ?? ''}</dd></div>
      <div><dt>ID giocatore</dt><dd class="num">{player?.playerId ?? ''}</dd></div>
      <div><dt>Anno di nascita</dt><dd class="num">{player?.birthYear ?? ''}</dd></div>
      <div class="wide">
        <dt>Divisione</dt>
        <dd>{check(division === 'Junior')} Junior &nbsp; {check(division === 'Senior')} Senior &nbsp; {check(division === 'Master')} Master</dd>
      </div>
      <div class="wide"><dt>Formato</dt><dd>{check(true)} Standard &nbsp; {check(false)} Expanded</dd></div>
    </dl>

    <table>
      <caption>Pokémon <span class="num">({sheet.totals.pokemon})</span></caption>
      <thead><tr><th class="q">Qtà</th><th>Nome</th><th>Set</th><th>N.</th><th>Reg.</th></tr></thead>
      <tbody>
        {#each sheet.pokemon as r, i (i)}
          <tr><td class="q num">{r.qty}</td><td>{r.name}</td><td>{r.set}</td><td class="num">{r.number}</td><td>{r.reg}</td></tr>
        {/each}
      </tbody>
    </table>

    <div class="two">
      <table>
        <caption>Allenatori <span class="num">({sheet.totals.trainer})</span></caption>
        <thead><tr><th class="q">Qtà</th><th>Nome</th></tr></thead>
        <tbody>
          {#each sheet.trainer as r (r.name)}<tr><td class="q num">{r.qty}</td><td>{r.name}</td></tr>{/each}
        </tbody>
      </table>
      <table>
        <caption>Energie <span class="num">({sheet.totals.energy})</span></caption>
        <thead><tr><th class="q">Qtà</th><th>Nome</th></tr></thead>
        <tbody>
          {#each sheet.energy as r (r.name)}<tr><td class="q num">{r.qty}</td><td>{r.name}</td></tr>{/each}
        </tbody>
      </table>
    </div>

    <footer>
      <strong>Totale carte: <span class="num">{sheet.totals.all}</span></strong>
    </footer>
  </article>
{:else}
  <p class="pad muted" aria-busy="true">Preparo il foglio…</p>
{/if}

<style>
  .pad {
    padding: 8px 16px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .muted {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .muted a {
    color: var(--accent);
  }

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 14px;
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  /* The sheet: black on white like paper, also on screen. */
  .sheet {
    margin: 16px;
    padding: 18px 16px;
    border-radius: 12px;
    background: #fff;
    color: #000;
    font-family: var(--font-body);
    font-size: 11px;
    line-height: 1.35;
  }

  .sheet header {
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 2px solid #000;
    padding-bottom: 6px;
  }

  /* Deckflix logo at the top: black name, "flix" in a darker yellow that prints well. */
  .sheet header :global(.logo) {
    color: #000;
  }

  .sheet header :global(.logo .flix) {
    color: #c99400;
  }

  .sheet h1 {
    flex: 1;
    font-size: 15px;
    color: #000;
  }

  .player {
    margin: 10px 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 12px;
  }

  .player div {
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
  }

  .player .wide {
    grid-column: 1 / -1;
  }

  .player dt {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #444;
  }

  .player dd {
    margin: 0;
    min-height: 15px;
    font-weight: 700;
  }

  table {
    width: 100%;
    margin-top: 10px;
    border-collapse: collapse;
  }

  caption {
    text-align: left;
    font-weight: 800;
    font-size: 12px;
    padding-bottom: 3px;
  }

  th,
  td {
    border: 1px solid #000;
    padding: 2px 5px;
    text-align: left;
    font-weight: 400;
  }

  th {
    background: #e8e8e8;
    font-weight: 700;
    font-size: 10px;
  }

  .q {
    width: 34px;
    text-align: center;
  }

  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: start;
  }

  .sheet footer {
    margin-top: 14px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  @media print {
    @page {
      size: A4;
      margin: 12mm;
    }

    .screen-only {
      display: none;
    }

    .sheet {
      margin: 0;
      padding: 0;
      border-radius: 0;
      font-size: 11pt;
    }
  }
</style>
