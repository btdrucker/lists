import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector, useDebugMode, useNavigateWithDebug } from '../../common/hooks';
import CircleIconButton from '../../common/components/CircleIconButton';
import type { Recipe } from '../../types';
import { getEffectiveIngredientValues } from '../../common/aiParsing';
import type { RecipeWithAiMetadata } from '../../common/aiParsing';
import ParsedFieldsDebug from '../../common/components/ParsedFieldsDebug';
import styles from './recipe.module.css';
import InstructionRow from './InstructionRow';
import TagInput from './TagInput';
import { useEditRecipeForm } from './useEditRecipeForm';
import { useEditRecipeSave } from './useEditRecipeSave';
import { useEditRecipeRescrape } from './useEditRecipeRescrape';

const IS_DEV = import.meta.env.DEV;

const EditRecipe = () => {
  const navigate = useNavigateWithDebug();
  const { id } = useParams<{ id: string }>();
  const recipes = useAppSelector((state) => state.recipes?.recipes || []);
  const debugMode = useDebugMode();

  const [error, setError] = useState<string | null>(null);

  const isNewRecipe = id === 'new';
  const existingRecipe = !isNewRecipe && id
    ? (recipes.find((r: Recipe) => r.id === id) as RecipeWithAiMetadata | null)
    : null;

  const form = useEditRecipeForm(existingRecipe, isNewRecipe);

  const { handleSave, isSaving } = useEditRecipeSave({
    ...form,
    existingRecipe,
    isNewRecipe,
    id,
    setError,
  });

  const { handleRescrape, isRescraping } = useEditRecipeRescrape({
    existingRecipe,
    id,
    hasChangesExcludingNotes: form.hasChangesExcludingNotes,
    applyScrapedRecipe: form.applyScrapedRecipe,
    setError,
  });

  const handleCancel = () => {
    if (form.hasActualChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.'
      );
      if (!confirmed) return;
    }
    if (!isNewRecipe && id) {
      navigate(`/recipe/${id}`);
    } else {
      navigate('/recipe-list');
    }
  };

  if (!isNewRecipe && id && !existingRecipe) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <CircleIconButton
            icon="fa-angle-left"
            onClick={() => navigate('/recipe-list')}
            ariaLabel="Back to all recipes"
          />
        </header>
        <div className={styles.form}>
          <div className={styles.notFound}>EditRecipe not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <CircleIconButton
          icon="fa-angle-left"
          onClick={handleCancel}
          ariaLabel="Back to all recipes"
        />
        <h1>Edit Recipe</h1>
        <CircleIconButton
          icon={isSaving ? "fa-circle-notch fa-spin" : "fa-check"}
          onClick={handleSave}
          disabled={isSaving || !form.hasActualChanges}
          ariaLabel="Save"
        />
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.form}>
        <div className={styles.field}>
          <label>Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => form.setTitle(e.target.value)}
            placeholder="Recipe title"
          />
        </div>

        {existingRecipe?.sourceUrl && (
          <div className={styles.field}>
            <label>Source URL</label>
            <div className={styles.sourceUrlContainer}>
              <div className={styles.immutableUrl}>
                <a href={existingRecipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {existingRecipe.sourceUrl}
                </a>
              </div>
              {IS_DEV && (
                <button
                  onClick={handleRescrape}
                  disabled={isRescraping}
                  className={styles.rescrapeButton}
                  aria-label="Re-scrape recipe from source"
                  title="Re-scrape recipe from source"
                >
                  <i className="fa-solid fa-rotate-right"></i>
                </button>
              )}
            </div>
          </div>
        )}

        <div className={styles.field}>
          <label>Description</label>
          <textarea
            ref={form.descriptionRef}
            value={form.description}
            onChange={(e) => form.setDescription(e.target.value)}
            placeholder="Brief description"
          />
        </div>

        <div className={styles.metaFields}>
          <div className={styles.metaField}>
            <label>Servings</label>
            <input
              type="number"
              min="1"
              value={form.servings}
              onChange={(e) => form.setServings(e.target.value)}
              placeholder=""
            />
          </div>
          <div className={styles.metaField}>
            <label>Prep time (min)</label>
            <input
              type="number"
              min="0"
              value={form.prepTime}
              onChange={(e) => form.setPrepTime(e.target.value)}
              placeholder=""
            />
          </div>
          <div className={styles.metaField}>
            <label>Cook time (min)</label>
            <input
              type="number"
              min="0"
              value={form.cookTime}
              onChange={(e) => form.setCookTime(e.target.value)}
              placeholder=""
            />
          </div>
        </div>

        <div className={styles.field}>
          <label>Notes</label>
          <textarea
            ref={form.notesRef}
            value={form.notes}
            onChange={(e) => form.setNotes(e.target.value)}
            placeholder="Personal notes, modifications, tips..."
          />
        </div>

        <TagInput
          label="Category"
          tags={form.category}
          onChange={form.setCategory}
          placeholder="Add category (e.g., Dinner, Dessert, Appetizer)"
        />

        <TagInput
          label="Cuisine"
          tags={form.cuisine}
          onChange={form.setCuisine}
          placeholder="Add cuisine (e.g., Italian, Mexican, Chinese)"
        />

        <TagInput
          label="Keywords"
          tags={form.keywords}
          onChange={form.setKeywords}
          placeholder="Add keyword (e.g., vegetarian, quick, comfort-food)"
        />

        <div className={styles.section}>
          <h3>Ingredients *</h3>
          {form.ingredients.map((ingredient, index) => (
            <div key={form.ingredientKeys[index]} className={styles.ingredientRow}>
              <div className={styles.ingredientGroup}>
                <input
                  type="text"
                  ref={(el) => { form.ingredientInputRefs.current[index] = el; }}
                  value={ingredient.originalText || ''}
                  onChange={(e) => form.handleOriginalTextChange(index, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && index === form.ingredients.length - 1) {
                      e.preventDefault();
                      form.addIngredient();
                    }
                  }}
                  placeholder="Original text"
                  className={styles.ingredientOriginalInput}
                />
                {debugMode && (() => {
                  const { amount, unit, name } = getEffectiveIngredientValues(ingredient);
                  return <ParsedFieldsDebug amount={amount} unit={unit} name={name ?? ''} />;
                })()}
              </div>
              <button
                onClick={() => form.removeIngredient(index)}
                className={styles.removeButton}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
          <button onClick={form.addIngredient} className={styles.addButton}>
            + Add Ingredient
          </button>
        </div>

        <div className={styles.section}>
          <h3>Instructions</h3>
          {form.instructions.map((instruction, index) => (
            <InstructionRow
              key={form.instructionKeys[index]}
              index={index}
              value={instruction}
              onChange={(value) => form.updateInstruction(index, value)}
              onRemove={() => form.removeInstruction(index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && index === form.instructions.length - 1) {
                  event.preventDefault();
                  form.addInstruction();
                }
              }}
              registerRef={(element) => { form.instructionInputRefs.current[index] = element; }}
            />
          ))}
          <button onClick={form.addInstruction} className={styles.addButton}>
            + Add Step
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || !form.hasActualChanges}
          className={styles.saveButton}
        >
          <i className="fa-solid fa-floppy-disk"></i>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default EditRecipe;
