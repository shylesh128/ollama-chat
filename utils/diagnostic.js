import client, { DOCUMENT_INDEX, DOCUMENT_CHUNKS_INDEX } from "./elastic.js";
import { fileURLToPath } from "url";

/**
 * Diagnostic utility to check Elasticsearch index status
 */
export const checkElasticsearchIndices = async () => {
  try {
    console.log("Running Elasticsearch diagnostics...");

    // Check if both indices exist
    const documentIndexExists = await client.indices.exists({
      index: DOCUMENT_INDEX,
    });
    const chunksIndexExists = await client.indices.exists({
      index: DOCUMENT_CHUNKS_INDEX,
    });

    console.log(
      `Document index (${DOCUMENT_INDEX}) exists: ${documentIndexExists}`
    );
    console.log(
      `Document chunks index (${DOCUMENT_CHUNKS_INDEX}) exists: ${chunksIndexExists}`
    );

    // Get document counts
    if (documentIndexExists) {
      const docStats = await client.count({ index: DOCUMENT_INDEX });
      console.log(`Document count in ${DOCUMENT_INDEX}: ${docStats.count}`);

      // Sample a document
      if (docStats.count > 0) {
        const sample = await client.search({
          index: DOCUMENT_INDEX,
          size: 1,
        });

        if (sample.hits.hits.length > 0) {
          const doc = sample.hits.hits[0]._source;
          console.log(
            `Sample document: ID=${sample.hits.hits[0]._id}, Title="${doc.title}"`
          );
          console.log(`Fields available: ${Object.keys(doc).join(", ")}`);
        }
      }
    }

    // Get chunk counts and check embeddings
    if (chunksIndexExists) {
      const chunkStats = await client.count({ index: DOCUMENT_CHUNKS_INDEX });
      console.log(
        `Document chunk count in ${DOCUMENT_CHUNKS_INDEX}: ${chunkStats.count}`
      );

      // Sample a chunk to check if embeddings exist
      if (chunkStats.count > 0) {
        const sample = await client.search({
          index: DOCUMENT_CHUNKS_INDEX,
          size: 1,
        });

        if (sample.hits.hits.length > 0) {
          const chunk = sample.hits.hits[0]._source;
          console.log(
            `Sample chunk: ID=${sample.hits.hits[0]._id}, Title="${chunk.title}"`
          );

          const fields = Object.keys(chunk);
          console.log(`Fields available: ${fields.join(", ")}`);

          // Check if embedding exists and what size it is
          if (fields.includes("embedding")) {
            console.log(
              `Embedding exists with length: ${chunk.embedding.length}`
            );
          } else {
            console.log("WARNING: No embedding field found in chunks!");
          }
        }
      } else {
        console.log("WARNING: No document chunks found in the index!");
      }
    }

    return true;
  } catch (error) {
    console.error("Elasticsearch diagnostic error:", error);
    return false;
  }
};

/**
 * Test a vector search with a random vector to validate functionality
 */
export const testVectorSearch = async () => {
  try {
    // Generate a random embedding vector of the correct dimensionality (768)
    const randomEmbedding = Array.from(
      { length: 768 },
      () => Math.random() * 2 - 1
    );

    console.log(
      `Testing vector search with random embedding (length: ${randomEmbedding.length})`
    );

    // Try with very low minScore to see if anything returns
    const result = await client.search({
      index: DOCUMENT_CHUNKS_INDEX,
      body: {
        query: {
          bool: {
            should: [
              {
                script_score: {
                  query: { match_all: {} },
                  script: {
                    source:
                      "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                    params: { query_vector: randomEmbedding },
                  },
                },
              },
            ],
          },
        },
        size: 5,
        _source: ["documentId", "title"],
      },
    });

    console.log(
      `Random vector search returned ${result.hits.hits.length} results`
    );

    if (result.hits.hits.length > 0) {
      console.log(
        "Vector search is working, but your query vectors may not match your documents"
      );

      // Show scores
      result.hits.hits.forEach((hit, i) => {
        const normalizedScore = (hit._score - 1.0) / 2.0;
        console.log(
          `Result ${i + 1}: score=${normalizedScore.toFixed(
            4
          )}, raw=${hit._score.toFixed(4)}, title="${hit._source.title}"`
        );
      });
    } else {
      console.log("Vector search returned no results even with random vector");
      console.log(
        "This may indicate a problem with the index or mapping configuration"
      );
    }

    return true;
  } catch (error) {
    console.error("Vector search test error:", error);
    return false;
  }
};

// For direct execution in ES modules
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  (async () => {
    await checkElasticsearchIndices();
    await testVectorSearch();
  })();
}

export default {
  checkElasticsearchIndices,
  testVectorSearch,
};
