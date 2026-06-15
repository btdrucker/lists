import type { ShoppingItem, CombinedItem, GroupedItems, ShoppingGroup, Recipe } from '../../types';
import { buildAggregatedDisplayString } from '../../common/ingredientDisplay';

export function normalizeItemName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Grouping key for aggregating items. Returns null when there's no parsed name
 * (e.g. parse failed) - those items never group with anything.
 * Match rule: two items group only when getItemKey(a) === getItemKey(b) and both are non-null.
 */
export function getItemKey(item: ShoppingItem): string | null {
  if (!item.name?.trim()) return null;
  return `${normalizeItemName(item.name)}:${item.unit}`;
}

export function isItemIndeterminate(item: CombinedItem | ShoppingItem): boolean {
  return 'isIndeterminate' in item && item.isIndeterminate;
}

export function getItemIds(item: CombinedItem | ShoppingItem): string[] {
  return 'sourceItemIds' in item ? item.sourceItemIds : [item.id];
}

export function combineItems(items: ShoppingItem[]): CombinedItem[] {
  const grouped = new Map<string, ShoppingItem[]>();
  const ungroupable: ShoppingItem[] = [];

  items.forEach((item) => {
    const key = getItemKey(item);
    if (key === null) {
      ungroupable.push(item);
    } else {
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }
  });

  const toCombined = (key: string, sourceItems: ShoppingItem[]) => {
    const totalAmount = sourceItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const allChecked = sourceItems.every((item) => item.isChecked);
    const someChecked = sourceItems.some((item) => item.isChecked);
    const isIndeterminate = someChecked && !allChecked;
    const allTagIds = [...new Set(sourceItems.flatMap((item) => item.tagIds))];
    const newestCreatedAt = sourceItems.reduce(
      (max, item) => (item.createdAt > max ? item.createdAt : max) as string,
      sourceItems[0].createdAt
    );
    const isAggregated = sourceItems.length > 1;
    const name = sourceItems[0].name;
    const originalText = isAggregated
      ? buildAggregatedDisplayString(totalAmount || null, sourceItems[0].unit, name ?? '')
      : sourceItems[0].originalText;

    return {
      key,
      originalText,
      name,
      amount: totalAmount || null,
      unit: sourceItems[0].unit,
      isChecked: allChecked,
      isIndeterminate,
      tagIds: allTagIds,
      sourceItemIds: sourceItems.map((item) => item.id),
      newestCreatedAt,
    };
  };

  const combinedFromGroups = Array.from(grouped.entries()).map(([key, sourceItems]) =>
    toCombined(key, sourceItems)
  );
  const combinedFromUngroupable = ungroupable.map((item) => toCombined(item.id, [item]));

  return [...combinedFromGroups, ...combinedFromUngroupable]
    .sort((a, b) => b.newestCreatedAt.localeCompare(a.newestCreatedAt))
    .map(({ newestCreatedAt: _, ...item }) => item);
}

export function groupItems(
  items: ShoppingItem[],
  recipes: Recipe[],
  groups: ShoppingGroup[]
): GroupedItems {
  const recipeMap = new Map<string, ShoppingItem[]>();
  const customGroupMap = new Map<string, ShoppingItem[]>();
  const manualItems: ShoppingItem[] = [];

  const validGroupIds = new Set(groups.map((g) => g.id));

  // Priority: customGroupId (if valid) > sourceRecipeId > manual
  items.forEach((item) => {
    if (item.customGroupId && validGroupIds.has(item.customGroupId)) {
      if (!customGroupMap.has(item.customGroupId)) customGroupMap.set(item.customGroupId, []);
      customGroupMap.get(item.customGroupId)!.push(item);
    } else if (item.sourceRecipeId) {
      if (!recipeMap.has(item.sourceRecipeId)) recipeMap.set(item.sourceRecipeId, []);
      recipeMap.get(item.sourceRecipeId)!.push(item);
    } else {
      manualItems.push(item);
    }
  });

  const recipeGroupsBuilt = Array.from(recipeMap.entries()).map(([recipeId, groupItems]) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    const newestCreatedAt =
      groupItems.length > 0
        ? groupItems.reduce(
            (max, item) => (item.createdAt > max ? item.createdAt : max) as string,
            groupItems[0].createdAt
          )
        : '';
    return { recipeId, recipeTitle: recipe?.title || 'Unknown Recipe', items: [...groupItems], newestCreatedAt };
  });

  const recipeGroups = recipeGroupsBuilt
    .sort((a, b) => b.newestCreatedAt.localeCompare(a.newestCreatedAt))
    .map(({ newestCreatedAt: _, ...g }) => g);

  // Include ALL groups from Firestore, even empty ones
  const customGroups = groups
    .map((group) => {
      const groupItemsList = customGroupMap.get(group.id) || [];
      return {
        groupId: group.id,
        groupName: group.displayName,
        sortOrder: group.sortOrder,
        items: [...groupItemsList].sort(
          (a, b) => (b.createdAt as string).localeCompare(a.createdAt as string)
        ),
      };
    })
    .sort((a, b) => b.sortOrder - a.sortOrder)
    .map(({ groupId, groupName, items }) => ({ groupId, groupName, items }));

  const sortedManualItems = [...manualItems].sort(
    (a, b) => (b.createdAt as string).localeCompare(a.createdAt as string)
  );

  return { recipeGroups, customGroups, manualItems: sortedManualItems };
}
