// @ts-check
// "Utility" in the Profile: useful Pokémon TCG websites, chosen by the user. Add new ones here.

/** @typedef {{ name: string, url: string, text: string }} UsefulLink */

/** @type {UsefulLink[]} */
export const USEFUL_LINKS = [
  { name: 'Pokémon.com', url: 'https://www.pokemon.com/it', text: 'Sito ufficiale: espansioni, regole e notizie' },
  { name: 'Limitless TCG', url: 'https://limitlesstcg.com/', text: 'Tornei, mazzi dei giocatori, liste da copiare' },
  { name: 'Pokémon Proxies', url: 'https://pokemonproxies.com/', text: 'Proxy da stampare per provare un mazzo' },
];

/** "limitlesstcg.com" from the URL, shown under the name. @param {string} url */
export const hostOf = (url) => new URL(url).hostname.replace(/^www\./, '');

/**
 * "Il progetto" in the Profile. Each button appears only when its value is set.
 * PayPal: a PayPal.me link (https://paypal.me/<name>) needs no integration and costs nothing.
 */
export const ABOUT = {
  /** Address for suggestions (opens the mail app). */
  contactEmail: '',
  /** "Offrimi un caffè": PayPal.me or another donation page. */
  donateUrl: '',
};
