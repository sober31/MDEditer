// 集成冒烟测试：在 jsdom 中加载真实 index.html 脚本（marked/purify/cm/app），
// 验证启动、预览渲染，以及点击 checkbox 同步源码任务行。
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

const ROOT = process.cwd();
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;
window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
window.cancelAnimationFrame = (id) => clearTimeout(id);
for (const k of ['MutationObserver', 'Node', 'Element', 'Range', 'HTMLElement', 'DOMParser', 'DocumentFragment', 'Event', 'CustomEvent', 'getComputedStyle']) {
  if (window[k] === undefined && global[k] !== undefined) window[k] = global[k];
}
const errors = [];
window.addEventListener('error', (e) => errors.push(e.message));

const load = (f) => window.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const firstTask = (t) => t.split('\n').find((l) => /^(\s*[-*+]\s+)\[([ xX])\]/.test(l));

(async () => {
  try {
    load('vendor/marked.min.js');
    load('vendor/purify.min.js');
    load('dist/cm.js');
    load('app.js');

    const preview = window.document.getElementById('preview');
    const boxes = preview.querySelectorAll('input[type="checkbox"]').length;
    const hasH1 = /<h1/.test(preview.innerHTML);
    if (!hasH1 || boxes === 0) throw new Error('preview not rendered (h1=' + hasH1 + ', checkboxes=' + boxes + ')');

    await sleep(800); // 等初始自动保存写入 localStorage
    const before = firstTask(JSON.parse(window.localStorage.getItem('mdedit:draft')).text);
    preview.querySelectorAll('input[type="checkbox"]')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await sleep(800);
    const after = firstTask(JSON.parse(window.localStorage.getItem('mdedit:draft')).text);

    const ok = before !== after && errors.length === 0;
    console.log('rendered H1:', hasH1, '| checkboxes:', boxes);
    console.log('task before:', JSON.stringify(before));
    console.log('task after :', JSON.stringify(after));
    console.log('runtime errors:', errors.length ? errors : 'none');
    if (ok) { console.log('INTEGRATION PASS ✅'); process.exit(0); }
    else { console.error('INTEGRATION FAIL ❌'); process.exit(1); }
  } catch (e) {
    console.error('INTEGRATION FAIL:', e && e.message);
    process.exit(1);
  }
})();
