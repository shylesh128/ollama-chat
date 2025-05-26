// reprocessDocuments.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { processDocumentContentWithEmbeddings } from "../services/document.service.js";
import Document from "../models/document.model.js";
import DocumentChunk from "../models/documentChunk.model.js";
import connectDB from "./db.js";

// Load environment variables
dotenv.config();

/**
 * Reprocess all documents to generate new chunks and embeddings
 */
const reprocessDocuments = async () => {
  try {
    // Connect to the database
    await connectDB();
    console.log("Connected to MongoDB");

    // Get all active documents
    const documents = await Document.find({ isActive: true });
    console.log(`Found ${documents.length} documents to reprocess`);

    if (documents.length === 0) {
      console.log("No documents to process. Exiting.");
      process.exit(0);
    }

    // Process each document
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      console.log(
        `\nProcessing document ${i + 1}/${documents.length}: ${doc.title}`
      );

      try {
        // Delete existing chunks for this document
        const deleteResult = await DocumentChunk.deleteMany({
          documentId: doc._id,
        });
        console.log(`Deleted ${deleteResult.deletedCount} existing chunks`);

        // Process the document with new chunking and embeddings
        await processDocumentContentWithEmbeddings(doc);
        console.log(`Successfully reprocessed document: ${doc.title}`);
      } catch (error) {
        console.error(`Error processing document ${doc.title}:`, error);
        // Continue with next document
      }
    }

    console.log("\nDocument reprocessing completed!");
    process.exit(0);
  } catch (error) {
    console.error("Error in reprocessDocuments:", error);
    process.exit(1);
  }
};

// Run the reprocessing
reprocessDocuments();
