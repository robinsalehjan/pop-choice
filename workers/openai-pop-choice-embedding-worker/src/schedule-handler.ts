import OpenAI from 'openai';
import { createClient } from "@supabase/supabase-js";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";

export default {
  async performInsertEmbeddings(
    event: ScheduledEvent,
    env: Env
  ) {
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
			console.info("Failed to retrieve contents of `movies.txt`")
			return new Response(JSON.stringify({ status: "error" }), { status: 500 });
    }

		const fileContents = await fileObject.text();

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
			// Create embeddings for each page content
			const response = await openai.embeddings.create({
				model: "text-embedding-ada-002",
				input: pageContents
			});

			if (pageContents.length !== response.data.length) {
				throw new Error("number of embeddings does not match number of page contents");
				return new Response(null, { status: 500 });
			}

			await Promise.all(
				pageContents.map(async (content, index) => {
						const embeddingObject = {
								content: content,
								embedding: response.data[index].embedding
						};
						await supabase.from('movies').insert(embeddingObject);
						console.info(`Successfully inserted embedding object for content at index ${index} into database`);
					})
			);

			return new Response(null, { status: 200 });

		} catch(error) {
			console.error(`Failed to insert embedding with error: ${error.message}`);
			return new Response(null, { status: 500 });
		}
  },
}
