import OpenAI from 'openai';
import { createClient } from "@supabase/supabase-js";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";

/**
 * Generates SHA-256 hash of file contents
 */
const generateFileHash = async (fileContents: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(fileContents);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Checks if file content has changed by comparing hashes
 */
const checkFileContentChanged = async (fileContents: string, kvStore: KVNamespace): Promise<{ changed: boolean; currentHash: string }> => {
  const currentHash = await generateFileHash(fileContents);
  const previousHash = await kvStore.get('movies_content_hash');

  return {
    changed: previousHash !== currentHash,
    currentHash
  };
};

/**
 * Processes text content into Document objects by splitting and cleaning
 */
const processTextIntoDocuments = async (fileContents: string): Promise<Document[]> => {
  const delimiter = "–––––––––––––––––––––––––";
  const textSplitter = new CharacterTextSplitter({
    separator: delimiter,
    chunkSize: 1000,
    chunkOverlap: 0,
  });

  const textChunks = await textSplitter.splitText(fileContents);
  return textChunks.map((textChunk) => {
    const cleanedTextChunk = textChunk.split(delimiter).join('').trim();
    return new Document({ pageContent: cleanedTextChunk });
  });
};

/**
 * Generates embeddings for the given text contents using OpenAI
 */
const generateEmbeddings = async (pageContents: string[], openai: OpenAI) => {
  const embeddings = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: pageContents
  });

  if (pageContents.length !== embeddings.data.length) {
    throw new Error("Embedding count mismatch");
  }

  return pageContents.map((content, index) => ({
    content,
    embedding: embeddings.data[index].embedding
  }));
};

/**
 * Inserts embedding objects into the Supabase database
 */
const insertEmbeddingsToDatabase = async (embeddingObjects: any[], supabase: any) => {
  const { error: insertError } = await supabase
    .from('movies')
    .insert(embeddingObjects);

  if (insertError) {
    throw new Error(`Database insertion failed: ${insertError.message}`);
  }

  return embeddingObjects.length;
};

export const performInsertEmbeddings = async (scheduledTime: number, env: Env): Promise<Response> => {
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: 'https://gateway.ai.cloudflare.com/v1/119e6a647b254157e00e8dd335535eab/pop-choice/openai',
    defaultHeaders: {
      'cf-aig-authorization': `Bearer ${env.AUTH_OPENAI_POP_CHOICE_WORKER}`
    }
  });

  const databaseUrl = env.SUPABASE_URL;
  const databaseAuthKey = env.SUPABASE_API_KEY;
  const supabase = createClient(databaseUrl, databaseAuthKey);

  // Retrieve file from bucket
  const fileObject = await env.INGESTION_BUCKET.get("movies.txt");

  if (!fileObject) {
    console.error("Failed to retrieve contents of `movies.txt`");
    return new Response(JSON.stringify({ error: "File not found" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const fileContents = await fileObject.text();

  // Check if file content has changed
  const { changed, currentHash } = await checkFileContentChanged(fileContents, env.KV_STORE);

  if (!changed) {
    console.info('File contents unchanged, skipping embedding generation');
    return new Response(JSON.stringify({ success: true, unchanged: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Store new hash before processing
  await env.KV_STORE.put('movies_content_hash', currentHash);

  try {
    // Process text into documents
    const documents = await processTextIntoDocuments(fileContents);
    const pageContents = documents.map((document) => document.pageContent);

    // Generate embeddings
    const embeddingObjects = await generateEmbeddings(pageContents, openai);

    // Insert embeddings into database
    const insertedCount = await insertEmbeddingsToDatabase(embeddingObjects, supabase);

    console.info(`Successfully inserted ${insertedCount} embeddings`);

    return new Response(
      JSON.stringify({ success: true, count: insertedCount }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Embedding insertion failed:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
