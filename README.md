# MDEditer

一款 Vim 风格的 Markdown 查看 / 编辑工具。单文件构建，离线可用，跨平台（macOS / Windows 下载即运行）。

## 功能

- **Vim 模态编辑**：基于 CodeMirror 6 + `@replit/codemirror-vim`
  - 普通 / 插入 / 可视模式；`h j k l` 移动，`i`/`a`/`o` 进入插入，`Esc` 回普通
  - `dd` 删行、`yy` 复制、`p` 粘贴、`u` 撤销、`Ctrl-r` 重做
  - `/` 搜索、底部 `-- INSERT --` 模式状态栏
  - `:w` / `:wq` / `:x` 触发保存
  - 语法高亮、行号、明暗主题（与页面主题联动）
- **Checkbox 双向勾选**：预览中点击复选框，自动同步源码对应任务行的 `[ ]` ↔ `[x]` 并重渲染
- **三视图**：源码 / 分屏 / 预览，一键切换
- **辅助功能**：打开/拖拽文件、保存/另存为、自动草稿（localStorage）、文档大纲跳转、查找高亮、字数/行数/任务进度统计、链接 XSS 净化、HTML 源码查看

## 使用

### 方式一：单文件独立版（推荐分发）

直接用浏览器打开根目录的 **`MDEditer.html`** 即可，无需联网、无需服务器、无需安装。

> 说明：`file://` 下浏览器限制 File System Access，因此打开/保存走「文件选择框 + 下载」；
> 若用本地静态服务器打开（如 `http://localhost:8080/index.html`），则支持直接写回原文件。

### 方式二：开发版

```bash
npm install
# 启动本地静态服务器，例如：
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080/index.html
```

## 构建

本项目的 CodeMirror 编辑器 bundle 与单文件 HTML 由脚本生成：

```bash
npm run build          # 重新打包 dist/cm.js 并内联生成 MDEditer.html
```

## 测试

```bash
npm test               # jsdom 集成冒烟测试：启动 + 预览渲染 + checkbox 源码同步
```

## CI

仓库已配置 GitHub Actions（`.github/workflows/ci.yml`）：push / PR 到 `main`
自动执行 `npm ci → npm run build → npm test`。

## 文件结构

```
index.html              开发版入口
app.js                  应用逻辑（驱动 CodeMirror）
styles.css              样式（明暗主题）
dist/cm.js              CodeMirror + vim 编辑器打包产物
MDEditer.html           单文件独立版（所有资源内联）
vendor/marked.min.js    Markdown 解析（本地，离线）
vendor/purify.min.js    HTML 净化（本地，离线）
build/editor.js         编辑器源码（esbuild 入口）
scripts/                打包与单文件构建脚本
test/                   集成测试
sample.md               示例文档
```
