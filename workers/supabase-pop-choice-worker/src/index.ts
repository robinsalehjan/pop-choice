import { createClient } from "@supabase/supabase-js";
import { RequestPayload } from './types/request-payload';
import { ResponsePayload } from './types/response-payload';

/**
* Creates CORS headers based on the request origin
*/
function createCorsHeaders(request: Request): Record<string, string> {
	const allowedOrigins: Array<string> = ['https://pop-choice.pages.dev'];
	const origin = request.headers.get('Origin') || '';
	const isOriginAllowed = allowedOrigins.includes(origin);

	return {
		'Access-Control-Allow-Origin': isOriginAllowed ? origin : 'null',
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};
}

/**
* Handles CORS preflight requests
*/
function handleCorsPreflightRequest(corsHeaders: Record<string, string>): Response {
	return new Response(null, {
		headers: corsHeaders
	});
}

/**
* Validates that the request method is POST
*/
function validateRequestMethod(request: Request, corsHeaders: Record<string, string>): Response | null {
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({
			error: `${request.method} method not allowed.`
		}), {
			status: 405,
			headers: corsHeaders
		});
	}
	return null;
}

/**
* Queries the database for movie matches
*/
async function queryMovieMatches(embeddings: RequestPayload, env: Env): Promise<any> {
	const databaseUrl: string = env.SUPABASE_URL;
	const databaseAuthKey: string = env.SUPABASE_API_KEY;
	const supabase = createClient(databaseUrl, databaseAuthKey);

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

	return data;
}

/**
* Creates a successful response with movie content
*/
function createSuccessResponse(data: any, corsHeaders: Record<string, string>): Response {
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
}

/**
* Creates an error response
*/
function createErrorResponse(error: any, corsHeaders: Record<string, string>): Response {
	console.error(`Failed to process request with: ${error}`);
	return new Response(
		JSON.stringify({ error: `Internal server error: ${error.message || 'Unknown error'}` }), {
			status: 500,
			headers: {
				...corsHeaders,
				'Content-Type': 'application/json'
			}
		});
	}

	export default {
		async fetch(
			request: Request,
			env: Env,
			ctx: ExecutionContext
		): Promise<Response> {
			const corsHeaders = createCorsHeaders(request);

			// Handle CORS preflight requests
			if (request.method === 'OPTIONS') {
				return handleCorsPreflightRequest(corsHeaders);
			}

			// Validate request method
			const methodValidationResponse = validateRequestMethod(request, corsHeaders);
			if (methodValidationResponse) {
				return methodValidationResponse;
			}

			try {
				const embeddings: RequestPayload = await request.json() as RequestPayload;
				const data = await queryMovieMatches(embeddings, env);
				return createSuccessResponse(data, corsHeaders);

			} catch (error) {
				return createErrorResponse(error, corsHeaders);
			}
		},
	} satisfies ExportedHandler<Env>;
