//  - Mobile nav toggle (runs on every page)
//   - Auth-aware nav link (Sign In ↔ username)
//   - Home page init (feed + sidebar)
//   - Routes to the correct page controller


import { initSearch }  from './search.js';
import { initProfile } from './profile.js';
import { initLogin }   from './login.js';
import { initSaved }   from './saved.js';
import {
  getUser, getLog, getActivity,
  formatTotalTime, formatDateShort, buildStars,
} from './storage.js';
import { fetchRecentReleases } from './api.js';

const PAGE = document.body.dataset.page;

//  MOBILE NAV TOGGLE  (shared across every page)

function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const drawer = document.getElementById('nav-mobile');
  if (!toggle || !drawer) return;

  toggle.addEventListener('click', () => {
    const opening = drawer.hasAttribute('hidden');
    drawer.toggleAttribute('hidden', !opening);
    toggle.setAttribute('aria-expanded', String(opening));
    toggle.setAttribute('aria-label', opening ? 'Close navigation menu' : 'Open navigation menu');
  });

  // Close drawer when any link inside it is followed
  drawer.addEventListener('click', e => {
    if (e.target.tagName === 'A') {
      drawer.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

//  AUTH-AWARE NAV  (swap "Sign In" link for username on all pages)

function updateNavAuthState() {
  const user = getUser();
  if (!user?.username) return;

  document.querySelectorAll('a[href="login.html"]').forEach(link => {
    link.textContent = user.username;
    link.href = 'profile.html';
    link.setAttribute('aria-label', `Your profile — ${user.username}`);
  });
}

//  HOME PAGE

function initHome() {
  renderSidebarProfilePeek();
  renderFeed();
  renderRecentSidebar();
  loadTrending();
}

function renderSidebarProfilePeek() {
  const user = getUser();
  const log  = getLog();

  const usernameEl = document.getElementById('sidebar-username');
  const statsEl    = document.getElementById('sidebar-stats');
  const avatarEl   = document.getElementById('sidebar-avatar');

  if (usernameEl) usernameEl.textContent = user?.username ?? 'Anonymous';
  if (statsEl) {
    const songs = log.filter(e => e.type === 'song').length;
    const time  = log.reduce((s, e) => s + (e.duration || 0), 0);
    statsEl.textContent = `${songs} songs · ${formatTotalTime(time)} listened`;
  }
  if (avatarEl && user?.avatar) avatarEl.src = user.avatar;
}

function renderFeed() {
  const feedEl    = document.getElementById('activity-feed');
  const loadingEl = document.getElementById('feed-loading');
  const emptyEl   = document.getElementById('feed-empty');
  const countEl   = document.getElementById('feed-count');
  if (!feedEl) return;

  const entries = getActivity();
  loadingEl?.setAttribute('hidden', '');

  if (!entries.length) {
    emptyEl?.removeAttribute('hidden');
    return;
  }

  if (countEl) countEl.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;

  entries.forEach((entry, i) => {
    const card = createActivityCard(entry);
    card.style.animationDelay = `${Math.min(i, 8) * 0.05}s`;
    feedEl.appendChild(card);
  });
}

function createActivityCard(entry) {
  const article = document.createElement('article');
  article.className = 'activity-card';
  article.setAttribute('aria-label', `${entry.title} by ${entry.artist}`);

  // Cover
  const coverLink = document.createElement('a');
  coverLink.className = 'activity-card__cover-link';
  coverLink.href = `search.html?edit=${entry.id}`;
  coverLink.setAttribute('aria-label', `Edit log entry for ${entry.title}`);

  const img = document.createElement('img');
  img.className = 'activity-card__cover';
  img.alt = `Cover art for ${entry.title} by ${entry.artist}`;
  img.src = entry.coverUrl || 'assets/cover-placeholder.svg';
  img.onerror = () => { img.src = 'assets/cover-placeholder.svg'; };
  coverLink.appendChild(img);

  // Body
  const body = document.createElement('div');
  body.className = 'activity-card__body';

  const meta = document.createElement('div');
  meta.className = 'activity-card__meta';

  const typeTag = document.createElement('span');
  typeTag.className = `tag tag--${entry.type}`;
  typeTag.textContent = entry.type;

  const dateEl = document.createElement('time');
  dateEl.className = 'activity-card__date';
  dateEl.dateTime  = entry.dateLogged;
  dateEl.textContent = formatDateShort(entry.dateLogged);

  meta.append(typeTag, dateEl);

  const title = document.createElement('h2');
  title.className = 'activity-card__title';
  title.textContent = entry.title;

  const artist = document.createElement('p');
  artist.className = 'activity-card__artist';
  artist.textContent = [entry.artist, entry.album, entry.year].filter(Boolean).join(' · ');

  const ratingRow = document.createElement('div');
  ratingRow.className = 'activity-card__rating';
  ratingRow.setAttribute('aria-label', `Rating: ${entry.rating} out of 10`);

  const stars = document.createElement('span');
  stars.className = 'activity-card__stars';
  stars.setAttribute('aria-hidden', 'true');
  stars.textContent = buildStars(entry.rating);

  const score = document.createElement('span');
  score.className = 'activity-card__score';
  score.textContent = `${entry.rating} / 10`;

  ratingRow.append(stars, score);
  body.append(meta, title, artist, ratingRow);

  if (entry.review) {
    const review = document.createElement('p');
    review.className = 'activity-card__review';
    review.textContent = `"${entry.review}"`;
    body.appendChild(review);
  }

  article.append(coverLink, body);
  return article;
}

function renderRecentSidebar() {
  const listEl  = document.getElementById('recent-list');
  const emptyEl = document.getElementById('recent-empty');
  if (!listEl) return;

  const entries = getLog().slice(0, 5);

  if (!entries.length) {
    emptyEl?.removeAttribute('hidden');
    return;
  }

  entries.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'recent-item';

    const img = document.createElement('img');
    img.className = 'recent-item__cover';
    img.src = entry.coverUrl || 'assets/cover-placeholder.svg';
    img.alt = `Cover for ${entry.title}`;
    img.onerror = () => { img.src = 'assets/cover-placeholder.svg'; };

    const info = document.createElement('div');
    info.className = 'recent-item__info';

    const titleEl = document.createElement('span');
    titleEl.className = 'recent-item__title';
    titleEl.textContent = entry.title;

    const artistEl = document.createElement('span');
    artistEl.className = 'recent-item__artist';
    artistEl.textContent = entry.artist;

    info.append(titleEl, artistEl);

    const score = document.createElement('span');
    score.className = 'recent-item__score';
    score.setAttribute('aria-label', `Rated ${entry.rating} out of 10`);
    score.textContent = entry.rating;

    li.append(img, info, score);
    listEl.appendChild(li);
  });
}

async function loadTrending() {
  const listEl    = document.getElementById('trending-list');
  const loadingEl = document.getElementById('trending-loading');
  const errorEl   = document.getElementById('trending-error');
  if (!listEl) return;

  try {
    const releases = await fetchRecentReleases(5);
    loadingEl?.setAttribute('hidden', '');

    if (!releases.length) {
      errorEl?.removeAttribute('hidden');
      return;
    }

    releases.forEach(release => {
      const li = document.createElement('li');
      li.className = 'trending-item';

      const img = document.createElement('img');
      img.className = 'trending-item__cover';
      img.alt = `Cover for ${release.title} by ${release.artist}`;
      img.src = release.coverUrl || 'assets/cover-placeholder.svg';
      img.onerror = () => { img.src = 'assets/cover-placeholder.svg'; };

      const info = document.createElement('div');
      info.className = 'trending-item__info';

      const titleEl = document.createElement('span');
      titleEl.className = 'trending-item__title';
      titleEl.textContent = release.title;

      const artistEl = document.createElement('span');
      artistEl.className = 'trending-item__artist';
      artistEl.textContent = release.artist;

      info.append(titleEl, artistEl);
      li.append(img, info);
      listEl.appendChild(li);
    });
  } catch {
    loadingEl?.setAttribute('hidden', '');
    errorEl?.removeAttribute('hidden');
  }
}

//  ROUTER — run on every page load

initNav();
updateNavAuthState();

switch (PAGE) {
  case 'home':    initHome();    break;
  case 'search':  initSearch();  break;
  case 'profile': initProfile(); break;
  case 'login':   initLogin();   break;
  case 'saved':   initSaved();   break;
}