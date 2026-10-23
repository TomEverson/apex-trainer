import { env } from 'cloudflare:workers'

/**
 * Wraps Cloudflare's ambient `env` import with a single type assertion.
 *
 * Bindings are configured per-project in wrangler.toml, so we assert the
 * shape once here and the rest of the code uses a typed env with no `as`
 * casts. This is the only file where ESLint allows an assertion.
 */
export function getCloudflareEnv(): Env {
  return env as Env
}
