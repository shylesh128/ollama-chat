import { getDbStatus } from "../utils/db.js";
import { getElasticsearchStatus } from "../utils/elastic.js";

/**
 * Get system status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getStatus = async (req, res) => {
  try {
    // Get database status
    const dbStatus = await getDbStatus();

    // Get Ollama status
    let ollamaStatus = "unknown";
    try {
      const ollamaResponse = await fetch(
        process.env.OLLAMA_API_HOST + "/api/tags",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (ollamaResponse.ok) {
        const models = await ollamaResponse.json();
        ollamaStatus = {
          status: "connected",
          models: models.models.map((m) => m.name),
        };
      } else {
        ollamaStatus = {
          status: "error",
          message: `HTTP ${ollamaResponse.status}: ${ollamaResponse.statusText}`,
        };
      }
    } catch (error) {
      ollamaStatus = {
        status: "error",
        message: error.message,
      };
    }

    res.json({
      status: "ok",
      databases: dbStatus,
      ollama: ollamaStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting status:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
