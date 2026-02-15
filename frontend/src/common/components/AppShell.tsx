import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { signOut } from '../../firebase/auth';
import { appendDebugToPath, useDebugMode } from '../hooks';
import styles from './appShell.module.css';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { to: '/recipe-list', label: 'Recipes', icon: 'fa-list' },
  { to: '/shopping', label: 'Shopping', icon: 'fa-cart-shopping' },
  { to: '/calendar', label: 'Calendar', icon: 'fa-calendar' },
];

interface AppShellProps {
  children: ReactNode;
}

const AppShell = ({ children }: AppShellProps) => {
  const debugMode = useDebugMode();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Main navigation">
        <div className={styles.navList}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={appendDebugToPath(item.to, debugMode)}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <i className={`fa-solid ${item.icon} ${styles.navIcon}`}></i>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </div>
        <button className={styles.signOutButton} onClick={handleSignOut}>
          <i className={`fa-solid fa-arrow-right-from-bracket ${styles.navIcon}`}></i>
          <span className={styles.navLabel}>Sign Out</span>
        </button>
      </nav>
      <main className={styles.content}>{children}</main>
    </div>
  );
};

export default AppShell;
