/**
 * publish-report.mjs — 各長官通用報告發布工具
 *
 * 用法：
 *   node publish-report.mjs <html_file> <slug> [category] [author]
 *
 * 範例：
 *   node publish-report.mjs "C:/path/to/報告.html" david-closure-20260529 closure CLO
 *
 * category: report | closure | analysis | meeting
 * 發布後可在 https://poc.mcstation.ai/r/<slug> 存取
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

const POC_PASSWORD = process.env.POC_PASSWORD || 'xu4bj6D1l41le4'
const BASE_URL = process.env.POC_BASE_URL || 'https://poc.mcstation.ai'

const [,, htmlFile, slug, category = 'report', author = 'CLO'] = process.argv

if (!htmlFile || !slug) {
  console.error('用法: node publish-report.mjs <html_file> <slug> [category] [author]')
  process.exit(1)
}

const htmlContent = readFileSync(resolve(htmlFile), 'utf-8')
const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i)
const title = titleMatch?.[1]?.trim() ?? slug

const res = await fetch(`${BASE_URL}/api/poc`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-poc-token': POC_PASSWORD },
  body: JSON.stringify({ title, category, author, htmlContent, slug }),
})

if (res.ok) {
  const { id } = await res.json()
  console.log(`✅ 報告已發布`)
  console.log(`   標題：${title}`)
  console.log(`   網址：${BASE_URL}/r/${slug}`)
  console.log(`   ID：${id}`)
} else {
  const err = await res.json().catch(() => ({}))
  console.error('❌ 發布失敗：', JSON.stringify(err))
  process.exit(1)
}
