<script>
  // @ts-check
  // Flag from Flagpack (flagpack.xyz, MIT) with its "Diagonal Ripple" effect (real-linear in
  // their code): a waving light and shade blended over the flag, plus a thin overlay border.
  // Card languages use the copies in public/flags/; any other country loads from jsDelivr.

  /** @type {{ lang?: string, country?: string, width?: number }} */
  let { lang, country, width = 20 } = $props();

  /** Card languages: Portuguese cards are printed for Brazil. */
  const LANG_FLAG = /** @type {Record<string, string>} */ ({ it: 'IT', en: 'GB-UKM', es: 'ES', fr: 'FR', de: 'DE', pt: 'BR' });
  const LOCAL = new Set(Object.values(LANG_FLAG));

  const code = $derived(lang ? LANG_FLAG[lang] : country === 'GB' || country === 'UK' ? 'GB-UKM' : country?.toUpperCase());
  const src = $derived(
    !code ? null : LOCAL.has(code) ? `${import.meta.env.BASE_URL}flags/${code}.svg` : `https://cdn.jsdelivr.net/npm/flagpack-core@2.1.0/svg/l/${code}.svg`,
  );
  let failed = $state(false);
</script>

{#if src && !failed}
  <span class="flag" style:width="{width}px" style:height="{Math.round(width * 0.75)}px" aria-hidden="true">
    <img {src} alt="" onerror={() => (failed = true)} />
  </span>
{/if}

<style>
  .flag {
    position: relative;
    flex-shrink: 0;
    display: inline-block;
    overflow: hidden;
    border-radius: 2px;
    vertical-align: middle;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Diagonal Ripple (Flagpack's real-linear gradient) and its border, both blended as overlay. */
  .flag::before,
  .flag::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    mix-blend-mode: overlay;
    pointer-events: none;
  }

  .flag::before {
    background-image: linear-gradient(
      45deg,
      rgba(0, 0, 0, 0.2) 0%,
      rgba(39, 39, 39, 0.22) 11%,
      rgba(255, 255, 255, 0.3) 27%,
      rgba(0, 0, 0, 0.24) 41%,
      rgba(0, 0, 0, 0.55) 52%,
      rgba(255, 255, 255, 0.26) 63%,
      rgba(0, 0, 0, 0.27) 74%,
      rgba(255, 255, 255, 0.3) 100%
    );
  }

  .flag::after {
    border: 1px solid rgba(0, 0, 0, 0.5);
  }
</style>
