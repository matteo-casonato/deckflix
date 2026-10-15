<script>
  // @ts-check
  // Renders a Hugeicons icon (@hugeicons/core-free-icons: an array of [tag, attributes]).
  /** @type {{ icon: [string, Record<string, any>][], size?: number, strokeWidth?: number, label?: string }} */
  let { icon, size = 24, strokeWidth = 1.5, label } = $props();

  /** @param {string} name */
  const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

  // Attributes come in camelCase (strokeWidth); the stroke width is set once on <svg>.
  const parts = $derived(
    icon.map(([tag, { key, strokeWidth: _, ...rest }]) => ({
      tag,
      key,
      attrs: Object.fromEntries(Object.entries(rest).map(([k, v]) => [kebab(k), v])),
    })),
  );
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  {#each parts as part (part.key)}
    <svelte:element this={part.tag} {...part.attrs} />
  {/each}
</svg>
