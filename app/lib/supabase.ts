import { createClient, type SupabaseClient } from "@supabase/supabase-js"

type SupabaseConfig = {
	url?: string
	publicKey?: string
	serviceRoleKey?: string
}

let supabaseClient: SupabaseClient | null = null
let clientCacheKey: string | null = null

export function getSupabaseConfig(): SupabaseConfig {
	return {
		url: process.env.NEXT_PUBLIC_SUPABASE_URL,
		publicKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
		serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
	}
}

export function getSupabase() {
	const { url, publicKey, serviceRoleKey } = getSupabaseConfig()
	const key = serviceRoleKey || publicKey

	if (!url || !key) {
		throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.")
	}

	const nextCacheKey = `${url}:${serviceRoleKey ? "service" : "public"}:${key}`

	if (!supabaseClient || clientCacheKey !== nextCacheKey) {
		supabaseClient = createClient(url, key, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		})
		clientCacheKey = nextCacheKey
	}

	return supabaseClient
}