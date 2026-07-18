// 用 esbuild 将 CodeMirror + Vim 编辑器打包为单文件 IIFE（dist/cm.js）
import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['build/editor.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  outfile: 'dist/cm.js',
  logLevel: 'info',
});
console.log('dist/cm.js built');
