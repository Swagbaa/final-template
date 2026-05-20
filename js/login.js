import { getUser, saveUser, isLoggedIn } from './storage.js';

//  INIT

export function initLogin() {
  // Already logged in → skip straight to home
  if (isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }
  initLoginTabs();
  initSignInForm();
  initRegisterForm();
}

//  TAB SWITCHER

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
      p.toggleAttribute('hidden', p.id !== `panel-${target}`);
    });
  }

  tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

  // Cross-link buttons inside each panel
  document.getElementById('go-register')?.addEventListener('click', () => switchTab('register'));
  document.getElementById('go-login')?.addEventListener('click',    () => switchTab('login'));
}

//  SIGN IN FORM

function initSignInForm() {
  const form     = document.getElementById('login-form');
  const feedback = document.getElementById('login-feedback');
  const errEl    = document.getElementById('err-login-username');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    clearMessages(feedback, errEl);

    const username = form.querySelector('#login-username')?.value.trim() ?? '';

    if (!username) {
      showFieldError(errEl, 'Please enter your username.');
      return;
    }

    const user = getUser();

    if (!user) {
      showFeedback(feedback, 'No account found. Use the "Create Account" tab to get started.', 'error');
      return;
    }

    if (user.username.toLowerCase() !== username.toLowerCase()) {
      showFeedback(feedback, 'Username not recognised. Check the spelling or create a new account.', 'error');
      return;
    }

    showFeedback(feedback, `Welcome back, ${user.username}! 🎵`, 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 750);
  });
}

//  CREATE ACCOUNT FORM

function initRegisterForm() {
  const form     = document.getElementById('register-form');
  const feedback = document.getElementById('register-feedback');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();

    const errUsername = document.getElementById('err-reg-username');
    const errEmail    = document.getElementById('err-reg-email');
    clearMessages(feedback, errUsername, errEmail);

    const username = form.querySelector('#reg-username')?.value.trim() ?? '';
    const email    = form.querySelector('#reg-email')?.value.trim()    ?? '';

    let valid = true;

    if (username.length < 2) {
      showFieldError(errUsername, 'Username must be at least 2 characters.');
      valid = false;
    } else if (!/^[A-Za-z0-9_\-]+$/.test(username)) {
      showFieldError(errUsername, 'Only letters, numbers, underscores, and hyphens are allowed.');
      valid = false;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError(errEmail, 'Please enter a valid email address.');
      valid = false;
    }

    if (!valid) return;

    saveUser({
      username,
      email,
      bio:      '',
      country:  '',
      favGenre: '',
      public:   true,
      joinDate: new Date().toISOString(),
    });

    showFeedback(feedback, `Account created! Welcome, ${username} 🎵`, 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 900);
  });
}

//  HELPERS

function showFieldError(el, msg) {
  if (el) el.textContent = msg;
}

function showFeedback(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className   = `form-feedback form-feedback--${type}`;
}

function clearMessages(...els) {
  els.forEach(el => { if (el) el.textContent = ''; });
}