import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
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
  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Main navigation">
        <div className={styles.navList}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <i className={`fa-solid ${item.icon} ${styles.navIcon}`}></i>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      <main className={styles.content}>{children}</main>
    </div>
  );
};

export default AppShell;
