import { readFileSync } from 'fs';
import { GoogleAuth } from 'google-auth-library';
import { buildIngredientSystemInstruction } from '../../../shared/aiPrompt.js';

export type AiIngredientResult = {
  amount: number | string | null;
  unit: string | null;
  name: string | null;
};

const VERTEX_AI_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

function getAiIngredientModel() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
}

function getAiApiKey() {
  return process.env.GEMINI_API_KEY;
}

function getVertexAiLocation() {
  return process.env.VERTEX_AI_LOCATION || 'us-central1';
}

function getVertexAiProjectId() {
  return (
    process.env.VERTEX_AI_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT
  );
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function getServiceAccountCredentials() {
  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountPath) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    return serviceAccount;
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

async function getVertexAccessToken(): Promise<string> {
  const credentials = getServiceAccountCredentials();
  const auth = new GoogleAuth({
    scopes: [VERTEX_AI_SCOPE],
    ...(credentials ? { credentials } : {}),
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();

  if (!token) {
    throw new Error('Failed to obtain Vertex AI access token.');
  }

  return token;
}

type AiRequestOptions = {
  systemInstruction?: string;
};

const buildSystemInstruction = (systemInstruction?: string) => {
  if (!systemInstruction || !systemInstruction.trim()) return undefined;
  return {
    role: 'system',
    parts: [{ text: systemInstruction }],
  };
};

async function fetchAiTextWithApiKey(
  prompt: string,
  options?: AiRequestOptions
): Promise<string | null> {
  const apiKey = getAiApiKey();
  const model = getAiIngredientModel();
  if (!apiKey) return null;
  const systemInstruction = buildSystemInstruction(options?.systemInstruction);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(systemInstruction ? { systemInstruction } : {}),
        generationConfig: { temperature: 0 },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.warn(
      'AI ingredient normalization failed:',
      response.status,
      response.statusText,
      errorText
    );
    return null;
  }

  const data = (await response.json()) as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function fetchAiTextWithVertex(
  prompt: string,
  options?: AiRequestOptions
): Promise<string | null> {
  const projectId = getVertexAiProjectId();
  if (!projectId) {
    console.warn('Vertex AI project ID not configured for AI ingredient normalization.');
    return null;
  }

  const location = getVertexAiLocation();
  const model = getAiIngredientModel();
  const systemInstruction = buildSystemInstruction(options?.systemInstruction);
  const accessToken = await getVertexAccessToken();
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: { temperature: 0 },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.warn(
      'Vertex AI ingredient normalization failed:',
      response.status,
      response.statusText,
      errorText
    );
    return null;
  }

  const data = (await response.json()) as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

export async function fetchAiText(
  prompt: string,
  options?: AiRequestOptions
): Promise<string | null> {
  try {
    return getAiApiKey()
      ? fetchAiTextWithApiKey(prompt, options)
      : fetchAiTextWithVertex(prompt, options);
  } catch (error) {
    console.warn('AI request failed:', error);
    return null;
  }
}

function buildIngredientUserPrompt(ingredientTexts: string[]) {
  return ['Ingredients:', JSON.stringify(ingredientTexts, null, 2)].join('\n');
}

async function fetchIngredientNormalizationText(
  ingredientTexts: string[],
  unitValues: string[]
): Promise<string | null> {
  if (process.env.NODE_ENV === 'test') return null;
  if (!ingredientTexts.length) return null;

  const systemInstruction = buildIngredientSystemInstruction(unitValues);
  const prompt = buildIngredientUserPrompt(ingredientTexts);
  return fetchAiText(prompt, { systemInstruction });
}

export async function fetchAiIngredientNormalization(
  ingredientTexts: string[],
  unitValues: string[]
): Promise<AiIngredientResult[] | null> {
  try {
    const text = await fetchIngredientNormalizationText(ingredientTexts, unitValues);
    if (!text) return null;

    const jsonArrayText = extractJsonArray(text);
    if (!jsonArrayText) return null;

    const parsed = JSON.parse(jsonArrayText) as AiIngredientResult[];
    if (!Array.isArray(parsed) || parsed.length !== ingredientTexts.length) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('AI ingredient normalization error:', error);
    return null;
  }
}
