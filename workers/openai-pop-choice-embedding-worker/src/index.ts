import { performInsertEmbeddings } from './schedule-handler';
import { RequestPayload } from './types/request-payload';
import { ResponsePayload } from './types/response-payload';
import OpenAI from 'openai';

// Helper function to get CORS headers
function getCorsHeaders(request: Request): Record<string, string> {
	const allowedOrigins: Array<string> = ['https://pop-choice.pages.dev'];
	const origin = request.headers.get('Origin') || '';
	const isOriginAllowed = allowedOrigins.includes(origin);

	return {
		'Access-Control-Allow-Origin': isOriginAllowed ? origin : 'null',
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};
}

// Helper function to create OpenAI client
function createOpenAIClient(env: Env): OpenAI {
	return new OpenAI({
		apiKey: env.OPENAI_API_KEY,
		baseURL: 'https://gateway.ai.cloudflare.com/v1/119e6a647b254157e00e8dd335535eab/pop-choice/openai',
		defaultHeaders: {
			'cf-aig-authorization': `Bearer ${env.AUTH_OPENAI_POP_CHOICE_WORKER}`
		}
	});
}

// Helper function to create embedding
async function createEmbedding(openai: OpenAI, query: string): Promise<number[]> {
	const response = await openai.embeddings.create({
		model: "text-embedding-ada-002",
		input: query
	});

	if (response.data.length !== 1) {
		throw new Error(`Failed to create embedding: expected 1 embedding, got ${response.data.length}`);
	}

	return response.data[0].embedding;
}

// Helper function to create error response
function createErrorResponse(error: string, status: number, corsHeaders: Record<string, string>): Response {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: {
			...corsHeaders,
			'Content-Type': 'application/json'
		}
	});
}

// Helper function to create success response
function createSuccessResponse(embedding: number[], corsHeaders: Record<string, string>): Response {
	const responsePayload: ResponsePayload = { embedding };
	return new Response(JSON.stringify(responsePayload), {
		status: 200,
		headers: {
			...corsHeaders,
			'Content-Type': 'application/json'
		}
	});
}

export default {
	async scheduled(
		controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext
	) {
		ctx.waitUntil(performInsertEmbeddings(controller.scheduledTime, env));
	},

	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const corsHeaders = getCorsHeaders(request);

		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: corsHeaders
			});
		}

		// Only process POST requests
		if (request.method !== 'POST') {
			return createErrorResponse(
				`${request.method} method not allowed.`,
				405,
				corsHeaders
			);
		}

		try {
			const requestPayload = await request.json() as RequestPayload;
			const openai = createOpenAIClient(env);
			const embedding = await createEmbedding(openai, requestPayload.query);

			return createSuccessResponse(embedding, corsHeaders);
		} catch (error) {
			console.error(`Failed to process request with: ${error}`);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return createErrorResponse(
				`Internal server error: ${errorMessage}`,
				500,
				corsHeaders
			);
		}
	},
} satisfies ExportedHandler<Env>;
