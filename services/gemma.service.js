/**
 * gemma.service.js
 * This file contains the service for interfacing with the Gemma 3 model.
 *
 * Currently, this is a placeholder implementation. In a production environment,
 * you would integrate with the actual Gemma 3 API or run a local instance.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Ollama } from "ollama";
import { generateAltTextPrompt } from "../utils/prompts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create an Ollama client
const ollama = new Ollama({});

// Maximum file size before compression (in bytes) - 5MB
const MAX_UNCOMPRESSED_SIZE = 5 * 1024 * 1024;

/**
 * Convert an image file to base64 string, compressing if necessary
 *
 * @param {string} filePath - Path to the image file
 * @returns {Promise<string>} - Base64 encoded image
 */
async function getBase64Image(filePath) {
  return Buffer.from(fs.readFileSync(filePath)).toString("base64");
}

/**
 * Generate alt text for an image using Gemma 3 model
 *
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<string>} - Generated alt text
 */
export async function generateAltText(imagePath) {
  try {
    // Check if the file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error("Image file not found");
    }

    // Get base64 encoded image
    const base64Image = await getBase64Image(imagePath);

    // Call Ollama with the model and image
    console.log("Calling Gemma 3 vision model for alt text generation...");

    try {
      // Send to Ollama vision model
      const response = await ollama.chat({
        model: "gemma3:4b", // Use Gemma 3 vision model
        messages: [
          {
            role: "user",
            content: generateAltTextPrompt,
            images: [base64Image],
          },
        ],
      });

      console.log("Alt text generation successful");
      return response.message.content;
    } catch (error) {
      console.error("Error from Ollama API:", error);
      // If Ollama API fails (e.g., model not available), fall back to simulation
      console.warn("Falling back to simulated response");
      return simulateGemma3Response(imagePath);
    }
  } catch (error) {
    console.error("Error generating alt text:", error);
    throw new Error("Failed to generate alt text: " + error.message);
  }
}

/**
 * Simulate Gemma 3 model response (used as fallback)
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<string>} - The generated alt text
 */
async function simulateGemma3Response(imagePath) {
  // Get file stats
  const stats = fs.statSync(imagePath);
  const fileSizeInBytes = stats.size;
  const fileSizeInMB = fileSizeInBytes / (1024 * 1024);

  // Get file extension
  const fileExtension = path.extname(imagePath).toLowerCase();

  // Get filename
  const filename = path.basename(imagePath);

  // Add artificial delay to simulate processing
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Generate a placeholder alt text based on file properties
  let altText = `An image file named ${filename}`;

  // Add some variety based on file extension
  switch (fileExtension) {
    case ".jpg":
    case ".jpeg":
      altText += " showing a photograph";
      break;
    case ".png":
      altText += " containing a graphic or screenshot";
      break;
    case ".gif":
      altText += " with animated content";
      break;
    case ".webp":
      altText += " with web-optimized content";
      break;
    default:
      altText += " with visual content";
  }

  // Add information about the image size
  if (fileSizeInMB < 0.5) {
    altText += ", small in size";
  } else if (fileSizeInMB > 2) {
    altText += ", large in size";
  }

  // Add a note about the simulation
  altText +=
    ". (This is a simulated alt text. Gemma 3 vision model was not available.)";

  return altText;
}

export default {
  generateAltText,
};
