#!/usr/bin/env node
/**
 * Single source of truth for the app version.
 *
 *   package.json "version"        -> Android versionName and the in-app version
 *   android/version.properties    -> Android versionCode
 *
 * Usage:
 *   node scripts/version.mjs                      # print the current values
 *   node scripts/version.mjs 2.2.0                # set versionName, versionCode += 1
 *   node scripts/version.mjs 2.2.0 --code 7       # set both explicitly
 *   node scripts/version.mjs --code 7             # bump only the versionCode
 *
 * Rule: Google Play rejects an upload whose versionCode is not higher than the
 * last one, so every upload needs a strictly increasing versionCode. `--code`
 * accepts a higher value only; the increment path is the safe default.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packagePath = join(root, 'package.json')
const codePath = join(root, 'android', 'version.properties')
const SEMVER = /^\d+\.\d+\.\d+$/

const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
const codeFile = readFileSync(codePath, 'utf8')
const codeMatch = /^versionCode=(\d+)\s*$/m.exec(codeFile)
if (!codeMatch) throw new Error('android/version.properties must contain versionCode=<number>')
const currentCode = Number(codeMatch[1])

const args = process.argv.slice(2)
const codeFlag = args.indexOf('--code')
const requestedCode = codeFlag === -1 ? null : args[codeFlag + 1]
const requestedName = args.find(arg => !arg.startsWith('--') && arg !== requestedCode) ?? null

if (!requestedName && !requestedCode) {
  console.log(`versionName=${packageJson.version}`)
  console.log(`versionCode=${currentCode}`)
  process.exit(0)
}

if (requestedName !== null && !SEMVER.test(requestedName)) {
  throw new Error(`versionName must look like 1.2.3, got "${requestedName}"`)
}

let nextCode = currentCode + 1
if (requestedCode !== null) {
  if (!/^\d+$/.test(requestedCode)) throw new Error(`--code must be an integer, got "${requestedCode}"`)
  nextCode = Number(requestedCode)
  if (nextCode <= currentCode) throw new Error(`versionCode must increase: ${nextCode} is not higher than ${currentCode}`)
}

if (requestedName) {
  const next = { ...packageJson, version: requestedName }
  writeFileSync(packagePath, `${JSON.stringify(next, null, 2)}\n`)
}
writeFileSync(codePath, `versionCode=${nextCode}\n`)

console.log(`versionName=${requestedName ?? packageJson.version}`)
console.log(`versionCode=${nextCode}`)
if (!requestedName) console.log('(versionName unchanged)')
