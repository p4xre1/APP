import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { APP_VERSION } from '../src/lib/version'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string; scripts: Record<string, string> }
const gradle = readFileSync('android/app/build.gradle', 'utf8')
const properties = readFileSync('android/version.properties', 'utf8')

test('the version lives in package.json and android/version.properties only', () => {
  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/, 'package.json version must be 1.2.3')
  assert.equal(APP_VERSION, `v${packageJson.version}`)

  const code = /^versionCode=(\d+)\s*$/m.exec(properties)
  assert.ok(code, 'android/version.properties must contain versionCode=<number>')
  assert.ok(Number(code[1]) >= 1, 'versionCode must be a positive integer')

  // The Gradle file must read both values, never hard-code them.
  assert.match(gradle, /file\('\.\.\/\.\.\/package\.json'\)/)
  assert.match(gradle, /file\('\.\.\/version\.properties'\)/)
  assert.match(gradle, /versionName fatoratiVersionName/)
  assert.match(gradle, /versionCode fatoratiVersionCode/)
  assert.equal(/versionName\s+["']/.test(gradle), false, 'versionName must not be a literal')
  assert.equal(/versionCode\s+\d/.test(gradle), false, 'versionCode must not be a literal')
})

test('the version bump script exists and refuses to lower the versionCode', () => {
  assert.match(packageJson.scripts.version, /scripts\/version\.mjs/)
  const script = readFileSync('scripts/version.mjs', 'utf8')
  assert.match(script, /versionCode must increase/)
  assert.match(script, /versionName must look like/)
})

test('release signing reads secrets from the environment or Gradle properties, never the repo', () => {
  for (const variable of ['FATORATI_KEYSTORE', 'FATORATI_KEYSTORE_PASSWORD', 'FATORATI_KEY_ALIAS', 'FATORATI_KEY_PASSWORD']) {
    assert.ok(gradle.includes(variable), `${variable} must be read by the signing config`)
  }
  assert.match(gradle, /System\.getenv\('FATORATI_KEYSTORE'\) \?: project\.findProperty\('fatoratiKeystore'\)/)
  // No literal secret material anywhere in the Gradle file.
  assert.equal(/storePassword\s+["']/.test(gradle), false)
  assert.equal(/keyPassword\s+["']/.test(gradle), false)
  // CI must be able to ask whether the build it just produced is signed.
  assert.match(gradle, /FATORATI_SIGNED=/)
})
