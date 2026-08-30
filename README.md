# Yan 个人作品集与技术笔记

一个无运行时依赖的多页个人作品集，围绕嵌入式、边缘视觉、算法建模、项目证据和个人经历组织内容。站点支持安装、离线访问、键盘操作和移动端布局。

在线地址：[yan-yongchun.github.io/Personal-blog](https://yan-yongchun.github.io/Personal-blog/)

## 页面

| 页面 | 内容 |
|---|---|
| `index.html` | 个人宣言、代表作品、能力谱系、竞赛证据与技术笔记入口 |
| `about.html` | 开发平台、完整竞赛荣誉与成长经历 |
| `embedded.html` | STM32、瑞萨、树莓派与调试检查清单 |
| `algorithms.html` | 九个 C++ 题解/模板与复杂度说明 |
| `modeling.html` | 可筛选的数学建模方法库 |
| `modeling-cat-*.html` | 算法模型、应用案例、理论研究分类笔记 |
| `projects.html` | 四个实践项目的目标、处理链路、实践重点和证据边界 |
| `blog.html` | 已可读专题与明确区分的写作队列 |
| `contact.html` | 邮件入口、邮箱复制与沟通信息清单 |
| `404.html` | GitHub Pages 在线错误链接的回退页面 |
| `offline.html` | 断网且目标页面未缓存时的明确回退状态 |

## 特点

- 原生 HTML、CSS、JavaScript，生产环境无需框架、构建产物或第三方脚本。
- 所有页面共用响应式导航、设计变量、组件与页脚。
- 支持键盘导航、焦点循环、跳过链接、明确焦点、无脚本降级、减少动态效果偏好和打印样式。
- 图片声明固定尺寸并提供替代文本，避免加载时布局跳动。
- 算法标签支持方向键切换，代码可展开和复制。
- 建模主题支持筛选并同步可分享的查询 URL，分类页使用稳定地址。
- 联系页不采集数据；邮件按钮直接打开本地客户端，邮箱可一键复制。
- 每页包含 canonical、Open Graph、robots、CSP、应用清单和主题色元数据。
- Service Worker 预缓存全部内容页；未知离线路径回退到专用离线页。

## 本地预览

在项目根目录运行：

```powershell
npm run serve
```

然后访问 `http://127.0.0.1:8000/`。直接打开 HTML 仍可阅读，但 PWA、离线缓存和安全策略需要 HTTP 服务环境。

## 自动检查

快速检查只依赖 Python 标准库和 Node.js：

```powershell
npm run check
```

它会检查：

- HTML 文档语言、字符集、唯一标题、描述与语义区块；
- 单一 `h1`、标题层级、重复 ID 和内联事件；
- 本地页面、锚点、脚本、样式、图片及 CSS 资源；
- 图片替代文本、固定尺寸、异步解码和 PWA 图标真实像素；
- canonical、Open Graph、CSP、manifest、sitemap、robots 与离线缓存覆盖；
- 按钮类型、表单标签、外链安全与危险 JavaScript 写法。

完整浏览器验收需要一次性安装开发依赖和 Chromium：

```powershell
npm ci
npx playwright install chromium
npm test
```

浏览器审计会遍历全部页面的桌面和手机视口，检查控制台、HTTP、图片、溢出、axe 无障碍规则、移动导航、标签页、筛选、邮箱复制、无脚本降级与真实断网导航，并在 `artifacts/blog-audit/` 生成关键页面截图。

生成与线上一致的白名单部署目录：

```powershell
npm run build
```

输出位于 `_site/`，只包含 HTML、静态资源、PWA 和搜索引擎发现文件。GitHub Pages 工作流会依次执行完整验收和构建，任一阶段失败都不会发布。

## 目录

```text
.
├── .github/workflows/deploy.yml
├── assets/
│   ├── app.js
│   ├── bootstrap.js
│   ├── modeling.js
│   ├── styles.css
│   ├── icon-192.png
│   ├── icon-512.png
│   └── images...
├── scripts/
│   ├── browser_audit.mjs
│   ├── build_site.py
│   └── check_site.py
├── manifest.webmanifest
├── robots.txt
├── sitemap.xml
├── sw.js
├── index.html
└── other pages...
```

## 许可证

本项目仅供学习交流使用。
