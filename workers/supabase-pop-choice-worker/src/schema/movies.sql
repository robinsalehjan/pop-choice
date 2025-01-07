create table movies (
  id bigserial primary key,
  content text,
  embedding vector(1536) -- 1536 works for OpenAI embeddings
);

-- Create a function to perform similarity search of embeddings (depends on the `pgvector` extension)
create or replace function match_movies (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  similarity float
)
language sql stable
as $$
  select
    movies.id,
    movies.content,
    1 - (movies.embedding <=> query_embedding) as similarity
  from movies
  where 1 - (movies.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
