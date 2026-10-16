// @ts-check
// Profile › Licenza e crediti: what the app uses from others, with owner and terms (see LICENSE).

/** @typedef {{ name: string, what: string, terms: string, url: string }} Credit */

/** @type {Credit[]} */
export const CREDITS = [
  { name: 'TCGdex', what: 'Dati, immagini e prezzi delle carte', terms: 'Servizio gratuito, dati dei rispettivi titolari', url: 'https://tcgdex.dev' },
  { name: 'pokesymbols.com', what: 'Simboli e loghi delle edizioni, simboli di rarità recenti', terms: 'Immagini dei rispettivi titolari', url: 'https://pokesymbols.com' },
  { name: 'Bulbapedia', what: 'Icone dei tipi e simboli di rarità meno recenti', terms: 'Immagini dei rispettivi titolari', url: 'https://bulbapedia.bulbagarden.net' },
  { name: 'The Hobby Bin', what: 'Loghi delle edizioni in uscita', terms: 'Immagini dei rispettivi titolari', url: 'https://thehobbybin.com' },
  { name: 'pokedata.ovh', what: 'Tornei Play! Pokémon', terms: 'Dati pubblici degli eventi ufficiali', url: 'https://pokedata.ovh' },
  { name: 'OpenStreetMap', what: 'Posizione della città per i tornei', terms: '© contributori di OpenStreetMap, ODbL', url: 'https://www.openstreetmap.org/copyright' },
  { name: 'Flagpack', what: 'Bandiere di lingue e paesi', terms: '© Yummygum, licenza MIT', url: 'https://flagpack.xyz' },
  { name: 'Bricolage Grotesque e DM Sans', what: 'Caratteri', terms: 'SIL Open Font License', url: 'https://fonts.google.com' },
  { name: 'Hugeicons', what: 'Icone dell’interfaccia', terms: 'Licenza MIT', url: 'https://hugeicons.com' },
];
