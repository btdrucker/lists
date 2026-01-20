import { useEffect, useMemo, useState } from 'react';
import { UnitValue } from '../../types';
import { getIdToken } from '../../firebase/auth';
import { buildIngredientSystemInstruction } from '../../../../shared/aiPrompt.js';
import styles from './aiDebug.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DEFAULT_PROMPT = buildIngredientSystemInstruction(Object.values(UnitValue));

const DEFAULT_USER_PROMPT = [
  'Ingredients:',
  '1 cup diced tomatoes',
  '2 tsp olive oil',
  '1 (14 oz) can chickpeas, drained',
].join('\n');

const extractJsonArray = (text: string) => {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
};

const STORAGE_KEYS = {
  prompt: 'aiDebug.prompt',
  ingredients: 'aiDebug.ingredients',
};

const getStoredValue = (key: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(key);
  return stored ?? fallback;
};

const AiDebug = () => {
  const [prompt, setPrompt] = useState(() =>
    getStoredValue(STORAGE_KEYS.prompt, DEFAULT_PROMPT)
  );
  const [ingredientsText, setIngredientsText] = useState(() =>
    getStoredValue(STORAGE_KEYS.ingredients, DEFAULT_USER_PROMPT)
  );
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const wordCount = useMemo(() => {
    const matches = prompt.match(/\S+/g);
    return matches ? matches.length : 0;
  }, [prompt]);
  const userPromptWordCount = useMemo(() => {
    const matches = ingredientsText.match(/\S+/g);
    return matches ? matches.length : 0;
  }, [ingredientsText]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.prompt, prompt);
  }, [prompt]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.ingredients, ingredientsText);
  }, [ingredientsText]);

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    setRawText(null);
    setMode(null);

    try {
      const token = await getIdToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const userPrompt = ingredientsText.trim();
      if (!userPrompt) {
        setError('Please provide a user prompt.');
        return;
      }

      const response = await fetch(`${API_URL}/ai-debug`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          systemInstruction: prompt.trim(),
          userPrompt,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.status !== 'ok') {
        setError(data.error || 'AI debug request failed.');
        return;
      }

      setRawText(data.rawText ?? null);
      setMode(data.mode ?? null);
    } catch (err) {
      setError('AI debug request failed.');
      console.error('AI debug error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const parsedJson = useMemo(() => {
    if (!rawText) return null;
    const jsonText = extractJsonArray(rawText);
    if (!jsonText) return null;
    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }, [rawText]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>AI Ingredient Debug</h1>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.section}>
        <label className={styles.label} htmlFor="ai-prompt">
          System instructions ({wordCount} words)
        </label>
        <textarea
          id="ai-prompt"
          className={styles.textarea}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </div>

      <div className={styles.section}>
        <label className={styles.label} htmlFor="ai-ingredients">
          User prompt ({userPromptWordCount} words)
        </label>
        <textarea
          id="ai-ingredients"
          className={styles.textarea}
          value={ingredientsText}
          onChange={(event) => setIngredientsText(event.target.value)}
        />
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          onClick={handleRun}
          disabled={isRunning}
        >
          {isRunning ? 'Running...' : 'Run AI'}
        </button>
        {mode && <span>Mode: {mode}</span>}
      </div>

      {parsedJson && (
        <div className={styles.section}>
          <label className={styles.label}>Parsed JSON</label>
          <div className={styles.resultBox}>{JSON.stringify(parsedJson, null, 2)}</div>
        </div>
      )}
    </div>
  );
};

export default AiDebug;
