<script>
  // @ts-check
  // Tournament type at the start of a row: the League Cup / League Challenge logo, or a tile
  // with the word (Lega, Prerelease) for the types without one.

  /** @type {{ type?: import('../../lib/domain/ics.js').TournamentType, size?: number }} */
  let { type = 'league', size = 40 } = $props();

  const LOGO = /** @type {Record<string, string>} */ ({ cup: 'league-cup.png', challenge: 'league-challenge.png' });
  const LABEL = /** @type {Record<string, string>} */ ({ cup: 'League Cup', challenge: 'League Challenge', prerelease: 'Prerelease', league: 'Lega' });
</script>

<span class="mark {type}" style:width="{size}px" style:height="{Math.round(size * 1.075)}px">
  {#if LOGO[type]}
    <img src="{import.meta.env.BASE_URL}brands/{LOGO[type]}" alt={LABEL[type]} />
  {:else}
    <span class="word" style:font-size="{Math.max(8, Math.round(size * 0.24))}px">{type === 'prerelease' ? 'Pre' : LABEL[type]}</span>
    <span class="visually-hidden">{LABEL[type]}</span>
  {/if}
</span>

<style>
  .mark {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .word {
    width: 100%;
    height: 100%;
    border-radius: 10px;
    background: var(--surface-2);
    color: var(--muted);
    font-weight: 800;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .prerelease .word {
    background: color-mix(in srgb, var(--success) 18%, var(--surface));
    color: var(--success);
  }
</style>
