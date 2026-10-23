/**
 * Codegen pipeline: snapshot the local D1 database to a clean /tmp file
 * (after a WAL checkpoint so codegen sees the latest schema), then run
 * kysely-codegen with kysely-codegen.json config.
 *
 * Why the snapshot step?
 *   D1's local SQLite file has a `_cf_METADATA` BLOB table that better-sqlite3
 *   chokes on. Copying to a clean file works around it.
 *
 * Why the WAL checkpoint?
 *   Without a checkpoint, recent writes may be only in the .wal sidecar file
 *   and not in the main .sqlite. After cp, the snapshot has the old schema.
 *
 * Run via: pnpm db:types
 */
import { copyFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const SRC_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
const TMP_FILE = '/tmp/aim-trainer-codegen.sqlite'

if (!existsSync(SRC_DIR)) {
  console.error(`No local D1 dir at ${SRC_DIR}. Run \`pnpm dev\` once to create it.`)
  process.exit(1)
}

const candidates = readdirSync(SRC_DIR).filter(f => f.endsWith('.sqlite'))
if (candidates.length === 0) {
  console.error(`No *.sqlite file in ${SRC_DIR}. Run \`pnpm dev\` once to create it.`)
  process.exit(1)
}

// Pick the largest .sqlite file — that's the actual DB (the others are
// metadata.sqlite and similar). The actual D1 DB is typically the larger one.
const real = candidates
  .map(f => ({ f, size: statSync(join(SRC_DIR, f)).size }))
  .sort((a, b) => b.size - a.size)[0]!

const src = join(SRC_DIR, real.f)
console.log(`Source: ${src} (${real.size} bytes)`)

// Force a WAL checkpoint on the SOURCE first. Miniflare's writes are
// flushed into the main file only when the WAL is checkpointed, so a
// fresh migration that hasn't been checkpointed will be missing from
// the snapshot even after we copy.
try {
  execFileSync('sqlite3', [src, 'PRAGMA wal_checkpoint(TRUNCATE);'], { stdio: 'ignore' })
} catch {
  // sqlite3 not on PATH — try with the bundled better-sqlite3 from a tsx
  // child process.
  execFileSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'tsx', '-e', `import Database from 'better-sqlite3'; const d = new Database(process.argv[1]); d.pragma('wal_checkpoint(TRUNCATE)'); d.close();`, src],
    { stdio: 'ignore' },
  )
}
console.log(`Snapshotting ${src} (${real.size} bytes) → ${TMP_FILE}`)
copyFileSync(src, TMP_FILE)

console.log('Running PRAGMA wal_checkpoint(TRUNCATE)...')
try {
  execFileSync('sqlite3', [TMP_FILE, 'PRAGMA wal_checkpoint(TRUNCATE);'], { stdio: 'inherit' })
} catch {
  console.warn('sqlite3 not on PATH; skipping checkpoint (codegen still works on the snapshot).')
}

console.log('Running kysely-codegen...')
execFileSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'kysely-codegen', '--config-file', 'kysely-codegen.json', '--url', TMP_FILE, '--out-file', 'kysely-types.ts'],
  { stdio: 'inherit' },
)
console.log('OK: kysely-types.ts regenerated.')
