import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import {
  parsePdf,
  saveDocument,
  getAllDocuments,
  getDocumentById,
  deleteDocument,
} from "../services/document.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  console.log("Creating uploads directory at:", UPLOAD_DIR);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

// File filter to accept only PDF files
const fileFilter = (req, file, cb) => {
  console.log("File upload attempt:", file.originalname, file.mimetype);
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    console.log("Rejected file:", file.originalname, file.mimetype);
    cb(new Error("Only PDF files are allowed"), false);
  }
};

// Create multer upload instance
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
});

export const uploadDocumentHandler = async (req, res, next) => {
  try {
    console.log("Upload handler called, req.file:", req.file);
    if (!req.file) {
      const error = new Error("No file uploaded or invalid file type");
      error.statusCode = 400;
      return next(error);
    }

    const { title } = req.body;
    console.log("Title received:", title);
    if (!title) {
      const error = new Error("Title is required");
      error.statusCode = 400;
      return next(error);
    }

    const filePath = req.file.path;
    console.log("Processing file:", filePath);

    try {
      const { content, metadata } = await parsePdf(filePath);
      console.log("PDF parsed successfully, pages:", metadata.pageCount);

      const document = await saveDocument({
        title,
        filename: req.file.filename,
        path: filePath,
        content,
        metadata,
      });

      res.status(201).json({
        success: true,
        document: {
          id: document._id,
          title: document.title,
          filename: document.filename,
          metadata: document.metadata,
        },
      });
    } catch (parseError) {
      console.error("PDF parsing error:", parseError);
      const error = new Error(`Failed to parse PDF: ${parseError.message}`);
      error.statusCode = 400;
      return next(error);
    }
  } catch (error) {
    console.error("Document upload error:", error);
    next(error);
  }
};

export const getDocumentsHandler = async (req, res, next) => {
  try {
    const documents = await getAllDocuments();
    res.json({ documents });
  } catch (error) {
    next(error);
  }
};

export const getDocumentHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const document = await getDocumentById(id);

    if (!document) {
      const error = new Error("Document not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({ document });
  } catch (error) {
    next(error);
  }
};

export const deleteDocumentHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await deleteDocument(id);

    if (!result) {
      const error = new Error("Document not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({ success: true, message: "Document deleted" });
  } catch (error) {
    next(error);
  }
};
