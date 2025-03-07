// Import video source utilities and configuration
import { videoSources, generateVideoUrl, getNextSource } from './videoSources.js';
import config from './config.js';

// API endpoints and configuration
const API_URL = config.api.baseUrl;
const API_KEY = config.api.key;

// Current video source state
let currentSourceId = videoSources[0].id;
let currentContentType = 'movie';
let currentContentId = null;
let currentSeason = null;
let currentEpisode = null;

// Cache for storing fetched content
const contentCache = {
    movies: new Map(),
    tv: new Map(),
    seasons: new Map()
};

// Function to fetch movies from TMDB API with caching
window.fetchMovies = async function() {
    try {
        // Check cache first
        if (contentCache.movies.size > 0) {
            loadContent(Array.from(contentCache.movies.values()), 'movie');
            return;
        }

        const response = await fetch(`${API_URL}${config.api.endpoints.movies}?api_key=${API_KEY}&${new URLSearchParams(config.api.params)}`);
        const data = await response.json();
        if (data.results) {
            // Cache the fetched movies
            data.results.forEach(movie => contentCache.movies.set(movie.id, movie));
            loadContent(data.results, 'movie');
        } else {
            console.error('Error fetching movies:', data.status_message);
        }
    } catch (error) {
        console.error('Error fetching movies:', error);
    }
}

// Function to fetch TV shows from TMDB API with caching
window.fetchTVShows = async function() {
    try {
        // Check cache first
        if (contentCache.tv.size > 0) {
            loadContent(Array.from(contentCache.tv.values()), 'tv');
            return;
        }

        const response = await fetch(`${API_URL}${config.api.endpoints.tv}?api_key=${API_KEY}&${new URLSearchParams(config.api.params)}`);
        const data = await response.json();
        if (data.results) {
            // Cache the fetched TV shows
            data.results.forEach(show => contentCache.tv.set(show.id, show));
            loadContent(data.results, 'tv');
        } else {
            console.error('Error fetching TV shows:', data.status_message);
        }
    } catch (error) {
        console.error('Error fetching TV shows:', error);
    }
}

// Function to fetch seasons for a TV show from TMDB API with caching
async function fetchSeasons(showId) {
    try {
        // Check cache first
        if (contentCache.seasons.has(showId)) {
            return contentCache.seasons.get(showId);
        }

        const response = await fetch(`${API_URL}${config.api.endpoints.tvDetails(showId)}?api_key=${API_KEY}`);
        const data = await response.json();
        if (data.seasons) {
            // Cache the fetched seasons
            contentCache.seasons.set(showId, data.seasons);
            return data.seasons;
        } else {
            console.error('Error fetching seasons:', data.status_message);
            return null;
        }
    } catch (error) {
        console.error('Error fetching seasons:', error);
        return null;
    }
}

// Function to search content
async function searchContent(query) {
    if (!query.trim()) {
        fetchMovies();
        return;
    }

    try {
        const response = await fetch(`${API_URL}${config.api.endpoints.search}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&${new URLSearchParams(config.api.params)}`);
        const data = await response.json();
        if (data.results) {
            const movies = data.results.filter(item => item.media_type === 'movie');
            const shows = data.results.filter(item => item.media_type === 'tv');
            
            // Update caches
            movies.forEach(movie => contentCache.movies.set(movie.id, movie));
            shows.forEach(show => contentCache.tv.set(show.id, show));
            
            // Load content based on current type
            loadContent(currentContentType === 'movie' ? movies : shows, currentContentType);
        } else {
            console.error('Error searching content:', data.status_message);
        }
    } catch (error) {
        console.error('Error searching content:', error);
    }
}

// DOM Elements
const movieGrid = document.getElementById('movieGrid');
const searchInput = document.getElementById('searchInput');
const videoPlayer = document.getElementById('videoPlayer');
const sourceSelector = document.getElementById('sourceSelector');

// Initialize source selector
function initializeSourceSelector() {
    sourceSelector.innerHTML = videoSources.map(source => `
        <option value="${source.id}">${source.name}</option>
    `).join('');
    sourceSelector.value = currentSourceId;
}

// Load content into the grid
// Function to load content into the movie grid
function loadContent(items, type) {
    const movieGrid = document.getElementById('movieGrid');
    movieGrid.innerHTML = '';

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card';

        const posterPath = item.poster_path
            ? `${config.images.baseUrl}${config.images.posterSize}${item.poster_path}`
            : 'placeholder.jpg';

        card.innerHTML = `
            <img src="${posterPath}" alt="${item.title || item.name}" class="movie-poster">
            <div class="movie-info">
                <h3>${item.title || item.name}</h3>
                <p class="rating"><i class="fas fa-star"></i> ${item.vote_average.toFixed(1)}</p>
            </div>
        `;

        card.addEventListener('click', () => {
            openVideoModal(item, type);
        });

        movieGrid.appendChild(card);
    });
}

// Play content function
async function playContent(id) {
    currentContentId = id;
    const modal = document.getElementById('videoModal');
    const modalTitle = document.getElementById('modalMovieTitle');
    const modalDetails = document.getElementById('modalMovieDetails');

    if (currentContentType === 'tv') {
        const seasons = await fetchSeasons(id);
        if (seasons) {
            currentSeason = 1;
            currentEpisode = 1;
            const show = contentCache.tv.get(parseInt(id));
            modalTitle.textContent = show.name;
            modalDetails.innerHTML = `Season ${currentSeason} Episode ${currentEpisode}`;
        }
    } else {
        const movie = contentCache.movies.get(parseInt(id));
        modalTitle.textContent = movie.title;
        modalDetails.textContent = movie.overview;
    }

    updateVideoSource();
    modal.style.display = 'block';
}

// Update video source
function updateVideoSource() {
    const params = {
        id: currentContentId
    };
    
    if (currentContentType === 'tv') {
        params.season = currentSeason;
        params.episode = currentEpisode;
    }
    
    const videoUrl = generateVideoUrl(currentSourceId, currentContentType, params);
    if (videoUrl) {
        videoPlayer.src = videoUrl;
    }
}

// Initialize the page with movies
document.addEventListener('DOMContentLoaded', () => {
    initializeSourceSelector();
    fetchMovies();
});

// Initialize content when page loads
document.addEventListener('DOMContentLoaded', () => {
    fetchMovies();
});

// Export functions for use in HTML
window.fetchMovies = fetchMovies;
window.fetchTVShows = fetchTVShows;

// Event Listeners
sourceSelector.addEventListener('change', (e) => {
    currentSourceId = e.target.value;
    updateVideoSource();
});

searchInput.addEventListener('input', (e) => {
    searchContent(e.target.value);
});

document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('videoModal').style.display = 'none';
    videoPlayer.src = '';
});

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeSourceSelector();
    fetchMovies(); // Load movies when the page loads
});

// Export functions for use in HTML script
window.fetchMovies = fetchMovies;
window.fetchTVShows = fetchTVShows;

// Expose functions to window for navigation
window.fetchMovies = fetchMovies;
window.fetchTVShows = fetchTVShows;

// Function to open video modal and play content
function openVideoModal(item, type) {
    currentContentType = type;
    playContent(item.id);
}