import type { MouseEvent } from 'react';
import styles from './circleIconButton.module.css';

interface CircleIconButtonProps {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  icon: string;
  className?: string;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}

const CircleIconButton = ({ onClick, icon, className, ariaLabel, title, disabled }: CircleIconButtonProps) => (
  <button
    className={`${styles.circleIconButton} ${className || ''}`}
    onClick={onClick}
    aria-label={ariaLabel}
    title={title}
    disabled={disabled}
    type="button"
  >
    <i className={`fa-solid ${icon}`} />
  </button>
);

export default CircleIconButton;
