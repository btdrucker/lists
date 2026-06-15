import { useDebugMode } from '../../common/hooks';
import { getEffectiveIngredientValues } from '../../common/aiParsing';
import ParsedFieldsDebug from '../../common/components/ParsedFieldsDebug';
import type { Ingredient } from '../../types';
import { groupIngredients } from './groupIngredients';
import styles from './viewRecipe.module.css';

interface IngredientGroupListProps {
  ingredients: Ingredient[];
}

export function IngredientGroupList({ ingredients }: IngredientGroupListProps) {
  const debugMode = useDebugMode();
  const sections = groupIngredients(ingredients);

  return (
    <>
      {sections.map(({ sectionName, ingredients: sectionIngredients }) => (
        <div
          key={sectionName ?? '__default__'}
          className={styles.ingredientSection}
        >
          {sectionName && (
            <h3 className={styles.ingredientSectionTitle}>{sectionName}</h3>
          )}
          <ul className={styles.ingredientList}>
            {sectionIngredients.map((ingredient) => {
              const { amount, unit, name } = getEffectiveIngredientValues(ingredient);
              return (
                <li key={ingredient.originalText}>
                  {ingredient.originalText || ingredient.aiName || ingredient.name}
                  {debugMode && (
                    <ParsedFieldsDebug amount={amount} unit={unit} name={name ?? ''} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}
