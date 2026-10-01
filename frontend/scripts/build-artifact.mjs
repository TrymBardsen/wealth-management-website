// Packs the artifact build into one HTML file for publishing as a Claude
// artifact: the platform wraps the file in its own <html>/<head>/<body>, so
// the file holds only a title, the CSS and the JS, all inline.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist-artifact')
const index = readFileSync(path.join(dist, 'index.html'), 'utf8')
const asset = (pattern) => {
  const match = index.match(pattern)
  if (!match) throw new Error(`Asset not found in dist-artifact/index.html: ${pattern}`)
  return readFileSync(path.join(dist, match[1]), 'utf8')
}

const js = asset(/<script[^>]+src="\.\/([^"]+\.js)"/)
const css = asset(/<link[^>]+href="\.\/([^"]+\.css)"/)
// A literal "</script" inside the bundle would end the inline script early.
const safeJs = js.replace(/<\/script/gi, '<\\/script')

const html = `<title>Wealth Copilot</title>
<style>${css}</style>
<div id="root"></div>
<script type="module">${safeJs}</script>
`
const out = path.join(dist, 'wealth-copilot.html')
writeFileSync(out, html)
console.log(`Wrote ${path.relative(process.cwd(), out)} (${(html.length / 1024 / 1024).toFixed(2)} MB)`)
