// @ts-check
// Local database (IndexedDB via Dexie). Schema in docs/SPEC.md § 3.
import Dexie from 'dexie';

/**
 * @typedef {{ key: string, cardId: string, setId: string, lang: string, variant: string, qty: number, condition?: string, purchasePrice?: number, addedAt: number, updatedAt: number }} CollectionEntry
 * @typedef {{ cardId: string, lang?: string, variant?: string, priority?: number, addedAt: number }} WishlistEntry
 * @typedef {{ id: string, name: string, format: 'standard', cards: { cardId: string, qty: number }[], cover?: string | null, createdAt: number, updatedAt: number }} Deck
 * @typedef {{ id: string, name: string, cards: { cardId: string, addedAt: number }[], createdAt: number, updatedAt: number }} Album
 * @typedef {{ date: string, totalValue: number }} PriceSnapshot
 * @typedef {{ cardId: string, date: string, price: number }} CardPrice
 * @typedef {{ lang: string, cardId: string, data: any, fetchedAt: number }} CachedCard
 * @typedef {{ path: string, data: any, fetchedAt: number }} CachedResponse
 * @typedef {{ id?: number, changedAt: number }} SyncFlag
 * @typedef {{ key: string, value: any }} Setting
 */

export class DeckflixDB extends Dexie {
  constructor() {
    super('deckflix');
    this.version(1).stores({
      collection: 'key, setId, cardId, updatedAt',
      wishlist: 'cardId',
      decks: 'id, updatedAt',
      priceSnapshots: 'date',
      cardCache: '[lang+cardId]',
      // Other TCGdex responses (sets, series, searches), keyed by API path.
      apiCache: 'path, fetchedAt',
      syncQueue: '++id',
      settings: 'key',
    });
    // v2: index changedAt, to clear only the changes included in a backup.
    this.version(2).stores({ syncQueue: '++id, changedAt' });
    // v3: manual albums ("Raccolte").
    this.version(3).stores({ albums: 'id, updatedAt' });
    // v4: daily Cardmarket price of owned and wished cards (TCGdex has no history).
    this.version(4).stores({ cardPrices: '[cardId+date], cardId, date' });
    // v5: copies are grouped by condition too; Near Mint keeps the old key. Entries that got a
    // condition on the old key move to the key with the condition.
    this.version(5)
      .stores({})
      .upgrade(async (tx) => {
        const table = tx.table('collection');
        const moved = (await table.toArray()).filter((e) => e.condition && e.condition !== 'NM' && e.key.split('|').length === 3);
        for (const e of moved) {
          await table.delete(e.key);
          await table.put({ ...e, key: `${e.key}|${e.condition}` });
        }
      });
    /** @type {Dexie.Table<CollectionEntry, string>} */
    this.collection = this.table('collection');
    /** @type {Dexie.Table<WishlistEntry, string>} */
    this.wishlist = this.table('wishlist');
    /** @type {Dexie.Table<Deck, string>} */
    this.decks = this.table('decks');
    /** @type {Dexie.Table<Album, string>} */
    this.albums = this.table('albums');
    /** @type {Dexie.Table<CardPrice, [string, string]>} */
    this.cardPrices = this.table('cardPrices');
    /** @type {Dexie.Table<PriceSnapshot, string>} */
    this.priceSnapshots = this.table('priceSnapshots');
    /** @type {Dexie.Table<CachedCard, [string, string]>} */
    this.cardCache = this.table('cardCache');
    /** @type {Dexie.Table<CachedResponse, string>} */
    this.apiCache = this.table('apiCache');
    /** @type {Dexie.Table<SyncFlag, number>} */
    this.syncQueue = this.table('syncQueue');
    /** @type {Dexie.Table<Setting, string>} */
    this.settings = this.table('settings');
  }
}

export const db = new DeckflixDB();
