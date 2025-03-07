// TMDB API Configuration
const config = {
    api: {
        baseUrl: 'https://api.themoviedb.org/3',
        key: 'e2fadb339b4f592654086499e9cfc9b1', // Direct API key since we're in browser environment
        endpoints: {
            movies: '/discover/movie',
            movieDetails: (movieId) => `/movie/${movieId}`,
            tv: '/discover/tv',
            tvDetails: (showId) => `/tv/${showId}`,
            seasons: (showId) => `/tv/${showId}/season`,
            search: '/search/multi'
        },
        params: {
            language: 'en-US',
            include_adult: false,
            include_video: true,
            sort_by: 'popularity.desc',
            page: 1
        }
    },
    images: {
        baseUrl: 'https://image.tmdb.org/t/p/',
        posterSize: 'w500',
        backdropSize: 'original'
    }
};

export default config;