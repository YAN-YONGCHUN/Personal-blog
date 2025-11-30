# Personal-blog

一个静态个人博客项目，包含主页、关于、算法、博客、联系、项目等页面，使用原生 HTML/CSS/JS 实现，适合部署到 GitHub Pages。

## 在线访问

- 站点地址：`https://YAN-YONGCHUN.github.io/Personal-blog/`

## 项目结构

- `index.html` 站点主页
- `about.html`、`algorithms.html`、`blog.html`、`contact.html`、`projects.html`
- `assets/` 前端资源目录（`styles.css`、`cyber.css`、`app.js`、图片等）

## 快速开始

- 克隆仓库：
  ```bash
  git clone https://github.com/YAN-YONGCHUN/Personal-blog.git
  cd Personal-blog
  ```
- 本地预览：直接双击 `index.html` 或使用任意静态服务器（如 VS Code Live Server）。

## 部署说明（GitHub Pages）

- 已配置 GitHub Actions，推送到 `main` 分支会自动发布到 Pages。
- 首次构建通常需要 1–3 分钟，如遇 404，请稍后刷新。

## 开发提示

- 页面为静态文件，修改后提交到 `main` 分支即可自动上线。
- 资源放置于 `assets/`，注意相对路径与大小写一致。

