import express from "express";
import morgan from "morgan";
import chatRoutes from "./routes/chat.routes.js";
import documentRoutes from "./routes/document.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import altTextRoutes from "./routes/alttext.routes.js";
import { swaggerUi, swaggerSpec } from "./swagger.js";
import errorController from "./controllers/error.controller.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(morgan("dev"));
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Admin route for document management
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Test upload route
app.get("/test-upload", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "test-upload.html"));
});

// Diagnostic route
app.get("/diagnostics", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "diagnostics.html"));
});

// Alt Text Generator route
app.get("/alttext", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "alttext.html"));
});

// Swagger API docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use("/api", chatRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/alttext", altTextRoutes);

// Global error handler
app.use(errorController);

export default app;
