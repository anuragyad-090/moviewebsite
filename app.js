// Import video source utilities
import { videoSources, generateVideoUrl, getNextSource } from './videoSources.js';

// API endpoints
const API_URL = 'http://localhost:5000/api';

// Current video source state
let currentSourceId = videoSources[0].id;
let currentContentType = 'movie';
let currentContentId = null;
let currentSeason = null;
let currentEpisode = null;

// Function to fetch movies from the backend
async function fetchMovies() {
    try {
        const response = await fetch(`${API_URL}/movies`);
        const data = await response.json();
        if (response.ok) {
            loadContent(data, 'movie');
        } else {
            console.error('Error fetching movies:', data.error);
        }
    } catch (error) {
        console.error('Error fetching movies:', error);
    }
}

// Function to fetch TV shows from the backend
async function fetchTVShows() {
    try {
        const response = await fetch(`${API_URL}/tv`);
        const data = await response.json();
        if (response.ok) {
            loadContent(data, 'tv');
        } else {
            console.error('Error fetching TV shows:', data.error);
        }
    } catch (error) {
        console.error('Error fetching TV shows:', error);
    }
}

// Function to fetch seasons for a TV show
async function fetchSeasons(showId) {
    try {
        const response = await fetch(`${API_URL}/tv/${showId}/seasons`);
        const data = await response.json();
        if (response.ok) {
            return data;
        } else {
            console.error('Error fetching seasons:', data.error);
            return null;
        }
    } catch (error) {
        console.error('Error fetching seasons:', error);
        return null;
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
        <option value="${source.id}" ${source.id === currentSourceId ? 'selected' : ''}>
            ${source.name} ${source.isFrench ? '🇫🇷' : ''}
        </option>
    `).join('');

    sourceSelector.addEventListener('change', (e) => {
        currentSourceId = e.target.value;
        if (currentContentId) {
            loadVideo(currentContentId, currentContentType, currentSeason, currentEpisode);
        }
    });
}

// Load video into player
function loadVideo(contentId, type = 'movie', season = null, episode = null) {
    currentContentId = contentId;
    currentContentType = type;
    currentSeason = season;
    currentEpisode = episode;

    const params = {
        id: contentId,
        ...(season && { season }),
        ...(episode && { episode })
    };

    const videoUrl = generateVideoUrl(currentSourceId, type, params);
    if (videoUrl) {
        videoPlayer.src = videoUrl;
        videoPlayer.style.display = 'block';
    } else {
        console.error('Failed to generate video URL');
        tryNextSource();
    }
}

// Try next available source when current source fails
function tryNextSource() {
    const nextSourceId = getNextSource(currentSourceId);
    if (nextSourceId && nextSourceId !== currentSourceId) {
        currentSourceId = nextSourceId;
        sourceSelector.value = currentSourceId;
        loadVideo(currentContentId, currentContentType, currentSeason, currentEpisode);
    } else {
        console.error('No more sources available');
        videoPlayer.style.display = 'none';
        alert('Sorry, this content is currently unavailable. Please try again later.');
    }
}

// Load content (movies or TV shows) into the grid
function loadContent(items, type) {
    movieGrid.innerHTML = '';
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <img src="${item.poster}" alt="${item.title}">
            <div class="movie-info">
                <h3>${item.title}</h3>
                <p>Rating: ${item.rating} ⭐</p>
                <p>Year: ${item.year}</p>
                ${type === 'tv' && item.seasons ? `<p>Seasons: ${item.seasons}</p>` : ''}
            </div>
        `;
        movieGrid.appendChild(card);

        // Add click event to show content details
        card.addEventListener('click', async () => {
            if (type === 'tv') {
                const seasons = await fetchSeasons(item.id);
                showTVDetails(item, seasons);
            } else {
                showMovieDetails(item);
            }
        });
    });
}

// Show movie details with video player
function showMovieDetails(movie) {
    const modal = document.getElementById('videoModal');
    const modalTitle = document.getElementById('modalMovieTitle');
    const modalDetails = document.getElementById('modalMovieDetails');

    modalTitle.textContent = movie.title;
    modalDetails.textContent = `Rating: ${movie.rating} ⭐ | Year: ${movie.year}`;

    // Load video player with the first available source
    loadVideo(movie.id, 'movie');

    modal.style.display = 'block';
}

// Show TV show details with season/episode selection
function showTVDetails(show, seasons) {
    const modal = document.getElementById('videoModal');
    const modalTitle = document.getElementById('modalMovieTitle');
    const modalDetails = document.getElementById('modalMovieDetails');

    modalTitle.textContent = show.title;
    modalDetails.innerHTML = `
        Rating: ${show.rating} ⭐ | Year: ${show.year}
        <div class="season-selector">
            <select id="seasonSelect" class="season-select">
                ${seasons.map(season => `
                    <option value="${season.season_number}">
                        ${season.name} (${season.episode_count} episodes)
                    </option>
                `).join('')}
            </select>
            <select id="episodeSelect" class="episode-select">
                ${Array.from({ length: seasons[0]?.episode_count || 0 }, (_, i) => `
                    <option value="${i + 1}">Episode ${i + 1}</option>
                `).join('')}
            </select>
        </div>
    `;

    // Add event listeners for season/episode selection
    const seasonSelect = document.getElementById('seasonSelect');
    const episodeSelect = document.getElementById('episodeSelect');

    seasonSelect.addEventListener('change', (e) => {
        const selectedSeason = seasons.find(s => s.season_number === parseInt(e.target.value));
        episodeSelect.innerHTML = Array.from({ length: selectedSeason.episode_count }, (_, i) => `
            <option value="${i + 1}">Episode ${i + 1}</option>
        `).join('');
        loadVideo(show.id, 'tv', parseInt(e.target.value), 1);
    });

    episodeSelect.addEventListener('change', (e) => {
        loadVideo(show.id, 'tv', parseInt(seasonSelect.value), parseInt(e.target.value));
    });

    // Load first episode of first season
    loadVideo(show.id, 'tv', seasons[0]?.season_number || 1, 1);

    modal.style.display = 'block';

    // Close modal when clicking the close button
    const closeBtn = document.querySelector('.close-modal');
    closeBtn.onclick = function() {
        modal.style.display = 'none';
        videoPlayer.src = '';
    };

    // Close modal when clicking outside
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
            videoPlayer.src = '';
        }
    };
}

// Search functionality
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const searchTerm = e.target.value.trim();
    
    if (searchTerm) {
        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(searchTerm)}`);
                const data = await response.json();
                if (response.ok) {
                    loadContent(data, currentContentType);
                } else {
                    console.error('Error searching:', data.error);
                }
            } catch (error) {
                console.error('Error searching:', error);
            }
        }, 300);
    } else {
        if (currentContentType === 'tv') {
            fetchTVShows();
        } else {
            fetchMovies();
        }
    }
});

// Expose fetch functions to window object for navigation
window.fetchMovies = fetchMovies;
window.fetchTVShows = fetchTVShows;

// Handle video player errors
videoPlayer.addEventListener('error', () => {
    console.error('Video player error, trying next source...');
    tryNextSource();
});

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeSourceSelector();
    fetchMovies();
});