/**
 * Migration script to move data from MongoDB to Elasticsearch
 *
 * Run with: node scripts/migrate-to-elasticsearch.js
 */

import "dotenv/config";
import mongoose from "mongoose";
import Document from "../models/document.model.js";
import DocumentChunk from "../models/documentChunk.model.js";
import elasticClient, {
  DOCUMENT_INDEX,
  DOCUMENT_CHUNKS_INDEX,
  initializeElasticsearch,
} from "../utils/elastic.js";

// Batch size for operations
const BATCH_SIZE = 50;

/**
 * Connect to MongoDB
 */
const connectMongo = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/ollama-chat"
    );
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

/**
 * Migrate documents from MongoDB to Elasticsearch
 */
const migrateDocuments = async () => {
  try {
    console.log("Migrating documents...");

    // Get all documents from MongoDB
    const documents = await Document.find();
    console.log(`Found ${documents.length} documents to migrate`);

    // Process documents in batches
    const operations = [];

    for (const doc of documents) {
      operations.push({
        index: {
          _index: DOCUMENT_INDEX,
          _id: doc._id.toString(),
        },
      });

      // Convert MongoDB document to Elasticsearch document
      operations.push({
        title: doc.title,
        filename: doc.filename,
        path: doc.path,
        content: doc.content,
        metadata: doc.metadata || {},
        isActive: doc.isActive !== false,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      });

      // Process in batches
      if (operations.length >= BATCH_SIZE * 2) {
        await elasticClient.bulk({ operations, refresh: true });
        console.log(`Migrated batch of ${operations.length / 2} documents`);
        operations.length = 0;
      }
    }

    // Process remaining operations
    if (operations.length > 0) {
      await elasticClient.bulk({ operations, refresh: true });
      console.log(`Migrated final batch of ${operations.length / 2} documents`);
    }

    console.log("Document migration complete");
  } catch (error) {
    console.error("Error migrating documents:", error);
    throw error;
  }
};

/**
 * Migrate document chunks from MongoDB to Elasticsearch
 */
const migrateDocumentChunks = async () => {
  try {
    console.log("Migrating document chunks...");

    // Count total chunks for progress reporting
    const totalChunks = await DocumentChunk.countDocuments();
    console.log(`Found ${totalChunks} document chunks to migrate`);

    // Get chunks in batches to avoid memory issues
    let processed = 0;
    let batch = 1;

    // Process in batches of 100
    const cursor = DocumentChunk.find().cursor();
    const operations = [];

    for await (const chunk of cursor) {
      operations.push({
        index: {
          _index: DOCUMENT_CHUNKS_INDEX,
          _id: chunk._id.toString(),
        },
      });

      // Convert MongoDB chunk to Elasticsearch document
      operations.push({
        documentId: chunk.documentId.toString(),
        title: chunk.title,
        content: chunk.content,
        embedding: chunk.embedding,
        pageNumber: chunk.pageNumber || 0,
        chunkIndex: chunk.chunkIndex,
        metadata: chunk.metadata || {},
        isActive: chunk.isActive !== false,
        createdAt: chunk.createdAt.toISOString(),
        updatedAt: chunk.updatedAt.toISOString(),
      });

      processed++;

      // Process in batches
      if (operations.length >= BATCH_SIZE * 2) {
        await elasticClient.bulk({ operations, refresh: false });
        console.log(
          `Migrated batch ${batch++} (${processed}/${totalChunks} chunks)`
        );
        operations.length = 0;
      }
    }

    // Process remaining operations
    if (operations.length > 0) {
      await elasticClient.bulk({ operations, refresh: true });
      console.log(`Migrated final batch (${processed}/${totalChunks} chunks)`);
    }

    // Refresh index to make all documents searchable
    await elasticClient.indices.refresh({ index: DOCUMENT_CHUNKS_INDEX });
    console.log("Document chunks migration complete");
  } catch (error) {
    console.error("Error migrating document chunks:", error);
    throw error;
  }
};

/**
 * Main migration function
 */
const migrate = async () => {
  try {
    // Connect to MongoDB
    await connectMongo();

    // Initialize Elasticsearch
    const initialized = await initializeElasticsearch();
    if (!initialized) {
      throw new Error("Failed to initialize Elasticsearch");
    }

    // Migrate documents
    await migrateDocuments();

    // Migrate document chunks
    await migrateDocumentChunks();

    console.log("Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

// Run migration
migrate();
