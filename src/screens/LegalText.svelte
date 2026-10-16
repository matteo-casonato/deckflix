<script>
  // @ts-check
  // Privacy policy or terms inside the app: the text of public/privacy.html or termini.html (the
  // pages Google links to), so there is one copy of it. The files are precached: offline too.

  /** @type {{ file: 'privacy.html' | 'termini.html' }} */
  let { file } = $props();

  /** @type {string | null} */
  let html = $state(null);
  let failed = $state(false);

  $effect(() => {
    const name = file;
    fetch(`${import.meta.env.BASE_URL}${name}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => {
        const main = new DOMParser().parseFromString(text, 'text/html').querySelector('main');
        if (!main) throw new Error('no main');
        // The page's own title and its links back to the app are not needed here.
        main.querySelector('h1')?.remove();
        main.querySelector('p.muted:last-child')?.remove();
        main.querySelectorAll('a[href]').forEach((a) => {
          if (!/^(https?:|mailto:)/.test(a.getAttribute('href') ?? '')) return;
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        });
        html = main.innerHTML;
      })
      .catch(() => (failed = true));
  });
</script>

{#if html}
  <article class="legal">{@html html}</article>
{:else if failed}
  <p class="muted">Non riesco a caricare il testo. <a href={`${import.meta.env.BASE_URL}${file}`} target="_blank" rel="noopener">Aprilo nel browser</a>.</p>
{:else}
  <p class="muted" aria-busy="true">Carico…</p>
{/if}

<style>
  .legal {
    padding: 0 4px 24px;
    font-size: 15px;
    line-height: 1.55;
  }

  .legal :global(h2) {
    margin: 24px 0 8px;
    font-size: 18px;
  }

  .legal :global(p),
  .legal :global(li) {
    color: var(--muted);
  }

  .legal :global(strong) {
    color: var(--text);
  }

  .legal :global(a) {
    color: var(--accent);
  }

  .legal :global(ul) {
    padding-left: 20px;
  }

  .legal :global(code) {
    font-size: 13px;
  }

  .legal :global(.muted:first-child) {
    margin-top: 0;
    font-size: 13px;
  }

  .muted {
    color: var(--muted);
  }

  .muted a {
    color: var(--accent);
  }
</style>
