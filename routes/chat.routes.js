import express from "express";
import {
  invokeLLMHandler,
  getConversationsHandler,
  getConversationHandler,
  deleteConversationHandler,
} from "../controllers/chat.controller.js";
import catchAsync from "../utils/catchAsync.js";

const router = express.Router();

/**
 * @swagger
 * /chat:
 *   post:
 *     summary: Get a response from the LLM
 *     description: Sends a query to the LLM and returns the response.
 *     tags:
 *       - Chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 example: "Hello, how are you?"
 *               conversationId:
 *                 type: string
 *                 example: "60d21b4667d0d8992e610c85"
 *               model:
 *                 type: string
 *                 example: "llama3"
 *               useContext:
 *                 type: boolean
 *                 example: true
 *                 description: Whether to use document context for answering
 *     responses:
 *       200:
 *         description: LLM response
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Internal server error
 */
router.post("/chat", catchAsync(invokeLLMHandler));

/**
 * @swagger
 * /conversations:
 *   get:
 *     summary: Get all conversations
 *     description: Returns a list of all conversations.
 *     tags:
 *       - Chat
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: User ID to filter conversations
 *     responses:
 *       200:
 *         description: List of conversations
 *       500:
 *         description: Internal server error
 */
router.get("/conversations", catchAsync(getConversationsHandler));

/**
 * @swagger
 * /conversations/{id}:
 *   get:
 *     summary: Get a conversation by ID
 *     description: Returns a conversation by ID.
 *     tags:
 *       - Chat
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Internal server error
 */
router.get("/conversations/:id", catchAsync(getConversationHandler));

/**
 * @swagger
 * /conversations/{id}:
 *   delete:
 *     summary: Delete a conversation
 *     description: Deletes a conversation by ID.
 *     tags:
 *       - Chat
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation deleted
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Internal server error
 */
router.delete("/conversations/:id", catchAsync(deleteConversationHandler));

export default router;
