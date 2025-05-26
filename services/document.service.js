import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import Document from "../models/document.model.js";
import elasticClient, {
  DOCUMENT_INDEX,
  DOCUMENT_CHUNKS_INDEX,
} from "../utils/elastic.js";
import {
  generateEmbedding,
  splitTextIntoChunks,
  createVectorSearchQuery,
} from "../utils/embedding.js";

/**
 * Parse PDF file and extract text content
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<{content: string, metadata: Object}>}
 */
export const parsePdf = async (filePath) => {
  try {
    console.log(`Reading file from: ${filePath}`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      console.error(`File not found at path: ${filePath}`);
      throw new Error(`File not found at path: ${filePath}`);
    }

    // Read file
    const dataBuffer = await fs.readFile(filePath);
    console.log(`File read successfully, size: ${dataBuffer.length} bytes`);

    if (dataBuffer.length === 0) {
      throw new Error("Empty PDF file");
    }

    // Parse PDF
    console.log("Parsing PDF with pdf-parse...");
    const data = await pdfParse(dataBuffer);
    console.log(`PDF parsed successfully: ${data.numpages} pages`);

    return {
      content: data.text || "No text content extracted",
      metadata: {
        pageCount: data.numpages,
        info: data.info,
      },
    };
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
};

/**
 * Save a document to Elasticsearch
 * @param {Object} documentData - Document data
 * @returns {Promise<Object>} - Saved document
 */
export const saveDocument = async (documentData) => {
  try {
    console.log("Saving document to Elasticsearch:", documentData.title);

    // Add timestamps
    const now = new Date().toISOString();
    const document = {
      ...documentData,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    // Save the main document record to Elasticsearch
    const result = await elasticClient.index({
      index: DOCUMENT_INDEX,
      document: document,
      refresh: true, // Make document immediately available for search
    });

    // Set document ID from Elasticsearch response
    const savedDocument = {
      ...document,
      _id: result._id,
    };

    // Process the content into chunks with embeddings
    console.log("Processing document content into chunks with embeddings...");
    await processDocumentContentWithEmbeddings(savedDocument);

    return savedDocument;
  } catch (error) {
    console.error("Error saving document:", error);
    throw new Error(`Failed to save document: ${error.message}`);
  }
};

/**
 * Process document content and create embedded chunks in Elasticsearch
 * @param {Object} document - The saved document
 * @returns {Promise<void>}
 */
export const processDocumentContentWithEmbeddings = async (document) => {
  try {
    console.log(
      `Processing content for document: ${document.title} (${document._id})`
    );

    // Split the content into chunks
    const chunks = splitTextIntoChunks(document.content);
    console.log(`Split content into ${chunks.length} chunks`);

    // Process each chunk and generate embeddings
    const operations = [];

    for (let index = 0; index < chunks.length; index++) {
      try {
        const chunkContent = chunks[index];
        console.log(
          `Generating embedding for chunk ${index + 1}/${chunks.length}`
        );
        const embedding = await generateEmbedding(chunkContent);

        // Create a new document chunk with embedding
        const documentChunk = {
          documentId: document._id,
          title: document.title,
          content: chunkContent,
          embedding: embedding,
          chunkIndex: index,
          pageNumber: estimatePageNumber(
            index,
            chunks.length,
            document.metadata.pageCount
          ),
          metadata: {
            documentTitle: document.title,
            totalChunks: chunks.length,
          },
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Add to bulk operations
        operations.push({
          index: {
            _index: DOCUMENT_CHUNKS_INDEX,
          },
        });
        operations.push(documentChunk);

        // Process in batches of 50 to avoid overwhelming Elasticsearch
        if (operations.length >= 100) {
          await elasticClient.bulk({ operations, refresh: true });
          operations.length = 0;
        }
      } catch (error) {
        console.error(`Error processing chunk ${index}:`, error);
        // Continue with other chunks even if one fails
      }
    }

    // Process any remaining operations
    if (operations.length > 0) {
      await elasticClient.bulk({ operations, refresh: true });
    }

    console.log(
      `Successfully processed all chunks for document ${document._id}`
    );
  } catch (error) {
    console.error("Error processing document content:", error);
    throw new Error(`Failed to process document content: ${error.message}`);
  }
};

/**
 * Estimate page number based on chunk index
 * @param {number} chunkIndex - Index of the chunk
 * @param {number} totalChunks - Total number of chunks
 * @param {number} totalPages - Total number of pages
 * @returns {number} - Estimated page number
 */
const estimatePageNumber = (chunkIndex, totalChunks, totalPages) => {
  if (totalChunks <= 1) return 1;
  // Simple linear mapping from chunk index to page number
  return Math.max(
    1,
    Math.min(
      totalPages,
      Math.floor((chunkIndex / totalChunks) * totalPages) + 1
    )
  );
};

/**
 * Get all documents from Elasticsearch
 * @returns {Promise<Array>}
 */
export const getAllDocuments = async () => {
  try {
    const result = await elasticClient.search({
      index: DOCUMENT_INDEX,
      query: {
        match: {
          isActive: true,
        },
      },
      sort: [{ createdAt: { order: "desc" } }],
      _source: ["title", "filename", "metadata", "createdAt"],
    });

    return result.hits.hits.map((hit) => ({
      _id: hit._id,
      title: hit._source.title,
      filename: hit._source.filename,
      metadata: hit._source.metadata,
      createdAt: hit._source.createdAt,
    }));
  } catch (error) {
    console.error("Error getting all documents:", error);
    throw error;
  }
};

/**
 * Get a document by ID from Elasticsearch
 * @param {string} documentId - Document ID
 * @returns {Promise<Object>}
 */
export const getDocumentById = async (documentId) => {
  try {
    const result = await elasticClient.get({
      index: DOCUMENT_INDEX,
      id: documentId,
    });

    return {
      _id: result._id,
      ...result._source,
    };
  } catch (error) {
    console.error(`Error getting document ${documentId}:`, error);
    return null;
  }
};

/**
 * Delete a document and its chunks from Elasticsearch
 * @param {string} documentId - Document ID
 * @returns {Promise<boolean>}
 */
export const deleteDocument = async (documentId) => {
  try {
    const document = await getDocumentById(documentId);
    if (!document) return false;

    // Delete the file
    try {
      await fs.unlink(document.path);
    } catch (err) {
      console.error("Error deleting file:", err);
      // Continue even if file deletion fails
    }

    // Delete associated chunks using the documentId field
    await elasticClient.deleteByQuery({
      index: DOCUMENT_CHUNKS_INDEX,
      query: {
        match: {
          documentId: documentId,
        },
      },
      refresh: true,
    });
    console.log(`Deleted associated chunks for document ${documentId}`);

    // Delete document from Elasticsearch
    await elasticClient.delete({
      index: DOCUMENT_INDEX,
      id: documentId,
      refresh: true,
    });

    return true;
  } catch (error) {
    console.error("Error deleting document:", error);
    throw error;
  }
};

/**
 * Search documents for relevant context using vector search
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results (default: 5)
 * @returns {Promise<Array>} - Array of document content snippets
 */
export const searchDocumentsForContext = async (query, limit = 5) => {
  try {
    console.log(`Searching for context with query: "${query}"`);

    // Clean and enhance the query for better matching
    const enhancedQuery = enhanceSearchQuery(query);
    console.log(`Enhanced query: "${enhancedQuery}"`);

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(enhancedQuery);
    console.log(`Generated embedding with length: ${queryEmbedding.length}`);

    // Perform vector search with lower threshold based on testing
    const minScore = 0.1; // Much lower threshold based on testing
    console.log(`Using minScore threshold: ${minScore}`);

    const vectorResults = await createVectorSearchQuery(
      queryEmbedding,
      limit * 2,
      minScore
    );

    console.log(`Vector search found ${vectorResults.length} relevant chunks`);

    if (vectorResults.length > 0) {
      // Log scores for debugging
      vectorResults.forEach((result, i) => {
        console.log(
          `  Result ${i + 1}: score=${result.score.toFixed(4)}, page=${
            result.pageNumber || "N/A"
          }, title="${result.title}"`
        );
      });

      // Group chunks by document to consolidate information
      const docMap = new Map();

      vectorResults.forEach((result) => {
        const docId = result.documentId.toString();
        if (!docMap.has(docId)) {
          docMap.set(docId, {
            documentId: result.documentId,
            title: result.title,
            chunks: [],
          });
        }

        // Add this chunk with its score
        docMap.get(docId).chunks.push({
          content: result.content,
          score: result.score,
          pageNumber: result.pageNumber,
        });
      });

      // For each document, combine nearby chunks for better context
      const contextSnippets = [];

      for (const [_, docInfo] of docMap.entries()) {
        // Sort chunks by page number and then by score
        docInfo.chunks.sort((a, b) => {
          if (a.pageNumber !== b.pageNumber) {
            return (a.pageNumber || 0) - (b.pageNumber || 0);
          }
          return b.score - a.score;
        });

        // Combine chunks that are from the same or adjacent pages
        let currentPageChunks = [];
        let currentPage = null;

        for (const chunk of docInfo.chunks) {
          if (
            currentPage === null ||
            currentPage === chunk.pageNumber ||
            currentPage + 1 === chunk.pageNumber ||
            currentPage - 1 === chunk.pageNumber
          ) {
            currentPageChunks.push(chunk);
            currentPage = chunk.pageNumber;
          } else {
            // Process current group and start a new one
            if (currentPageChunks.length > 0) {
              contextSnippets.push(
                createSnippetFromChunks(
                  docInfo.title,
                  docInfo.documentId,
                  currentPageChunks
                )
              );
            }
            currentPageChunks = [chunk];
            currentPage = chunk.pageNumber;
          }
        }

        // Process final group
        if (currentPageChunks.length > 0) {
          contextSnippets.push(
            createSnippetFromChunks(
              docInfo.title,
              docInfo.documentId,
              currentPageChunks
            )
          );
        }
      }

      // Sort snippets by average score
      contextSnippets.sort((a, b) => b.score - a.score);

      return contextSnippets.slice(0, limit);
    }

    // Fallback to text search if vector search returns no results
    console.log("Falling back to text search");

    const result = await elasticClient.search({
      index: DOCUMENT_INDEX,
      query: {
        bool: {
          must: [
            { match: { isActive: true } },
            {
              multi_match: {
                query: query,
                fields: ["title^2", "content"],
                fuzziness: "AUTO",
              },
            },
          ],
        },
      },
      size: limit,
      _source: ["title", "content"],
    });

    // Extract relevant snippets from each document
    const contextSnippets = result.hits.hits.map((doc) => {
      const content = doc._source.content;
      const queryTerms = query.split(" ").filter((term) => term.length > 3);
      let bestSnippetStart = 0;

      // Find a reasonable snippet starting position
      if (queryTerms.length > 0) {
        for (const term of queryTerms) {
          const pos = content.toLowerCase().indexOf(term.toLowerCase());
          if (pos !== -1) {
            // Try to start the snippet a bit before the term
            bestSnippetStart = Math.max(0, pos - 100);
            break;
          }
        }
      }

      // Extract a snippet (up to 500 chars)
      const snippetLength = 500;
      let snippet = content.substring(
        bestSnippetStart,
        bestSnippetStart + snippetLength
      );

      // If we cut in the middle of a word at the start, find the next space and start there
      if (bestSnippetStart > 0) {
        const firstSpace = snippet.indexOf(" ");
        if (firstSpace > 0) {
          snippet = snippet.substring(firstSpace + 1);
        }
      }

      // Add ellipsis if needed
      if (bestSnippetStart > 0) {
        snippet = `...${snippet}`;
      }
      if (bestSnippetStart + snippetLength < content.length) {
        snippet = `${snippet}...`;
      }

      return {
        title: doc._source.title,
        snippet,
        documentId: doc._id,
        score: 0.5, // Lower score for text search results
      };
    });

    return contextSnippets;
  } catch (error) {
    console.error("Error searching for document context:", error);
    // Fallback to empty array in case of errors
    return [];
  }
};

/**
 * Enhance search query for better matching
 * @param {string} query - Original query
 * @returns {string} - Enhanced query
 */
const enhanceSearchQuery = (query) => {
  // Remove question marks and other punctuation that might affect search
  let enhanced = query.replace(/\?+$/, "").trim();

  // Remove common filler words at the start of questions
  enhanced = enhanced
    .replace(
      /^(can you|could you|please|tell me|explain|what is|how to|how do|why is|where is|when is)/i,
      ""
    )
    .trim();

  // If query is very short, keep it as is
  if (enhanced.length < 10 && query.length >= enhanced.length) {
    return query;
  }

  return enhanced;
};

/**
 * Create a snippet from multiple chunks
 * @param {string} title - Document title
 * @param {Object} documentId - Document ID
 * @param {Array} chunks - Array of chunks with scores
 * @returns {Object} - Snippet object
 */
const createSnippetFromChunks = (title, documentId, chunks) => {
  // If only one chunk, return it directly
  if (chunks.length === 1) {
    return {
      title,
      documentId,
      snippet: chunks[0].content,
      pageNumber: chunks[0].pageNumber,
      score: chunks[0].score,
    };
  }

  // Sort chunks by score
  chunks.sort((a, b) => b.score - a.score);

  // Calculate average score
  const avgScore =
    chunks.reduce((sum, chunk) => sum + chunk.score, 0) / chunks.length;

  // Get the highest scored chunk as the center of our context
  const primaryChunk = chunks[0];

  // Limit total content length
  const maxCombinedLength = 800;
  let combinedContent = primaryChunk.content;
  let pageNumbers = new Set([primaryChunk.pageNumber]);

  // Add other chunks' content until we reach the max length
  for (let i = 1; i < chunks.length; i++) {
    if (
      combinedContent.length + chunks[i].content.length <=
      maxCombinedLength
    ) {
      combinedContent += "\n\n" + chunks[i].content;
      if (chunks[i].pageNumber) pageNumbers.add(chunks[i].pageNumber);
    } else {
      // If adding full chunk exceeds limit, add partial content
      const remainingSpace = maxCombinedLength - combinedContent.length;
      if (remainingSpace > 100) {
        // Only add if we can include a meaningful amount
        combinedContent +=
          "\n\n" + chunks[i].content.substring(0, remainingSpace) + "...";
        if (chunks[i].pageNumber) pageNumbers.add(chunks[i].pageNumber);
      }
      break;
    }
  }

  // Convert page numbers set to array and sort
  const pages = Array.from(pageNumbers)
    .filter((p) => p !== null && p !== undefined)
    .sort();

  // Create page range string (e.g., "Pages 5-7" or "Page 3")
  let pageStr = "";
  if (pages.length === 1) {
    pageStr = `Page ${pages[0]}`;
  } else if (pages.length > 1) {
    pageStr = `Pages ${pages[0]}-${pages[pages.length - 1]}`;
  }

  return {
    title,
    documentId,
    snippet: combinedContent,
    pageNumber: pages[0], // Use first page as reference
    pageInfo: pageStr,
    score: avgScore,
  };
};
