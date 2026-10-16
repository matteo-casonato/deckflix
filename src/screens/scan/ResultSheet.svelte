<script>
  // @ts-check
  // Single mode result (SPEC § 4.1.7): language, print, quantity ("Ne hai già 1 → diventano 2"),
  // Riprova / Aggiungi. Several candidates: the user picks. Not read: Riprova / Inserimento rapido.
  import { liveQuery } from 'dexie';
  import Picker from '../../lib/ui/Picker.svelte';
  import { langOptions } from '../../lib/ui/options.js';
  import { db } from '../../lib/db.js';
  import { euro, thumbUrl } from '../../lib/domain/cards.js';
  import { hrefFor } from '../../lib/domain/routes.js';
  import { printsFor } from '../../lib/scan/pipeline.js';
  import { learnStamp } from '../../lib/scan/stamp.js';
  import { showToast } from '../../lib/stores/toast.svelte.js';

  /**
   * @type {{
   *   rec: import('../../lib/scan/pipeline.js').Recognition,
   *   onadd: (s: { cardId: string, lang: string, variant: string, name: string, localId: string }) => void,
   *   onretry: () => void,
   * }}
   */
  let { rec, onadd, onretry } = $props();

  let chosen = $state(0);
  let lang = $state(rec.lang);
  const candidate = $derived(rec.candidates[chosen] ?? null);

  /** @type {Awaited<ReturnType<typeof printsFor>> | null} */
  let prints = $state(null);
  let variant = $state('normal');
  $effect(() => {
    const c = candidate;
    prints = null;
    if (!c) return;
    printsFor(c, rec).then((p) => {
      if (candidate !== c) return;
      prints = p;
      variant = p.preselect;
    });
  });

  const owned = $derived(
    liveQuery(async () =>
      candidate ? ((await db.collection.where('cardId').equals(candidate.id).toArray()).find((e) => e.lang === lang && e.variant === variant)?.qty ?? 0) : 0,
    ),
  );

  function teachStamp() {
    if (!rec.stamp) return;
    learnStamp(rec.stamp);
    showToast('Modello del timbro Play! salvato su questo telefono');
  }
</script>

<div class="sheet" role="dialog" aria-modal="true" aria-label="Risultato della scansione">
  <span class="grip" aria-hidden="true"></span>
  {#if rec.status === 'unread'}
    <h2>Non riesco a leggere il numero</h2>
    <p class="muted">Tieni la carta ferma dentro la cornice, con buona luce e senza riflessi sul numero in basso.</p>
    <div class="actions">
      <a class="btn" href={hrefFor('quick')}>Inserimento rapido</a>
      <button class="btn primary" onclick={onretry}>Riprova</button>
    </div>
  {:else if rec.status === 'nomatch'}
    <h2>Numero {rec.reading.num ? `${rec.reading.num.number}/${rec.reading.num.total}` : (rec.reading.special?.code ?? '')} non trovato</h2>
    <p class="muted">Nessuna edizione con questo totale contiene la carta. Prova di nuovo o inseriscila per numero.</p>
    <div class="actions">
      <a class="btn" href={hrefFor('quick')}>Inserimento rapido</a>
      <button class="btn primary" onclick={onretry}>Riprova</button>
    </div>
  {:else if candidate}
    <div class="card-row">
      {#if candidate.image}
        <img src={thumbUrl(candidate)} alt="" onerror={(e) => (e.currentTarget.style.visibility = 'hidden')} />
      {:else}
        <span class="ph"></span>
      {/if}
      <span class="info">
        <strong>{candidate.name}</strong>
        <span class="muted num">{candidate.reprint ? 'Ristampa · ' : ''}{candidate.setName} · {candidate.localId}/{candidate.official || '?'}</span>
        {#if rec.uncertain}<span class="badge warn">Da verificare</span>{/if}
        {#if rec.corrected}<span class="muted small">Numero letto {rec.reading.num?.number}/{rec.reading.num?.total}, corretto in {rec.corrected}</span>{/if}
      </span>
    </div>

    {#if rec.candidates.length > 1}
      <div class="choices" role="radiogroup" aria-label="Carta">
        {#each rec.candidates.slice(0, 5) as c, i (c.id)}
          <button class="chip" role="radio" aria-checked={i === chosen} aria-pressed={i === chosen} onclick={() => (chosen = i)}>
            {c.name} · {c.setCode ?? c.setName}
          </button>
        {/each}
      </div>
    {/if}

    <label class="line">
      <span>Lingua</span>
      <Picker title="Lingua" value={lang} options={langOptions()} onchange={(l) => (lang = l)} />
    </label>

    <div class="prints" role="radiogroup" aria-label="Variante">
      {#if !prints}
        <span class="muted small">Carico le varianti…</span>
      {:else}
        {#each prints.options as v (v.key)}
          <button
            class="chip"
            class:hint={prints.highlighted.includes(v.key)}
            role="radio"
            aria-checked={variant === v.key}
            aria-pressed={variant === v.key}
            onclick={() => (variant = v.key)}
          >
            {prints.highlighted.includes(v.key) ? '★ ' : ''}{v.label}{v.price != null ? ` · ${euro(v.price)}` : ''}
          </button>
        {/each}
      {/if}
    </div>
    {#if rec.stamp && !rec.stamp.learned}
      <button class="link" onclick={teachStamp}>Ha il timbro Play!? Usala come modello del timbro</button>
    {/if}

    <p class="qty num">
      {$owned ? `Ne hai già ${$owned} → diventano ${$owned + 1}` : 'Non ce l’hai ancora'}
    </p>

    <div class="actions">
      <button class="btn" onclick={onretry}>Riprova</button>
      <button
        class="btn primary"
        disabled={!prints}
        onclick={() => onadd({ cardId: candidate.id, lang, variant, name: candidate.name, localId: candidate.localId })}
      >
        {$owned ? 'Aggiorna' : 'Aggiungi'}
      </button>
    </div>
  {/if}
</div>

<style>
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 25;
    max-width: 560px;
    margin-inline: auto;
    max-height: 78dvh;
    overflow-y: auto;
    padding: 10px 18px calc(18px + var(--safe-bottom));
    border-radius: var(--r-section) var(--r-section) 0 0;
    background: var(--surface);
    border-top: 1px solid var(--line-2);
    box-shadow: 0 -16px 40px rgb(0 0 0 / 0.5);
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: up var(--dur) var(--ease);
  }

  @keyframes up {
    from {
      transform: translateY(24px);
      opacity: 0;
    }
  }

  .grip {
    align-self: center;
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--line-2);
  }

  h2 {
    font-size: 20px;
  }

  .muted {
    color: var(--muted);
    margin: 0;
  }

  .small {
    font-size: 12px;
  }

  .card-row {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .card-row img,
  .ph {
    width: 84px;
    aspect-ratio: 63 / 88;
    border-radius: var(--r-cardimg);
    background: var(--surface-2);
    object-fit: cover;
    flex-shrink: 0;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .info strong {
    font-family: var(--font-display);
    font-size: 20px;
  }

  .badge {
    align-self: flex-start;
    height: 22px;
    padding: 0 8px;
    border-radius: 11px;
    font-size: 11px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
  }

  .badge.warn {
    background: color-mix(in srgb, var(--accent) 18%, var(--surface));
    color: var(--accent);
  }

  .choices,
  .prints {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip.hint {
    border-color: var(--accent);
  }

  .line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
  }

  .link {
    align-self: flex-start;
    min-height: 40px;
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 13px;
    text-decoration: underline;
    cursor: pointer;
  }

  .qty {
    margin: 0;
    font-weight: 700;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1.6fr;
    gap: 10px;
  }

  .actions .btn {
    min-height: 52px;
  }
</style>
