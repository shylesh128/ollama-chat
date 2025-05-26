import mongoose from "mongoose";
import { initializeElasticsearch, getElasticsearchStatus } from "./elastic.js";

// MONGODB_URI should be set in your .env file
const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () => {
      console.log("MongoDB connected successfully");
    });

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
    });

    // Connect to MongoDB
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/ollama-chat"
    );

    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Initialize Elasticsearch
    console.log("Initializing Elasticsearch...");
    const elasticInitialized = await initializeElasticsearch();

    if (!elasticInitialized) {
      console.error(
        "Failed to initialize Elasticsearch. Check your configuration."
      );
      console.warn("Elasticsearch features will not be available.");
    }
  } catch (error) {
    console.error("Database connection error:", error);
    process.exit(1);
  }
};

/**
 * Initialize vector search by creating or updating the vector index
 */
export const initializeVectorSearch = async () => {
  const db = mongoose.connection.db;
  const collections = await db
    .listCollections({ name: "documentchunks" })
    .toArray();

  if (collections.length > 0) {
    console.log("Document chunks collection exists, checking vector index...");

    // Check if vector index exists
    const indexes = await db.collection("documentchunks").indexes();
    const vectorIndex = indexes.find((index) => index.name === "vectorIndex");

    // If index exists but with wrong dimensions, drop it to recreate
    if (vectorIndex) {
      // all-mpnet-base-v2 has 768 dimensions
      if (
        vectorIndex.key &&
        vectorIndex.key.embedding === "vector" &&
        (!vectorIndex.vectorOptions ||
          vectorIndex.vectorOptions.dimension !== 768)
      ) {
        console.log(
          "Existing vector index has incorrect dimensions, recreating..."
        );
        await db.collection("documentchunks").dropIndex("vectorIndex");
        await createVectorIndex(db);
      } else {
        console.log("Vector index exists with correct configuration");
      }
    } else {
      console.log("Creating vector index on document chunks...");
      await createVectorIndex(db);
    }
  } else {
    console.log(
      "Document chunks collection doesn't exist yet, index will be created when needed"
    );
  }
};

/**
 * Create vector index with proper dimensions for the embedding model
 * @param {Object} db - MongoDB database connection
 */
const createVectorIndex = async (db) => {
  await db.collection("documentchunks").createIndex(
    { embedding: "vector" },
    {
      name: "vectorIndex",
      vectorDimension: 768, // Dimension of all-mpnet-base-v2 embeddings
      vectorDistanceMetric: "cosine",
    }
  );
  console.log("Vector index created successfully");
};

/**
 * Get database connection status for both MongoDB and Elasticsearch
 */
export const getDbStatus = async () => {
  const mongoState = mongoose.connection.readyState;
  const mongoStates = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  // Get Elasticsearch status
  const elasticStatus = await getElasticsearchStatus();

  return {
    mongodb: {
      status: mongoStates[mongoState] || "unknown",
      readyState: mongoState,
    },
    elasticsearch: elasticStatus,
  };
};

export default connectDB;
