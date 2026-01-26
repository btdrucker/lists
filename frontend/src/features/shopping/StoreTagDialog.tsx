import type { Store } from '../../types';
import styles from './storeTagDialog.module.css';

interface StoreTagDialogProps {
  stores: Store[];
  selectedStoreIds: string[];
  itemIds: string[];
  onStoreToggle: (itemIds: string[], storeId: string) => void;
}

const StoreTagDialog = ({
  stores,
  selectedStoreIds,
  itemIds,
  onStoreToggle,
}: StoreTagDialogProps) => {
  return (
    <div className={styles.storeDialog} onClick={(e) => e.stopPropagation()}>
      <div className={styles.storeDialogContent}>
        {[...stores]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((store) => {
            const isSelected = selectedStoreIds.includes(store.id);
            return (
              <button
                key={store.id}
                className={`${styles.storeDialogOption} ${
                  isSelected ? styles.storeDialogOptionSelected : ''
                }`}
                style={{
                  backgroundColor: store.color,
                }}
                onClick={() => onStoreToggle(itemIds, store.id)}
              >
                {store.displayName}
              </button>
            );
          })}
      </div>
    </div>
  );
};

export default StoreTagDialog;
