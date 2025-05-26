# Ollama REST API Setup Guide

This guide explains how to set up and run the Ollama REST API project using Docker for both development and production environments. It also covers how to install and use the Ollama LLM service (llama3:2b model).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed

## 1. Clone the Repository

```sh
git clone <your-repo-url>
cd <your-repo-directory>
```

## 2. Create a `.env` File

Create a `.env` file in the project root with the following content:

```env
PORT=3000
OLLAMA_HOST=http://ollama:11434
NODE_ENV=development
```

- Set `NODE_ENV=development` for development (hot reload, code mounting)
- Set `NODE_ENV=production` for production (optimized, no code mounting)

## 3. Start the Services

### Development

Runs with hot reload and code mounting.

```sh
docker compose --profile dev up --build
```

### Production

Runs with optimized settings.

1. Edit `.env` and set `NODE_ENV=production`
2. Start the services:

```sh
docker compose up --build
```

## 4. Pull the Llama3 Model (First Time Only)

After the containers are running, open a new terminal and run:

```sh
docker exec -it ollama ollama pull llama3
```

This downloads the llama3.2 model into the Ollama container's persistent volume. You only need to do this once per model/version.

## 5. API Documentation

Once running, access the API docs at:

```
http://localhost:3000/api-docs
```

## 6. Stopping the Services

```sh
docker compose down
```

---

## Additional Resources

- [Ollama Installation](https://github.com/ollama/ollama?tab=readme-ov-file)
- [Blog post: Node.js + Ollama](https://ergin-d.com/blog/nodejs-run-local-llm)

---

## Notes

- The project uses Docker Compose for both development and production. No manual installation of Ollama or Node.js dependencies is required on your host machine.
- The `.env` file is used for both environments. Change `NODE_ENV` as needed.
- The first model pull may take several minutes depending on your internet connection.

# Ollama Chat with PDF Context

This application provides a web interface for interacting with Ollama LLMs, with the ability to use PDF documents as context for answering questions.

## Features

- 💬 Chat with local language models powered by Ollama
- 📄 Upload PDF documents as knowledge sources
- 🔍 Automatic context retrieval from documents
- 💾 Conversation history
- 📱 Responsive design for mobile and desktop

## Setup

### Prerequisites

- Node.js 16+
- MongoDB
- Ollama running locally or on a remote server

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/ollama-chat.git
   cd ollama-chat
   ```

2. Install dependencies:

   ```
   pnpm install
   ```

3. Create a `.env` file in the root directory:

   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/ollama-chat
   OLLAMA_HOST=http://localhost:11434
   ```

4. Start the application:

   ```
   pnpm dev
   ```

5. Access the application at http://localhost:3000

## Using PDF Context

### Adding Documents

1. Navigate to the admin interface at http://localhost:3000/admin
2. Click on the upload area or drag and drop a PDF file
3. Enter a title for the document
4. Click "Upload Document"

### Chatting with Context

1. Go to the main chat interface at http://localhost:3000
2. Make sure the "USE CONTEXT" toggle in the sidebar is enabled
3. Ask questions related to the content of your uploaded documents
4. The LLM will use the relevant information from the documents to answer your questions

### Managing Documents

- View all uploaded documents in the admin interface
- Delete documents you no longer need

## API Endpoints

### Chat API

- `POST /api/chat` - Send a message to the LLM
  - Body: `{ query: string, conversationId?: string, model?: string, useContext?: boolean }`

### Conversations API

- `GET /api/conversations` - Get all conversations
- `GET /api/conversations/:id` - Get a specific conversation
- `DELETE /api/conversations/:id` - Delete a conversation

### Documents API

- `POST /api/documents` - Upload a document
- `GET /api/documents` - Get all documents
- `GET /api/documents/:id` - Get a specific document
- `DELETE /api/documents/:id` - Delete a document

## Architecture

- **Frontend**: HTML, CSS, JavaScript with Tailwind CSS
- **Backend**: Node.js with Express
- **Database**: MongoDB for storing conversations and documents
- **LLM**: Ollama for local language model hosting

## License

[MIT License](LICENSE)

# Ollama Chat with Elasticsearch

A chat application using Ollama for LLM capabilities and Elasticsearch for document embedding storage and retrieval.

## Features

- Chat with Ollama models
- Upload and index PDF documents
- Context-aware responses using vector search
- Document management

## Requirements

- Node.js 18+
- MongoDB
- Elasticsearch 8.0+
- Ollama

## Setup

### 1. Install Elasticsearch

#### Using Docker (recommended)

```bash
docker run -d --name elasticsearch -p 9200:9200 -p 9300:9300 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.3
```

#### Manual Installation

Follow the [official Elasticsearch installation guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/install-elasticsearch.html) for your operating system.

### 2. Install MongoDB

Follow the [official MongoDB installation guide](https://www.mongodb.com/docs/manual/installation/) for your operating system.

### 3. Install Ollama

Follow the [Ollama installation instructions](https://github.com/ollama/ollama) for your platform.

### 4. Install Dependencies

```bash
npm install
```

### 5. Configure Environment Variables

Create a `.env` file based on the example:

```
# Server
PORT=3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/ollama-chat

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=
# ELASTICSEARCH_TLS_CA= # Path to CA certificate if using TLS

# Upload paths
UPLOAD_DIR=./uploads

# Ollama
OLLAMA_API_HOST=http://localhost:11434
```

### 6. Start the Application

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Endpoints

- **Chat API**: `/api/chat`
- **Document API**: `/api/documents`
- **Admin API**: `/api/admin`
- **API Documentation**: `/api-docs`

## API Documentation

Swagger documentation is available at `/api-docs` when the server is running.

## Features

- **Document Processing**: Upload PDFs, which are processed into chunks with embeddings stored in Elasticsearch
- **Semantic Search**: Search uploaded documents semantically using embeddings
- **Contextual Answers**: Chat with the model using context from your documents
