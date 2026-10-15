<script>
  // @ts-check
  // Round Google account photo (initial as fallback) with the backup status dot.
  /** @type {{ user: { name: string, picture: string | null }, size?: number, status?: 'saved' | 'pending' | 'idle' | 'none', ring?: string }} */
  let { user, size = 28, status = 'none', ring = 'var(--surface)' } = $props();

  let broken = $state(false);
  const initial = $derived((user.name.trim()[0] ?? '?').toUpperCase());
</script>

<span class="avatar" style:--size="{size}px" style:--ring={ring}>
  {#if user.picture && !broken}
    <img src={user.picture} alt="" referrerpolicy="no-referrer" onerror={() => (broken = true)} />
  {:else}
    <span class="initial" aria-hidden="true">{initial}</span>
  {/if}
  {#if status !== 'none'}
    <span class="dot {status}" aria-hidden="true"></span>
  {/if}
</span>

<style>
  .avatar {
    position: relative;
    width: var(--size);
    height: var(--size);
    flex-shrink: 0;
    border-radius: 50%;
    display: inline-flex;
  }

  img,
  .initial {
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }

  img {
    object-fit: cover;
  }

  .initial {
    background: var(--accent);
    color: var(--on-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: calc(var(--size) * 0.45);
  }

  .dot {
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: max(10px, calc(var(--size) * 0.22));
    height: max(10px, calc(var(--size) * 0.22));
    border-radius: 50%;
    border: 2px solid var(--ring);
  }

  .saved {
    background: var(--success);
  }

  .pending {
    background: var(--accent);
  }

  .idle {
    background: var(--idle);
  }
</style>
