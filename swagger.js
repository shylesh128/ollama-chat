// swagger.js
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Ollama LLM API",
    version: "1.0.0",
    description: "API documentation for the Ollama LLM REST service",
  },
  servers: [
    {
      url: "http://localhost:3002/api",
      description: "Development server",
    },
  ],
  tags: [
    {
      name: "Chat",
      description: "API endpoints for chat interactions",
    },
    {
      name: "Documents",
      description: "API endpoints for document management",
    },
    {
      name: "Admin",
      description: "API endpoints for administrative functions",
    },
    {
      name: "Alt Text",
      description: "API endpoints for image alt text generation using Gemma 3",
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ["./routes/*.js"], // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(options);

export { swaggerUi, swaggerSpec };
