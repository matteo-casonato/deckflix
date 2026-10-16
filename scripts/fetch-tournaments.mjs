// @ts-check
// Run by the deploy workflow every morning: downloads the card-game tournaments of each country
// from pokedata.ovh (the official Play! Pokémon events) and writes them next to the built app,
// dist/tournaments/<COUNTRY>.json. The app can't read pokedata itself (their CORS only allows
// their own site), but it can read a file on its own site: each phone then keeps the
// tournaments within its own radius. No personal data here: whole countries, public events.
//
// Usage: node scripts/fetch-tournaments.mjs [outDir]   (countries from TOURNAMENT_COUNTRIES, default IT)
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEventsJson, within } from '../src/lib/domain/ics.js';

const DAYS = 31;
const outDir = resolve(process.argv[2] ?? 'dist', 'tournaments');
const countries = (process.env.TOURNAMENT_COUNTRIES ?? 'IT').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);

const now = Date.now();
const d = new Date(now);
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

mkdirSync(outDir, { recursive: true });
for (const country of countries) {
  const url = `https://pokedata.ovh/events2/events.php?${new URLSearchParams({
    includePast: 'false',
    country,
    startDate: today,
    tcgTypes: 'cups,challenges,prerelease,friendly',
    vgTypes: '',
    goTypes: '',
  })}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Deckflix (personal PWA; one request a day)' } });
  if (!res.ok) throw new Error(`${country}: HTTP ${res.status}`);
  // Only what the app shows, with a position, for the next month.
  const events = within(parseEventsJson(await res.text()), now, DAYS).filter((t) => t.lat != null && t.lng != null);
  if (!events.length) throw new Error(`${country}: no tournaments in the answer`);
  writeFileSync(resolve(outDir, `${country}.json`), JSON.stringify({ generatedAt: now, country, events }));
  console.log(`${country}: ${events.length} tournaments`);
}
