// @ts-check
// Run by the deploy workflow: the drawing fingerprint of every English card, written next to
// the built app as dist/fingerprints.json, so the scanner can recognise a card by its artwork
// when the number can't be read (SPEC § 4.1).
//
// Gentle with TCGdex: the previous index is read back from the published site and only cards
// not in it are downloaded, one thumbnail at a time with a pause between requests, for at most
// FINGERPRINT_MINUTES per run. The first full index takes a few runs; after that each run only
// adds the new sets. With FINGERPRINT_MINUTES=0 (pushes) it just republishes the previous index.
//
// Usage: node scripts/fingerprints.mjs [outDir]
//   FINGERPRINT_MINUTES (default 20, at most 300), FINGERPRINT_DELAY_MS (default 400),
//   FINGERPRINT_PREVIOUS (URL of the published index)
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fingerprint } from '../src/lib/domain/fingerprint.js';
import { decodePng } from './png.mjs';

const API = 'https://api.tcgdex.net/v2/en';
const PREVIOUS = process.env.FINGERPRINT_PREVIOUS ?? 'https://matteo-casonato.github.io/deckflix/fingerprints.json';
const MINUTES = Math.min(300, Number(process.env.FINGERPRINT_MINUTES ?? 20));
const DELAY_MS = Number(process.env.FINGERPRINT_DELAY_MS ?? 400);
const HEADERS = { 'User-Agent': 'Deckflix (personal PWA; slow artwork index, github.com/matteo-casonato/deckflix)' };
const out = resolve(process.argv[2] ?? 'dist', 'fingerprints.json');

const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

/** @param {string} url */
async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/** @type {Map<string, string>} */
const index = new Map();
try {
  const prev = await getJson(PREVIOUS);
  if (prev.v === 1) prev.ids.forEach((/** @type {string} */ id, /** @type {number} */ i) => index.set(id, prev.h[i]));
  console.log(`previous index: ${index.size} cards`);
} catch (err) {
  console.log(`no previous index (${err instanceof Error ? err.message : err})`);
}

const save = () => {
  const ids = [...index.keys()];
  writeFileSync(out, JSON.stringify({ v: 1, generatedAt: Date.now(), ids, h: ids.map((id) => index.get(id)) }));
  console.log(`wrote ${ids.length} fingerprints to ${out}`);
};

if (MINUTES > 0) {
  // Newest sets first (the sets list is oldest first); TCG Pocket cards are not paper cards.
  const [sets, cards, pocket] = await Promise.all([getJson(`${API}/sets`), getJson(`${API}/cards`), getJson(`${API}/series/tcgp`)]);
  const skip = new Set(pocket.sets.map((/** @type {any} */ s) => s.id));
  const order = new Map(sets.map((/** @type {any} */ s, /** @type {number} */ i) => [s.id, i]));
  const setOf = (/** @type {string} */ id) => id.slice(0, id.lastIndexOf('-'));
  const todo = cards
    .filter((/** @type {any} */ c) => c.image && !index.has(c.id) && !skip.has(setOf(c.id)))
    .sort((/** @type {any} */ a, /** @type {any} */ b) => (order.get(setOf(b.id)) ?? -1) - (order.get(setOf(a.id)) ?? -1));
  console.log(`${todo.length} cards to add`);

  const stopAt = Date.now() + MINUTES * 60_000;
  let added = 0;
  let failed = 0;
  let busy = 0;
  for (const card of todo) {
    if (Date.now() > stopAt) break;
    try {
      const res = await fetch(`${card.image}/low.png`, { headers: HEADERS });
      // Too many requests or server busy: pause a minute; stop after three times in a row.
      if (res.status === 429 || res.status === 503) {
        if (++busy >= 3) {
          console.log(`TCGdex answers ${res.status} again: stopping here`);
          break;
        }
        console.log(`TCGdex answers ${res.status}: pausing a minute`);
        await sleep(60_000);
        continue;
      }
      busy = 0;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { width, height, rgba } = decodePng(Buffer.from(await res.arrayBuffer()));
      index.set(card.id, fingerprint(rgba, width, height));
      added++;
    } catch (err) {
      failed++;
      if (failed <= 20) console.log(`${card.id}: ${err instanceof Error ? err.message : err}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`added ${added}, failed ${failed}, left ${todo.length - added - failed}`);
}

if (index.size) save();
else throw new Error('empty index: nothing to publish');
