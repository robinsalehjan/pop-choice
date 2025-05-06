# [PopChoice](https://pop-choice.pages.dev)

This repository is a movie recommendation system demonstrating the integration between CloudFlare Workers, CloudFlare AI Gateway, CloudFlare Pages, Supabase/PostgreSQL with PGVector extension, and OpenAI API for semantic search capabilities.

## Architecture

The application consists of three main components:
- A frontend web application built with vanilla JavaScript
- An OpenAI embedding worker for generating vector embeddings
- A Supabase/PostgreSQL worker for performing vector similarity search
- A scheduled worker that performs a health check query towards Postgresql once every day; to avoid the project
  begin suspended in Supabase.

### Key Features
- Vector embeddings generation using OpenAI's text-embedding-ada-002 model
- Vector similarity search using PostgreSQL with PGVector extension
- Scheduled ingestion of movie data using CloudFlare Workers
- CORS-enabled API endpoints for cross-origin requests
