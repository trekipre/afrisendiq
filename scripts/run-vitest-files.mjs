import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

const rawFilters = process.argv.slice(2)

if (rawFilters.length === 0) {
  console.error("Usage: npm run test:files -- <test-file> [more test files]")
  process.exit(1)
}

const normalizedFilters = rawFilters.map((filter) => {
  const absolutePath = path.resolve(process.cwd(), filter)
  const relativePath = path.relative(process.cwd(), absolutePath).split(path.sep).join("/")

  return relativePath.startsWith(".") ? relativePath.slice(2) : relativePath
})

const tempConfigPath = path.join(process.cwd(), `.vitest.focused.${process.pid}.${Date.now()}.mjs`)
const tempConfigSource = [
  'import baseConfig from "./vitest.config.ts"',
  '',
  'export default {',
  '  ...baseConfig,',
  '  test: {',
  '    ...(baseConfig.test ?? {}),',
  `    include: ${JSON.stringify(normalizedFilters)},`,
  '  },',
  '}',
  '',
].join(os.EOL)

try {
  await fs.writeFile(tempConfigPath, tempConfigSource, "utf8")
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

const result = spawnSync(process.execPath, ["./node_modules/vitest/vitest.mjs", "run", "--config", tempConfigPath], {
  cwd: process.cwd(),
  stdio: "inherit",
})

await fs.unlink(tempConfigPath).catch(() => undefined)

process.exit(typeof result.status === "number" ? result.status : 1)