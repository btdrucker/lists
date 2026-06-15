# Family Recipe & Shopping App — Product Spec

> **Purpose of this document**: Describe what the app does from the user's perspective. No technology, no implementation details. This is the source of truth for features and user experience.

---

## Overview

A shared household app for managing recipes, planning meals, and building shopping lists. It is installed on the home screen like a native app and works offline. All data is shared across family members in real time.

---

## Core Screens

The app has three main areas, always accessible from a persistent navigation bar:

- **Recipes** — the household recipe library
- **Shopping** — the active shopping list
- **Meal Plan** — upcoming meals organized by day

---

## Authentication

- Users sign in with an email/password account or with Google.
- The app remembers the signed-in user across sessions.
- Signing out is available from any main screen via a menu.

---

## Recipes

### Recipe List

- Shows all recipes in the household library as a list.
- Each recipe card shows the title and key metadata (category, cuisine, cook time, etc.).
- A search bar filters recipes in real time by title, ingredient, category, cuisine, or keywords.
- Each recipe card has a quick-add button to send its ingredients directly to the shopping list.
  - If the recipe's ingredients are already on the shopping list, the user is notified instead of adding duplicates.
  - The button shows a brief success state after adding.
- Tapping a recipe opens it in a full detail view.
- A "+" button opens the Add Recipe flow.

### Add Recipe

Two ways to add a recipe:

1. **Scrape from URL**: Paste a link to any recipe website. The app imports the title, description, ingredients, instructions, images, and metadata automatically. This requires an internet connection.
2. **Create manually**: Enter a title, then fill in the recipe form by hand.

After scraping, the recipe opens immediately for review and editing before being saved.

### View Recipe

- Displays the recipe with a full-width hero image (or a plain title header if no image).
- Shows: description, category/cuisine/keyword badges, servings, prep time, cook time.
- Shows ingredients, grouped by section when the recipe has ingredient sections.
- Shows step-by-step instructions.
- Shows a personal notes field — free-form text the user can edit. Notes save automatically.
- A source attribution link is shown when the recipe was scraped from a website.
- A menu (⋯) provides actions:
  - **Add to Shopping List** — sends all ingredients to the shopping list.
  - **Share** — shares the recipe link via the system share sheet (on mobile) or copies the link to clipboard.
  - **Cook Mode** — prevents the screen from going to sleep while cooking.
  - **Edit** — opens the recipe editor.
  - **Delete** — deletes the recipe after confirmation.
- A back button returns to the recipe list.

### Edit Recipe

- A full-screen editor for all recipe fields: title, description, ingredients, instructions, image, servings, prep time, cook time, category, cuisine, keywords.
- Changes are saved explicitly (save button).
- Supports navigating away without saving (with a confirmation if there are unsaved changes).

---

## Shopping List

The shopping list is a shared, real-time list. Changes appear instantly across all family members' devices.

### Adding Items

- A "+" button opens an inline text input at the top of the list. The user types the item in natural language (e.g., "2 cups flour", "3 apples"). The item appears immediately; ingredient parsing (amount, unit, name) happens in the background.
- Items can also be added from a recipe: the menu offers "Add Recipe," which opens a recipe picker. Selecting one or more recipes sends all their ingredients to the list. Duplicate ingredients from the same recipe are not re-added.

### Viewing Items

Two display modes, toggled by a switch in the header:

1. **Simple**: All items in a single flat list. Identical ingredients from different sources are combined and their amounts summed.
2. **Grouped**: Items organized under collapsible group headers. There are two kinds of groups:
   - **Recipe groups**: Auto-created when a recipe's ingredients are added. Header shows the recipe title.
   - **Custom groups**: User-created named sections (e.g., "Produce", "Freezer"). Created from the menu.

### Working with Items

- Tap an item's checkbox to check it off. Checked items appear with a strikethrough.
- Tap an item's text to edit it inline. Saving re-parses the text.
- Items can be tagged with colored category tags (e.g., "Produce", "Dairy"). Tags are shown as colored abbreviation badges on each item.
- A tag filter bar in the header filters the list to show only items matching selected tags.
- Groups can be collapsed or expanded.
- Checking a group header checks all items in that group at once.

### Deleting Items

- Checked items are deleted via "Delete Checked" in the menu. The count of checked items is shown.
- Fully-checked groups are also deleted along with their items.

### Custom Groups

- The user can create named groups from the menu ("New Group").
- Group names are edited by tapping them inline.
- New items can be added directly to a specific group.
- Groups are automatically deleted when their last item is removed.

### Tags

- Tags are family-wide colored labels with a short abbreviation (e.g., "P" for Produce).
- Tags are created, renamed, recolored, and deleted from "Edit Tags" in the menu.
- Each item can have one or more tags.
- Tapping an item's info button opens a tag assignment dialog.

---

## Meal Plan

A rolling calendar for planning meals. Shows 3 past days (if they have content), today, and 7 future days. An "Ideas" section holds unscheduled meals.

### Adding to the Plan

Each day has two add actions:
- **Add Recipe**: Opens a recipe picker to select from the library.
- **Add Note**: Adds a free-text note to the day (e.g., "Leftovers", "Dinner out").

### Managing Items

- Recipe items show the recipe title.
- Note items show editable text — tap to edit inline.
- Items can be **dragged** between days to reschedule them (drag and drop, works on touch).
- Items can be deleted with a trash button.
- Empty past days are automatically hidden.

---

## PWA & Offline Behavior

- The app can be installed to the home screen on iOS and Android.
- An install prompt appears for users who haven't installed the app yet.
- An offline indicator appears in the header when the device has no internet connection.
- When a new version of the app is available, the user is prompted to refresh.
- The shopping list and meal plan use real-time sync — changes from other family members appear automatically.
- Recipes are cached locally so the recipe library is available offline.
- New shopping items added while offline are stored locally and sync when connectivity returns.

---

## Status

### Implemented

- Authentication (email/password + Google)
- Recipe library with search
- Recipe scraping from URLs
- Manual recipe creation and editing
- Recipe detail view with cook mode, sharing, and notes
- Quick-add recipe ingredients to shopping list
- Shopping list with real-time sync
- Item parsing (natural language → structured ingredient)
- Simple and grouped view modes
- Tag system for shopping items
- Custom groups in shopping list
- Recipe-grouped view
- Bulk delete checked items
- Meal plan with drag-and-drop rescheduling
- Ideas (unscheduled) section in meal plan
- PWA install, offline indicator, and update prompt

### Planned / Not Yet Implemented

- Unit-aware combining in simple list view: compatible volume units (e.g. 1 tbsp + 2 tsp → 1⅔ tbsp, 1 pint + 1 cup → 3 cups) and compatible weight units (e.g. 1 lb + 4 oz → 1¼ lb) could be summed; incompatible unit pairs (e.g. 1 lb + 1 cup) would remain separate items. Currently items only combine when they share the exact same unit.
- Family sharing (invite family members, shared access control)
- Recipe image upload (images currently only come from scraping)
- Recipe scaling (multiply ingredients by a factor)
- Print-friendly recipe view
- Public recipe discovery
- Shopping list history / past trips
- Nutrition information
- Browser back / swipe-back guard on edit screens: navigating away via the browser back button or gesture does not currently prompt the user about unsaved changes (in-app back arrow does). Requires migrating from `BrowserRouter` to `createBrowserRouter` to enable React Router's navigation blocking API.
- Local dev on corporate networks with TLS inspection (e.g. Zscaler via GlobalProtect VPN): the backend cannot reach Google's auth servers to verify tokens, causing ingredient parsing to fail with a 401. Fix: export the corporate CA cert from the system keychain and pass it to Node via `NODE_EXTRA_CA_CERTS` in the `dev` script before starting the backend.
