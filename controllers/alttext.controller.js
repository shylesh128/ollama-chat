import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import gemmaService from "../services/gemma.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate alt text for an uploaded image using Gemma 3 model
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
const generateAltText = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file uploaded",
      });
    }

    // Get the uploaded file path
    const imagePath = req.file.path;

    try {
      // Use the Gemma 3 service to generate alt text
      const altText = await gemmaService.generateAltText(imagePath);

      return res.status(200).json({
        success: true,
        data: {
          altText: altText,
          imageFile: req.file.filename,
          model: "gemma3:vision",
        },
      });
    } catch (error) {
      console.error("Error in alt text generation:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to generate alt text",
        error: error.toString(),
      });
    }
  } catch (error) {
    console.error("Error in alt text generation controller:", error);
    next(error);
  }
};

export default {
  generateAltText,
};
