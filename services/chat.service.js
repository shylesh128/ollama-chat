import { Ollama } from "ollama";
import Conversation from "../models/conversation.model.js";
import { searchDocumentsForContext } from "./document.service.js";

// Create a custom Ollama client with the correct host
const ollama = new Ollama();

/**
 * Get a response from the LLM
 * @param {string} query - User's message
 * @param {string} conversationId - Optional conversation ID
 * @param {string} model - Model to use (default: llama3)
 * @param {boolean} useContext - Whether to use document context (default: true)
 * @returns {Promise<{response: string, conversationId: string}>}
 */
export const invokeLLM = async (
  query,
  conversationId = null,
  model = "llama3",
  useContext = true
) => {
  try {
    let conversation;
    let messages = [];

    // If conversation ID is provided, load existing conversation
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (conversation) {
        messages = conversation.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
      }
    }

    // If no conversation found or ID not provided, create a new one
    if (!conversation) {
      conversation = new Conversation({
        model,
        messages: [],
      });
    }

    // Add user message to conversation
    const userMessage = { role: "user", content: query };
    conversation.messages.push(userMessage);
    messages.push(userMessage);

    // Retrieve context from PDF documents if enabled
    let contextPrompt = "";
    let contextUsed = false;
    let contextDocs = [];

    if (useContext) {
      const contextSnippets = await searchDocumentsForContext(query);
      if (contextSnippets && contextSnippets.length > 0) {
        contextUsed = true;
        contextPrompt =
          "I'll provide relevant information from documents to help answer your question. Please use this information to give an accurate response.\n\n";

        // Organize context by document
        const documentMap = new Map();
        contextSnippets.forEach((snippet) => {
          const docId = snippet.documentId.toString();
          if (!documentMap.has(docId)) {
            documentMap.set(docId, []);
          }
          documentMap.get(docId).push(snippet);

          // Track document details for conversation metadata
          contextDocs.push({
            documentId: docId,
            title: snippet.title,
            pageInfo:
              snippet.pageInfo ||
              (snippet.pageNumber ? `Page ${snippet.pageNumber}` : ""),
          });
        });

        // Format context with document titles and page numbers when available
        let contextNum = 1;
        for (const [_, snippets] of documentMap.entries()) {
          // Sort by page number if available
          snippets.sort((a, b) => (a.pageNumber || 0) - (b.pageNumber || 0));

          const title = snippets[0].title;
          contextPrompt += `DOCUMENT ${contextNum}: "${title}"\n`;

          snippets.forEach((snippet) => {
            if (snippet.pageInfo) {
              contextPrompt += `[${snippet.pageInfo}]:\n${snippet.snippet}\n\n`;
            } else if (snippet.pageNumber) {
              contextPrompt += `[Page ${snippet.pageNumber}]:\n${snippet.snippet}\n\n`;
            } else {
              contextPrompt += `${snippet.snippet}\n\n`;
            }
          });

          contextNum++;
        }

        contextPrompt += "QUESTION: " + query + "\n\n";
        contextPrompt +=
          "ANSWER: Please provide a comprehensive answer based on the document information provided above. Include specific details from the documents and cite the source documents and pages when possible.";

        // For the first message in a conversation, replace with the context-enhanced prompt
        if (messages.length === 1) {
          messages[0].content = contextPrompt;
        } else {
          // For ongoing conversations, add a system message with context
          messages.unshift({
            role: "system",
            content: contextPrompt,
          });
        }
      }
    }

    // Track query time for response metrics
    const queryStartTime = Date.now();

    // Send to Ollama
    const response = await ollama.chat({
      model: model,
      messages: messages,
    });

    // Calculate response time in seconds
    const responseTime = (Date.now() - queryStartTime) / 1000;

    // Add assistant response to conversation
    const assistantMessage = {
      role: "assistant",
      content: response.message.content,
    };
    conversation.messages.push(assistantMessage);

    // Add metadata about context usage
    if (!conversation.metadata) {
      conversation.metadata = {};
    }
    conversation.metadata.lastQueryUsedContext = contextUsed;
    if (contextUsed) {
      conversation.metadata.lastContextDocs = contextDocs;
      conversation.metadata.lastResponseTime = responseTime;
    }

    // Save conversation
    await conversation.save();

    return {
      response: response.message.content,
      conversationId: conversation._id.toString(),
      usedContext: contextUsed,
    };
  } catch (error) {
    console.error("Error invoking LLM:", error);
    const err = new Error("Failed to invoke LLM: " + (error.message || error));
    err.statusCode = 502;
    throw err;
  }
};

/**
 * Get all conversations for a user
 * @param {string} userId - User ID (default: 'anonymous')
 * @returns {Promise<Array>} - Array of conversations
 */
export const getConversations = async (userId = "anonymous") => {
  try {
    return await Conversation.find({ userId })
      .select("_id title model messages.length createdAt updatedAt metadata")
      .sort({ updatedAt: -1 });
  } catch (error) {
    console.error("Error getting conversations:", error);
    throw error;
  }
};

/**
 * Get a conversation by ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} - Conversation object
 */
export const getConversation = async (conversationId) => {
  try {
    return await Conversation.findById(conversationId);
  } catch (error) {
    console.error("Error getting conversation:", error);
    throw error;
  }
};

/**
 * Delete a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<boolean>} - Success indicator
 */
export const deleteConversation = async (conversationId) => {
  try {
    const result = await Conversation.findByIdAndDelete(conversationId);
    return !!result;
  } catch (error) {
    console.error("Error deleting conversation:", error);
    throw error;
  }
};
