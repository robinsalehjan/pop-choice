import OpenAI from 'openai';
import { createClient } from "@supabase/supabase-js";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";

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

    const fileObject = await env.INGESTION_BUCKET.get("movies.txt");

		if (!fileObject) {
      console.error("Failed to retrieve contents of `movies.txt`");
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

		const fileContents = await fileObject.text();

    // Generate hash of file contents
    const encoder = new TextEncoder();
    const data = encoder.encode(fileContents);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const currentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Check if hash exists in KV store
    const previousHash = await env.KV_STORE.get('movies_content_hash');

    if (previousHash === currentHash) {
      console.info('File contents unchanged, skipping embedding generation');
      return new Response(JSON.stringify({ success: true, unchanged: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store new hash before processing
    await env.KV_STORE.put('movies_content_hash', currentHash);

    const delimiter = "–––––––––––––––––––––––––"
    const textSplitter = new CharacterTextSplitter({
      separator: delimiter,
      chunkSize: 1000, // Adjust based on expected review size
      chunkOverlap: 0, // No overlap needed for independent reviews
    });

    const textChunks = await textSplitter.splitText(fileContents);
    const documents = textChunks.map((textChunk, index) => {
			// Remove all occurrences of the delimiter and trim whitespace
			const cleanedTextChunk = textChunk.split(delimiter).join('').trim();

			// Return a Document object with the cleaned text
			return new Document({ pageContent: cleanedTextChunk });
		});

		const pageContents = documents.map((document) => document.pageContent);

		try {
      const embeddings = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: pageContents
      });

      if (pageContents.length !== embeddings.data.length) {
        throw new Error("Embedding count mismatch");
      }

      const embeddingObjects = pageContents.map((content, index) => ({
        content,
        embedding: embeddings.data[index].embedding
      }));

      const { error: insertError } = await supabase
        .from('movies')
        .insert(embeddingObjects);

      if (insertError) {
        throw new Error(`Database insertion failed: ${insertError.message}`);
      }

      console.info(`Successfully inserted ${embeddingObjects.length} embeddings`);

      return new Response(
        JSON.stringify({ success: true, count: embeddingObjects.length }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );

		} catch(error) {
      console.error('Embedding insertion failed:', error);
      return new Response(
        JSON.stringify({ error: error.message }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
        }
      );
		}
};
