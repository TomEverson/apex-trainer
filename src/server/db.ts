import { Kysely, CamelCasePlugin } from 'kysely'
import { D1Dialect } from 'kysely-d1'
import type { DB as Database } from '../../kysely-types'
import { getCloudflareEnv } from './env'

// Construct a new Kysely instance per request — Workers are stateless,
// module-level singletons do not persist across invocations reliably.
export function getDb(): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new D1Dialect({ database: getCloudflareEnv().DB }),
    plugins: [new CamelCasePlugin()],
  })
}
