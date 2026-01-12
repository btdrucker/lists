import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useOnlineStatus } from '../../common/hooks';
import { addRecipe } from '../recipe-list/slice.ts';
import { getIdToken } from '../../firebase/auth';
import styles from './recipeStart.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const RecipeStart = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isOnline = useOnlineStatus();

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate URL
  const isValidUrl = (urlString: string) => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleScrape = async () => {
    if (!url.trim() || !isValidUrl(url.trim())) {
      setError('Please enter a valid URL');
      return;
    }

    if (!isOnline) {
      setError('EditRecipe scraping requires an internet connection');
      return;
    }

    setIsScraping(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${API_URL}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.success && data.recipe) {
        // Add scraped recipe to Redux state
        dispatch(addRecipe(data.recipe));

        // Navigate to view the scraped recipe
        navigate(`/recipe/${data.recipe.id}`);
      } else {
        setError(data.error || 'Failed to scrape recipe');
      }
    } catch (err) {
      setError('Failed to scrape recipe. Please try manual entry.');
      console.error('Scrape error:', err);
    } finally {
      setIsScraping(false);
    }
  };

  const handleManualCreate = () => {
    if (!title.trim()) {
      setError('Please enter a recipe title');
      return;
    }

    // Navigate to recipe editor with 'new' as the id and title in state
    navigate('/edit-recipe/new', { state: { initialTitle: title.trim() } });
  };

  const handleCancel = () => {
    if (url.trim() || title.trim()) {
      const confirmed = window.confirm(
        'Are you sure you want to leave? Any entered information will be lost.'
      );
      if (!confirmed) return;
    }
    navigate('/recipe-list');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Add EditRecipe</h1>
        <button onClick={handleCancel} className={styles.cancelButton}>
          Cancel
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.content}>
        {/* Option 1: Scrape from URL */}
        <div className={styles.option}>
          <div className={styles.optionHeader}>
            <h2>Scrape from URL</h2>
            <p>Import a recipe from a website</p>
          </div>
          <div className={styles.inputSection}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/recipe"
              className={styles.input}
              onKeyUp={(e) => {
                if (e.key === 'Enter' && url.trim() && isValidUrl(url.trim())) {
                  handleScrape();
                }
              }}
            />
            <button
              onClick={handleScrape}
              disabled={isScraping || !url.trim() || !isValidUrl(url.trim()) || !isOnline}
              className={styles.primaryButton}
              title={!isOnline ? 'Scraping requires an internet connection' : ''}
            >
              {isScraping ? 'Scraping...' : isOnline ? 'Scrape EditRecipe' : 'Offline - Cannot Scrape'}
            </button>
          </div>
        </div>

        <div className={styles.divider}>
          <span>OR</span>
        </div>

        {/* Option 2: Create manually */}
        <div className={styles.option}>
          <div className={styles.optionHeader}>
            <h2>Create Manually</h2>
            <p>Start with a recipe title</p>
          </div>
          <div className={styles.inputSection}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="EditRecipe title"
              className={styles.input}
              onKeyUp={(e) => {
                if (e.key === 'Enter' && title.trim()) {
                  handleManualCreate();
                }
              }}
            />
            <button
              onClick={handleManualCreate}
              disabled={!title.trim()}
              className={styles.primaryButton}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeStart;
