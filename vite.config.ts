import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import ts from 'typescript'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The shipped index.html pins a strict Content-Security-Policy (no network, no
 * inline scripts from the app). That policy also blocks Vite's own dev client,
 * so the dev server serves a relaxed copy. `vite build` leaves index.html
 * untouched, so the APK keeps the strict policy.
 */
function devCsp(): Plugin {
  return {
    name: 'fatorati-dev-csp',
    apply: 'serve',
    enforce: 'pre',
    transformIndexHtml(html: string) {
      return html.replace(
        /<meta http-equiv="Content-Security-Policy"[^>]*>/,
        `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'" />`,
      )
    },
  }
}

function hashSeed(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0 || 0x13579bdf
}

function xorBase64Encode(utf8Text: string, seed: number): string {
  const bytes = Buffer.from(utf8Text, 'utf8')
  let state = seed >>> 0
  for (let i = 0; i < bytes.length; i++) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    bytes[i] ^= (state >>> ((i & 3) << 3)) & 0xff
  }
  return bytes.toString('base64')
}

function shufflePool(items: string[], seed: number): string[] {
  const out = [...items]
  let state = (seed ^ 0xa5a5a5a5) >>> 0 || 1
  for (let i = out.length - 1; i > 0; i--) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    const j = (state >>> 0) % (i + 1)
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function isTransformableStringLiteral(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): boolean {
  if (node.text.length === 0) return false
  const parent = node.parent
  if (!parent) return false
  if (
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent) ||
    ts.isExternalModuleReference(parent) ||
    ts.isImportTypeNode(parent) ||
    ts.isLiteralTypeNode(parent) ||
    ts.isImportSpecifier(parent) ||
    ts.isExportSpecifier(parent) ||
    ts.isImportAttribute(parent) ||
    ts.isExpressionStatement(parent) ||
    ts.isTaggedTemplateExpression(parent)
  ) {
    return false
  }
  if (ts.isCallExpression(parent)) {
    if (parent.expression.kind === ts.SyntaxKind.ImportKeyword) return false
    if (ts.isIdentifier(parent.expression) && parent.expression.text === 'require') return false
  }
  if ('name' in parent && (parent as { name?: ts.Node }).name === node) {
    return false
  }
  return true
}

function obfuscateJavaScriptSource(code: string, id: string): string | null {
  const seed = hashSeed(id)
  const keyMask = seed & 0x3fffffff || 0x12345678
  const idxMask = ((seed >>> 7) ^ 0x25a3c9) & 0x3fffff || 0x1a2b3c
  const sf = ts.createSourceFile(id, code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS)

  const namespaceImports = new Set<string>()
  for (const stmt of sf.statements) {
    if (
      ts.isImportDeclaration(stmt) &&
      stmt.importClause?.namedBindings &&
      ts.isNamespaceImport(stmt.importClause.namedBindings)
    ) {
      namespaceImports.add(stmt.importClause.namedBindings.name.text)
    }
  }

  const isConvertiblePropertyAccess = (node: ts.PropertyAccessExpression): boolean => {
    if (!ts.isIdentifier(node.name) || node.name.text.length === 0) return false
    if (ts.isMetaProperty(node.expression) || node.expression.kind === ts.SyntaxKind.SuperKeyword) return false
    if (ts.isIdentifier(node.expression) && namespaceImports.has(node.expression.text)) return false
    return true
  }

  const rawStrings = new Set<string>()
  const collect = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) return
    if (ts.isPropertyAccessExpression(node) && isConvertiblePropertyAccess(node)) {
      rawStrings.add(node.name.text)
    } else if (
      ts.isPropertyAssignment(node) &&
      (ts.isStringLiteral(node.name) || ts.isIdentifier(node.name)) &&
      node.name.text.length > 0 &&
      node.parent &&
      ts.isObjectLiteralExpression(node.parent)
    ) {
      rawStrings.add(node.name.text)
    } else if (
      ts.isShorthandPropertyAssignment(node) &&
      node.name.text.length > 0 &&
      node.parent &&
      ts.isObjectLiteralExpression(node.parent)
    ) {
      rawStrings.add(node.name.text)
    } else if (
      ts.isBindingElement(node) &&
      !node.dotDotDotToken &&
      node.parent &&
      ts.isObjectBindingPattern(node.parent)
    ) {
      if (!node.propertyName && ts.isIdentifier(node.name) && node.name.text.length > 0) {
        rawStrings.add(node.name.text)
      } else if (
        node.propertyName &&
        (ts.isIdentifier(node.propertyName) || ts.isStringLiteral(node.propertyName)) &&
        node.propertyName.text.length > 0
      ) {
        rawStrings.add(node.propertyName.text)
      }
    } else if (ts.isTemplateExpression(node) && !ts.isTaggedTemplateExpression(node.parent)) {
      if (node.head.text.length > 0) rawStrings.add(node.head.text)
      for (const span of node.templateSpans) {
        if (span.literal.text.length > 0) rawStrings.add(span.literal.text)
      }
    } else if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      isTransformableStringLiteral(node)
    ) {
      rawStrings.add(node.text)
    }
    ts.forEachChild(node, collect)
  }
  collect(sf)

  const pool = shufflePool([...rawStrings], seed)
  const poolIndex = new Map<string, number>(pool.map((value, idx) => [value, idx]))
  const callPool = (text: string): ts.Expression =>
    ts.factory.createCallExpression(ts.factory.createIdentifier('__f_s'), undefined, [
      ts.factory.createNumericLiteral((poolIndex.get(text)! ^ idxMask) >>> 0),
    ])

  let transformed = false
  const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
    const visit: ts.Visitor = (node: ts.Node): ts.Node => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return node
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) return node

      if (ts.isPropertyAccessExpression(node) && isConvertiblePropertyAccess(node)) {
        transformed = true
        const visitedTarget = ts.visitNode(node.expression, visit) as ts.Expression
        const keyExpr = callPool(node.name.text)
        return node.questionDotToken
          ? ts.factory.createElementAccessChain(visitedTarget, node.questionDotToken, keyExpr)
          : ts.factory.createElementAccessExpression(visitedTarget, keyExpr)
      }

      if (
        ts.isPropertyAssignment(node) &&
        (ts.isStringLiteral(node.name) || ts.isIdentifier(node.name)) &&
        node.name.text.length > 0 &&
        node.parent &&
        ts.isObjectLiteralExpression(node.parent)
      ) {
        transformed = true
        const visitedInit = ts.visitNode(node.initializer, visit) as ts.Expression
        return ts.factory.updatePropertyAssignment(
          node,
          ts.factory.createComputedPropertyName(callPool(node.name.text)),
          visitedInit,
        )
      }

      if (
        ts.isShorthandPropertyAssignment(node) &&
        node.name.text.length > 0 &&
        node.parent &&
        ts.isObjectLiteralExpression(node.parent)
      ) {
        transformed = true
        const visitedInit = node.objectAssignmentInitializer
          ? (ts.visitNode(node.objectAssignmentInitializer, visit) as ts.Expression)
          : undefined
        return ts.factory.createPropertyAssignment(
          ts.factory.createComputedPropertyName(callPool(node.name.text)),
          visitedInit
            ? ts.factory.createBinaryExpression(node.name, ts.SyntaxKind.EqualsToken, visitedInit)
            : node.name,
        )
      }

      if (
        ts.isBindingElement(node) &&
        !node.dotDotDotToken &&
        node.parent &&
        ts.isObjectBindingPattern(node.parent)
      ) {
        const visitedInit = node.initializer ? (ts.visitNode(node.initializer, visit) as ts.Expression) : undefined
        const visitedName = ts.visitNode(node.name, visit) as ts.BindingName
        if (!node.propertyName && ts.isIdentifier(node.name) && node.name.text.length > 0) {
          transformed = true
          return ts.factory.updateBindingElement(
            node,
            undefined,
            ts.factory.createComputedPropertyName(callPool(node.name.text)),
            visitedName,
            visitedInit,
          )
        }
        if (
          node.propertyName &&
          (ts.isIdentifier(node.propertyName) || ts.isStringLiteral(node.propertyName)) &&
          node.propertyName.text.length > 0
        ) {
          transformed = true
          return ts.factory.updateBindingElement(
            node,
            undefined,
            ts.factory.createComputedPropertyName(callPool(node.propertyName.text)),
            visitedName,
            visitedInit,
          )
        }
      }

      if (ts.isTemplateExpression(node) && !ts.isTaggedTemplateExpression(node.parent)) {
        transformed = true
        const parts: ts.Expression[] = [
          node.head.text.length > 0 ? callPool(node.head.text) : ts.factory.createStringLiteral(''),
        ]
        for (const span of node.templateSpans) {
          const visitedExpr = ts.visitNode(span.expression, visit) as ts.Expression
          parts.push(ts.factory.createParenthesizedExpression(visitedExpr))
          if (span.literal.text.length > 0) {
            parts.push(callPool(span.literal.text))
          }
        }
        return ts.factory.createParenthesizedExpression(
          parts.reduce((acc, cur) => ts.factory.createBinaryExpression(acc, ts.SyntaxKind.PlusToken, cur)),
        )
      }

      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        isTransformableStringLiteral(node)
      ) {
        transformed = true
        return callPool(node.text)
      }

      if (ts.isNumericLiteral(node)) {
        const parent = node.parent
        if (!(parent && 'name' in parent && (parent as { name?: ts.Node }).name === node) && /^\d+$/.test(node.text)) {
          const n = Number(node.text)
          if (Number.isSafeInteger(n) && n >= 2 && n <= 0x3fffffff) {
            transformed = true
            return ts.factory.createParenthesizedExpression(
              ts.factory.createBinaryExpression(
                ts.factory.createIdentifier('__f_k'),
                ts.SyntaxKind.CaretToken,
                ts.factory.createNumericLiteral((n ^ keyMask) >>> 0),
              ),
            )
          }
        }
      }

      return ts.visitEachChild(node, visit, context)
    }
    return root => ts.visitNode(root, visit) as ts.SourceFile
  }

  const result = ts.transform(sf, [transformer])
  if (!transformed) {
    result.dispose()
    return null
  }
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true })
  const printed = printer.printFile(result.transformed[0])
  result.dispose()

  const b64 = xorBase64Encode(JSON.stringify(pool), seed)
  const header = `let __f_t,__f_k=${keyMask},__f_m=${idxMask};const __f_s=i=>{if(!__f_t){const b=atob("${b64}"),l=b.length,u=new Uint8Array(l);let s=${seed}>>>0;for(let j=0;j<l;j++){s^=s<<13;s^=s>>>17;s^=s<<5;u[j]=b.charCodeAt(j)^((s>>>((j&3)<<3))&255)}__f_t=JSON.parse(new TextDecoder().decode(u))}return __f_t[i^__f_m]};\n`
  return header + printed
}

/**
 * Production code protection for the WebView bundle packaged into the APK:
 * - Encodes all i18n dictionary payloads, per-module string literals, object
 *   property keys, destructuring keys, and member accesses into shuffled,
 *   XOR-scrambled binary tables decoded in memory without eval() (preserving
 *   the strict `script-src 'self'` Content-Security-Policy).
 * - Masks string table indices and integer constants via bitwise XOR expressions.
 * - Hashes all output chunk/asset filenames so source module names are never
 *   exposed in `assets/public/assets/`.
 */
function obfuscateBundle(): Plugin {
  return {
    name: 'fatorati-obfuscate-bundle',
    apply: 'build',
    enforce: 'post',
    transform(code: string, id: string) {
      const cleanId = id.split('?')[0].replace(/\\/g, '/')
      if (cleanId.endsWith('/package.json')) {
        const pkg = JSON.parse(readFileSync(cleanId, 'utf8')) as { version: string }
        const seed = hashSeed(cleanId)
        const b64 = xorBase64Encode(JSON.stringify({ version: pkg.version }), seed)
        return {
          code: `const b=atob("${b64}"),l=b.length,u=new Uint8Array(l);let s=${seed}>>>0;for(let j=0;j<l;j++){s^=s<<13;s^=s>>>17;s^=s<<5;u[j]=b.charCodeAt(j)^((s>>>((j&3)<<3))&255)}const p=JSON.parse(new TextDecoder().decode(u));export const version=p.version;export default p;`,
          map: null,
        }
      }
      if (/\/src\/i18n\/[a-z]{2}\.json$/.test(cleanId)) {
        const raw = readFileSync(cleanId, 'utf8')
        const seed = hashSeed(cleanId)
        const b64 = xorBase64Encode(JSON.stringify(JSON.parse(raw)), seed)
        return {
          code: `const b=atob("${b64}"),l=b.length,u=new Uint8Array(l);let s=${seed}>>>0;for(let j=0;j<l;j++){s^=s<<13;s^=s>>>17;s^=s<<5;u[j]=b.charCodeAt(j)^((s>>>((j&3)<<3))&255)}export default JSON.parse(new TextDecoder().decode(u));`,
          map: null,
        }
      }
      if (!cleanId.includes('/src/') || !/\.[jt]sx?$/.test(cleanId)) return null
      const obfuscated = obfuscateJavaScriptSource(code, cleanId)
      return obfuscated ? { code: obfuscated, map: null } : null
    },
    async writeBundle(options) {
      const outDir = options.dir ? resolve(options.dir) : resolve('dist')
      const prepaintPath = resolve(outDir, 'prepaint.js')
      if (existsSync(prepaintPath)) {
        const raw = readFileSync(prepaintPath, 'utf8')
        const obfuscated = obfuscateJavaScriptSource(raw, '/public/prepaint.js')
        if (obfuscated) {
          const wrapped = `(()=>{${obfuscated}})();`
          try {
            const req = createRequire(import.meta.url)
            const viteReq = createRequire(req.resolve('vite'))
            const terser = viteReq('terser') as {
              minify: (code: string, opts: Record<string, unknown>) => Promise<{ code?: string }>
            }
            const minified = await terser.minify(wrapped, {
              compress: { passes: 2, drop_console: true, drop_debugger: true },
              mangle: { toplevel: true },
              format: { comments: false },
            })
            writeFileSync(prepaintPath, `${minified.code || wrapped.replace(/\n+/g, '')}\n`, 'utf8')
          } catch {
            writeFileSync(prepaintPath, `${wrapped.replace(/\n+/g, '')}\n`, 'utf8')
          }
        }
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), devCsp(), obfuscateBundle()],
  build: {
    sourcemap: false,
    minify: true,
    rolldownOptions: {
      output: {
        entryFileNames: 'assets/c-[hash].js',
        chunkFileNames: 'assets/c-[hash].js',
        assetFileNames: 'assets/a-[hash][extname]',
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true, // Sandbox/preview hosts; the served app still blocks network calls.
  },
  preview: { host: true, port: 4173, strictPort: true, allowedHosts: true },
})
