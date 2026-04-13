const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3-lite';
const MAX_TEXT_LENGTH = 2000;
const MAX_BATCH_SIZE = 128;

interface VoyageEmbeddingObject {
  embedding: number[];
  index: number;
}

interface VoyageEmbeddingResponse {
  data: VoyageEmbeddingObject[];
  model: string;
  usage: {
    total_tokens: number;
  };
}

type VoyageInputType = 'document' | 'query';

/**
 * Concatenates title and content with ": " (or just ":" when content is empty),
 * trims whitespace, and truncates to MAX_TEXT_LENGTH characters. Used to build
 * the text that gets embedded for a knowledge base entry.
 */
export function buildEmbeddingText(title: string, content: string): string {
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const combined = trimmedContent.length > 0
    ? `${trimmedTitle}: ${trimmedContent}`
    : `${trimmedTitle}:`;
  return combined.slice(0, MAX_TEXT_LENGTH);
}

/**
 * Calls the Voyage AI embeddings endpoint for a batch of texts.
 * Handles splitting into chunks of up to 128 texts per API call.
 * Throws if VOYAGE_API_KEY is not set or if the API returns an error.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY environment variable is not set');
  }

  if (texts.length === 0) {
    return [];
  }

  // Split into chunks of MAX_BATCH_SIZE
  const chunks: string[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    chunks.push(texts.slice(i, i + MAX_BATCH_SIZE));
  }

  const results: number[][] = [];

  for (const chunk of chunks) {
    const chunkResults = await callVoyageEmbeddings(chunk, 'document');
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Embeds a single text as a document. Returns the embedding vector.
 */
export async function embed(text: string): Promise<number[]> {
  const results = await embedBatch([text]);
  return results[0];
}

/**
 * Embeds a search query using Voyage AI&apos;s query input_type.
 * Voyage AI optimizes query embeddings differently from document embeddings
 * for improved retrieval performance.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY environment variable is not set');
  }

  const results = await callVoyageEmbeddings([query], 'query');
  return results[0];
}

/**
 * Convenience function: builds the embedding text from title + content,
 * then returns the embedding vector.
 */
export async function embedKnowledgeEntry(title: string, content: string): Promise<number[]> {
  const text = buildEmbeddingText(title, content);
  return embed(text);
}

async function callVoyageEmbeddings(
  texts: string[],
  inputType: VoyageInputType
): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(no body)');
    throw new Error(
      `Voyage AI API error: HTTP ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  const json = (await response.json()) as VoyageEmbeddingResponse;

  // Sort by index to ensure order matches input order
  const sorted = [...json.data].sort((a, b) => a.index - b.index);
  return sorted.map((obj) => obj.embedding);
}
