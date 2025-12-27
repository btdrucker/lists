import React from 'react';
import styles from './iconButton.module.css';

interface Props {
  onClick: () => void;
  icon: string;
  hideTextOnMobile?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

const IconButton = ({ onClick, icon, hideTextOnMobile, disabled, className, children }: Props) => {
  return (
    <button
      className={`${styles.iconButton} ${className || ''}`}
      onClick={onClick}
      disabled={disabled ?? false}
    >
      <i className={`fa-solid ${icon}`}></i>
      {hideTextOnMobile ? (
        <span className={styles.hideOnMobile}>{children}</span>
      ) : (
        <span>{children}</span>
      )}
    </button>
  );
};

export default IconButton;

