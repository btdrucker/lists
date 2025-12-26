import React, { useState } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../../firebase/auth';
import { useAppDispatch } from '../../common/hooks';
import { setUser, setError } from './slice';
import styles from './auth.module.css';

type AuthMode = 'login' | 'signup';

const AuthScreen = () => {
  const dispatch = useAppDispatch();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { user, error } = await signInWithGoogle();
      if (error) {
        setErrorMessage(error);
        dispatch(setError(error));
      } else if (user) {
        dispatch(setUser(user));
      }
    } catch (err) {
      setErrorMessage('Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (mode === 'login') {
        const { user, error } = await signInWithEmail(email, password);
        if (error) {
          setErrorMessage(error);
          dispatch(setError(error));
        } else if (user) {
          dispatch(setUser(user));
        }
      } else {
        const { user, error } = await signUpWithEmail(email, password, displayName);
        if (error) {
          setErrorMessage(error);
          dispatch(setError(error));
        } else if (user) {
          dispatch(setUser(user));
        }
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.box}>
        <h1 className={styles.title}>Recipe Lists</h1>
        <h2 className={styles.subtitle}>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>

        {mode === 'login' && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className={styles.googleButton}
            >
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </button>
            <div className={styles.divider}>
              <span>or</span>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === 'signup' && (
            <div className={styles.field}>
              <label htmlFor="displayName">Name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="Your name"
              />
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} className={styles.button}>
            {loading
              ? 'Loading...'
              : mode === 'login'
              ? 'Sign In'
              : 'Create Account'}
          </button>
        </form>

        <div className={styles.footer}>
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={styles.link}
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className={styles.link}
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;

