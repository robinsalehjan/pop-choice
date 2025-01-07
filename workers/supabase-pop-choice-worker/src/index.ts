import { createClient } from "@supabase/supabase-js";
import RequestPayload from './types/request-payload';
import ResponsePayload from './types/response-payload';

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const origin = request.headers.get('Origin') || '';
		const allowedOrigins: Array<string> = [
			'http://localhost:5173',
			'https://pop-choice.pages.dev'
		];

		const corsHeaders = {
			'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		};

		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// Only process POST requests
		if (request.method !== 'POST') {
			return new Response(JSON.stringify({
				error: `${request.method} method not allowed.`
			}), {
				status: 405,
				headers: corsHeaders
			})
		}

		try {
			const databaseUrl: string = env.SUPABASE_URL;
			const databaseAuthKey: string = env.SUPABASE_API_KEY;
			const supabase: SupabaseClient = createClient(databaseUrl, databaseAuthKey);

			const requestPayload = await request.json() as RequestPayload;

			const { data, error } = await supabase.rpc('match_movies', {
				query_embedding: requestPayload.embedding,
				match_threshold: 0.5,
				match_count: 1
			});

			if (data.length > 0) {
				// Return embedding with highest similarity score (i.e. first element in array)
				const contentOfFirstMatch: string = data[0].content;
				const responsePayload: ResponsePayload = { content: contentOfFirstMatch };
				return new Response(JSON.stringify(responsePayload), { status: 200 });
			} else {
				const responsePayload: ResponsePayload = { content: "No match found for query" };
				return new Response(JSON.stringify(responsePayload), { status: 404 });
			}
		} catch (error) {
			console.error(`Failed to process request with: ${error}`);
			return new Response(null, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
