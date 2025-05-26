import express from "express";
import {
  upload,
  uploadDocumentHandler,
  getDocumentsHandler,
  getDocumentHandler,
  deleteDocumentHandler,
} from "../controllers/document.controller.js";
import catchAsync from "../utils/catchAsync.js";

const router = express.Router();

/**
 * @swagger
 * /documents:
 *   post:
 *     summary: Upload a PDF document
 *     description: Uploads a PDF document and extracts its content.
 *     tags:
 *       - Documents
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The PDF file to upload
 *               title:
 *                 type: string
 *                 description: Title for the document
 *             required:
 *               - file
 *               - title
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *       400:
 *         description: Invalid input or file type
 *       500:
 *         description: Internal server error
 */
router.post("/", upload.single("file"), catchAsync(uploadDocumentHandler));

/**
 * @swagger
 * /documents:
 *   get:
 *     summary: Get all documents
 *     description: Returns a list of all uploaded documents.
 *     responses:
 *       200:
 *         description: List of documents
 *       500:
 *         description: Internal server error
 */
router.get("/", catchAsync(getDocumentsHandler));

/**
 * @swagger
 * /documents/{id}:
 *   get:
 *     summary: Get a document by ID
 *     description: Returns a document by ID.
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document details
 *       404:
 *         description: Document not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", catchAsync(getDocumentHandler));

/**
 * @swagger
 * /documents/{id}:
 *   delete:
 *     summary: Delete a document
 *     description: Deletes a document by ID.
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted
 *       404:
 *         description: Document not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", catchAsync(deleteDocumentHandler));

export default router;
