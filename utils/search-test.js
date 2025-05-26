import { generateEmbedding } from "./embedding.js";
import client, { DOCUMENT_CHUNKS_INDEX } from "./elastic.js";

/**
 * Test vector search with different configurations
 * @param {string} query - The search query
 */
export const testSearch = async (query) => {
  try {
    console.log(`Testing search with query: "${query}"`);

    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    console.log(`Generated embedding vector with length: ${embedding.length}`);

    // Search directly with Elasticsearch client for more control
    const result = await client.search({
      index: DOCUMENT_CHUNKS_INDEX,
      body: {
        query: {
          script_score: {
            query: { match_all: {} },
            script: {
              source:
                "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
              params: { query_vector: embedding },
            },
          },
        },
        size: 10,
        _source: ["documentId", "title", "content"],
      },
    });

    console.log(`Search returned ${result.hits.hits.length} results`);

    // Process and display results
    const hits = result.hits.hits.map((hit) => {
      // Convert ES cosine score (which is in range [-1,1] + 1.0) to [0,1]
      const normalizedScore = (hit._score - 1.0) / 2.0;

      return {
        id: hit._id,
        title: hit._source.title,
        score: normalizedScore,
        rawScore: hit._score,
        snippet: hit._source.content.substring(0, 100) + "...",
      };
    });

    // Log scores for all results
    console.log("\nAll search results with scores:");
    hits.forEach((hit, i) => {
      console.log(
        `${i + 1}. [Score: ${hit.score.toFixed(4)}] "${hit.title}": ${
          hit.snippet
        }`
      );
    });

    // Show what would be returned with different score thresholds
    console.log("\nResults at different minimum score thresholds:");
    for (const threshold of [0.7, 0.5, 0.3, 0.2, 0.1, 0.05]) {
      const filtered = hits.filter((hit) => hit.score >= threshold);
      console.log(
        `minScore=${threshold.toFixed(2)}: ${filtered.length} results`
      );
    }

    return hits;
  } catch (error) {
    console.error("Search test error:", error);
    return [];
  }
};

// For direct execution
if (process.argv[2]) {
  const query = process.argv[2];
  testSearch(query).catch((err) => console.error(err));
} else {
  console.log('Usage: node search-test.js "your search query"');
}
