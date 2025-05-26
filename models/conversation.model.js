import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant", "system"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const conversationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "New Conversation",
    },
    messages: [messageSchema],
    model: {
      type: String,
      default: "llama3",
    },
    userId: {
      type: String,
      default: "anonymous",
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

// Create a title from the first message if not provided
conversationSchema.pre("save", function (next) {
  if (
    this.isNew &&
    this.title === "New Conversation" &&
    this.messages.length > 0
  ) {
    const firstMessage = this.messages[0].content;
    this.title =
      firstMessage.substring(0, 30) + (firstMessage.length > 30 ? "..." : "");
  }
  next();
});

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
