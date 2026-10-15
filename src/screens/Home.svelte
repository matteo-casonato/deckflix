<script>
  // @ts-check
  // Home (docs/mockups/Home.html): collection value with the 30-day change, last addition,
  // recent additions.
  import { liveQuery } from 'dexie';
  import { db } from '../lib/db.js';
  import { account } from '../lib/stores/account.svelte.js';
  import { settings } from '../lib/stores/settings.svelte.js';
  import { cachedCards, prefetchCards } from '../lib/data/catalog.js';
  import { valuedCollection } from '../lib/data/value.js';
  import { isConfigured } from '../lib/sync/sync.js';
  import { REMINDER_SNOOZE_MS, showSignInReminder } from '../lib/domain/backup.js';
  import { cardImage } from '../lib/api/tcgdex.js';
  import { periodChange } from '../lib/domain/value.js';
  import { euro, setIdOf, variantBadge } from '../lib/domain/cards.js';
  import Icon from '../lib/ui/Icon.svelte';
  import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
  import { hrefFor } from '../lib/domain/routes.js';
  import EmptyState from '../lib/ui/EmptyState.svelte';
  import CardTile from '../lib/ui/CardTile.svelte';

  const recent = liveQuery(() => db.collection.orderBy('updatedAt').reverse().limit(9).toArray());
  const ids = $derived([...new Set(($recent ?? []).map((e) => e.cardId))]);
  const cards = $derived(liveQuery(() => cachedCards(ids, settings.cardLang)));
  $effect(() => {
    if (ids.length) prefetchCards(ids, settings.cardLang);
  });

  // Value from the cached prices (no download here: App records the daily snapshot).
  /** @type {number | null} */
  let total = $state(null);
  $effect(() => {
    void $recent;
    void settings.cardLang;
    valuedCollection().then((d) => (total = d.value.total));
  });
  const snapshots = liveQuery(() => db.priceSnapshots.toArray());
  const pct = $derived(periodChange($snapshots ?? [], 30, Date.now()).pct);

  const local = liveQuery(async () => {
    const [exp, snooze] = await db.settings.bulkGet(['lastExportAt', 'signInReminderUntil']);
    return { lastExportAt: exp?.value ?? null, snoozedUntil: snooze?.value ?? null };
  });
  const reminder = $derived(
    !!$local &&
      showSignInReminder({
        signedIn: !!account.user,
        configured: isConfigured(),
        copies: $recent?.length ?? 0,
        ...$local,
        now: Date.now(),
      }),
  );
  const snooze = () => db.settings.put({ key: 'signInReminderUntil', value: Date.now() + REMINDER_SNOOZE_MS });

  const last = $derived($recent?.[0]);
  /** @param {number} t */
  function ago(t) {
    const min = Math.round((Date.now() - t) / 60_000);
    if (min < 1) return 'adesso';
    if (min < 60) return `${min} min fa`;
    if (min < 60 * 24) return `${Math.round(min / 60)} h fa`;
    const days = Math.round(min / 1440);
    return days === 1 ? 'ieri' : `${days} giorni fa`;
  }
</script>

<header class="top">
  <h1 class="logo">Deck<span>flix</span></h1>
  {#if account.user}<span class="hello">Ciao, {account.user.givenName || account.user.name}</span>{/if}
</header>

{#if $recent && $recent.length === 0}
  <EmptyState title="Nessuna carta ancora" text="Scansiona le tue carte o inseriscile per numero.">
    <a class="btn light" href={hrefFor('scan')}>Scansiona</a>
    <a class="btn" href={hrefFor('quick')}>Inserimento rapido</a>
  </EmptyState>
{:else if $recent}
  {#if reminder}
    <section class="remind card" aria-label="Backup">
      <p><strong>Accedi con Google per non perdere la collezione</strong><br />Oggi è salvata solo su questo telefono.</p>
      <div class="row">
        <button class="btn" onclick={snooze}>Più tardi</button>
        <button class="btn light" onclick={() => (account.firstRunDone = false)}>Accedi</button>
      </div>
    </section>
  {/if}
  <section class="value card">
    <a class="head" href={hrefFor('collection', {}, { view: 'stats' })}>
      <span class="col">
        <span class="muted">La tua collezione</span>
        <strong class="num">{total == null ? '…' : euro(total)}</strong>
      </span>
      <span class="col end">
        {#if pct != null}
          <span class="pct num" class:up={pct > 0} class:down={pct < 0}>
            {pct >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(1).replace('.', ',')}% · 30 gg
          </span>
        {/if}
        <span class="muted">Statistiche ›</span>
      </span>
    </a>
    {#if last}
      {@const card = $cards?.get(last.cardId)}
      <a class="last card" href={hrefFor('card', { lang: settings.cardLang, id: last.cardId })}>
        <span class="thumb">
          {#if cardImage(card)}<img src={cardImage(card)} alt="" loading="lazy" />{/if}
        </span>
        <span class="col grow">
          <span class="muted small">Ultima aggiunta · {ago(last.updatedAt)}</span>
          <strong>{card?.name ?? last.cardId} · {card?.localId ?? ''}</strong>
        </span>
        <Icon icon={ArrowRight01Icon} size={18} />
      </a>
    {/if}
  </section>

  <div class="section-head">
    <h2>Aggiunte di recente</h2>
    <a href={hrefFor('collection', {}, { view: 'recent' })}>Vedi tutte</a>
  </div>
  <div class="grid3">
    {#each $recent as e (e.key)}
      {@const card = $cards?.get(e.cardId)}
      <CardTile
        name={card?.name ?? e.cardId}
        localId={card?.localId ?? e.cardId.slice(setIdOf(e.cardId).length + 1)}
        image={card?.image ?? null}
        qty={e.qty}
        badge={variantBadge(e.variant)}
        href={hrefFor('card', { lang: settings.cardLang, id: e.cardId })}
      />
    {/each}
  </div>
  <div class="actions">
    <a class="btn" href={hrefFor('quick')}>Inserimento rapido</a>
    <a class="btn" href={hrefFor('search')}>Cerca una carta</a>
  </div>
{/if}

<style>
  .top {
    padding: 10px 20px 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo {
    font-size: 28px;
    letter-spacing: -0.5px;
  }

  .logo span {
    color: var(--accent);
  }

  .hello {
    font-size: 13px;
    color: var(--muted);
  }

  .remind {
    margin: 10px 16px 0;
    padding: 14px 16px;
    border-radius: var(--r-card);
    background: var(--surface-2);
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
    color: var(--muted);
  }

  .remind p {
    margin: 0;
  }

  .remind strong {
    color: var(--text);
    font-size: 14px;
  }

  .remind .row {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .value {
    margin: 14px 16px 0;
    padding: 18px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .value a {
    color: var(--text);
    text-decoration: none;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .col.end {
    align-items: flex-end;
  }

  .grow {
    flex: 1;
  }

  .head strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 30px;
  }

  .muted {
    font-size: 13px;
    color: var(--muted);
  }

  .small {
    font-size: 12px;
  }

  .pct {
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }

  .pct.up {
    color: var(--success);
  }

  .pct.down {
    color: var(--danger);
  }

  .last {
    padding: 10px;
    border-radius: 26px;
    background: var(--bg);
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--muted);
  }

  .last strong {
    font-size: 15px;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .thumb {
    width: 36px;
    height: 50px;
    flex-shrink: 0;
    border-radius: 6px;
    overflow: hidden;
    background: var(--surface-2);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 22px 20px 10px;
  }

  .section-head h2 {
    font-weight: 600;
    font-size: 19px;
  }

  .section-head a {
    min-height: 48px;
    display: flex;
    align-items: center;
    color: var(--muted);
    font-size: 14px;
  }

  .grid3 {
    padding: 0 16px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 10px;
  }

  .actions {
    padding: 16px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
</style>
