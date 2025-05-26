import {
  invokeLLM,
  getConversations,
  getConversation,
  deleteConversation,
} from "../services/chat.service.js";

export const invokeLLMHandler = async (req, res, next) => {
  const { query, conversationId, model, useContext } = req.body;

  if (!query || query.length < 2) {
    const error = new Error("Query must be at least 2 characters long");
    error.statusCode = 400;
    return next(error);
  }

  try {
    const result = await invokeLLM(
      query,
      conversationId,
      model,
      useContext !== undefined ? useContext : true
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getConversationsHandler = async (req, res, next) => {
  try {
    const userId = req.query.userId || "anonymous";
    const conversations = await getConversations(userId);
    res.json({ conversations });
  } catch (error) {
    next(error);
  }
};

export const getConversationHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await getConversation(id);

    if (!conversation) {
      const error = new Error("Conversation not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({ conversation });
  } catch (error) {
    next(error);
  }
};

export const deleteConversationHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await deleteConversation(id);

    if (!result) {
      const error = new Error("Conversation not found");
      error.statusCode = 404;
      return next(error);
    }

    res.json({ success: true, message: "Conversation deleted" });
  } catch (error) {
    next(error);
  }
};
