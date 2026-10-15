<script>
  // @ts-check
  // "Play!" in the Profile: the players of this phone (you, your children…) with Player ID,
  // birth year, age division and the check-in QR code shown at the league.
  import { Add01Icon, QrCodeIcon } from '@hugeicons/core-free-icons';
  import { settings, setSetting } from '../lib/stores/settings.svelte.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import { QR_VALID_DAYS, ageDivision, playerQrText, validPlayerId } from '../lib/domain/players.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import ConfirmDialog from '../lib/ui/ConfirmDialog.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import QrCode from '../lib/ui/QrCode.svelte';
  import Sheet from '../lib/ui/Sheet.svelte';

  const DIVISION = { Junior: 'Junior', Senior: 'Senior', Master: 'Master' };

  /** @type {import('../lib/domain/players.js').Player | null} */
  let editing = $state(null);
  let form = $state({ name: '', playerId: '', birthYear: '' });
  /** @type {import('../lib/domain/players.js').Player | null} */
  let showing = $state(null);
  /** @type {import('../lib/domain/players.js').Player | null} */
  let removing = $state(null);
  let hideYear = $state(false);

  const thisYear = new Date().getFullYear();
  const valid = $derived(
    form.name.trim().length > 1 && validPlayerId(form.playerId) && Number(form.birthYear) >= 1920 && Number(form.birthYear) <= thisYear,
  );

  function add() {
    form = { name: '', playerId: '', birthYear: '' };
    editing = { id: '', name: '', playerId: '', birthYear: 0 };
  }

  /** @param {import('../lib/domain/players.js').Player} p */
  function edit(p) {
    form = { name: p.name, playerId: p.playerId, birthYear: String(p.birthYear) };
    editing = p;
  }

  /** @param {SubmitEvent} e */
  async function save(e) {
    e.preventDefault();
    if (!valid || !editing) return;
    const p = { id: editing.id || crypto.randomUUID(), name: form.name.trim(), playerId: form.playerId.trim(), birthYear: Number(form.birthYear) };
    const list = settings.players.map((x) => ({ ...x }));
    const i = list.findIndex((x) => x.id === p.id);
    if (i >= 0) list[i] = p;
    else list.push(p);
    await setSetting('players', list);
    editing = null;
  }

  async function remove() {
    if (!removing) return;
    const gone = removing;
    const before = settings.players.map((x) => ({ ...x }));
    await setSetting('players', before.filter((x) => x.id !== gone.id));
    showToast(`${gone.name} rimosso`, () => setSetting('players', before));
  }
</script>

<BackHeader title="Play!" big fallback={hrefFor('profile')} />

<p class="intro">
  I giocatori di questo telefono, per i tornei: ID giocatore, divisione per età e il codice QR da mostrare in lega.
</p>

{#if settings.players.length}
  <ul class="players">
    {#each settings.players as p (p.id)}
      {@const div = ageDivision(p.birthYear, Date.now())}
      <li class="player card">
        <button class="info" onclick={() => edit(p)} aria-label={`Modifica ${p.name}`}>
          <strong>{p.name}</strong>
          <span class="num">ID {p.playerId} · nato nel {p.birthYear}</span>
          {#if div}<span class="div">{DIVISION[div]}</span>{/if}
        </button>
        <button class="qr-btn" onclick={() => ((hideYear = false), (showing = p))} aria-label={`Codice QR di ${p.name}`}>
          <Icon icon={QrCodeIcon} size={26} />
        </button>
      </li>
    {/each}
  </ul>
{/if}

<div class="pad">
  <button class="btn {settings.players.length ? '' : 'primary'} wide" onclick={add}>
    <Icon icon={Add01Icon} size={18} /> Aggiungi giocatore
  </button>
  <p class="note">
    La divisione (Junior, Senior, Master) si ricava dall’anno di nascita e cambia con la stagione Play! Pokémon.
    I dati restano sul telefono e nel backup su Drive.
  </p>
</div>

<Sheet open={!!editing} title={editing?.id ? 'Modifica giocatore' : 'Nuovo giocatore'} onclose={() => (editing = null)}>
  <form class="form" onsubmit={save}>
    <label>
      <span>Nome e cognome</span>
      <input bind:value={form.name} autocomplete="name" placeholder="Es. Alessio Rossi" maxlength="60" />
    </label>
    <label>
      <span>ID giocatore</span>
      <input bind:value={form.playerId} inputmode="numeric" placeholder="Es. 4359311" maxlength="10" />
    </label>
    <label>
      <span>Anno di nascita</span>
      <input bind:value={form.birthYear} inputmode="numeric" placeholder="Es. 2015" maxlength="4" />
    </label>
    {#if Number(form.birthYear) >= 1920}
      <p class="note">Divisione: {ageDivision(Number(form.birthYear), Date.now()) ?? '—'}</p>
    {/if}
    <div class="row">
      {#if editing?.id}
        <button type="button" class="btn danger" onclick={() => ((removing = editing), (editing = null))}>Elimina</button>
      {/if}
      <button type="submit" class="btn primary" disabled={!valid}>Salva</button>
    </div>
  </form>
</Sheet>

<Sheet open={!!showing} title="Codice per la lega" onclose={() => (showing = null)}>
  {#if showing}
    <div class="qr-view">
      <p class="id">ID giocatore: <strong class="num">{showing.playerId}</strong></p>
      <p class="name">{showing.name}</p>
      {#if !hideYear}<p class="year">Anno di nascita: <strong class="num">{showing.birthYear}</strong></p>{/if}
      <button class="link" onclick={() => (hideYear = !hideYear)}>{hideYear ? 'Mostra anno' : 'Nascondi anno'}</button>
      <div class="qr-box">
        <QrCode text={playerQrText(showing, Date.now())} label={`Codice QR del giocatore ${showing.name}, ID ${showing.playerId}`} />
      </div>
      <p class="note">Valido {QR_VALID_DAYS} giorni come quello dell’app Pokémon; si rinnova ogni volta che lo apri. Alza la luminosità per la lettura.</p>
    </div>
  {/if}
</Sheet>

<ConfirmDialog
  open={!!removing}
  title="Eliminare il giocatore?"
  text={`${removing?.name ?? ''} sparisce da questo telefono e dal backup.`}
  confirmLabel="Elimina"
  danger
  onconfirm={remove}
  onclose={() => (removing = null)}
/>

<style>
  .intro {
    margin: 0 20px 12px;
    font-size: 14px;
    color: var(--muted);
  }

  .players {
    list-style: none;
    margin: 0;
    padding: 0 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .player {
    padding: 6px 6px 6px 4px;
    border-radius: var(--r-card);
    background: var(--surface);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .info {
    flex: 1;
    min-width: 0;
    min-height: 64px;
    padding: 8px 12px;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 2px;
    cursor: pointer;
  }

  .info strong {
    font-size: 16px;
  }

  .info span {
    font-size: 13px;
    color: var(--muted);
  }

  .info .div {
    align-self: flex-start;
    margin-top: 4px;
    padding: 2px 10px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--accent) 16%, var(--surface));
    color: var(--accent);
    font-weight: 700;
    font-size: 12px;
  }

  .qr-btn {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    border: 0;
    border-radius: 20px;
    background: var(--text);
    color: var(--on-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .pad {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .wide {
    width: 100%;
  }

  .note {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
  }

  .form input {
    min-height: 48px;
    padding: 0 16px;
    border: 1px solid var(--line-2);
    border-radius: var(--r-control);
    background: var(--bg);
    color: var(--text);
    font: inherit;
  }

  .row {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn.danger {
    color: var(--danger);
  }

  .qr-view {
    padding: 4px 0 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
  }

  .qr-view p {
    margin: 0;
  }

  .id,
  .year {
    font-size: 15px;
  }

  .name {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 800;
  }

  .link {
    min-height: 44px;
    border: 0;
    background: transparent;
    color: var(--accent);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }

  .qr-box {
    padding: 14px;
    border-radius: 24px;
    background: #fff;
  }

  .qr-view .note {
    margin-top: 8px;
    max-width: 320px;
  }
</style>
