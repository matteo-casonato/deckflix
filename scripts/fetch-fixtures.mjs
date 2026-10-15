// Downloads real TCGdex responses into tests/fixtures/tcgdex/<path>.json.
// They are used by the tests and by the offline development mode (VITE_TCGDEX_FIXTURES=1).
// Run again to refresh: node scripts/fetch-fixtures.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const BASE = 'https://api.tcgdex.net/v2';
const OUT = join(import.meta.dirname, '..', 'tests', 'fixtures', 'tcgdex');

const PATHS = [
  // The same card in every language (id is shared), with Cardmarket prices and variants.
  ...['it', 'en', 'es', 'fr', 'de', 'pt'].map((lang) => `/${lang}/cards/sv03.5-025`),
  // No image in Italian (falls back to English), old set.
  '/it/cards/base1-4',
  '/en/cards/base1-4',
  // Stamped prints in variants_detailed (Play! Pokémon, Logo set, Staff).
  '/it/cards/me01-118',
  '/it/cards/sv10-049',
  // A complete set and the set list.
  '/it/sets/sv03.5',
  '/it/sets',
  '/it/series',
];

for (const path of PATHS) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  const file = join(OUT, `${path}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(await res.json(), null, 1)}\n`);
  console.log('saved', path);
}
