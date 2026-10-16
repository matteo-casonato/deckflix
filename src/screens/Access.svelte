<script>
  // @ts-check
  // First run only (docs/mockups/AccessoGoogle.html): official Google button or continue
  // without an account.
  import { onMount } from 'svelte';
  import Logo from '../lib/ui/Logo.svelte';
  import { LockIcon } from '@hugeicons/core-free-icons';
  import Icon from '../lib/ui/Icon.svelte';
  import { renderSignInButton } from '../lib/sync/google-auth.js';
  import { continueWithoutAccount, isConfigured, signIn } from '../lib/sync/sync.js';

  /** @type {HTMLDivElement} */
  let buttonBox;
  /** @type {string | null} */
  let problem = $state(isConfigured() ? null : 'Accesso con Google non ancora configurato: puoi usare l’app senza account.');

  onMount(() => {
    if (!isConfigured()) return;
    renderSignInButton(buttonBox, (user) => signIn(user)).catch((err) => (problem = err.message));
  });
</script>

<div class="access">
  <div class="intro">
    <Logo size={26} />
    <h1>La tua collezione,<br />sempre al sicuro.</h1>
    <p>Accedi con Google: Deckflix salva una copia su Drive mentre la usi e la ritrova su qualsiasi telefono.</p>
  </div>

  <div class="google" bind:this={buttonBox} hidden={!!problem}></div>
  {#if problem}<p class="problem" role="status">{problem}</p>{/if}

  <button class="skip" onclick={continueWithoutAccount}>Continua senza account</button>

  <p class="note">
    <Icon icon={LockIcon} size={16} />
    <span>Deckflix usa solo una cartella nascosta tutta sua su Drive: non vede i tuoi file.</span>
  </p>
</div>

<style>
  .access {
    min-height: 100dvh;
    max-width: 480px;
    margin-inline: auto;
    padding: calc(24px + var(--safe-top)) 16px calc(52px + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 14px;
  }

  .intro {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 6px 22px;
  }



  h1 {
    font-size: 34px;
    line-height: 1.12;
  }

  .intro p {
    margin: 0;
    font-size: 15px;
    color: var(--muted);
    line-height: 1.5;
  }

  /* Google draws its own button (iframe); keep room for it and centre it. */
  .google {
    min-height: 44px;
    display: flex;
    justify-content: center;
  }

  .problem {
    margin: 0;
    padding: 14px;
    border-radius: var(--r-control);
    background: var(--surface);
    color: var(--muted);
    font-size: 14px;
    text-align: center;
  }

  .skip {
    min-height: 48px;
    border: 0;
    background: transparent;
    color: var(--text);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }

  .note {
    margin: 0;
    padding: 0 8px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.45;
  }
</style>
