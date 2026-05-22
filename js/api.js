const MB_BASE    = 'https://musicbrainz.org/ws/2';
const CAA_BASE   = 'https://coverartarchive.org/release';
const USER_AGENT = 'MusicLog/1.0 (musiclog-student-project)';

export function debounce(fn, delay) {
  let timerId;                       
  return function (...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// base fetcher
async function mbFetch(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${MB_BASE}${path}${sep}fmt=json`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) throw new Error(`MusicBrainz ${res.status}: ${res.statusText}`);
  return res.json();
}

// search

/**
 * Search MusicBrainz.
 * @param {'recording'|'release'|'artist'} type
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<NormalizedResult[]>}
 */
export async function searchMusicBrainz(type, query, limit = 12) {
  const encoded = encodeURIComponent(query.trim());
  if (!encoded) return [];

  const data = await mbFetch(`/${type}?query=${encoded}&limit=${limit}`);

  switch (type) {
    case 'recording': return (data.recordings ?? []).map(normalizeRecording);
    case 'release':   return (data.releases   ?? []).map(normalizeRelease);
    case 'artist':    return (data.artists    ?? []).map(normalizeArtist);
    default:          return [];
  }
}

// normalizing responsive

function normalizeRecording(r) {
  const artistCredit = r['artist-credit'] ?? [];
  const artistName   = artistCredit.map(c => typeof c === 'string' ? c : c.name ?? c.artist?.name ?? '').join('');
  const artistMbid   = artistCredit[0]?.artist?.id ?? '';

  const release      = r.releases?.[0] ?? {};
  const year         = release.date ? parseInt(release.date, 10) : null;

  return {
    mbid:       r.id,
    type:       'song',
    title:      r.title ?? '',
    artist:     artistName,
    artistMbid,
    album:      release.title ?? '',
    releaseMbid: release.id ?? '',
    year,
    duration:   r.length ? Math.round(r.length / 1000) : 0,  // ms → s
    coverUrl:   release.id ? getCoverUrl(release.id) : '',
  };
}

function normalizeRelease(r) {
  const artistCredit = r['artist-credit'] ?? [];
  const artistName   = artistCredit.map(c => typeof c === 'string' ? c : c.name ?? c.artist?.name ?? '').join('');
  const artistMbid   = artistCredit[0]?.artist?.id ?? '';
  const year         = r.date ? parseInt(r.date, 10) : null;
  const primaryType  = r['release-group']?.['primary-type'] ?? 'Album';

  return {
    mbid:       r.id,
    type:       mapReleaseType(primaryType),
    title:      r.title ?? '',
    artist:     artistName,
    artistMbid,
    album:      r.title ?? '',
    releaseMbid: r.id,
    year,
    duration:   0,   
    coverUrl:   getCoverUrl(r.id),
  };
}

function normalizeArtist(a) {
  return {
    mbid:       a.id,
    type:       'artist',
    title:      a.name ?? '',
    artist:     a.name ?? '',
    artistMbid: a.id,
    album:      '',
    releaseMbid: '',
    year:       null,
    duration:   0,
    coverUrl:   '',
  };
}

function mapReleaseType(mbType) {
  switch ((mbType ?? '').toLowerCase()) {
    case 'single': return 'single';
    case 'ep':     return 'ep';
    default:       return 'album';
  }
}

// cover art

export function getCoverUrl(releaseMbid) {
  if (!releaseMbid) return '';
  return `${CAA_BASE}/${releaseMbid}/front-250`;
}

// trending or recent releases  

export async function fetchRecentReleases(limit = 6) {
  const year = new Date().getFullYear();
  // Search for album releases from this year or last year
  const data = await mbFetch(`/release?query=date:${year}+AND+status:Official&limit=${limit}`);
  const releases = data.releases ?? [];

  // If current year returns too few results, fall back to previous year
  const results = releases.length >= 3
    ? releases
    : (await mbFetch(`/release?query=date:${year - 1}+AND+status:Official&limit=${limit}`)).releases ?? [];

  return results.map(normalizeRelease);
}