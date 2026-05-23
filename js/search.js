import { searchMusicBrainz } from './api.js';
import { addEntry, generateId, addFavorite } from './storage.js';

export function initSearch() {
  const searchBtn     = document.getElementById('search-btn');
  const searchInput   = document.getElementById('search-input');
  const resultsGrid   = document.getElementById('search-results');
  const loadingMsg    = document.getElementById('search-loading');
  const errorMsg      = document.getElementById('search-error');
  const emptyState    = document.getElementById('search-empty');
  const noResults     = document.getElementById('search-no-results');
  const resultsCount  = document.getElementById('results-count');

  if (!searchBtn || !searchInput) return;

  searchBtn.addEventListener('click', async (e) => {
    e.preventDefault(); 
    
    const query = searchInput.value.trim();
    if (!query) return;

    // Get selected radio button type
    const typeOption = document.querySelector('input[name="search-type"]:checked');
    const type = typeOption ? typeOption.value : 'recording';

    // Reset UI states
    emptyState?.setAttribute('hidden', '');
    noResults?.setAttribute('hidden', '');
    errorMsg?.setAttribute('hidden', '');
    resultsGrid.innerHTML = '';
    if (resultsCount) resultsCount.textContent = '';
    
    // Show Loading
    loadingMsg?.removeAttribute('hidden');

    try {
      const results = await searchMusicBrainz(type, query);
      
      // Hide Loading
      loadingMsg?.setAttribute('hidden', '');
      
      if (results.length === 0) {
        noResults?.removeAttribute('hidden');
        return;
      }

      if (resultsCount) resultsCount.textContent = `Found ${results.length} results.`;

      // Render results mapping to your HTML template structure
      results.forEach(result => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.setAttribute('role', 'listitem');
        card.setAttribute('tabindex', '0');
        
        // Simple click-to-log handler template
        card.addEventListener('click', () => {
          document.getElementById('log-title').value = result.title || '';
          document.getElementById('log-artist').value = result.artist || '';
          document.getElementById('log-year').value = result.year || '';
          document.getElementById('log-type').value = result.type === 'song' ? 'song' : 'album';
          document.getElementById('log-cover-url').value = result.coverUrl || '';
          document.getElementById('log-duration').value = result.duration || 0;
          
          document.getElementById('log-title').focus();
        });

        const coverWrap = document.createElement('div');
        coverWrap.className = 'result-card__cover-wrap';
        
        const img = document.createElement('img');
        img.className = 'result-card__cover';
        img.src = result.coverUrl || 'assets/cover-placeholder.svg';
        img.alt = `Cover art for ${result.title} by ${result.artist}`;
        img.onerror = () => { img.src = 'assets/cover-placeholder.svg'; };
        
        const overlay = document.createElement('div');
        overlay.className = 'result-card__overlay';
        overlay.innerHTML = '<span class="result-card__log-icon">+ Log</span>';
        
        coverWrap.append(img, overlay);

        const info = document.createElement('div');
        info.className = 'result-card__info';
        
        const typeTag = document.createElement('span');
        typeTag.className = `result-card__type tag tag--${result.type}`;
        typeTag.textContent = result.type;
        
        const title = document.createElement('h3');
        title.className = 'result-card__title';
        title.textContent = result.title;
        
        const artist = document.createElement('p');
        artist.className = 'result-card__artist';
        artist.textContent = result.artist;
        
        const meta = document.createElement('p');
        meta.className = 'result-card__meta';
        meta.textContent = result.year ? result.year : 'Unknown Year';
        
        info.append(typeTag, title, artist, meta);
        card.append(coverWrap, info);
        resultsGrid.appendChild(card);
      });

    } catch (error) {
      loadingMsg?.setAttribute('hidden', '');
      errorMsg?.removeAttribute('hidden');
      console.error("Search failed:", error);
    }
  });

  // Optional: Trigger search on "Enter" key press
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchBtn.click();
    }
  });
  const logForm = document.getElementById('log-form');
  const logFeedback = document.getElementById('log-feedback');

  if (logForm) {
    logForm.addEventListener('submit', (e) => {
      e.preventDefault(); // Prevent page reload

      const title = document.getElementById('log-title').value.trim();
      const artist = document.getElementById('log-artist').value.trim();
      const type = document.getElementById('log-type').value;

      // Ensure required fields are filled
      if (!title || !artist || !type) {
        if (logFeedback) {
          logFeedback.textContent = 'Please fill out Title, Artist, and Type.';
          logFeedback.className = 'form-feedback form-feedback--error';
        }
        return;
      }

      // Build the data object
      const entry = {
        id: document.getElementById('log-edit-id').value || generateId(),
        title: title,
        artist: artist,
        album: document.getElementById('log-album').value.trim(),
        type: type,
        year: parseInt(document.getElementById('log-year').value, 10) || null,
        genre: document.getElementById('log-genre').value,
        rating: parseInt(document.getElementById('log-rating').value, 10),
        dateLogged: document.getElementById('log-date').value || new Date().toISOString().split('T')[0],
        review: document.getElementById('log-review').value.trim(),
        coverUrl: document.getElementById('log-cover-url').value,
        duration: parseInt(document.getElementById('log-duration').value, 10) || 0
      };

      // Save to local storage
      addEntry(entry);

      // Handle the Favorites checkbox
      if (document.getElementById('log-favorite').checked) {
        const favType = type === 'song' ? 'songs' : 'albums';
        addFavorite(favType, {
          id: entry.id,
          title: entry.title,
          artist: entry.artist,
          coverUrl: entry.coverUrl,
          year: entry.year
        });
      }

      // Show success message and clear form
      if (logFeedback) {
        logFeedback.textContent = 'Successfully logged! 🎵';
        logFeedback.className = 'form-feedback form-feedback--success';
        
        setTimeout(() => {
          logFeedback.textContent = '';
          logForm.reset();
        }, 2000);
      }
    });
  }
}