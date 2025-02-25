from flask import Flask, jsonify, request
from flask_cors import CORS
from tmdbv3api import TMDb, Movie, TV
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import time

app = Flask(__name__, static_url_path='', static_folder='.')
CORS(app)

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

# Configure retry strategy
retry_strategy = Retry(
    total=3,  # number of retries
    backoff_factor=1,  # wait 1, 2, 4 seconds between retries
    status_forcelist=[500, 502, 503, 504]  # HTTP status codes to retry on
)

# Create HTTP adapter with retry strategy
http_adapter = HTTPAdapter(max_retries=retry_strategy)

# Initialize TMDB
tmdb = TMDb()
tmdb.api_key = 'e2fadb339b4f592654086499e9cfc9b1'
tmdb.language = 'en'
tmdb.debug = True

# Initialize Movie and TV objects with custom session
movie_obj = Movie()
tv_obj = TV()
# Create a session for both movie and TV objects
session = requests.Session()
movie_obj.session = session
tv_obj.session = session
movie_obj.session.mount('https://', http_adapter)
movie_obj.session.timeout = (30, 30)  # Increased timeouts (connect timeout, read timeout)

# Test API key validity
try:
    response = movie_obj.session.get(
        f'https://api.themoviedb.org/3/authentication/token/new?api_key={tmdb.api_key}',
        timeout=(30, 30)
    )
    if response.status_code == 200:
        print('TMDB API connection successful - API key is valid')
    else:
        print(f'TMDB API error: {response.status_code} - {response.text}')
except Exception as e:
    print(f'TMDB API connection error: {str(e)}')

# Configure proxy settings if needed
# movie_obj.session.proxies = {
#     'http': 'http://proxy.example.com:8080',
#     'https': 'https://proxy.example.com:8080'
# }

# Sample data for testing with video URLs
movies = [
    {
        'id': 1,
        'title': 'Sample Movie 1',
        'poster': 'https://source.unsplash.com/random/300x450?movie,1',
        'rating': 4.5,
        'year': 2024,
        'videoUrl': 'https://www.youtube.com/embed/dQw4w9WgXcQ'
    },
    {
        'id': 2,
        'title': 'Sample Movie 2',
        'poster': 'https://source.unsplash.com/random/300x450?movie,2',
        'rating': 4.2,
        'year': 2023,
        'videoUrl': 'https://www.youtube.com/embed/C0DPdy98e4c'
    },
    {
        'id': 3,
        'title': 'Sample Movie 3',
        'poster': 'https://source.unsplash.com/random/300x450?movie,3',
        'rating': 4.8,
        'year': 2024,
        'videoUrl': 'https://www.youtube.com/embed/M7lc1UVf-VE'
    },
    {
        'id': 4,
        'title': 'Sample Movie 4',
        'poster': 'https://source.unsplash.com/random/300x450?movie,4',
        'rating': 4.0,
        'year': 2023,
        'videoUrl': 'https://www.youtube.com/embed/8tPnX7OPo0Q'
    }
]

@app.route('/api/movies', methods=['GET'])
def get_movies():
    max_retries = 3
    retry_delay = 1  # seconds
    
    for attempt in range(max_retries):
        try:
            # Get popular movies from TMDB
            popular_movies = movie_obj.popular()
            movies = [{
                'id': movie.id,
                'title': movie.title,
                'poster': f'https://image.tmdb.org/t/p/w500{movie.poster_path}',
                'rating': round(movie.vote_average, 1),
                'year': movie.release_date[:4] if movie.release_date else 'N/A'
            } for movie in popular_movies]
            return jsonify(movies)
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                continue
            print(f'Error fetching movies: {str(e)}')
            return jsonify({'error': 'Failed to fetch movies'}), 500

@app.route('/api/tv', methods=['GET'])
def get_tv_shows():
    max_retries = 3
    retry_delay = 1  # seconds
    
    for attempt in range(max_retries):
        try:
            # Get popular TV shows from TMDB
            popular_shows = tv_obj.popular()
            shows = [{
                'id': show.id,
                'title': show.name,
                'poster': f'https://image.tmdb.org/t/p/w500{show.poster_path}',
                'rating': round(show.vote_average, 1),
                'year': show.first_air_date[:4] if show.first_air_date else 'N/A',
                'seasons': show.number_of_seasons if hasattr(show, 'number_of_seasons') else None
            } for show in popular_shows]
            return jsonify(shows)
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                continue
            print(f'Error fetching TV shows: {str(e)}')
            return jsonify({'error': 'Failed to fetch TV shows'}), 500

@app.route('/api/tv/<int:show_id>/seasons', methods=['GET'])
def get_tv_show_seasons(show_id):
    try:
        show = tv_obj.details(show_id)
        seasons = [{
            'season_number': season.season_number,
            'episode_count': season.episode_count,
            'name': season.name,
            'overview': season.overview
        } for season in show.seasons]
        return jsonify(seasons)
    except Exception as e:
        print(f'Error fetching seasons: {str(e)}')
        return jsonify({'error': 'Failed to fetch seasons'}), 500

@app.route('/api/movies/trailers', methods=['GET'])
def get_movies_with_trailers():
    try:
        popular = movie_obj.popular()
        if not popular:
            return jsonify({'error': 'No movies found'}), 404

        # Get movie trailers
        movies_with_trailers = []
        for movie in popular[:12]:  # Limit to 12 movies for better performance
            if not hasattr(movie, 'poster_path') or not movie.poster_path:
                continue
                
            try:
                # Get movie videos
                response = movie_obj.session.get(
                    f'https://api.themoviedb.org/3/movie/{movie.id}/videos?api_key={tmdb.api_key}'
                )
                videos = response.json().get('results', [])
                
                # Find trailer
                trailer = next(
                    (video for video in videos if video['type'].lower() == 'trailer' and video['site'].lower() == 'youtube'),
                    None
                )
                
                movies_with_trailers.append({
                    'id': movie.id,
                    'title': movie.title,
                    'poster': f'https://image.tmdb.org/t/p/w500{movie.poster_path}',
                    'rating': round(float(movie.vote_average), 1) if hasattr(movie, 'vote_average') else 0.0,
                    'year': movie.release_date[:4] if movie.release_date else 'N/A',
                    'videoUrl': f'https://www.youtube.com/embed/{trailer["key"]}' if trailer else None
                })
            except Exception as e:
                print(f'Error fetching trailer for movie {movie.id}: {str(e)}')
                # Still add the movie even if we couldn't get the trailer
                movies_with_trailers.append({
                    'id': movie.id,
                    'title': movie.title,
                    'poster': f'https://image.tmdb.org/t/p/w500{movie.poster_path}',
                    'rating': round(float(movie.vote_average), 1) if hasattr(movie, 'vote_average') else 0.0,
                    'year': movie.release_date[:4] if movie.release_date else 'N/A',
                    'videoUrl': None
                })
        return jsonify(movies_with_trailers)
    except Exception as e:
        print(f'Error fetching movies with trailers: {str(e)}')
        return jsonify({'error': 'Failed to fetch movies'}), 500

@app.route('/api/search', methods=['GET'])
def search_content():
    max_retries = 3
    retry_delay = 1  # seconds
    
    for attempt in range(max_retries):
        try:
            query = request.args.get('q', '')
            if not query:
                return jsonify([])
            
            # Search both movies and TV shows
            movie_results = movie_obj.search(query)
            tv_results = tv_obj.search(query)
            
            combined_results = []
            
            # Process movie results
            for movie in movie_results[:6]:  # Limit to 6 movies
                if not hasattr(movie, 'poster_path') or not movie.poster_path:
                    continue
                
                combined_results.append({
                    'id': movie.id,
                    'title': movie.title,
                    'poster': f'https://image.tmdb.org/t/p/w500{movie.poster_path}',
                    'rating': round(float(movie.vote_average), 1) if hasattr(movie, 'vote_average') else 0.0,
                    'year': movie.release_date[:4] if hasattr(movie, 'release_date') and movie.release_date else 'N/A',
                    'type': 'movie'
                })
            
            # Process TV show results
            for show in tv_results[:6]:  # Limit to 6 TV shows
                if not hasattr(show, 'poster_path') or not show.poster_path:
                    continue
                
                combined_results.append({
                    'id': show.id,
                    'title': show.name,
                    'poster': f'https://image.tmdb.org/t/p/w500{show.poster_path}',
                    'rating': round(float(show.vote_average), 1) if hasattr(show, 'vote_average') else 0.0,
                    'year': show.first_air_date[:4] if hasattr(show, 'first_air_date') and show.first_air_date else 'N/A',
                    'type': 'tv'
                })
            
            return jsonify(combined_results)
        except Exception as e:
            print(f'Error in search_movies: {str(e)}')
            if attempt < max_retries - 1:
                print(f'Attempt {attempt + 1} failed. Retrying in {retry_delay} seconds...')
                time.sleep(retry_delay)
                retry_delay *= 2  # exponential backoff
                continue
            return jsonify({
                'error': 'Failed to search movies from TMDB API',
                'details': str(e)
            }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)