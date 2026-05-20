/* ================================================================
   saved.js — Saved / Favorites standalone page controller.
   Renders the user's favorited artists, albums, and songs as a
   full-page view with remove functionality.
   ================================================================ */

import { getFavorites, removeFavorite, getUser } from './storage.js';


export function initSaved() {
  renderPageHeader();
  renderSection('artists', 'fav-artists-grid', 'fav-artists-empty', buildArtistCard);
  renderSection('albums',  'fav-albums-grid',  'fav-albums-empty',  buildAlbumCard);
  renderSection('songs',   'fav-songs-grid',   'fav-songs-empty',   buildSongCard);
}

//  PAGE HEADER

function renderPageHeader() {
  const user    = getUser();
  const nameEl  = document.getElementById('saved-username');
  if (nameEl && user?.username) {
    nameEl.textContent = `${user.username}'s Favorites`;
  }
}

//  GENERIC SECTION RENDERER

function renderSection(type, gridId, emptyId, buildFn) {
  const grid    = document.getElementById(gridId);
  const emptyEl = document.getElementById(emptyId);
  if (!grid) return;

  grid.innerHTML = '';

  const items = getFavorites()[type] ?? [];

  if (!items.length) {
    emptyEl?.removeAttribute('hidden');
    updateCount(type, 0);
    return;
  }

  emptyEl?.setAttribute('hidden', '');
  updateCount(type, items.length);

  // CLOSURE: each card's remove handler captures its own `item`
  items.forEach(item => {
    const card      = buildFn(item);
    const removeBtn = card.querySelector('.fav-card__remove');

    removeBtn?.addEventListener('click', () => {
      removeFavorite(type, item.id);
      card.remove();
      const remaining = grid.querySelectorAll('.fav-card').length;
      updateCount(type, remaining);
      if (!remaining) emptyEl?.removeAttribute('hidden');
    });

    grid.appendChild(card);
  });
}

function updateCount(type, count) {
  const el = document.getElementById(`fav-${type}-count`);
  if (el) el.textContent = count || '';
}

//  CARD BUILDERS

function buildArtistCard(item) {
  const card = document.createElement('div');
  card.className = 'fav-card fav-card--artist';
  card.setAttribute('role', 'listitem');

  const wrap = document.createElement('div');
  wrap.className = 'fav-card__avatar-wrap';
  const img = makeImg(item.coverUrl || 'assets/avatar-placeholder.svg', item.title ?? item.artist ?? '');
  img.className = 'fav-card__avatar';
  wrap.appendChild(img);

  const name = document.createElement('span');
  name.className = 'fav-card__name';
  name.textContent = item.title ?? item.artist ?? '';

  card.append(wrap, name, makeRemoveBtn(item.title ?? ''));
  return card;
}

function buildAlbumCard(item) {
  const card = document.createElement('div');
  card.className = 'fav-card fav-card--album';
  card.setAttribute('role', 'listitem');

  const img = makeImg(item.coverUrl, `Cover for ${item.title}`);
  img.className = 'fav-card__cover';

  const info = document.createElement('div');
  info.className = 'fav-card__info';

  const name = document.createElement('span');
  name.className = 'fav-card__name';
  name.textContent = item.title;

  const sub = document.createElement('span');
  sub.className = 'fav-card__sub';
  sub.textContent = [item.artist, item.year].filter(Boolean).join(' · ');

  info.append(name, sub);
  card.append(img, info, makeRemoveBtn(item.title));
  return card;
}

function buildSongCard(item) {
  const card = document.createElement('div');
  card.className = 'fav-card fav-card--song';
  card.setAttribute('role', 'listitem');

  const img = makeImg(item.coverUrl, `Cover for ${item.title}`);
  img.className = 'fav-card__cover';

  const info = document.createElement('div');
  info.className = 'fav-card__info';

  const name = document.createElement('span');
  name.className = 'fav-card__name';
  name.textContent = item.title;

  const sub = document.createElement('span');
  sub.className = 'fav-card__sub';
  sub.textContent = [item.artist, item.album].filter(Boolean).join(' · ');

  info.append(name, sub);
  card.append(img, info, makeRemoveBtn(item.title));
  return card;
}

//  HELPERS

function makeImg(src, alt) {
  const img = document.createElement('img');
  img.src     = src || 'assets/cover-placeholder.svg';
  img.alt     = alt;
  img.onerror = () => { img.src = 'assets/cover-placeholder.svg'; };
  return img;
}

function makeRemoveBtn(name) {
  const btn = document.createElement('button');
  btn.className = 'fav-card__remove';
  btn.setAttribute('aria-label', `Remove ${name} from favorites`);
  btn.setAttribute('type', 'button');
  btn.textContent = '✕';
  return btn;
}