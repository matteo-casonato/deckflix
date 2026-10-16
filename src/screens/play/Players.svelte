<script>
  // @ts-check
  // Players of this phone (you, your children…) in the Play! section: photo, Player ID,
  // birth year, age division and the check-in QR code shown at the league.
  import { Add01Icon, QrCodeIcon } from '@hugeicons/core-free-icons';
  import { settings, setSetting } from '../../lib/stores/settings.svelte.js';
  import { showToast } from '../../lib/stores/toast.svelte.js';
  import { avatarFromFile } from '../../lib/data/avatar.js';
  import { QR_VALID_DAYS, ageDivision, playerQrText, pointsUrl, validPlayerId } from '../../lib/domain/players.js';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';
  import Icon from '../../lib/ui/Icon.svelte';
  import QrCode from '../../lib/ui/QrCode.svelte';
  import Sheet from '../../lib/ui/Sheet.svelte';

  /** @typedef {import('../../lib/domain/players.js').Player} Player */

  /** @type {Player | null} */
  let editing = $state(null);
  /** @type {{ name: string, playerId: string, birthYear: string, avatar: string | null }} */
  let form = $state({ name: '', playerId: '', birthYear: '', avatar: null });
  /** @type {Player | null} */
  let showing = $state(null);
  /** @type {Player | null} */
  let removing = $state(null);
  let hideYear = $state(false);

  const thisYear = new Date().getFullYear();
  const valid = $derived(
    form.name.trim().length > 1 && validPlayerId(form.playerId) && Number(form.birthYear) >= 1920 && Number(form.birthYear) <= thisYear,
  );

  /** @param {string} name */
  const initials = (name) =>
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  function add() {
    form = { name: '', playerId: '', birthYear: '', avatar: null };
    editing = { id: '', name: '', playerId: '', birthYear: 0 };
  }

  /** @param {Player} p */
  function edit(p) {
    form = { name: p.name, playerId: p.playerId, birthYear: String(p.birthYear), avatar: p.avatar ?? null };
    editing = p;
  }

  /** @param {Event & { currentTarget: HTMLInputElement }} e */
  async function pickPhoto(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      form.avatar = await avatarFromFile(file);
    } catch {
      showToast('Non riesco a leggere questa immagine');
    }
  }

  /** @param {SubmitEvent} e */
  async function save(e) {
    e.preventDefault();
    if (!valid || !editing) return;
    /** @type {Player} */
    const p = {
      id: editing.id || crypto.randomUUID(),
      name: form.name.trim(),
      playerId: form.playerId.trim(),
      birthYear: Number(form.birthYear),
      avatar: form.avatar,
    };
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

{#snippet avatar(/** @type {{ name: string, avatar?: string | null }} */ p, /** @type {number} */ size)}
  <span class="avatar" style:width="{size}px" style:height="{size}px" style:font-size="{size * 0.36}px" aria-hidden="true">
    {#if p.avatar}<img src={p.avatar} alt="" />{:else}{initials(p.name) || '?'}{/if}
  </span>
{/snippet}

<ul class="players">
  {#each settings.players as p (p.id)}
    {@const div = ageDivision(p.birthYear, Date.now())}
    <li class="player card">
      <button class="info" onclick={() => edit(p)} aria-label={`Modifica ${p.name}`}>
        {@render avatar(p, 52)}
        <span class="txt">
          <strong>{p.name}</strong>
          <span class="num">ID {p.playerId} · {p.birthYear}</span>
          {#if div}<span class="div">{div}</span>{/if}
        </span>
      </button>
      <button class="qr-btn" onclick={() => ((hideYear = false), (showing = p))} aria-label={`Codice QR di ${p.name}`}>
        <Icon icon={QrCodeIcon} size={26} />
      </button>
    </li>
  {/each}
  <li>
    <button class="add" onclick={add}>
      <Icon icon={Add01Icon} size={18} />
      {settings.players.length ? 'Aggiungi giocatore' : 'Aggiungi il tuo ID giocatore'}
    </button>
  </li>
</ul>

<Sheet open={!!editing} title={editing?.id ? 'Modifica giocatore' : 'Nuovo giocatore'} onclose={() => (editing = null)}>
  <form class="form" onsubmit={save}>
    <div class="photo">
      {@render avatar({ name: form.name, avatar: form.avatar }, 72)}
      <label class="btn">
        {form.avatar ? 'Cambia foto' : 'Aggiungi foto'}
        <input class="visually-hidden" type="file" accept="image/*" onchange={pickPhoto} />
      </label>
      {#if form.avatar}<button type="button" class="btn subtle" onclick={() => (form.avatar = null)}>Togli</button>{/if}
    </div>
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
      {@render avatar(showing, 56)}
      <p class="id">ID giocatore: <strong class="num">{showing.playerId}</strong></p>
      <p class="name">{showing.name}</p>
      {#if !hideYear}<p class="year">Anno di nascita: <strong class="num">{showing.birthYear}</strong></p>{/if}
      <button class="link" onclick={() => (hideYear = !hideYear)}>{hideYear ? 'Mostra anno' : 'Nascondi anno'}</button>
      <div class="qr-box">
        <QrCode
          text={playerQrText(showing, Date.now())}
          logo={`${import.meta.env.BASE_URL}brands/play-pokemon.png`}
          fit="meet"
          label={`Codice QR del giocatore ${showing.name}, ID ${showing.playerId}`}
        />
      </div>
      <a class="btn points" href={pointsUrl(showing, Date.now())} target="_blank" rel="noopener noreferrer">Punti campionato e classifica</a>
      <p class="note">
        Stessi dati del codice dell’app Pokémon (ID, nome, anno di nascita), valido {QR_VALID_DAYS} giorni e rinnovato
        ogni volta che lo apri. Alza la luminosità per la lettura.
      </p>
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
    min-height: 72px;
    padding: 8px 10px;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
  }

  .txt {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .txt strong {
    font-size: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .txt span {
    font-size: 13px;
    color: var(--muted);
  }

  .txt .div {
    align-self: flex-start;
    margin-top: 2px;
    padding: 2px 10px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--accent) 16%, var(--surface));
    color: var(--accent);
    font-weight: 700;
    font-size: 12px;
  }

  .avatar {
    flex-shrink: 0;
    border-radius: 50%;
    overflow: hidden;
    background: var(--surface-2);
    color: var(--text);
    font-family: var(--font-display);
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
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

  .add {
    width: 100%;
    min-height: 56px;
    border: 1.5px dashed var(--line-2);
    border-radius: var(--r-card);
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
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

  .photo {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .photo label.btn {
    cursor: pointer;
  }

  .form > label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
  }

  .form input:not([type='file']) {
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

  .points {
    margin-top: 10px;
    width: 100%;
  }

  .qr-view .note {
    margin-top: 8px;
    max-width: 320px;
  }
</style>
