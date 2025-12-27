import { useNavigate, useParams } from 'react-router-dom';
import { useAppSelector } from '../../common/hooks';
import IconButton from '../../common/IconButton';
import styles from './viewRecipe.module.css';

const ViewRecipe = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const recipes = useAppSelector((state) => state.recipes?.recipes || []);
  
  const recipe = recipes.find((r: any) => r.id === id);

  if (!recipe) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>Recipe not found</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <IconButton
          onClick={() => navigate('/recipe-list')}
          icon="fa-angle-left"
          hideTextOnMobile={true}
          className={styles.backButton}
        >
          All recipes
        </IconButton>
        <h1>{recipe.title}</h1>
        <IconButton
          onClick={() => navigate(`/edit-recipe/${id}`)}
          icon="fa-pen"
          hideTextOnMobile={true}
          className={styles.editButton}
        >
          Edit
        </IconButton>
      </header>

      <div className={styles.content}>
        {recipe.sourceUrl && (
          <div className={styles.sourceUrl}>
            <label>Source:</label>
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
              {recipe.sourceUrl}
            </a>
          </div>
        )}

        {recipe.description && (
          <div className={styles.description}>
            {recipe.description}
          </div>
        )}

        {recipe.imageUrl && (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className={styles.image}
          />
        )}

        <section className={styles.section}>
          <h2>Ingredients</h2>
          <ul className={styles.ingredientList}>
            {recipe.ingredients.map((ingredient: any, index: number) => (
              <li key={index}>
                {ingredient.originalText || ingredient.name}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Instructions</h2>
          <ol className={styles.instructionList}>
            {recipe.instructions.map((instruction: string, index: number) => (
              <li key={index}>{instruction}</li>
            ))}
          </ol>
        </section>

        {(recipe.servings || recipe.prepTime || recipe.cookTime) && (
          <section className={styles.meta}>
            {recipe.servings && <div><strong>Servings:</strong> {recipe.servings}</div>}
            {recipe.prepTime && <div><strong>Prep time:</strong> {recipe.prepTime} min</div>}
            {recipe.cookTime && <div><strong>Cook time:</strong> {recipe.cookTime} min</div>}
          </section>
        )}
      </div>
    </div>
  );
};

export default ViewRecipe;

