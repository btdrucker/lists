# Shared Types

TypeScript types shared between the frontend and backend. The single source of truth for the data model — changes here propagate to both layers automatically.

For architectural context, see [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md).

## Key Types

### `RecipeBase<DateType>`

The core recipe type is generic over its date fields. Backend uses `RecipeBase<Date>` (Firestore timestamps); frontend uses `RecipeBase<string>` (Redux requires serializable values).

### `Ingredient`

Structured ingredient with `amount`, `unit` (from `UnitValue` enum), `name`, `originalText`, and optional `section`. Also carries AI-parsed fields (`aiAmount`, `aiUnit`, `aiName`) that may override the base fields when parse confidence is low.

### Shopping list types

`ShoppingItem`, `Tag`, `ShoppingGroup` — all follow the same `Base<DateType>` pattern. `CombinedItem` and `GroupedItems` are display-only types computed in the frontend; they are never stored in Firestore.

### `MealPlanItem`

Can be either a `recipe` entry (with `recipeId` and denormalized `recipeTitle`) or a `note` (with `text`). `date` is `null` for unscheduled "Ideas" items.

### `UnitValue`

Enum of all recognized units (cups, tablespoons, pounds, etc.). Used for ingredient parsing and shopping list aggregation.

## Adding a New Shared Field

1. Add the field to the appropriate interface in `shared/types/index.ts`
2. Both frontend and backend pick it up automatically — no duplicate definitions needed
3. Update Firestore reads/writes in `frontend/src/firebase/firestore.ts` and/or `backend/src/services/firestore.ts` if the field needs to be persisted
