import { initSearch }  from './search.js';
import { initProfile } from './profile.js';
import {
  getUser, saveUser, isLoggedIn,
  getLog, getActivity,
  formatTotalTime, formatDateShort, buildStars,
} from './storage.js';
import { fetchRecentReleases, getCoverUrl } from './api.js';

// Page detection 
const PAGE = document.body.dataset.page;

//  SHARED: Mobile nav toggle  (runs on every page)

function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const drawer = document.getElementById('nav-mobile');
  if (!toggle || !drawer) return;

  toggle.addEventListener('click', () => {
    const isOpen = !drawer.hasAttribute('hidden');
    drawer.toggleAttribute('hidden', isOpen);
    toggle.setAttribute('aria-expanded', String(!isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Open navigation menu' : 'Close navigation menu');
  });

  // Close drawer when a link inside it is clicked
  drawer.addEventListener('click', e => {
    if (e.target.tagName === 'A') {
      drawer.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

//  SHARED: Auth-aware nav  (swaps "Sign In" → username on every page)

function updateNavAuthState() {
  const user = getUser();
  // Find every Sign In link in both desktop and mobile navs
  document.querySelectorAll('a[href="login.html"]').forEach(link => {
    if (user?.username) {
      link.textContent = user.username;
      link.href = 'profile.html';
      link.setAttribute('aria-label', `Your profile — ${user.username}`);
    }
  });
}

//  HOME PAGE

export function initHome() {
  updateHomeProfilePeek();
  renderFeed();
  renderRecentSidebar();
  loadTrending();
}

function updateHomeProfilePeek() {
  const user    = getUser();
  const log     = getLog();
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
  const feed      = document.getElementById('activity-feed');
  const loading   = document.getElementById('feed-loading');
  const emptyEl   = document.getElementById('feed-empty');
  const countEl   = document.getElementById('feed-count');
  if (!feed) return;

  const entries = getActivity();
  loading?.setAttribute('hidden', '');

  if (!entries.length) {
    emptyEl?.removeAttribute('hidden');
    return;
  }

  if (countEl) countEl.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;

  entries.forEach((entry, i) => {
    const card = createActivityCard(entry);
    card.style.animationDelay = `${i * 0.05}s`;
    feed.appendChild(card);
  });
}

function createActivityCard(entry) {
  const article = document.createElement('article');
  article.className = 'activity-card';
  article.setAttribute('aria-label', `${entry.title} by ${entry.artist}`);

  // Cover
  const coverLink = document.createElement('a');
  coverLink.className = 'activity-card__cover-link';
  coverLink.href = 'search.html';
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
  const date = document.createElement('time');
  date.className = 'activity-card__date';
  date.dateTime = entry.dateLogged;
  date.textContent = formatDateShort(entry.dateLogged);
  meta.append(typeTag, date);

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
  const list    = document.getElementById('recent-list');
  const emptyEl = document.getElementById('recent-empty');
  if (!list) return;

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
    const titleEl  = document.createElement('span');
    titleEl.className = 'recent-item__title';
    titleEl.textContent = entry.title;
    const artistEl = document.createElement('span');
    artistEl.className = 'recent-item__artist';
    artistEl.textContent = entry.artist;
    info.append(titleEl, artistEl);

    const score = document.createElement('span');
    score.className = 'recent-item__score';
    score.setAttribute('aria-label', `Rated ${entry.rating}`);
    score.textContent = entry.rating;

    li.append(img, info, score);
    list.appendChild(li);
  });
}

async function loadTrending() {
  const list      = document.getElementById('trending-list');
  const loadingEl = document.getElementById('trending-loading');
  const errorEl   = document.getElementById('trending-error');
  if (!list) return;

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
      const titleEl  = document.createElement('span');
      titleEl.className = 'trending-item__title';
      titleEl.textContent = release.title;
      const artistEl = document.createElement('span');
      artistEl.className = 'trending-item__artist';
      artistEl.textContent = release.artist;
      info.append(titleEl, artistEl);

      li.append(img, info);
      list.appendChild(li);
    });
  } catch {
    loadingEl?.setAttribute('hidden', '');
    errorEl?.removeAttribute('hidden');
  }
}

//  LOGIN PAGE

export function initLogin() {
  // If already logged in, go straight to home
  if (isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  initLoginTabs();
  initLoginForm();
  initRegisterForm();
}

function initLoginTabs() {
  const tabs   = document.querySelectorAll('.login-tab');
  const panels = document.querySelectorAll('.login-panel');

  function switchTab(target) {
    tabs.forEach(t => {
      const active = t.dataset.tab === target;
      t.classList.toggle('login-tab--active', active);
      t.setAttribute('aria-selected', String(active));
    });
    panels.forEach(p => {
      const active = p.id === `panel-${target}`;
      p.toggleAttribute('hidden', !active);
      if (active) p.classList.add('login-panel--active');
      else        p.classList.remove('login-panel--active');
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Cross-link buttons inside forms
  document.getElementById('go-register')?.addEventListener('click', () => switchTab('register'));
  document.getElementById('go-login')?.addEventListener('click',    () => switchTab('login'));
}

function initLoginForm() {
  const form      = document.getElementById('login-form');
  const feedback  = document.getElementById('login-feedback');
  const errEl     = document.getElementById('err-login-username');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    clearMessages(feedback, errEl);

    const username = form.querySelector('#login-username').value.trim();

    if (!username) {
      showFieldError(errEl, 'Please enter your username.');
      return;
    }

    const user = getUser();
    if (!user) {
      showFeedback(feedback, 'No account found. Create one using the Create Account tab.', 'error');
      return;
    }
    if (user.username.toLowerCase() !== username.toLowerCase()) {
      showFeedback(feedback, 'Username not recognised. Did you mean to create an account?', 'error');
      return;
    }

    showFeedback(feedback, `Welcome back, ${user.username}!`, 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 700);
  });
}

function initRegisterForm() {
  const form     = document.getElementById('register-form');
  const feedback = document.getElementById('register-feedback');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    clearMessages(
      feedback,
      document.getElementById('err-reg-username'),
      document.getElementById('err-reg-email'),
    );

    const username = form.querySelector('#reg-username').value.trim();
    const email    = form.querySelector('#reg-email').value.trim();

    let valid = true;

    if (!username || username.length < 2) {
      showFieldError(document.getElementById('err-reg-username'), 'Username must be at least 2 characters.');
      valid = false;
    }
    if (!/^[A-Za-z0-9_\-]+$/.test(username)) {
      showFieldError(document.getElementById('err-reg-username'), 'Only letters, numbers, _ and - are allowed.');
      valid = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError(document.getElementById('err-reg-email'), 'Please enter a valid email address.');
      valid = false;
    }
    if (!valid) return;

    const user = {
      username,
      email,
      bio:      '',
      country:  '',
      favGenre: '',
      joinDate: new Date().toISOString(),
    };
    saveUser(user);

    showFeedback(feedback, `Account created! Welcome, ${username} 🎵`, 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 900);
  });
}

//  SHARED FORM HELPERS  (used by login + other pages)

function showFieldError(el, msg) {
  if (!el) return;
  el.textContent = msg;
}

function showFeedback(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = `form-feedback form-feedback--${type}`;
}

function clearMessages(...els) {
  els.forEach(el => { if (el) el.textContent = ''; });
}


initNav();
updateNavAuthState();

switch (PAGE) {
  case 'home':    initHome();    break;
  case 'search':  initSearch();  break;
  case 'profile': initProfile(); break;
  case 'login':   initLogin();   break;
}