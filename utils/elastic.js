import { Client } from "@elastic/elasticsearch";

// Create and configure Elasticsearch client
// const client = new Client({
//   node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
//   auth: {
//     username: "shyy",
//     password: "shylesh",
//   },
//   tls: process.env.ELASTICSEARCH_TLS_CA
//     ? {
//         ca: process.env.ELASTICSEARCH_TLS_CA,
//       }
//     : undefined,
// });

const client = new Client({
  node: "https://my-elasticsearch-project-d1300c.es.ap-southeast-1.aws.elastic.cloud:443",
  auth: {
    apiKey: "SzNyS0RKY0JiV0dkRk9kWG0wMTE6QUF2ZEtNTDI2TjJCeGE5QTBKcnZCUQ==",
  },
});

// Indices
export const DOCUMENT_INDEX = "documents";
export const DOCUMENT_CHUNKS_INDEX = "document_chunks";

/**
 * Initialize Elasticsearch connection and create necessary indices
 */
export const initializeElasticsearch = async () => {
  try {
    // Test connection
    const info = await client.info();
    console.log(`Elasticsearch connected: ${info.version.number}`);

    // Create document index if it doesn't exist
    const documentIndexExists = await client.indices.exists({
      index: DOCUMENT_INDEX,
    });

    if (!documentIndexExists) {
      await client.indices.create({
        index: DOCUMENT_INDEX,
        mappings: {
          properties: {
            title: { type: "text" },
            filename: { type: "keyword" },
            path: { type: "keyword" },
            content: { type: "text" },
            metadata: { type: "object", enabled: true },
            isActive: { type: "boolean" },
            createdAt: { type: "date" },
            updatedAt: { type: "date" },
          },
        },
      });
      console.log(`Created ${DOCUMENT_INDEX} index`);
    }

    // Create document chunks index with vector search capabilities
    const chunksIndexExists = await client.indices.exists({
      index: DOCUMENT_CHUNKS_INDEX,
    });

    if (!chunksIndexExists) {
      await client.indices.create({
        index: DOCUMENT_CHUNKS_INDEX,
        mappings: {
          properties: {
            documentId: { type: "keyword" },
            title: { type: "text" },
            content: { type: "text" },
            embedding: {
              type: "dense_vector",
              dims: 768,
              index: true,
              similarity: "cosine",
            },
            pageNumber: { type: "integer" },
            chunkIndex: { type: "integer" },
            metadata: { type: "object", enabled: true },
            isActive: { type: "boolean" },
            createdAt: { type: "date" },
            updatedAt: { type: "date" },
          },
        },
      });
      console.log(`Created ${DOCUMENT_CHUNKS_INDEX} index`);
    }

    return true;
  } catch (error) {
    console.error("Elasticsearch initialization error:", error);
    return false;
  }
};

/**
 * Get Elasticsearch health status
 */
export const getElasticsearchStatus = async () => {
  try {
    const health = await client.cluster.health();
    return {
      status: health.status,
      clusterName: health.cluster_name,
      numberOfNodes: health.number_of_nodes,
    };
  } catch (error) {
    console.error("Failed to get Elasticsearch status:", error);
    return {
      status: "error",
      error: error.message,
    };
  }
};

/**
 * Perform vector search on document chunks
 * @param {Array<number>} embedding - The query embedding vector
 * @param {number} limit - Maximum number of results
 * @param {number} minScore - Minimum similarity score threshold (0-1)
 * @returns {Promise<Array>} - Search results
 */
export const vectorSearch = async (embedding, limit = 5, minScore = 0.1) => {
  try {
    console.log(
      `Vector search called with embedding length: ${embedding.length}, limit: ${limit}, minScore: ${minScore}`
    );

    const result = await client.search({
      index: DOCUMENT_CHUNKS_INDEX,
      body: {
        query: {
          bool: {
            must: [
              {
                match: {
                  isActive: true,
                },
              },
            ],
            should: [
              {
                script_score: {
                  query: { match_all: {} },
                  script: {
                    source:
                      "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                    params: { query_vector: embedding },
                  },
                },
              },
            ],
          },
        },
        size: limit * 2,
        _source: {
          includes: [
            "documentId",
            "title",
            "content",
            "pageNumber",
            "chunkIndex",
            "metadata",
          ],
        },
      },
    });

    console.log(`Raw search returned ${result.hits.hits.length} results`);

    if (result.hits.hits.length === 0) {
      console.log(
        `No hits found in Elasticsearch. Checking if index exists and has documents...`
      );
      const indexExists = await client.indices.exists({
        index: DOCUMENT_CHUNKS_INDEX,
      });
      console.log(`Index ${DOCUMENT_CHUNKS_INDEX} exists: ${indexExists}`);

      if (indexExists) {
        const stats = await client.indices.stats({
          index: DOCUMENT_CHUNKS_INDEX,
        });
        console.log(
          `Index stats: ${JSON.stringify(
            stats.indices[DOCUMENT_CHUNKS_INDEX].total.docs
          )}`
        );
      }

      return [];
    }

    // Process results and filter by score
    // Elasticsearch cosine similarity returns values in [-1,1], transform to [0,1]
    const hits = result.hits.hits.map((hit) => {
      const score = (hit._score - 1.0) / 2.0; // Transform from [-1,1] to [0,1]
      return {
        _id: hit._id,
        documentId: hit._source.documentId,
        title: hit._source.title,
        content: hit._source.content,
        pageNumber: hit._source.pageNumber,
        chunkIndex: hit._source.chunkIndex,
        metadata: hit._source.metadata,
        score,
        rawScore: hit._score,
      };
    });

    console.log(
      `Scores before filtering: ${hits
        .map((h) => h.score.toFixed(2))
        .join(", ")}`
    );

    const filteredHits = hits
      .filter((hit) => hit.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(
      `After filtering by minScore ${minScore}: ${filteredHits.length} hits remain`
    );

    return filteredHits;
  } catch (error) {
    console.error("Error performing vector search:", error);
    return [];
  }
};

/**
 * Perform text search on documents
 * @param {string} query - Text search query
 * @param {number} limit - Maximum results
 * @returns {Promise<Array>} - Search results
 */
export const textSearch = async (query, limit = 5) => {
  try {
    const result = await client.search({
      index: DOCUMENT_INDEX,
      body: {
        query: {
          bool: {
            must: [
              {
                match: {
                  isActive: true,
                },
              },
              {
                multi_match: {
                  query,
                  fields: ["title^2", "content"],
                  fuzziness: "AUTO",
                },
              },
            ],
          },
        },
        size: limit,
        _source: {
          includes: ["_id", "title", "content"],
        },
      },
    });

    return result.hits.hits.map((hit) => ({
      documentId: hit._id,
      title: hit._source.title,
      content: hit._source.content,
      score: hit._score / 10, // Normalize score
    }));
  } catch (error) {
    console.error("Error performing text search:", error);
    return [];
  }
};

// Export client for direct use in other modules
export default client;
