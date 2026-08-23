# USTC Navigator 前端

中国科学技术大学校园资源导航助手的第一版响应式 Web 前端。当前版本可在没有后端服务的情况下完整演示首页探索、资源搜索与筛选、资源详情和引导式 AI 导航。

## 本地运行

需要 Node.js 20+ 与 pnpm。

```powershell
pnpm install
pnpm dev
```

默认地址为 `http://localhost:5173`。

## 验证命令

```powershell
pnpm lint
pnpm test:run
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

## 数据边界

- `src/data/raw/resources.json` 是当前比赛仓库内爬虫数据的前端快照。
- `src/data/resourceAdapter.ts` 负责把当前旧字段和未来 API 字段统一成 `Resource`。
- 更新爬虫结果时可以替换快照；只要保留 `articles` 数组或直接提供数组，页面无需修改。
- 当前快照 1295 条记录全部保留；非法或非 HTTP(S) 地址不会显示外链按钮。

## AI 服务接入

不配置环境变量时，AI 页面使用本地演示响应。连接后端时创建 `.env.local`：

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_USE_MOCKS=false
```

前端会调用：

```text
GET  {VITE_API_BASE_URL}/api/resources
GET  {VITE_API_BASE_URL}/api/resources/{id}
POST {VITE_API_BASE_URL}/api/search
```

请求结构：

```json
{
  "query": "我想参加科创竞赛",
  "top_k": 5,
  "category": null,
  "session_id": "可选"
}
```

响应结构：

```json
{
  "answer": "...",
  "results": [{ "title": "...", "summary": "...", "category": "...", "url": "已收录的官方 URL" }],
  "session_id": "..."
}
```

AI 返回的 URL 会先与本地资源目录核验，只有命中已知资源的结果才会生成内部详情链接。不要把密钥放进 `VITE_*` 变量；它们会被打包进浏览器代码。鉴权与模型密钥必须保留在服务端。

## 官方素材

校徽与校园照片的官方来源、处理方式和获取日期记录在 `public/brand/SOURCES.md`。页面页脚持续注明该产品为学生参赛项目，并非正式校务系统。
