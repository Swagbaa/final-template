/* ================================================================
   profile.js — Profile page controller.

   Handles all four tabs: Overview, List, Favorites, Stats.
   Computes and renders stats, manages sort/filter state, and
   wires up all interactive elements on the profile page.
   ================================================================ */

import {
  getUser, saveUser,
  getLog, deleteEntry,
  getFavorites, removeFavorite,
  formatDate, formatDateShort, formatTotalTime, buildStars,
  computeStats,
} from './storage.js';
import { debounce } from './api.js';

let currentSort = 'date-desc';
let filterQuery = '';

// CLOSURE — private session counter exposed via a narrow API.
// Tracks how many entries the user has added during this visit
// without polluting the module scope with a bare mutable variable.
const sessionCounter = (() => {
  let count = 0;
  return {
    increment: () => ++count,
    get:       () => count,
  };
})();

//  INIT

export function initProfile() {
  renderProfileHero();
  initEditForm();
  initTabs();
}

//  PROFILE HERO

function renderProfileHero() {
  const user = getUser();
  const log  = getLog();

  setText('profile-username', user?.username ?? 'Anonymous');
  setText('profile-bio',      user?.bio || 'No bio yet. Click "Edit Profile" to add one.');

  const songs  = log.filter(e => e.type === 'song').length;
  const albums = log.filter(e => e.type !== 'song').length;
  const time   = log.reduce((s, e) => s + (e.duration || 0), 0);

  setText('hero-songs',  songs);
  setText('hero-albums', albums);
  setText('hero-time',   formatTotalTime(time));
  setText('hero-joined', user?.joinDate
    ? new Date(user.joinDate).getFullYear()
    : '—');
}

//  EDIT FORM

function initEditForm() {
  const editBtn   = document.getElementById('edit-profile-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const panel     = document.getElementById('edit-profile-panel');
  const form      = document.getElementById('edit-form');
  const bioInput  = document.getElementById('edit-bio');
  const bioCount  = document.getElementById('bio-char-count');

  // Toggle panel open / closed
  editBtn?.addEventListener('click', () => {
    const isHidden = panel?.hasAttribute('hidden');
    panel?.toggleAttribute('hidden', !isHidden);
    editBtn.setAttribute('aria-expanded', String(isHidden));
    if (isHidden) prefillEditForm();
  });

  cancelBtn?.addEventListener('click', () => {
    panel?.setAttribute('hidden', '');
    editBtn?.setAttribute('aria-expanded', 'false');
  });

  // Live bio character count
  bioInput?.addEventListener('input', () => {
    if (bioCount) bioCount.textContent = `${bioInput.value.length} / 300`;
  });

  form?.addEventListener('submit', handleEditSubmit);
  prefillEditForm();
}

function prefillEditForm() {
  const user = getUser();
  if (!user) return;
  setVal('edit-username',  user.username  ?? '');
  setVal('edit-email',     user.email     ?? '');
  setVal('edit-bio',       user.bio       ?? '');
  setVal('edit-country',   user.country   ?? '');
  setVal('edit-fav-genre', user.favGenre  ?? '');

  const pubCheck = document.getElementById('edit-public');
  if (pubCheck) pubCheck.checked = user.public !== false;

  // Sync bio counter
  const bio   = document.getElementById('edit-bio');
  const count = document.getElementById('bio-char-count');
  if (bio && count) count.textContent = `${bio.value.length} / 300`;
}

function handleEditSubmit(e) {
  e.preventDefault();
  const feedback = document.getElementById('edit-feedback');
  const errEl    = document.getElementById('err-username');

  const username = document.getElementById('edit-username')?.value.trim() ?? '';

  if (username.length < 2) {
    if (errEl) errEl.textContent = 'Username must be at least 2 characters.';
    return;
  }
  if (errEl) errEl.textContent = '';

  const existing = getUser() ?? {};
  saveUser({
    ...existing,
    username,
    email:    document.getElementById('edit-email')?.value.trim()   ?? existing.email ?? '',
    bio:      document.getElementById('edit-bio')?.value.trim()     ?? '',
    country:  document.getElementById('edit-country')?.value        ?? '',
    favGenre: document.getElementById('edit-fav-genre')?.value      ?? '',
    public:   document.getElementById('edit-public')?.checked !== false,
  });

  renderProfileHero();

  if (feedback) {
    feedback.textContent = '✓ Profile saved.';
    feedback.className = 'form-feedback form-feedback--success';
    setTimeout(() => {
      feedback.textContent = '';
      feedback.className   = 'form-feedback';
    }, 2200);
  }
}

//  TABS

function initTabs() {
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Restore tab from URL hash
  const hash  = location.hash.replace('#', '');
  const valid = ['overview', 'list', 'favorites', 'stats'];
  switchTab(valid.includes(hash) ? hash : 'overview');
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.profile-tab').forEach(t => {
    const active = t.dataset.tab === tabName;
    t.classList.toggle('profile-tab--active', active);
    t.setAttribute('aria-selected', String(active));
  });

  // Show / hide panels
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.toggleAttribute('hidden', p.id !== `panel-${tabName}`);
  });

  // Persist in URL without reloading
  history.replaceState(null, '', `#${tabName}`);

  // Render the selected tab
  switch (tabName) {
    case 'overview':  renderOverview();  break;
    case 'list':      initListTab();     break;
    case 'favorites': renderFavorites(); break;
    case 'stats':     renderStats();     break;
  }
}

//  OVERVIEW TAB

function renderOverview() {
  const log     = getLog();
  const listEl  = document.getElementById('overview-recent');
  const emptyEl = document.getElementById('overview-empty');
  if (!listEl) return;

  listEl.innerHTML = '';

  const recent = log.slice(0, 5);

  if (!recent.length) {
    emptyEl?.removeAttribute('hidden');
  } else {
    emptyEl?.setAttribute('hidden', '');
    recent.forEach(entry => listEl.appendChild(createOverviewEntry(entry)));
  }

  updateQuickStats(log);
}

function createOverviewEntry(entry) {
  const li = document.createElement('li');
  li.className = 'overview-entry';

  const img = document.createElement('img');
  img.className = 'overview-entry__cover';
  img.src = entry.coverUrl || 'assets/cover-placeholder.svg';
  img.alt = `Cover for ${entry.title}`;
  img.onerror = () => { img.src = 'assets/cover-placeholder.svg'; };

  const info = document.createElement('div');
  info.className = 'overview-entry__info';

  const titleEl = document.createElement('span');
  titleEl.className = 'overview-entry__title';
  titleEl.textContent = entry.title;

  const artistEl = document.createElement('span');
  artistEl.className = 'overview-entry__artist';
  artistEl.textContent = [entry.artist, entry.year].filter(Boolean).join(' · ');

  info.append(titleEl, artistEl);

  const right = document.createElement('div');
  right.className = 'overview-entry__right';

  const scoreEl = document.createElement('span');
  scoreEl.className = 'overview-entry__score';
  scoreEl.textContent = `${entry.rating}/10`;

  const dateEl = document.createElement('time');
  dateEl.className = 'overview-entry__date';
  dateEl.dateTime  = entry.dateLogged;
  dateEl.textContent = formatDateShort(entry.dateLogged);

  right.append(scoreEl, dateEl);
  li.append(img, info, right);
  return li;
}

function updateQuickStats(log) {
  const s = computeStats(log);
  setText('qs-songs',     s.totalSongs);
  setText('qs-albums',    s.totalAlbums);
  setText('qs-time',      formatTotalTime(s.totalDuration));
  setText('qs-rating',    s.meanRating ?? '—');
  setText('qs-artists',   s.uniqueArtists);
  setText('qs-top-genre', s.topGenre ?? '—');
}

//  LIST TAB

function initListTab() {
  renderList();

  const filterInput = document.getElementById('list-filter');
  const sortSelect  = document.getElementById('list-sort');

  // Debounced filter — closes over filterInput
  const debouncedFilter = debounce(() => {
    filterQuery = filterInput?.value.toLowerCase().trim() ?? '';
    renderList();
  }, 280);

  filterInput?.addEventListener('input', debouncedFilter);

  sortSelect?.addEventListener('change', () => {
    currentSort = sortSelect.value;
    renderList();
  });

  // Column header sort (click event)
  document.querySelectorAll('.log-table__th--sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (!col) return;
      currentSort = currentSort === `${col}-desc` ? `${col}-asc` : `${col}-desc`;
      if (sortSelect) sortSelect.value = currentSort;
      updateSortIcons(col, currentSort.endsWith('-asc'));
      renderList();
    });
  });
}

function updateSortIcons(activeCol, asc) {
  document.querySelectorAll('.log-table__th--sortable').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (!icon) return;
    if (th.dataset.col === activeCol) {
      icon.textContent = asc ? ' ↑' : ' ↓';
    } else {
      icon.textContent = '';
    }
  });
}

function renderList() {
  const tbody   = document.getElementById('log-tbody');
  const emptyEl = document.getElementById('list-empty');
  const noResEl = document.getElementById('list-no-results');
  const countEl = document.getElementById('list-count');
  if (!tbody) return;

  tbody.innerHTML = '';

  const log      = getLog();
  const filtered = applyFilter(log);
  const sorted   = applySort(filtered);

  emptyEl?.toggleAttribute('hidden', log.length > 0);
  noResEl?.toggleAttribute('hidden', sorted.length > 0 || log.length === 0);

  if (countEl) {
    countEl.textContent = log.length
      ? `${sorted.length} of ${log.length} ${log.length === 1 ? 'entry' : 'entries'}`
      : '';
  }

  // CLOSURE: each row's handlers close over their specific `entry`
  sorted.forEach(entry => tbody.appendChild(createLogRow(entry)));
}

function applyFilter(log) {
  if (!filterQuery) return log;
  return log.filter(e =>
    e.title?.toLowerCase().includes(filterQuery)  ||
    e.artist?.toLowerCase().includes(filterQuery) ||
    e.album?.toLowerCase().includes(filterQuery)  ||
    e.genre?.toLowerCase().includes(filterQuery)
  );
}

function applySort(log) {
  const [col, dir] = currentSort.split('-');
  const asc        = dir === 'asc';

  return [...log].sort((a, b) => {
    let va, vb;
    switch (col) {
      case 'date':   va = a.dateLogged ?? '';  vb = b.dateLogged ?? '';  break;
      case 'rating': va = a.rating     ?? 0;   vb = b.rating     ?? 0;   break;
      case 'artist': va = (a.artist    || '').toLowerCase(); vb = (b.artist || '').toLowerCase(); break;
      case 'title':  va = (a.title     || '').toLowerCase(); vb = (b.title  || '').toLowerCase(); break;
      case 'year':   va = a.year ?? 0;         vb = b.year ?? 0;         break;
      default:       va = a.dateLogged ?? '';  vb = b.dateLogged ?? '';
    }
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ?  1 : -1;
    return 0;
  });
}

function createLogRow(entry) {
  const tr = document.createElement('tr');
  tr.className = 'log-row';
  tr.dataset.id = entry.id;

  // Cover
  const tdCover = document.createElement('td');
  tdCover.className = 'log-row__cover';
  const img = document.createElement('img');
  img.src = entry.coverUrl || 'assets/cover-placeholder.svg';
  img.alt = `Cover for ${entry.title}`;
  img.onerror = () => { img.src = 'assets/cover-placeholder.svg'; };
  tdCover.appendChild(img);

  // Title
  const tdTitle = makeCell('log-row__title', entry.title);
  tdTitle.title = entry.title;

  // Artist
  const tdArtist = makeCell('log-row__artist', entry.artist);
  tdArtist.title = entry.artist;

  // Type tag
  const tdType = document.createElement('td');
  const typeTag = document.createElement('span');
  typeTag.className = `tag tag--${entry.type}`;
  typeTag.textContent = entry.type;
  tdType.appendChild(typeTag);

  // Remaining simple cells
  const tdYear  = makeCell('', entry.year  ?? '—');
  const tdGenre = makeCell('', entry.genre || '—');

  const tdRating = makeCell('log-row__rating', `${entry.rating}/10`);
  tdRating.setAttribute('aria-label', `Rating ${entry.rating} out of 10`);

  const tdDate = makeCell('', formatDate(entry.dateLogged));

  // Actions — each handler closes over `entry` and `tr`
  const tdActions = document.createElement('td');
  tdActions.className = 'log-row__actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-icon btn-icon--edit';
  editBtn.setAttribute('aria-label', `Edit ${entry.title}`);
  editBtn.setAttribute('type', 'button');
  editBtn.textContent = '✎';
  editBtn.addEventListener('click', () => {
    window.location.href = `search.html?edit=${entry.id}`;
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-icon btn-icon--delete';
  delBtn.setAttribute('aria-label', `Delete ${entry.title}`);
  delBtn.setAttribute('type', 'button');
  delBtn.textContent = '✕';
  delBtn.addEventListener('click', () => {
    if (!confirm(`Delete "${entry.title}" from your log?`)) return;
    deleteEntry(entry.id);
    tr.remove();
    renderProfileHero();
    sessionCounter.increment();   // track deletes via closure counter
    const remaining = document.querySelectorAll('#log-tbody .log-row').length;
    const countEl   = document.getElementById('list-count');
    const updated   = getLog();
    if (countEl) {
      countEl.textContent = updated.length
        ? `${remaining} of ${updated.length} ${updated.length === 1 ? 'entry' : 'entries'}`
        : '';
    }
    if (!remaining) document.getElementById('list-empty')?.removeAttribute('hidden');
  });

  tdActions.append(editBtn, delBtn);
  tr.append(tdCover, tdTitle, tdArtist, tdType, tdYear, tdGenre, tdRating, tdDate, tdActions);
  return tr;
}

//  FAVORITES TAB

function renderFavorites() {
  const favs = getFavorites();
  renderFavSection('artists', favs.artists ?? [], 'fav-artists', 'fav-artists-empty', 'fav-artists-count', buildArtistCard);
  renderFavSection('albums',  favs.albums  ?? [], 'fav-albums',  'fav-albums-empty',  'fav-albums-count',  buildAlbumCard);
  renderFavSection('songs',   favs.songs   ?? [], 'fav-songs',   'fav-songs-empty',   'fav-songs-count',   buildSongCard);
}

function renderFavSection(type, items, gridId, emptyId, countId, buildFn) {
  const grid    = document.getElementById(gridId);
  const emptyEl = document.getElementById(emptyId);
  const countEl = document.getElementById(countId);
  if (!grid) return;

  grid.innerHTML = '';
  if (countEl) countEl.textContent = items.length || '';

  if (!items.length) {
    emptyEl?.removeAttribute('hidden');
    return;
  }
  emptyEl?.setAttribute('hidden', '');

  items.forEach(item => {
    const card      = buildFn(item);
    const removeBtn = card.querySelector('.fav-card__remove');
    removeBtn?.addEventListener('click', () => {
      removeFavorite(type, item.id);
      card.remove();
      const left = grid.querySelectorAll('.fav-card').length;
      if (countEl) countEl.textContent = left || '';
      if (!left)   emptyEl?.removeAttribute('hidden');
    });
    grid.appendChild(card);
  });
}

function buildArtistCard(item) {
  const card = document.createElement('div');
  card.className = 'fav-card fav-card--artist';
  card.setAttribute('role', 'listitem');

  const wrap = document.createElement('div');
  wrap.className = 'fav-card__avatar-wrap';
  const img = favImg(item.coverUrl || 'assets/avatar-placeholder.svg', item.title ?? item.artist ?? '');
  img.className = 'fav-card__avatar';
  wrap.appendChild(img);

  const name = document.createElement('span');
  name.className = 'fav-card__name';
  name.textContent = item.title ?? item.artist ?? '';

  card.append(wrap, name, buildRemoveBtn(item.title ?? ''));
  return card;
}

function buildAlbumCard(item) {
  const card = document.createElement('div');
  card.className = 'fav-card fav-card--album';
  card.setAttribute('role', 'listitem');

  const img = favImg(item.coverUrl, `Cover for ${item.title}`);
  img.className = 'fav-card__cover';

  const info    = document.createElement('div');
  info.className = 'fav-card__info';
  const name    = document.createElement('span');
  name.className = 'fav-card__name';
  name.textContent = item.title;
  const sub     = document.createElement('span');
  sub.className  = 'fav-card__sub';
  sub.textContent = [item.artist, item.year].filter(Boolean).join(' · ');
  info.append(name, sub);

  card.append(img, info, buildRemoveBtn(item.title));
  return card;
}

function buildSongCard(item) {
  const card = document.createElement('div');
  card.className = 'fav-card fav-card--song';
  card.setAttribute('role', 'listitem');

  const img = favImg(item.coverUrl, `Cover for ${item.title}`);
  img.className = 'fav-card__cover';

  const info    = document.createElement('div');
  info.className = 'fav-card__info';
  const name    = document.createElement('span');
  name.className = 'fav-card__name';
  name.textContent = item.title;
  const sub     = document.createElement('span');
  sub.className  = 'fav-card__sub';
  sub.textContent = [item.artist, item.album].filter(Boolean).join(' · ');
  info.append(name, sub);

  card.append(img, info, buildRemoveBtn(item.title));
  return card;
}

function favImg(src, alt) {
  const img = document.createElement('img');
  img.src     = src || 'assets/cover-placeholder.svg';
  img.alt     = alt;
  img.onerror = () => { img.src = 'assets/cover-placeholder.svg'; };
  return img;
}

function buildRemoveBtn(name) {
  const btn = document.createElement('button');
  btn.className = 'fav-card__remove';
  btn.setAttribute('aria-label', `Remove ${name} from favorites`);
  btn.setAttribute('type', 'button');
  btn.textContent = '✕';
  return btn;
}

//  STATS TAB

function renderStats() {
  const log   = getLog();
  const stats = computeStats(log);

  // Summary cards
  setText('stat-total-time',   formatTotalTime(stats.totalDuration));
  setText('stat-total-songs',  stats.totalSongs);
  setText('stat-total-albums', stats.totalAlbums);
  setText('stat-mean-rating',  stats.meanRating ?? '—');

  renderYearBars(stats.byYear);
  renderArtistTable(stats.byArtist);
  renderGenreTable(stats.byGenre);
}

function renderYearBars(byYear) {
  const container = document.getElementById('stats-by-year');
  const emptyEl   = document.getElementById('year-empty');
  if (!container) return;
  container.innerHTML = '';

  if (!byYear.length) { emptyEl?.removeAttribute('hidden'); return; }
  emptyEl?.setAttribute('hidden', '');

  const maxCount = Math.max(...byYear.map(y => y.count));

  byYear.forEach(y => {
    const pct = maxCount ? Math.round((y.count / maxCount) * 100) : 0;

    const row = document.createElement('div');
    row.className = 'stats-bar-row';
    row.setAttribute('role', 'listitem');
    row.setAttribute('aria-label', `${y.year}: ${y.count} entries`);

    const label = document.createElement('span');
    label.className = 'stats-bar-row__label';
    label.textContent = y.year;

    const track = document.createElement('div');
    track.className = 'stats-bar-row__track';
    track.setAttribute('aria-hidden', 'true');

    const fill = document.createElement('div');
    fill.className = 'stats-bar-row__fill';
    // Set CSS custom property programmatically — not an inline style=""
    fill.style.setProperty('--bar-pct', `${pct}%`);
    track.appendChild(fill);

    const count = document.createElement('span');
    count.className = 'stats-bar-row__count';
    count.textContent = `${y.count} ${y.count === 1 ? 'entry' : 'entries'}`;

    const avg = document.createElement('span');
    avg.className = 'stats-bar-row__avg';
    avg.textContent = y.avgRating ? `★ ${y.avgRating}` : '—';

    row.append(label, track, count, avg);
    container.appendChild(row);
  });
}

function renderArtistTable(byArtist) {
  const tbody   = document.getElementById('artist-tbody');
  const emptyEl = document.getElementById('artist-empty');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!byArtist.length) { emptyEl?.removeAttribute('hidden'); return; }
  emptyEl?.setAttribute('hidden', '');

  byArtist.forEach((a, i) => {
    const tr = document.createElement('tr');
    tr.append(
      makeCell('', i + 1, true),
      makeCell('', a.name),
      makeCell('', a.count),
      makeCell('', a.avgRating ? `★ ${a.avgRating}` : '—'),
      makeCell('', formatTotalTime(a.duration)),
    );
    tbody.appendChild(tr);
  });
}

function renderGenreTable(byGenre) {
  const tbody   = document.getElementById('genre-tbody');
  const emptyEl = document.getElementById('genre-empty');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!byGenre.length) { emptyEl?.removeAttribute('hidden'); return; }
  emptyEl?.setAttribute('hidden', '');

  byGenre.forEach(g => {
    const label = g.genre.charAt(0).toUpperCase() + g.genre.slice(1);
    const tr = document.createElement('tr');
    tr.append(
      makeCell('', label),
      makeCell('', g.count),
      makeCell('', g.avgRating ? `★ ${g.avgRating}` : '—'),
      makeCell('', formatTotalTime(g.duration)),
      makeCell('', `${g.share}%`),
    );
    tbody.appendChild(tr);
  });
}

//  HELPERS

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '';
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function makeCell(className, text, center = false) {
  const td = document.createElement('td');
  if (className) td.className = className;
  if (center)    td.style.textAlign = 'center';
  td.textContent = text ?? '';
  return td;
}