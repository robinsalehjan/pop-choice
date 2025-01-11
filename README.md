# [PopChoice](https://pop-choice.pages.dev)

This repository is a movie recommendation system demonstrating the integration between CloudFlare Workers, CloudFlare AI Gateway, CloudFlare Pages, PostgreSQL with PGVector extension, and OpenAI API for semantic search capabilities.

## Architecture

The application consists of three main components:
- A frontend web application built with vanilla JavaScript
- An OpenAI embedding worker for generating vector embeddings
- A Supabase worker for vector similarity search

### Key Features
- Vector embeddings generation using OpenAI's text-embedding-ada-002 model
- Vector similarity search using Supabase's pgvector extension
- Scheduled ingestion of movie data using CloudFlare Workers
- CORS-enabled API endpoints for cross-origin requests

## Getting Started

### Prerequisites
- `node.js` >= 16
- `npm` >= 8
- A CloudFlare account with Workers and Pages enabled
- A Supabase account with Vector extension enabled
- An OpenAI API key

### Running the Frontend Locally
1. Clone the repository:
   ```sh
   git clone https://github.com/your-username/pop-choice.git
   cd pop-choice
   ```

2. Install dependencies and start the frontend:
   ```sh
   cd web && npm install && npm run dev
   ```

### Deploying the Workers

1. Deploy the OpenAI embedding worker:
   ```sh
   cd workers/openai-pop-choice-embedding-worker
   npm install
   npm run deploy
   ```

2. Deploy the Supabase worker:
   ```sh
   cd workers/supabase-pop-choice-worker
   npm install
   npm run deploy
   ```

### Environment Variables

The following environment variables need to be set in your CloudFlare Workers:

#### OpenAI Embedding Worker
- `OPENAI_API_KEY`: Your OpenAI API key
- `AUTH_OPENAI_POP_CHOICE_WORKER`: CloudFlare AI Gateway authorization token
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_API_KEY`: Your Supabase service role key

#### Supabase Worker
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_API_KEY`: Your Supabase service role key
