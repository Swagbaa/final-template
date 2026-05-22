// ── Storage keys ──
const KEYS = {
  USER:      'ml_user',
  LOG:       'ml_log',
  FAVORITES: 'ml_favorites',
  ACTIVITY:  'ml_activity',
};

const ACTIVITY_LIMIT = 30;

// ── ID generator ───
export const generateId = () => {
  // Use secure crypto if available, otherwise fallback for local file:// testing
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

//  USER  (profile info)

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.USER)) ?? null;
  } catch {
    return null;
  }
}

export function saveUser(user) {
  localStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export function isLoggedIn() {
  return getUser() !== null;
}

// ================================================================
//  LOG  (array of LogEntry objects)
// ================================================================

export function getLog() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.LOG)) ?? [];
  } catch {
    return [];
  }
}

export function saveLog(entries) {
  localStorage.setItem(KEYS.LOG, JSON.stringify(entries));
}

export function addEntry(entry) {
  const log = getLog();
  log.unshift(entry);       // newest first
  saveLog(log);
  pushActivity(entry);
  return log;
}

export function updateEntry(id, updates) {
  const log = getLog();
  const idx = log.findIndex(e => e.id === id);
  if (idx === -1) return log;
  log[idx] = { ...log[idx], ...updates };
  saveLog(log);
  return log;
}

export function deleteEntry(id) {
  const log = getLog().filter(e => e.id !== id);
  saveLog(log);
  // Also remove from activity
  const activity = getActivity().filter(e => e.id !== id);
  localStorage.setItem(KEYS.ACTIVITY, JSON.stringify(activity));
  return log;
}

export function getEntryById(id) {
  return getLog().find(e => e.id === id) ?? null;
}

//  FAVORITES  ({ artists: [], albums: [], songs: [] })

function defaultFavorites() {
  return { artists: [], albums: [], songs: [] };
}

export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.FAVORITES)) ?? defaultFavorites();
  } catch {
    return defaultFavorites();
  }
}

export function saveFavorites(favs) {
  localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favs));
}

export function addFavorite(type, item) {
  const favs = getFavorites();
  const list = favs[type] ?? [];
  if (!list.some(f => f.id === item.id)) {
    list.push(item);
    favs[type] = list;
    saveFavorites(favs);
  }
}

export function removeFavorite(type, id) {
  const favs = getFavorites();
  favs[type] = (favs[type] ?? []).filter(f => f.id !== id);
  saveFavorites(favs);
}

//  ACTIVITY  (recent feed — last N entries)

export function getActivity() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.ACTIVITY)) ?? [];
  } catch {
    return [];
  }
}

function pushActivity(entry) {
  const activity = getActivity();
  // Avoid duplicates (e.g. on edits)
  const fresh = [entry, ...activity.filter(e => e.id !== entry.id)];
  localStorage.setItem(KEYS.ACTIVITY, JSON.stringify(fresh.slice(0, ACTIVITY_LIMIT)));
}

//  FORMATTERS

export function formatDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatTotalTime(totalSeconds) {
  if (!totalSeconds) return '0m';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function buildStars(rating) {
  const n = Math.max(0, Math.min(10, Math.round(rating)));
  return '★'.repeat(n) + '☆'.repeat(10 - n);
}

//  STATS ENGINE

export function computeStats(log) {
  const totalEntries  = log.length;
  const totalSongs    = log.filter(e => e.type === 'song').length;
  const totalAlbums   = log.filter(e => e.type !== 'song').length;
  const totalDuration = log.reduce((sum, e) => sum + (e.duration || 0), 0);

  const rated    = log.filter(e => e.rating > 0);
  const meanRating = rated.length
    ? (rated.reduce((s, e) => s + e.rating, 0) / rated.length).toFixed(1)
    : null;

  const artistMap = {};
  log.forEach(e => {
    if (!e.artist) return;
    if (!artistMap[e.artist]) {
      artistMap[e.artist] = { name: e.artist, count: 0, duration: 0, ratingSum: 0, ratingCount: 0 };
    }
    const a = artistMap[e.artist];
    a.count++;
    a.duration    += (e.duration || 0);
    if (e.rating)  { a.ratingSum += e.rating; a.ratingCount++; }
  });

  const byArtist = Object.values(artistMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(a => ({ ...a, avgRating: a.ratingCount ? (a.ratingSum / a.ratingCount).toFixed(1) : null }));

  const genreMap = {};
  log.forEach(e => {
    if (!e.genre) return;
    if (!genreMap[e.genre]) {
      genreMap[e.genre] = { genre: e.genre, count: 0, duration: 0, ratingSum: 0, ratingCount: 0 };
    }
    const g = genreMap[e.genre];
    g.count++;
    g.duration   += (e.duration || 0);
    if (e.rating) { g.ratingSum += e.rating; g.ratingCount++; }
  });

  const byGenre = Object.values(genreMap)
    .sort((a, b) => b.count - a.count)
    .map(g => ({
      ...g,
      avgRating: g.ratingCount ? (g.ratingSum / g.ratingCount).toFixed(1) : null,
      share: totalEntries ? Math.round((g.count / totalEntries) * 100) : 0,
    }));

  const yearMap = {};
  log.forEach(e => {
    const yr = Number(e.year);
    if (!yr) return;
    if (!yearMap[yr]) {
      yearMap[yr] = { year: yr, count: 0, ratingSum: 0, ratingCount: 0 };
    }
    const y = yearMap[yr];
    y.count++;
    if (e.rating) { y.ratingSum += e.rating; y.ratingCount++; }
  });

  const byYear = Object.values(yearMap)
    .sort((a, b) => b.year - a.year)
    .map(y => ({ ...y, avgRating: y.ratingCount ? (y.ratingSum / y.ratingCount).toFixed(1) : null }));

  return {
    totalEntries,
    totalSongs,
    totalAlbums,
    totalDuration,
    meanRating,
    uniqueArtists: Object.keys(artistMap).length,
    topGenre: byGenre[0]?.genre ?? null,
    byArtist,
    byGenre,
    byYear,
  };
}