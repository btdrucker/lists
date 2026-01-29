import styles from './checkbox.module.css';

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

/**
 * Accessible checkbox with 48px touch target and 22px visual size.
 * Uses Font Awesome icons for consistent cross-browser styling.
 * Supports indeterminate state for partial selections.
 */
const Checkbox = ({ checked, indeterminate = false, onChange, className }: CheckboxProps) => {
  // Determine which icon class to show
  const getIconClass = () => {
    if (indeterminate) return 'fa-solid fa-square-minus';
    if (checked) return 'fa-solid fa-square-check';
    return 'fa-regular fa-square';
  };

  // Determine the style class
  const getStateClass = () => {
    if (indeterminate) return styles.indeterminate;
    if (checked) return styles.checked;
    return styles.unchecked;
  };

  return (
    <div
      className={`${styles.wrapper} ${className || ''}`}
      onClick={(e) => {
        e.stopPropagation();
        // If indeterminate, treat as unchecked -> checked
        const newChecked = indeterminate ? true : !checked;
        onChange(newChecked);
      }}
    >
      <i className={`${getIconClass()} ${styles.icon} ${getStateClass()}`} />
    </div>
  );
};

export default Checkbox;
