// MDEditer 编辑器核心：CodeMirror 6 + Vim 模式
import {
  EditorView, keymap, lineNumbers, highlightActiveLine,
  highlightActiveLineGutter, drawSelection,
} from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import {
  defaultKeymap, history, historyKeymap, indentWithTab, undo, redo,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { vim, Vim } from "@replit/codemirror-vim";

const themeCompartment = new Compartment();

// 用与页面相同的 CSS 变量着色，明暗主题自动同步
function makeTheme(dark) {
  return EditorView.theme({
    "&": { color: "var(--text)", backgroundColor: "var(--bg)", height: "100%" },
    ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "1.6" },
    ".cm-content": { fontSize: "13px", padding: "12px 0", caretColor: "var(--text)" },
    ".cm-gutters": {
      backgroundColor: "var(--bg-soft)", color: "var(--text-soft)",
      border: "none", borderRight: "1px solid var(--border)",
    },
    ".cm-activeLine": { backgroundColor: "rgba(127,127,127,0.10)" },
    ".cm-activeLineGutter": { backgroundColor: "rgba(127,127,127,0.10)" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "var(--text)" },
    ".cm-selectionBackground, .cm-content ::selection": { backgroundColor: "var(--accent-soft)" },
    ".cm-vim-panel": {
      backgroundColor: "var(--bg-soft)", color: "var(--text)",
      borderTop: "1px solid var(--border)", fontFamily: "var(--mono)", fontSize: "13px",
    },
    ".cm-vim-panel input": { color: "var(--text)", background: "transparent", border: "none", outline: "none" },
  }, { dark });
}

// :w / :wq / :x 触发保存
let saveHandler = function () {};
Vim.defineEx("w", "w", function () { saveHandler(); });
Vim.defineEx("wq", "wq", function () { saveHandler(); });
Vim.defineEx("x", "x", function () { saveHandler(); });

function cursorInfo(state) {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  return { line: line.number, col: head - line.from + 1, pos: head };
}

function createEditor(opts) {
  const onChange = opts.onChange;
  const onCursor = opts.onCursor;
  const onSave = opts.onSave;
  if (onSave) saveHandler = onSave;

  const view = new EditorView({
    parent: opts.parent,
    state: EditorState.create({
      doc: opts.doc || "",
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        vim({ status: true }),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        themeCompartment.of(makeTheme(opts.theme === "dark")),
        EditorView.updateListener.of(function (u) {
          if (u.docChanged && onChange) onChange(u.state.doc.toString());
          if (u.selectionSet || u.docChanged) { if (onCursor) onCursor(cursorInfo(u.state)); }
        }),
      ],
    }),
  });

  return {
    view: view,
    getValue: function () { return view.state.doc.toString(); },
    setValue: function (text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    },
    focus: function () { view.focus(); },
    setTheme: function (t) {
      view.dispatch({ effects: themeCompartment.reconfigure(makeTheme(t === "dark")) });
    },
    undo: function () { undo(view); },
    redo: function () { redo(view); },
    getCursor: function () { return cursorInfo(view.state); },
    surround: function (before, after) {
      const s = view.state.selection.main;
      const sel = view.state.sliceDoc(s.from, s.to) || "文本";
      view.dispatch({
        changes: { from: s.from, to: s.to, insert: before + sel + after },
        selection: { anchor: s.from + before.length, head: s.from + before.length + sel.length },
      });
      view.focus();
    },
    linePrefix: function (prefix) {
      const s = view.state.selection.main;
      const line = view.state.doc.lineAt(s.from);
      view.dispatch({
        changes: { from: line.from, insert: prefix },
        selection: { anchor: s.from + prefix.length, head: s.to + prefix.length },
      });
      view.focus();
    },
    insertBlock: function (block) {
      const s = view.state.selection.main;
      const pad = s.from > 0 && view.state.doc.sliceString(s.from - 1, s.from) !== "\n" ? "\n" : "";
      const insert = pad + block;
      view.dispatch({
        changes: { from: s.from, to: s.to, insert: insert },
        selection: { anchor: s.from + insert.length },
      });
      view.focus();
    },
  };
}

window.MDEditer = { createEditor: createEditor };
