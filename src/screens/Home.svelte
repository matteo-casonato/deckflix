<script>
  // @ts-check
  // Home (docs/mockups/Home.html): value with its 30-day trend, shortcuts, featured deck,
  // card of the day, price movers, wishes getting cheaper, recent additions, set in progress.
  import { liveQuery } from 'dexie';
  import { FlashIcon, KeyboardIcon, ScanIcon, Search01Icon } from '@hugeicons/core-free-icons';
  import { db } from '../lib/db.js';
  import { account } from '../lib/stores/account.svelte.js';
  import { settings } from '../lib/stores/settings.svelte.js';
  import { liveCards, prefetchCards, setsMap } from '../lib/data/catalog.js';
  import { isConfigured } from '../lib/sync/sync.js';
  import { REMINDER_SNOOZE_MS, showSignInReminder } from '../lib/domain/backup.js';
  import { cardImage } from '../lib/api/tcgdex.js';
  import { collectionValue, dayKey, periodChange } from '../lib/domain/value.js';
  import { ownedTiles } from '../lib/domain/albums.js';
  import { cardOfTheDay, priceMovers, setInProgress } from '../lib/domain/home.js';
  import { euro, setIdOf } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import Icon from '../lib/ui/Icon.svelte';
  import EmptyState from '../lib/ui/EmptyState.svelte';
  import Sparkline from './home/Sparkline.svelte';
  import CardStrip from './home/CardStrip.svelte';
  import FeaturedDeck from './home/FeaturedDeck.svelte';

  const entries = liveQuery(() => db.collection.toArray());
  const wishlist = liveQuery(() => db.wishlist.toArray());
  const ownedIds = $derived([...new Set(($entries ?? []).map((e) => e.cardId))].sort());
  const wishIds = $derived(($wishlist ?? []).map((w) => w.cardId).sort());
  const ids = $derived([...new Set([...ownedIds, ...wishIds])]);
  const cards = $derived(liveCards(ids, settings.cardLang));
  $effect(() => {
    if (ids.length) prefetchCards(ids, settings.cardLang);
  });

  /** @type {Map<string, any>} */
  let sets = $state(new Map());
  $effect(() => {
    setsMap(settings.cardLang).then((m) => (sets = m));
  });

  // Value from the cached prices (App records the daily snapshot).
  const value = $derived($entries && $cards ? collectionValue($entries, $cards) : null);
  const snapshots = liveQuery(() => db.priceSnapshots.toArray());
  const trend = $derived(periodChange($snapshots ?? [], 30, Date.now()));

  const tiles = $derived($entries && $cards ? ownedTiles($entries, $cards) : []);
  const today = dayKey(Date.now());
  const spotlight = $derived($cards ? cardOfTheDay(tiles, $cards, today) : null);
  const movers = $derived($cards ? priceMovers(tiles, $cards) : { up: [], down: [] });
  const wishDrops = $derived($cards ? priceMovers(wishIds.map((cardId) => ({ cardId })), $cards, { minPrice: 0.2 }).down : []);
  const progress = $derived($entries ? setInProgress($entries, sets) : null);
  const recent = $derived([...($entries ?? [])].sort((a, b) => b.updatedAt - a.updatedAt));

  const local = liveQuery(async () => {
    const [exp, snooze] = await db.settings.bulkGet(['lastExportAt', 'signInReminderUntil']);
    return { lastExportAt: exp?.value ?? null, snoozedUntil: snooze?.value ?? null };
  });
  const reminder = $derived(
    !!$local &&
      showSignInReminder({
        signedIn: !!account.user,
        configured: isConfigured(),
        copies: $entries?.length ?? 0,
        ...$local,
        now: Date.now(),
      }),
  );
  const snooze = () => db.settings.put({ key: 'signInReminderUntil', value: Date.now() + REMINDER_SNOOZE_MS });

  /** @param {string} cardId */
  const card = (cardId) => $cards?.get(cardId);
  /** @param {string} cardId */
  const href = (cardId) => hrefFor('card', { lang: settings.cardLang, id: cardId });
  const pct = (/** @type {number} */ p) => `${p >= 0 ? '+' : '−'}${Math.abs(Math.round(p))}%`;

  /** @param {{ cardId: string, pct: number, price: number }[]} list */
  const moverItems = (list) =>
    list.map((m) => ({
      key: m.cardId,
      href: href(m.cardId),
      image: cardImage(card(m.cardId)),
      title: card(m.cardId)?.name ?? m.cardId,
      sub: euro(m.price),
      tag: pct(m.pct),
      tone: /** @type {'up' | 'down'} */ (m.pct > 0 ? 'up' : 'down'),
    }));

  const recentItems = $derived.by(() => {
    const seen = new Set();
    return recent
      .filter((e) => !seen.has(e.cardId) && seen.add(e.cardId))
      .slice(0, 12)
      .map((e) => ({
        key: e.cardId,
        href: href(e.cardId),
        image: cardImage(card(e.cardId)),
        title: card(e.cardId)?.name ?? e.cardId,
        sub: card(e.cardId)?.localId ?? e.cardId.slice(setIdOf(e.cardId).length + 1),
        tag: null,
        tone: null,
      }));
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
</script>

<header class="top">
  <h1 class="logo">Deck<span>flix</span></h1>
  {#if account.user}<span class="hello">{greeting}, {account.user.givenName || account.user.name}</span>{/if}
</header>

{#if $entries && $entries.length === 0}
  <EmptyState title="Inizia la tua collezione" text="Inquadra una carta e l’app la riconosce, oppure scrivi il numero stampato in basso.">
    <a class="btn primary" href={hrefFor('scan')}>Scansiona la prima carta</a>
    <a class="btn" href={hrefFor('quick')}>Inserimento rapido</a>
  </EmptyState>
  <FeaturedDeck />
{:else if $entries}
  {#if reminder}
    <section class="remind card" aria-label="Backup">
      <p><strong>Accedi con Google per non perdere la collezione</strong><br />Oggi è salvata solo su questo telefono.</p>
      <div class="row">
        <button class="btn" onclick={snooze}>Più tardi</button>
        <button class="btn light" onclick={() => (account.firstRunDone = false)}>Accedi</button>
      </div>
    </section>
  {/if}

  <a class="value card" href={hrefFor('collection', {}, { view: 'stats' })}>
    <span class="col">
      <span class="muted">La tua collezione</span>
      <strong class="num">{value ? euro(value.total) : '…'}</strong>
      <span class="meta num">
        {#if trend.pct != null}
          <span class:up={trend.pct > 0} class:down={trend.pct < 0}>{trend.pct >= 0 ? '+' : '−'}{Math.abs(trend.pct).toFixed(1).replace('.', ',')}%</span> · 30 gg ·
        {/if}
        {tiles.length} {tiles.length === 1 ? 'carta' : 'carte'} · Statistiche ›
      </span>
    </span>
    <Sparkline points={trend.points} />
  </a>

  <nav class="shortcuts" aria-label="Azioni rapide">
    <a href={hrefFor('scan')}><span class="ic"><Icon icon={ScanIcon} /></span>Scansiona</a>
    <a href={hrefFor('scan', {}, { mode: 'burst' })}><span class="ic"><Icon icon={FlashIcon} /></span>Raffica</a>
    <a href={hrefFor('quick')}><span class="ic"><Icon icon={KeyboardIcon} /></span>Per numero</a>
    <a href={hrefFor('search')}><span class="ic"><Icon icon={Search01Icon} /></span>Cerca</a>
  </nav>

  <FeaturedDeck />

  {#if spotlight}
    {@const c = card(spotlight.cardId)}
    <a class="spot card" href={href(spotlight.cardId)}>
      <img src={cardImage(c, 'high')} alt="" loading="lazy" />
      <span class="col">
        <span class="tag">Carta del giorno</span>
        <strong>{c?.name}</strong>
        <span class="muted num">{sets.get(setIdOf(spotlight.cardId))?.name ?? ''} · {c?.localId}</span>
        {#if c?.illustrator}<span class="muted small">Illustrata da {c.illustrator}</span>{/if}
        {#if spotlight.unit > 0}<span class="price num">{euro(spotlight.unit)}</span>{/if}
        {#if spotlight.qty > 1}<span class="muted small num">Ne hai {spotlight.qty}</span>{/if}
      </span>
    </a>
  {/if}

  {#if movers.up.length}
    <div class="section-head"><h2>In salita</h2><span class="hint">7 giorni su 30 · Cardmarket</span></div>
    <CardStrip label="Carte in salita" items={moverItems(movers.up)} />
  {/if}
  {#if movers.down.length}
    <div class="section-head"><h2>In discesa</h2></div>
    <CardStrip label="Carte in discesa" items={moverItems(movers.down)} />
  {/if}
  {#if wishDrops.length}
    <div class="section-head">
      <h2>Desideri in calo</h2>
      <a href={hrefFor('collection', {}, { tab: 'wishlist', sort: 'down' })}>Tutti</a>
    </div>
    <CardStrip label="Desideri in calo" items={moverItems(wishDrops)} />
  {/if}

  <div class="section-head">
    <h2>Aggiunte di recente</h2>
    <a href={hrefFor('collection', {}, { view: 'recent' })}>Tutte</a>
  </div>
  <CardStrip label="Aggiunte di recente" items={recentItems} />

  {#if progress}
    {@const set = sets.get(progress.setId)}
    <a class="progress card" href={hrefFor('set', { id: progress.setId }, { show: 'missing' })}>
      <span class="col grow">
        <span class="muted small">Edizione in corso</span>
        <strong>{set?.name ?? progress.setId}</strong>
        <span class="muted num">{progress.owned} di {progress.total} · ne mancano {progress.missing}</span>
        <span class="bar" aria-hidden="true"><span style:width="{progress.percent}%"></span></span>
      </span>
      <span class="pctbig num">{progress.percent}%</span>
    </a>
  {/if}
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
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .grow {
    flex: 1;
  }

  .value strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 32px;
    line-height: 1.1;
  }

  .muted {
    font-size: 13px;
    color: var(--muted);
  }

  .small {
    font-size: 12px;
  }

  .meta {
    font-size: 12px;
    color: var(--muted);
  }

  .meta .up {
    color: var(--success);
    font-weight: 700;
  }

  .meta .down {
    color: var(--danger);
    font-weight: 700;
  }

  .shortcuts {
    margin: 14px 16px 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .shortcuts a {
    min-height: 76px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    text-decoration: none;
  }

  .ic {
    width: 52px;
    height: 52px;
    border-radius: 20px;
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .shortcuts a:first-child .ic {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }

  .spot {
    margin: 14px 16px 0;
    padding: 14px;
    border-radius: var(--r-section);
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface)), var(--surface) 55%);
    border: 1px solid var(--line);
    display: flex;
    gap: 16px;
    align-items: center;
    color: var(--text);
    text-decoration: none;
  }

  .spot img {
    width: 42%;
    max-width: 170px;
    aspect-ratio: 63 / 88;
    border-radius: 12px;
    object-fit: cover;
    box-shadow: 0 14px 28px rgb(0 0 0 / 0.45);
    transform: rotate(-3deg);
  }

  .spot strong {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 800;
    line-height: 1.15;
  }

  .tag {
    align-self: flex-start;
    margin-bottom: 4px;
    padding: 3px 10px;
    border-radius: 10px;
    background: var(--bg);
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
  }

  .price {
    margin-top: 6px;
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 800;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 22px 20px 10px;
    gap: 12px;
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

  .hint {
    font-size: 11px;
    color: var(--muted);
  }

  .progress {
    margin: 22px 16px 24px;
    padding: 16px 18px;
    border-radius: var(--r-card);
    background: var(--surface);
    display: flex;
    align-items: center;
    gap: 14px;
    color: var(--text);
    text-decoration: none;
  }

  .progress strong {
    font-size: 16px;
  }

  .bar {
    margin-top: 8px;
    height: 8px;
    border-radius: 4px;
    background: var(--surface-2);
    overflow: hidden;
    display: block;
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 4px;
  }

  .pctbig {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 800;
  }
</style>
