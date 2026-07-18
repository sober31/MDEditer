/* ===================== MDEditer 应用逻辑（Vim 版） ===================== */
(function () {
  'use strict';

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const preview = $('#preview');
  const previewPane = $('#previewPane');
  const sourcePane = $('#sourcePane');
  const fileNameEl = $('#fileName');
  const fileInput = $('#fileInput');
  const workspace = $('#workspace');
  const body = document.body;

  // CodeMirror 编辑器实例（由 dist/cm.js 暴露的 window.MDEditer 创建）
  let ed = null;

  // ---------- 状态 ----------
  let fileHandle = null;          // File System Access 句柄
  let currentName = '未命名.md';
  let searchTerm = '';
  let renderTimer = null;

  // ---------- Markdown 配置 ----------
  marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });

  // ---------- 渲染 ----------
  function render() {
    const text = ed.getValue();
    let html = marked.parse(text);
    html = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });

    const scrollTop = previewPane.scrollTop;
    preview.innerHTML = html;

    preview.querySelectorAll('a').forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });

    assignTaskIndices();
    assignHeadingIds();
    applySearchHighlight();
    previewPane.scrollTop = scrollTop;

    updateStats();
    buildOutline();
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 120);
  }

  // ---------- 任务清单（checkbox 双向同步） ----------
  function getTaskLines(text) {
    const lines = text.split('\n');
    const out = [];
    const re = /^(\s*[-*+]\s+)\[([ xX])\]/;
    lines.forEach((line, i) => {
      const m = line.match(re);
      if (m) out.push({ lineNo: i, checked: m[2].toLowerCase() === 'x' });
    });
    return out;
  }

  function assignTaskIndices() {
    const boxes = preview.querySelectorAll('input[type="checkbox"]');
    boxes.forEach((box, i) => {
      box.disabled = false;
      box.dataset.taskIndex = String(i);
      const li = box.closest('li');
      if (li) {
        li.classList.add('task-item');
        if (box.checked) li.classList.add('task-done');
        else li.classList.remove('task-done');
      }
    });
  }

  function toggleTask(index) {
    const text = ed.getValue();
    const tasks = getTaskLines(text);
    if (index < 0 || index >= tasks.length) return;
    const { lineNo } = tasks[index];
    const lines = text.split('\n');
    lines[lineNo] = lines[lineNo].replace(/\[([ xX])\]/, (_, c) =>
      c.toLowerCase() === 'x' ? '[ ]' : '[x]'
    );
    ed.setValue(lines.join('\n'));   // 触发 onChange -> render + 自动保存
  }

  previewPane.addEventListener('click', (e) => {
    const box = e.target.closest('input[type="checkbox"]');
    if (!box) return;
    e.preventDefault();
    toggleTask(Number(box.dataset.taskIndex));
  });

  // ---------- 大纲 ----------
  function getHeadings(text) {
    const lines = text.split('\n');
    const out = [];
    let inFence = false;
    lines.forEach((raw) => {
      if (/^\s*```/.test(raw)) { inFence = !inFence; return; }
      if (inFence) return;
      const m = raw.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (m) out.push({ level: m[1].length, text: m[2].trim() });
    });
    return out;
  }

  function assignHeadingIds() {
    const hs = preview.querySelectorAll('h1,h2,h3,h4,h5,h6');
    hs.forEach((h, i) => { h.id = 'md-h-' + i; });
  }

  function buildOutline() {
    const list = $('#outlineList');
    const heads = getHeadings(ed.getValue());
    if (!heads.length) { list.innerHTML = '<p style="color:var(--text-soft);padding:8px">暂无标题</p>'; return; }
    list.innerHTML = heads
      .map((h, i) => `<a class="lvl-${Math.min(h.level, 3)}" data-i="${i}" href="#md-h-${i}">${escapeHtml(h.text)}</a>`)
      .join('');
  }

  $('#outlineList').addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    const el = document.getElementById('md-h-' + a.dataset.i);
    if (el) {
      if (body.dataset.view === 'source') setView('preview');
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ---------- 统计 / 光标 ----------
  function updateStats() {
    const text = ed.getValue();
    const chars = text.length;
    const lines = text.split('\n').length;
    const words = (text.match(/[\u4e00-\u9fa5]|[A-Za-z0-9]+/g) || []).length;
    $('#statCount').textContent = words + ' 字 / ' + lines + ' 行';
    const tasks = getTaskLines(text);
    const done = tasks.filter((t) => t.checked).length;
    $('#statTasks').textContent = '任务 ' + done + '/' + tasks.length;
  }

  function updateCursor(info) {
    if (!info) info = ed.getCursor();
    $('#statCursor').textContent = '行 ' + info.line + ', 列 ' + info.col;
  }

  // ---------- 视图切换 ----------
  function setView(view) {
    body.dataset.view = view;
    document.querySelectorAll('.view-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.view === view));
    $('#statView').textContent = '视图: ' + ({ source: '源码', split: '分屏', preview: '预览' }[view]);
    const showFmt = view !== 'preview';
    $('#formatBar').style.display = showFmt ? 'flex' : 'none';
    if (view === 'preview' || view === 'split') render();
    localStorage.setItem('mdedit:view', view);
  }
  document.querySelectorAll('.view-btn').forEach((b) =>
    b.addEventListener('click', () => setView(b.dataset.view)));

  // ---------- 格式化工具栏 ----------
  const fmtMap = {
    bold: () => ed.surround('**', '**'),
    italic: () => ed.surround('*', '*'),
    strike: () => ed.surround('~~', '~~'),
    code: () => ed.surround('`', '`'),
    codeblock: () => ed.insertBlock('\n```\n代码\n```\n'),
    quote: () => ed.linePrefix('> '),
    h1: () => ed.linePrefix('# '),
    h2: () => ed.linePrefix('## '),
    h3: () => ed.linePrefix('### '),
    ul: () => ed.linePrefix('- '),
    ol: () => ed.linePrefix('1. '),
    task: () => ed.linePrefix('- [ ] '),
    link: () => ed.surround('[', '](https://)'),
    img: () => ed.surround('![', '](https://)'),
    table: () => ed.insertBlock('\n| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |\n'),
    hr: () => ed.insertBlock('\n---\n'),
  };
  $('#formatBar').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn && fmtMap[btn.dataset.cmd]) fmtMap[btn.dataset.cmd]();
  });

  // ---------- 文件操作 ----------
  function loadText(text, name) {
    ed.setValue(text);
    currentName = name || '未命名.md';
    fileNameEl.textContent = currentName;
    setView(body.dataset.view || 'source');
  }

  async function openFile() {
    if (window.showOpenFilePicker) {
      try {
        const [h] = await window.showOpenFilePicker({
          types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown', '.mdx', '.txt'] } }],
        });
        fileHandle = h;
        const file = await h.getFile();
        loadText(await file.text(), file.name);
        flashSaved('已打开 ' + file.name);
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    fileInput.click();
  }
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    fileHandle = null;
    loadText(await f.text(), f.name);
    flashSaved('已打开 ' + f.name);
    fileInput.value = '';
  });

  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveFile() {
    const text = ed.getValue();
    if (window.showSaveFilePicker && fileHandle) {
      try {
        if ((await fileHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
          if ((await fileHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') return;
        }
        const w = await fileHandle.createWritable();
        await w.write(text); await w.close();
        flashSaved('已保存 ' + currentName);
        return;
      } catch (err) { /* 回退下载 */ }
    }
    download(currentName, text);
    flashSaved('已下载 ' + currentName);
  }

  async function saveAs() {
    const text = ed.getValue();
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({
          suggestedName: currentName,
          types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
        });
        fileHandle = h;
        const w = await h.createWritable();
        await w.write(text); await w.close();
        currentName = h.name; fileNameEl.textContent = currentName;
        flashSaved('已保存 ' + currentName);
        return;
      } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    download(currentName, text);
  }

  function newFile() {
    if (ed.getValue() && !confirm('新建将清空当前内容（草稿仍可从本地恢复），继续？')) return;
    ed.setValue('');
    fileHandle = null;
    currentName = '未命名.md';
    fileNameEl.textContent = currentName;
  }

  $('#btnOpen').addEventListener('click', openFile);
  $('#btnSave').addEventListener('click', saveFile);
  $('#btnSaveAs').addEventListener('click', saveAs);
  $('#btnNew').addEventListener('click', newFile);
  $('#btnUndo').addEventListener('click', () => ed.undo());
  $('#btnRedo').addEventListener('click', () => ed.redo());

  // ---------- 大纲面板 ----------
  $('#btnOutline').addEventListener('click', () => $('#outlinePanel').classList.toggle('open'));
  $('#outlineClose').addEventListener('click', () => $('#outlinePanel').classList.remove('open'));

  // ---------- HTML 源码弹窗 ----------
  $('#btnHtml').addEventListener('click', () => {
    $('#htmlSrc').textContent = preview.innerHTML;
    $('#htmlModal').classList.add('open');
  });
  $('#htmlClose').addEventListener('click', () => $('#htmlModal').classList.remove('open'));
  $('#htmlModal').addEventListener('click', (e) => { if (e.target.id === 'htmlModal') $('#htmlModal').classList.remove('open'); });
  $('#htmlCopy').addEventListener('click', () => {
    navigator.clipboard.writeText($('#htmlSrc').textContent).then(() => flashSaved('HTML 已复制'));
  });

  // ---------- 主题 ----------
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('mdedit:theme', t);
    if (ed) ed.setTheme(t);
  }
  $('#btnTheme').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  // ---------- 搜索（预览高亮） ----------
  function buildSearchBox() {
    const input = document.createElement('input');
    input.id = 'searchBox';
    input.placeholder = '查找…';
    input.style.cssText = 'border:1px solid var(--border);background:var(--bg);color:var(--text);border-radius:7px;padding:5px 10px;font-size:13px;width:140px;';
    input.addEventListener('input', () => { searchTerm = input.value.trim(); applySearchHighlight(); });
    const grp = document.querySelector('.actions');
    grp.insertBefore(input, grp.firstChild);
  }
  function applySearchHighlight() {
    if (!searchTerm) return;
    const term = searchTerm;
    const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) {
      if (n.parentNode && ['MARK', 'SCRIPT', 'STYLE'].includes(n.parentNode.tagName)) continue;
      if (n.nodeValue.toLowerCase().includes(term.toLowerCase())) nodes.push(n);
    }
    nodes.forEach((node) => {
      const frag = document.createDocumentFragment();
      const parts = node.nodeValue.split(new RegExp('(' + escapeReg(term) + ')', 'gi'));
      parts.forEach((p) => {
        if (p.toLowerCase() === term.toLowerCase()) {
          const mk = document.createElement('mark'); mk.textContent = p; frag.appendChild(mk);
        } else frag.appendChild(document.createTextNode(p));
      });
      node.parentNode.replaceChild(frag, node);
    });
  }
  function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---------- 自动保存草稿 ----------
  let saveTimer = null;
  function scheduleAutosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem('mdedit:draft', JSON.stringify({ text: ed.getValue(), name: currentName }));
        flashSaved('已自动保存草稿');
      } catch (e) {}
    }, 600);
  }
  function flashSaved(msg) {
    const el = $('#statSaved');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ---------- 拖拽打开 ----------
  window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) document.body.classList.remove('dragging'); });
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.body.classList.remove('dragging');
    const f = e.dataTransfer.files[0];
    if (!f) return;
    fileHandle = null;
    loadText(await f.text(), f.name);
    flashSaved('已打开 ' + f.name);
  });

  // ---------- 全局快捷键 ----------
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); saveFile(); }
    else if (k === 'o') { e.preventDefault(); openFile(); }
    else if (k === 'f') { e.preventDefault(); const sb = $('#searchBox'); if (sb) sb.focus(); }
    else if (k === 'b') { e.preventDefault(); fmtMap.bold(); }
    else if (k === 'i') { e.preventDefault(); fmtMap.italic(); }
    else if (k === 'k') { e.preventDefault(); fmtMap.link(); }
  });

  // ---------- 初始化 ----------
  function init() {
    applyTheme(localStorage.getItem('mdedit:theme') || 'light');
    buildSearchBox();

    ed = window.MDEditer.createEditor({
      parent: document.getElementById('cmHost'),
      doc: '',
      theme: document.documentElement.dataset.theme,
      onChange: () => { scheduleRender(); scheduleAutosave(); },
      onCursor: (info) => updateCursor(info),
      onSave: () => saveFile(),
    });

    const view = localStorage.getItem('mdedit:view') || 'split';
    const draft = localStorage.getItem('mdedit:draft');
    if (draft) {
      try {
        const d = JSON.parse(draft);
        ed.setValue(d.text || '');
        currentName = d.name || '未命名.md';
        fileNameEl.textContent = currentName;
      } catch (e) {}
    }
    if (!ed.getValue()) {
      ed.setValue(sampleDoc);
      currentName = '示例文档.md';
      fileNameEl.textContent = currentName;
    }
    setView(view);
    updateCursor();
  }

  const sampleDoc = `# MDEditer 示例文档（Vim 风格）

欢迎使用 **MDEditer** —— 支持 Vim 操作的 Markdown 查看 / 编辑工具。

## Vim 速查
- 普通模式：\`h j k l\` 移动，\`i\` 进入插入，\`Esc\` 返回普通
- \`dd\` 删行，\`yy\` 复制，\`p\` 粘贴，\`u\` 撤销，\`Ctrl-r\` 重做
- \`/\` 搜索，\`:w\` 保存，\`:wq\` 保存并退出
- [x] 勾选任务会自动同步到源码
- [ ] 试试在普通模式按 \`i\` 再输入文字

## 文本样式
支持 *斜体*、**加粗**、~~删除线~~、\`行内代码\` 与[链接](https://www.codebuddy.cn)。

> 引用块：Vim 一切皆命令。

\`\`\`js
function hello() { console.log('Hello MDEditer'); }
\`\`\`

| 功能 | 状态 |
| --- | --- |
| Vim 模式 | 已实现 |
| 勾选同步 | 已实现 |

点击「大纲」查看标题导航，点击「HTML」查看生成的源码。
`;

  init();
})();
