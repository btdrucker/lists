import type { RefObject } from 'react';
import Checkbox from '../../common/components/Checkbox';
import styles from './shoppingItemRow.module.css';

interface NewItemRowProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}

const NewItemRow = ({
  value,
  onChange,
  onBlur,
  onKeyDown,
  inputRef,
}: NewItemRowProps) => {
  return (
    <div className={styles.item} onClick={(e) => e.stopPropagation()}>
      <Checkbox
        checked={false}
        onChange={() => {}}
        className={styles.itemCheckbox}
      />
      <div className={styles.itemDetails}>
        <div className={styles.itemMainRow}>
          <div className={styles.itemNameRow}>
            <textarea
              ref={inputRef}
              className={styles.itemTextarea}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
              placeholder="Item name"
              rows={1}
              aria-label="New item name"
            />
          </div>
        </div>
      </div>
      <button
        className={`${styles.itemEditButton} ${styles.itemEditButtonDisabled}`}
        disabled
        aria-hidden
        type="button"
      >
        <i className="fa-solid fa-tag" />
      </button>
    </div>
  );
};

export default NewItemRow;
