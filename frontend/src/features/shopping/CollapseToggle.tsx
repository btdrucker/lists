import styles from './shopping.module.css';

interface CollapseToggleProps {
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Collapse/expand toggle with 48px touch target.
 * Shows right caret when collapsed, down caret when expanded.
 */
const CollapseToggle = ({ collapsed, onToggle }: CollapseToggleProps) => {
  return (
    <div
      className={styles.groupCaretWrapper}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <i
        className={`fa-solid fa-caret-${collapsed ? 'right' : 'down'} ${styles.groupCaret}`}
      />
    </div>
  );
};

export default CollapseToggle;
