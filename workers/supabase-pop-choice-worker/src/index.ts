import { createClient } from "@supabase/supabase-js";
import { RequestPayload } from './types/request-payload';
import { ResponsePayload } from './types/response-payload';

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const allowedOrigins: Array<string> = ['https://pop-choice.pages.dev'];

		const origin = request.headers.get('Origin') || '';
		const isOriginAllowed = allowedOrigins.includes(origin);

		const corsHeaders = {
				'Access-Control-Allow-Origin': isOriginAllowed ? origin : 'null',
				'Access-Control-Allow-Methods': 'POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type',
		};

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: corsHeaders
      });
    }

		// Only process POST requests
		if (request.method !== 'POST') {
				return new Response(JSON.stringify({
						error: `${request.method} method not allowed.`
				}), {
						status: 405,
						headers: corsHeaders
				});
		}

		try {
			const databaseUrl: string = env.SUPABASE_URL;
			const databaseAuthKey: string = env.SUPABASE_API_KEY;
			const supabase = createClient(databaseUrl, databaseAuthKey);

			const embeddings: RequestPayload = await request.json() as RequestPayload;

			const { data, error } = await supabase
				.schema('public')
				.rpc('match_movies', {
					query_embedding: embeddings,
					match_threshold: 0.5,
					match_count: 1
				});

			if (error) {
				throw new Error(`Database query failed: ${error.message}`);
			}

			if (!data) {
				const responsePayload: ResponsePayload = { content: "No match found for query" };
				return new Response(JSON.stringify(responsePayload), {
					status: 404,
					headers: { ...corsHeaders }
				});
			}

			// Return embedding with highest similarity score (i.e. first element in array)
			const contentOfFirstMatch: string = data[0].content;
			const responsePayload: ResponsePayload = { content: contentOfFirstMatch };
			return new Response(JSON.stringify(responsePayload), {
				status: 200,
				headers: { ...corsHeaders }
			});

		} catch (error) {
			console.error(`Failed to process request with: ${error}`);
			return new Response(
				JSON.stringify({ error: `Internal server error: ${ error.message || 'Unknown error'}` }), {
					status: 500,
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json'
					}
			});
		}
	},
} satisfies ExportedHandler<Env>;
