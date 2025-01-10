import performInsertEmbeddings from './schedule-handler';
import RequestPayload from './types/request-payload';
import ResponsePayload from './types/response-payload';
import OpenAI from 'openai';

export default {
	async scheduled(
		event: ScheduledEvent,
		env: Env,
		ctx: ExecutionContext
	) {
    ctx.waitUntil(performInsertEmbeddings());
  },

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

		const isOriginAllowed = allowedOrigins.includes(origin);

		const corsHeaders = {
				'Access-Control-Allow-Origin': isOriginAllowed ? origin : undefined,
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
				const requestPayload = await request.json() as RequestPayload;

				const openai = new OpenAI({
						apiKey: env.OPENAI_API_KEY,
						baseURL: 'https://gateway.ai.cloudflare.com/v1/119e6a647b254157e00e8dd335535eab/pop-choice/openai',
						defaultHeaders: {
								'cf-aig-authorization': `Bearer ${env.AUTH_OPENAI_POP_CHOICE_WORKER}`
						}
				});

				// Create embeddings for the query
				const response = await openai.embeddings.create({
						model: "text-embedding-ada-002",
						input: requestPayload.query
				});

				if (response.data.length !== 1) {
						console.error(`Failed to create a embedding ${response.data.length} for the query: ${requestPayload.query}`);
						return new Response(null, {
								status: 500,
								headers: { ...corsHeaders }
						});
				}

				const responsePayload: ResponsePayload = { embedding: response.data[0].embedding };
				return new Response(JSON.stringify(responsePayload), {
						status: 200,
						headers: { ...corsHeaders }
				});
		} catch (error) {
				console.error('Error:', error);
				return new Response(null, {
						status: 500,
						headers: { ...corsHeaders }
				});
		}
	},
} satisfies ExportedHandler<Env>;
