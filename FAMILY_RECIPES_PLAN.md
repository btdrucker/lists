# Family Recipe Sharing - Implementation Plan

## Overview

This document outlines the design for adding family/group-based recipe sharing to the Recipe app. This feature would allow users to organize into families or groups, where each family has their own shared collection of recipes that only members can access.

## Firestore Schema Changes

### New Collections

#### 1. `families` Collection

```typescript
interface Family {
  id: string;                    // Auto-generated document ID
  name: string;                  // "Smith Family", "Our Recipe Group", etc.
  createdBy: string;             // userId of the family creator
  createdAt: Timestamp;
  updatedAt: Timestamp;
  inviteCode?: string;           // Optional: shareable code for easy joining
}
```

**Example document path:** `families/abc123`

#### 2. `family_members` Subcollection

```typescript
interface FamilyMember {
  userId: string;                // Firebase Auth UID
  role: 'admin' | 'member';      // Admins can manage family, invite others
  joinedAt: Timestamp;
  addedBy: string;               // userId of person who invited them
}
```

**Example document path:** `families/abc123/members/user456`

### Updates to Existing Collections

#### `recipes` Collection - Add Family Field

```typescript
interface Recipe {
  // ... existing fields ...
  id: string;
  userId: string;                // Keep: original creator of recipe
  title: string;
  description?: string;
  ingredients: Ingredient[];
  instructions: string[];
  sourceUrl?: string;
  imageUrl?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  tags?: string[];
  
  // NEW FIELDS
  familyId?: string;             // NEW: which family owns this recipe (null = personal)
  visibility?: 'private' | 'family' | 'public';  // Optional: more granular control
  
  // Keep for backward compatibility
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}
```

#### `users` Collection (Optional - New)

Adding a users collection can help with default family settings and user management:

```typescript
interface User {
  uid: string;                   // Firebase Auth UID
  email: string;
  displayName: string | null;
  defaultFamilyId?: string;      // Which family to show by default
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Example document path:** `users/user456`

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ========== Helper Functions ==========
    
    // Check if user is a member of a family
    function isFamilyMember(familyId) {
      return exists(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid));
    }
    
    // Check if user is an admin of a family
    function isFamilyAdmin(familyId) {
      let memberDoc = get(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid));
      return memberDoc.data.role == 'admin';
    }
    
    // ========== Recipes ==========
    
    match /recipes/{recipeId} {
      // Read access: own recipes, family recipes, or public recipes
      allow read: if request.auth != null && (
        // User created it
        resource.data.userId == request.auth.uid ||
        // User is in the recipe's family
        (resource.data.familyId != null && isFamilyMember(resource.data.familyId)) ||
        // Recipe is marked public
        resource.data.isPublic == true
      );
      
      // Create: must be authenticated and proper ownership
      allow create: if request.auth != null && (
        // Must set self as creator
        request.resource.data.userId == request.auth.uid &&
        // If assigning to family, must be member of that family
        (!('familyId' in request.resource.data) || 
         request.resource.data.familyId == null ||
         isFamilyMember(request.resource.data.familyId))
      );
      
      // Update/Delete: owner or family admin
      allow update, delete: if request.auth != null && (
        // User is the creator
        resource.data.userId == request.auth.uid ||
        // User is admin of the recipe's family
        (resource.data.familyId != null && isFamilyAdmin(resource.data.familyId))
      );
    }
    
    // ========== Families ==========
    
    match /families/{familyId} {
      // Read: must be a member
      allow read: if request.auth != null && isFamilyMember(familyId);
      
      // Create: any authenticated user can create a family
      allow create: if request.auth != null && 
                       request.resource.data.createdBy == request.auth.uid;
      
      // Update/Delete: only family admins
      allow update, delete: if request.auth != null && isFamilyAdmin(familyId);
      
      // ========== Family Members Subcollection ==========
      
      match /members/{userId} {
        // Read: any family member can see other members
        allow read: if request.auth != null && isFamilyMember(familyId);
        
        // Write: only family admins can add/remove/modify members
        allow write: if request.auth != null && isFamilyAdmin(familyId);
      }
    }
    
    // ========== Users ==========
    
    match /users/{userId} {
      // Users can read their own profile
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Users can create/update their own profile
      allow create, update: if request.auth != null && request.auth.uid == userId;
      
      // No deletion of user profiles
      allow delete: if false;
    }
  }
}
```

## Migration Strategy

### For Existing Recipes

When rolling out family features, you have several options:

1. **Auto-create default family per user**
   - When families launch, create a "[User's Name] Family" for each existing user
   - Assign all their recipes to this default family
   - User becomes admin of their default family

2. **Keep recipes personal initially**
   - Leave `familyId` as `null` for all existing recipes
   - Recipes remain personal until user explicitly assigns them to a family
   - Add UI to bulk-assign recipes to families

3. **User-driven migration**
   - Prompt users to create or join a family on next login
   - Let them choose which recipes to move to family vs keep private

**Recommended:** Option 2 (keep personal) - least disruptive, gives users control

### Database Migration Script Example

```typescript
// One-time migration to add familyId field to existing recipes
async function migrateExistingRecipes() {
  const recipesRef = firestore.collection('recipes');
  const snapshot = await recipesRef.get();
  
  const batch = firestore.batch();
  let count = 0;
  
  snapshot.docs.forEach(doc => {
    // Add familyId field if it doesn't exist
    if (!doc.data().familyId) {
      batch.update(doc.ref, { 
        familyId: null,  // Keep as personal recipe
        updatedAt: new Date()
      });
      count++;
    }
  });
  
  if (count > 0) {
    await batch.commit();
    console.log(`Migrated ${count} recipes`);
  }
}
```

## Frontend Implementation

### New Features & UI Components

#### 1. Family Management Screen
- **Create Family**: Form to create a new family with name
- **Join Family**: Enter invite code to join existing family
- **Family List**: View all families user belongs to
- **Family Settings**: Edit name, generate invite codes, remove members (admin only)

#### 2. Family Selector Component
- Dropdown in app header to switch between families
- Options: "Personal Recipes", "Smith Family", "Friends Group", etc.
- Remembers last selected family (localStorage or user profile)

#### 3. Recipe Visibility Settings
- When creating/editing recipe, choose:
  - **Personal** - Only you can see
  - **Family** - Select which family (if member of multiple)
  - **Public** - Anyone can see (future feature)

#### 4. Member Management
- For family admins: invite members by email
- Generate and share invite codes
- View member list with roles
- Promote/demote members, remove members

### New Routes

```typescript
/families                    // List of user's families
/families/new                // Create new family
/families/join               // Join family with invite code
/families/:id                // Family detail/settings page
/families/:id/members        // Manage family members (admin only)
```

### Redux State Updates

```typescript
interface FamiliesState {
  families: Family[];
  currentFamilyId: string | null;  // Currently selected family filter
  loading: boolean;
  error: string | null;
}

interface RecipesState {
  recipes: Recipe[];
  filteredByFamily: string | null;  // Filter recipes by familyId
  loading: boolean;
  error: string | null;
}
```

### API Updates (Backend)

New endpoints needed:

```typescript
POST   /families                    // Create family
GET    /families                    // List user's families
GET    /families/:id                // Get family details
PUT    /families/:id                // Update family
DELETE /families/:id                // Delete family

POST   /families/:id/members        // Add member
DELETE /families/:id/members/:uid   // Remove member
PUT    /families/:id/members/:uid   // Update member role

GET    /families/:id/invite-code    // Generate invite code
POST   /families/join                // Join by invite code

// Update existing
GET    /recipes?familyId=:id        // Filter recipes by family
```

## Alternative: Simpler Sharing Approach

If you want something simpler to start with:

### Minimal Schema
```typescript
interface Recipe {
  // ... existing fields ...
  sharedWith: string[];  // Array of userIds who can access this recipe
}
```

### Security Rules (Simplified)
```javascript
match /recipes/{recipeId} {
  allow read: if request.auth != null && (
    resource.data.userId == request.auth.uid ||
    request.auth.uid in resource.data.sharedWith
  );
}
```

### UI Features
- "Share Recipe" button → enter email addresses
- Backend looks up users by email, adds their UID to `sharedWith` array
- No concept of families, just direct recipe sharing

**Pros:** Much simpler to implement
**Cons:** Doesn't scale well for large groups, no group management features

## Rollout Plan

### Phase 1: Backend & Schema
1. Update Firestore security rules
2. Add backend API endpoints for families
3. Run migration script to add `familyId` field to recipes
4. Test security rules thoroughly

### Phase 2: Core Family Features
1. Create family management UI
2. Add family selector to header
3. Update recipe list to filter by family
4. Add family field to recipe creation/editing

### Phase 3: Advanced Features
1. Invite codes and email invitations
2. Member management UI for admins
3. Bulk recipe assignment (move multiple recipes to family)
4. Family recipe statistics/insights

### Phase 4: Polish
1. Notifications when added to family
2. Activity feed (who added what recipe)
3. Recipe favorites/bookmarks within families
4. Search within family recipes

## Considerations & Notes

### Permissions Model
- **Member**: Can view family recipes, add new recipes to family
- **Admin**: Everything members can do + invite/remove members, delete family, manage settings

### Recipe Ownership
- Creator (`userId`) always retained even if recipe is in a family
- Family admins can edit/delete any family recipe
- Original creator maintains special privileges

### Edge Cases to Handle
- User leaves family: Do their contributed recipes stay or go?
- Family deletion: What happens to recipes? (Archive? Transfer to creator?)
- User in multiple families: Clear UI for which family a recipe belongs to
- Recipe moves between families: Track history? Notify members?

### Privacy Considerations
- Users must explicitly join families (no auto-adding)
- Clear indication of who can see each recipe
- Option to convert family recipe back to personal
- Family activity logging for transparency

## Future Enhancements

- **Public recipe library**: Share recipes publicly, discover others' recipes
- **Recipe collections**: Organize family recipes into meal plans, categories
- **Collaborative editing**: Multiple family members can edit recipe simultaneously
- **Recipe comments/ratings**: Family members can leave feedback
- **Shopping lists**: Generate shared shopping lists from family recipes
- **Calendar integration**: Plan family meals, assign recipes to dates

---

**Status:** Planning phase - implementation pending

**Last Updated:** December 27, 2025

