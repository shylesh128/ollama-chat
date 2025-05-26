import { pipeline } from "@xenova/transformers";
import { vectorSearch } from "./elastic.js";

// Cache the model to avoid reloading it for each request
let embeddingModel = null;

/**
 * Initialize the embedding model
 * @returns {Promise<Object>} - The embedding model
 */
export const initEmbeddingModel = async () => {
  if (!embeddingModel) {
    console.log("Initializing embedding model...");
    try {
      // Use a better embedding model for improved semantic search
      // all-mpnet-base-v2 is more powerful than MiniLM for semantic search
      embeddingModel = await pipeline(
        "feature-extraction",
        "Xenova/all-mpnet-base-v2"
      );
      console.log("Embedding model initialized successfully");
    } catch (error) {
      console.error("Error initializing embedding model:", error);
      throw error;
    }
  }
  return embeddingModel;
};

/**
 * Generate embeddings for a text
 * @param {string} text - The text to embed
 * @returns {Promise<Array<number>>} - The embedding vector
 */
export const generateEmbedding = async (text) => {
  try {
    const model = await initEmbeddingModel();
    const output = await model(text, { pooling: "mean", normalize: true });
    // Convert to regular array from typed array for storage in Elasticsearch
    return Array.from(output.data);
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
};

/**
 * Split text into chunks with improved chunking strategy
 * @param {string} text - The text to split
 * @param {number} maxChunkSize - Maximum size of each chunk (default: 512)
 * @param {number} overlapSize - Size of overlap between chunks (default: 100)
 * @returns {Array<string>} - Array of text chunks
 */
export const splitTextIntoChunks = (
  text,
  maxChunkSize = 512,
  overlapSize = 100
) => {
  // Clean up the text first - remove excessive whitespace
  const cleanedText = text.replace(/\s+/g, " ").trim();

  // If text is small enough, return as single chunk
  if (cleanedText.length <= maxChunkSize) {
    return [cleanedText];
  }

  // More sophisticated splitting by paragraphs first, then sentences
  const paragraphs = cleanedText.split(/\n\s*\n/); // Split by empty lines
  const chunks = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    // If paragraph itself is longer than maxChunkSize, split it into sentences
    if (paragraph.length > maxChunkSize) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/);

      for (const sentence of sentences) {
        // If adding this sentence exceeds max size, start a new chunk
        if (currentChunk.length + sentence.length > maxChunkSize) {
          if (currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            // Keep some overlap for context continuity
            const words = currentChunk.split(" ");
            if (words.length > overlapSize / 5) {
              // approx 5 chars per word
              currentChunk = words
                .slice(-Math.floor(overlapSize / 5))
                .join(" ");
            } else {
              currentChunk = "";
            }
          }
        }
        currentChunk += " " + sentence;
      }
    }
    // If paragraph plus current chunk exceeds max size, start a new chunk
    else if (currentChunk.length + paragraph.length > maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // Keep some overlap for context continuity
        const words = currentChunk.split(" ");
        if (words.length > overlapSize / 5) {
          currentChunk = words.slice(-Math.floor(overlapSize / 5)).join(" ");
        } else {
          currentChunk = "";
        }
      }
      currentChunk += " " + paragraph;
    }
    // Otherwise add paragraph to current chunk
    else {
      currentChunk += " " + paragraph;
    }
  }

  // Add the last chunk if not empty
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

/**
 * Create vector search query for Elasticsearch
 * @param {Array<number>} embedding - The query embedding vector
 * @param {number} limit - Maximum number of results to return
 * @param {number} minScore - Minimum similarity score threshold (0-1)
 *                          - For this model, typical semantic similarity scores are in range 0.1-0.3
 *                          - Values above 0.3 are very high similarity
 *                          - Default is 0.1 to capture relevant matches
 * @returns {Promise<Array>} - Search results with scores
 */
export const createVectorSearchQuery = async (
  embedding,
  limit = 5,
  minScore = 0.1
) => {
  return await vectorSearch(embedding, limit, minScore);
};
