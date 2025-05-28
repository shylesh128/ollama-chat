import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import altTextController from "../controllers/alttext.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads/images");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter to only allow image files
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: fileFilter,
});

/**
 * @swagger
 * /alttext:
 *   post:
 *     summary: Generate alt text for an image
 *     description: Upload an image and receive AI-generated alt text using Gemma 3 model
 *     tags: [Alt Text]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: The image file to generate alt text for
 *     responses:
 *       200:
 *         description: Successfully generated alt text
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     altText:
 *                       type: string
 *                       description: The generated alt text
 *                       example: A scenic mountain landscape with snow-capped peaks and a lake in the foreground
 *                     imageFile:
 *                       type: string
 *                       description: The filename of the uploaded image
 *                       example: 1620123456789-123456789.jpg
 *       400:
 *         description: No image file uploaded or invalid file format
 *       500:
 *         description: Server error
 */
router.post("/", upload.single("image"), altTextController.generateAltText);

export default router;
