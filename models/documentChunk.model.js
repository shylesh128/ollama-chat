import mongoose from "mongoose";

const documentChunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    metadata: {
      type: Object,
      default: {},
    },
    embedding: {
      type: [Number],
      required: true,
      index: {
        name: "vectorIndex",
        key: { embedding: "vector" },
        background: true,
      },
    },
    pageNumber: {
      type: Number,
      default: 0,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Create a text index on the content field for backup text search
documentChunkSchema.index({ content: "text", title: "text" });

const DocumentChunk = mongoose.model("DocumentChunk", documentChunkSchema);

export default DocumentChunk;
