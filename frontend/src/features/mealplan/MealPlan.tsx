import { useState } from 'react';
import { useAppDispatch } from '../../common/hooks';
import { clearAuth } from '../auth/slice';
import { signOut } from '../../firebase/auth';
import CircleIconButton from '../../common/components/CircleIconButton';
import styles from './mealplan.module.css';

const MealPlan = () => {
  const dispatch = useAppDispatch();
  const [showMenu, setShowMenu] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    dispatch(clearAuth());
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Meal Plan</h1>
        <div className={styles.headerButtons}>
          {/* Mobile: Menu */}
          <div className={styles.menuContainer}>
            <CircleIconButton
              icon="fa-ellipsis-vertical"
              onClick={() => setShowMenu(!showMenu)}
              ariaLabel="Menu"
            />
            {showMenu && (
              <div className={styles.menuDropdown}>
                <button
                  className={styles.menuItem}
                  onClick={async () => {
                    try {
                      await handleSignOut();
                      setShowMenu(false);
                    } catch (error) {
                      console.error('Error signing out:', error);
                    }
                  }}
                >
                  <i className="fa-solid fa-arrow-right-from-bracket" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={styles.placeholder}>
        <h2 className={styles.placeholderTitle}>Meal Plan</h2>
        <p className={styles.placeholderMessage}>
          Coming soon: plan meals, add notes, and track your week.
        </p>
      </div>

      {showMenu && (
        <div
          className={styles.menuBackdrop}
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};

export default MealPlan;
