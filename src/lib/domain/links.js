// @ts-check
// "Utility" in the Profile: useful Pokémon TCG websites, chosen by the user. Add new ones here.

/** @typedef {{ name: string, url: string, text: string, icon?: string }} UsefulLink icon: favicon when not at /favicon.ico */

/** @type {UsefulLink[]} */
export const USEFUL_LINKS = [
  { name: 'Pokémon.com', url: 'https://www.pokemon.com/it', text: 'Sito ufficiale: espansioni, regole e notizie' },
  {
    name: 'Event Locator',
    url: 'https://events.pokemon.com/EventLocator/?locale=it-IT&range=100&iskm=true&filters=tcg',
    text: 'Tornei e leghe di carte vicino a te (Play! Pokémon)',
    icon: 'https://www.pokemon.com/favicon.ico',
  },
  { name: 'Limitless Labs', url: 'https://labs.limitlesstcg.com/', text: 'Statistiche dei tornei, mazzi e liste da copiare' },
  { name: 'Pokémon Proxies', url: 'https://pokemonproxies.com/', text: 'Proxy da stampare per provare un mazzo', icon: 'https://pokemonproxies.com/pokeball.png' },
];

/**
 * Favicon of a link, loaded from the site itself (no third-party favicon service); the page
 * shows the initial when it doesn't load.
 * @param {UsefulLink} l
 */
export const faviconOf = (l) => l.icon ?? `${new URL(l.url).origin}/favicon.ico`;

/** "limitlesstcg.com" from the URL, shown under the name. @param {string} url */
export const hostOf = (url) => new URL(url).hostname.replace(/^www\./, '');

/**
 * "Il progetto" in the Profile. Each button appears only when its value is set.
 * PayPal: a PayPal.me link (https://paypal.me/<name>) needs no integration and costs nothing.
 */
export const ABOUT = {
  /** Address for suggestions (opens the mail app). */
  contactEmail: 'matteocasonato@gmail.com',
  /** "Offrimi un caffè": PayPal.me or another donation page. */
  donateUrl: 'https://www.paypal.me/matteocasonato',
};
