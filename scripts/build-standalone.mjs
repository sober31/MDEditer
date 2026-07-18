// 将 index.html 的全部外部资源（CSS / marked / purify / cm / app）内联，产出单文件 MDEditer.html
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, p) => {
  const code = fs.readFileSync(path.join(ROOT, p), 'utf8');
  return '<script>\n' + safe(code) + '\n</script>';
});
html = html.replace(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g, (m, p) => {
  const css = fs.readFileSync(path.join(ROOT, p), 'utf8');
  return '<style>\n' + css + '\n</style>';
});

const out = path.join(ROOT, 'MDEditer.html');
fs.writeFileSync(out, html);
console.log('standalone built ->', out, '(', fs.statSync(out).size, 'bytes )');
console.log('remaining <script src= tags:', (html.match(/<script src="/g) || []).length);
console.log('remaining <link tags:', (html.match(/<link/g) || []).length);
