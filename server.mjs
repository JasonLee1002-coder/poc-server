import express from 'express'
import { neon } from '@neondatabase/serverless'

const app = express()
const PORT = process.env.PORT || 3012
const PASSWORD = process.env.POC_PASSWORD || 'xu4bj6D1l41le4'
const sql = neon(process.env.DATABASE_URL)

app.use(express.json({ limit: '5mb' }))

// ── 工具函數 ──────────────────────────────────────────────
function checkToken(req) {
  return req.headers['x-poc-token'] === PASSWORD
}

function checkCookie(req) {
  const raw = req.headers.cookie || ''
  return raw.split(';').some(c => c.trim() === `poc_token=${PASSWORD}`)
}

// ── 列表頁（瀏覽器用，需密碼 cookie）──────────────────────
app.get('/', async (req, res) => {
  if (!checkCookie(req)) {
    return res.send(loginPage())
  }
  const reports = await sql`
    SELECT id, title, category, author, slug, created_at
    FROM poc_reports ORDER BY created_at DESC
  `
  res.send(listPage(reports))
})

// ── 密碼登入 POST ─────────────────────────────────────────
app.post('/login', express.urlencoded({ extended: false }), (req, res) => {
  if (req.body.password === PASSWORD) {
    res.setHeader('Set-Cookie', `poc_token=${PASSWORD}; Path=/; Max-Age=86400; HttpOnly`)
    return res.redirect('/')
  }
  res.send(loginPage('密碼錯誤'))
})

// ── 個別報告頁（瀏覽器用）────────────────────────────────
app.get('/r/:slug', async (req, res) => {
  if (!checkCookie(req)) return res.redirect('/')
  const [report] = await sql`
    SELECT html_content FROM poc_reports WHERE slug = ${req.params.slug}
  `
  if (!report) return res.status(404).send('<h1>找不到報告</h1>')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(report.html_content)
})

// ── API: 發布報告（供 publish-report.mjs 使用）────────────
app.post('/api/poc', async (req, res) => {
  if (!checkToken(req)) return res.status(401).json({ error: 'Unauthorized' })
  const { title, category = 'report', author = 'CLO', htmlContent, slug } = req.body
  if (!title || !htmlContent || !slug) {
    return res.status(400).json({ error: 'title, htmlContent, slug 必填' })
  }
  const [row] = await sql`
    INSERT INTO poc_reports (title, category, author, html_content, slug)
    VALUES (${title}, ${category}, ${author}, ${htmlContent}, ${slug})
    ON CONFLICT (slug) DO UPDATE
      SET title = EXCLUDED.title,
          html_content = EXCLUDED.html_content,
          category = EXCLUDED.category,
          author = EXCLUDED.author,
          created_at = NOW()
    RETURNING id, slug
  `
  res.json({ id: row.id, slug: row.slug })
})

// ── API: 列表（供 publish-report.mjs 查詢）───────────────
app.get('/api/poc', async (req, res) => {
  if (!checkToken(req)) return res.status(401).json({ error: 'Unauthorized' })
  const reports = await sql`
    SELECT id, title, category, author, slug, created_at
    FROM poc_reports ORDER BY created_at DESC
  `
  res.json(reports)
})

// ── API: 刪除報告 ─────────────────────────────────────────
app.delete('/api/poc', async (req, res) => {
  if (!checkToken(req)) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id 必填' })
  await sql`DELETE FROM poc_reports WHERE id = ${id}`
  res.json({ ok: true })
})

app.listen(PORT, () => console.log(`poc-server running on port ${PORT}`))

// ── HTML 樣板 ─────────────────────────────────────────────

function loginPage(error = '') {
  return `<!DOCTYPE html><html lang="zh-TW"><head>
<meta charset="UTF-8"><title>MCS 內部報告中心</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .box{background:#fff;border-radius:12px;padding:40px;width:340px;box-shadow:0 4px 20px rgba(0,0,0,.08)}
  h2{margin:0 0 24px;color:#1e293b;font-size:1.3rem}
  input{width:100%;box-sizing:border-box;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:1rem;margin-bottom:16px}
  button{width:100%;padding:12px;background:#00C6AD;color:#fff;border:none;border-radius:8px;font-size:1rem;cursor:pointer;font-weight:600}
  .err{color:#dc2626;font-size:.9rem;margin-bottom:12px}
</style></head><body>
<div class="box">
  <h2>🔒 MCS 內部報告中心</h2>
  ${error ? `<div class="err">⚠️ ${error}</div>` : ''}
  <form method="POST" action="/login">
    <input type="password" name="password" placeholder="請輸入密碼" autofocus>
    <button type="submit">登入</button>
  </form>
</div></body></html>`
}

function listPage(reports) {
  const categoryLabel = { closure: '結案', report: '報告', analysis: '分析', meeting: '會議記錄' }
  const categoryColor = { closure: '#7c3aed', report: '#0284c7', analysis: '#d97706', meeting: '#16a34a' }

  const rows = reports.map(r => {
    const cat = r.category
    const badge = `<span style="background:${categoryColor[cat] || '#64748b'};color:#fff;padding:2px 8px;border-radius:4px;font-size:.75rem">${categoryLabel[cat] || cat}</span>`
    const date = new Date(r.created_at).toLocaleDateString('zh-TW')
    return `<tr>
      <td><a href="/r/${r.slug}" style="color:#0284c7;text-decoration:none;font-weight:500">${r.title}</a></td>
      <td>${badge}</td>
      <td style="color:#64748b">${r.author}</td>
      <td style="color:#64748b">${date}</td>
      <td><button onclick="del('${r.id}')" style="background:#fee2e2;color:#dc2626;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:.8rem">刪除</button></td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html><html lang="zh-TW"><head>
<meta charset="UTF-8"><title>MCS 內部報告中心</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f8fafc;margin:0;padding:24px}
  h1{color:#1e293b;margin-bottom:4px;font-size:1.5rem}
  .sub{color:#64748b;font-size:.9rem;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)}
  th{background:#f1f5f9;padding:12px 16px;text-align:left;font-size:.8rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
  td{padding:12px 16px;border-top:1px solid #f1f5f9;vertical-align:middle}
  tr:hover td{background:#f8fafc}
  .empty{text-align:center;color:#94a3b8;padding:40px}
</style></head><body>
<h1>📋 MCS 內部報告中心</h1>
<div class="sub">密碼保護 · 僅限內部人員 · <a href="/login" style="color:#0284c7" onclick="document.cookie='poc_token=;Max-Age=0;Path=/';location.href='/'">登出</a></div>
<table>
  <thead><tr>
    <th>標題</th><th>類型</th><th>作者</th><th>日期</th><th>操作</th>
  </tr></thead>
  <tbody>${rows || `<tr><td colspan="5" class="empty">尚無報告</td></tr>`}</tbody>
</table>
<script>
async function del(id) {
  if (!confirm('確定刪除？')) return
  const r = await fetch('/api/poc?id=' + id, {
    method: 'DELETE', headers: {'x-poc-token': document.cookie.match(/poc_token=([^;]+)/)?.[1] || ''}
  })
  if (r.ok) location.reload()
  else alert('刪除失敗')
}
</script></body></html>`
}
