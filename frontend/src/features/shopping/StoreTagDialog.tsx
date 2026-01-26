import type { Store } from '../../types';
import styles from './storeTagDialog.module.css';

interface StoreTagDialogProps {
  stores: Store[];
  selectedStoreIds: string[];
  itemIds: string[];
  onStoreToggle: (itemIds: string[], storeId: string) => void;
  showAbove?: boolean;
  isPositioned?: boolean;
}

const StoreTagDialog = ({
  stores,
  selectedStoreIds,
  itemIds,
  onStoreToggle,
  showAbove = false,
  isPositioned = true,
}: StoreTagDialogProps) => {
  return (
    <div 
      className={`${styles.storeDialog} ${showAbove ? styles.storeDialogAbove : ''} ${!isPositioned ? styles.storeDialogHidden : ''}`} 
      onClick={(e) => e.stopPropagation()}
    >
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
  );
};

export default StoreTagDialog;
