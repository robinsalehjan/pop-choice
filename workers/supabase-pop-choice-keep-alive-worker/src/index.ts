import { createClient } from "@supabase/supabase-js";
import { env } from "cloudflare:workers";

export default {
	async scheduled(event, env, ctx): Promise<void> {
		try {
			const databaseUrl: string = env.SUPABASE_URL;
			const databaseAuthKey: string = env.SUPABASE_API_KEY;
			const supabase = createClient(databaseUrl, databaseAuthKey);
			const { data, error } = await supabase.rpc('health_check');

			if (error) {
				console.error("Error executing RPC", error);
			}

			if (data) {
				console.info("Supabase health check was successful", data);
			} else {
				console.error("Supabase health check failed");
			}

		} catch (error) {
			console.error("Error connecting to Supabase", error);
		}
	},
} satisfies ExportedHandler<Env>;
