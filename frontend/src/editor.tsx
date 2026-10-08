import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import type { Language } from "../../shared/types";
(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};
loader.config({ monaco });
export default function CodeEditor({
  language,
  value,
  onChange,
  disabled,
}: {
  language: Language;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={{ cpp17: "cpp", python3: "python", java17: "java" }[language]}
      value={value}
      onChange={(v) => onChange(v || "")}
      loading={<div className="loading">Opening your editor…</div>}
      options={{
        fontSize: 14,
        fontFamily: "Consolas, monospace",
        minimap: { enabled: false },
        padding: { top: 20 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        readOnly: disabled,
        tabSize: 4,
        wordWrap: "on",
      }}
    />
  );
}
