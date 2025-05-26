import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import catchAsync from "../utils/catchAsync.js";
import {
  processDocumentContentWithEmbeddings,
  getDocumentById,
} from "../services/document.service.js";
import Document from "../models/document.model.js";
import DocumentChunk from "../models/documentChunk.model.js";
import * as adminController from "../controllers/admin.controller.js";
import elasticClient, { DOCUMENT_CHUNKS_INDEX } from "../utils/elastic.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

const router = express.Router();

/**
 * @swagger
 * /admin/status:
 *   get:
 *     summary: Get system status
 *     description: Returns system status information for diagnostics.
 *     tags:
 *       - Admin
 *     responses:
 *       200:
 *         description: System status
 */
router.get("/status", catchAsync(adminController.getStatus));

/**
 * @swagger
 * /admin/fix-uploads:
 *   post:
 *     summary: Fix uploads directory
 *     description: Creates the uploads directory if it doesn't exist.
 *     tags:
 *       - Admin
 *     responses:
 *       200:
 *         description: Result of the fix operation
 */
router.post(
  "/fix-uploads",
  catchAsync(async (req, res) => {
    try {
      if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        res.json({
          success: true,
          message: "Uploads directory created successfully",
          path: UPLOAD_DIR,
        });
      } else {
        res.json({
          success: true,
          message: "Uploads directory already exists",
          path: UPLOAD_DIR,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to create uploads directory: ${error.message}`,
        error: error.toString(),
      });
    }
  })
);

/**
 * @swagger
 * /admin/reprocess-documents:
 *   post:
 *     summary: Reprocess documents with improved embeddings
 *     description: Regenerates chunks and embeddings for all documents or a specific document.
 *     tags:
 *       - Admin
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               documentId:
 *                 type: string
 *                 description: Optional document ID to reprocess. If not provided, all documents will be reprocessed.
 *     responses:
 *       200:
 *         description: Result of the reprocessing operation
 *       500:
 *         description: Internal server error
 */
router.post(
  "/reprocess-documents",
  catchAsync(async (req, res) => {
    try {
      const { documentId } = req.body;

      // If documentId is provided, process only that document
      if (documentId) {
        const document = await getDocumentById(documentId);
        if (!document) {
          return res.status(404).json({
            success: false,
            message: "Document not found",
          });
        }

        // Delete existing chunks from Elasticsearch
        const deleteResponse = await elasticClient.deleteByQuery({
          index: DOCUMENT_CHUNKS_INDEX,
          query: {
            match: {
              documentId: documentId,
            },
          },
          refresh: true,
        });

        // Process document
        await processDocumentContentWithEmbeddings(document);

        return res.json({
          success: true,
          message: `Document "${document.title}" reprocessed successfully. Deleted ${deleteResponse.deleted} old chunks.`,
        });
      }

      // Otherwise, process all documents
      const documents = await Document.find({ isActive: true });

      if (documents.length === 0) {
        return res.json({
          success: true,
          message: "No documents found to reprocess",
        });
      }

      // Start background processing - don't wait for completion
      const jobId = Date.now();

      res.json({
        success: true,
        message: `Started reprocessing ${documents.length} documents in the background`,
        jobId,
        totalDocuments: documents.length,
      });

      // Background processing
      (async () => {
        try {
          console.log(
            `[Job ${jobId}] Starting to reprocess ${documents.length} documents`
          );

          for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            console.log(
              `[Job ${jobId}] Processing document ${i + 1}/${
                documents.length
              }: ${doc.title}`
            );

            try {
              // Delete existing chunks from Elasticsearch
              const deleteResponse = await elasticClient.deleteByQuery({
                index: DOCUMENT_CHUNKS_INDEX,
                query: {
                  match: {
                    documentId: doc._id.toString(),
                  },
                },
                refresh: true,
              });

              console.log(
                `[Job ${jobId}] Deleted ${deleteResponse.deleted} old chunks for "${doc.title}"`
              );

              // Get full document with content from Elasticsearch
              const fullDoc = await getDocumentById(doc._id);
              if (!fullDoc) {
                console.error(
                  `[Job ${jobId}] Document ${doc._id} not found in Elasticsearch`
                );
                continue;
              }

              // Reprocess document
              await processDocumentContentWithEmbeddings(fullDoc);
              console.log(
                `[Job ${jobId}] Successfully reprocessed "${doc.title}"`
              );
            } catch (docError) {
              console.error(
                `[Job ${jobId}] Error processing document "${doc.title}":`,
                docError
              );
              // Continue with next document
            }
          }

          console.log(`[Job ${jobId}] Completed reprocessing all documents`);
        } catch (jobError) {
          console.error(`[Job ${jobId}] Background job error:`, jobError);
        }
      })();
    } catch (error) {
      console.error("Error reprocessing documents:", error);
      res.status(500).json({
        success: false,
        message: `Error reprocessing documents: ${error.message}`,
        error: error.toString(),
      });
    }
  })
);

export default router;
