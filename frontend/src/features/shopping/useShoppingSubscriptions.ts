import { useEffect } from 'react';
import { useAppDispatch } from '../../common/hooks';
import {
  subscribeToShoppingItems,
  subscribeToTags,
  subscribeToShoppingGroups,
  initializeDefaultTags,
} from '../../firebase/firestore';
import {
  mergeShoppingItemsFromFirestore,
  setShoppingItems,
  setTags,
  setShoppingGroups,
} from './slice';

const FAMILY_ID = 'default-family';

export function useShoppingSubscriptions(): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let unsubItems: (() => void) | undefined;
    let unsubTags: (() => void) | undefined;
    let unsubGroups: (() => void) | undefined;

    const initAndSubscribe = async () => {
      try {
        await initializeDefaultTags(FAMILY_ID);
        unsubItems = subscribeToShoppingItems(FAMILY_ID, (newItems) => {
          dispatch(mergeShoppingItemsFromFirestore(newItems));
        });
        unsubTags = subscribeToTags(FAMILY_ID, (newTags) => {
          dispatch(setTags(newTags));
        });
        unsubGroups = subscribeToShoppingGroups(FAMILY_ID, (newGroups) => {
          dispatch(setShoppingGroups(newGroups));
        });
      } catch (error) {
        console.error('Error initializing shopping list:', error);
        dispatch(setShoppingItems([]));
        dispatch(setTags([]));
        dispatch(setShoppingGroups([]));
      }
    };

    initAndSubscribe();

    return () => {
      if (unsubItems) unsubItems();
      if (unsubTags) unsubTags();
      if (unsubGroups) unsubGroups();
    };
  }, [dispatch]);
}
