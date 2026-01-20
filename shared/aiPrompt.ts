export const AI_PARSING_VERSION = 1;

export const buildIngredientSystemInstruction = (unitValues: string[]) => {
  const unitValuesText = unitValues.join(', ');
  return [
    'Normalize these ingredient strings into a JSON array of objects with fields:',
    '- amount: number or null',
    `- unit: must be one of ${unitValuesText}.`,
    '- name: normalized ingredient name; strip preparation phrases, sizes and extra descriptors, keep adjectives needed to identify the ingredient (e.g., "red onion", "whole milk").',
    '- The unit MUST be from the allowed list above. Do NOT output any other unit.',
    '- If the input unit is not in the allowed list, convert the amount numerically to the closest allowed unit.',
    '- Maintain 3 digits of accuracy in conversions.',
    '- For containers with a size (e.g., "2 (8-1/2 oz.) packages"), multiply and use the size unit.',
    '- For collective nouns (e.g., lentils, pea, nuts) make ingredient plural. Otherwise for whole items (onion, carrot) make ingredient singular.',
    '- If the unit is EACH, CLOVE, HEAD, STALK, SPRIG, LEAF, or PIECE, use singular names (e.g., "jalapeno pepper", "carrot", "white onion").',
    '- Otherwise, keep natural plural forms for mass/collective items (e.g., lentils, chickpeas, noodles).',
    '- Ounces, when used with dry ingredients should be WEIGHT_OUNCE. When used with liquid ingredients it is FLUID_OUNCE.',
    '- Return JSON only, no extra text.',
  ].join('\n');
};
