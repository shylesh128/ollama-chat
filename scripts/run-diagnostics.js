import {
  checkElasticsearchIndices,
  testVectorSearch,
} from "../utils/diagnostic.js";

/**
 * Run diagnostics for Elasticsearch vector search
 */
const runDiagnostics = async () => {
  console.log("=======================================");
  console.log("Running Elasticsearch vector search diagnostics");
  console.log("=======================================");

  // Check index status and document counts
  await checkElasticsearchIndices();

  console.log("\n---------------------------------------\n");

  // Test vector search with random vectors
  await testVectorSearch();

  console.log("=======================================");
  console.log("Diagnostics complete");
  console.log("=======================================");
};

// Run the diagnostics
runDiagnostics().catch((error) => {
  console.error("Diagnostic error:", error);
});
