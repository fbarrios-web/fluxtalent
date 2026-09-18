import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export interface PlaceholderEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholders: Record<string, string>;
  placeholder?: string;
  className?: string;
  singleLine?: boolean;
  showInsertButtons?: boolean;
  insertLabel?: string;
  "aria-label"?: string;
}

const chipClass =
  "inline-flex items-center rounded px-1.5 py-0.5 text-sm bg-muted text-muted-foreground align-middle select-none cursor-default mx-0.5";

function rawToHtml(raw: string, placeholders: Record<string, string>) {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      const label = placeholders[key] || key;
      return `<span contenteditable="false" data-placeholder="${key}" class="${chipClass}">${label}</span>`;
    });
}

function htmlToRaw(html: string, singleLine: boolean) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    const el = node as HTMLElement;
    if (el.tagName === "BR") return "\n";
    if (el.dataset?.placeholder) return `{{${el.dataset.placeholder}}}`;
    return Array.from(node.childNodes).map(walk).join("");
  }
  let raw = walk(tmp);
  if (singleLine) raw = raw.replace(/\n/g, " ");
  return raw;
}

export const PlaceholderEditor = forwardRef<
  { insertPlaceholder: (key: string) => void },
  PlaceholderEditorProps
>(function PlaceholderEditor(props, ref) {
  const {
    value,
    onChange,
    placeholders,
    placeholder,
    className,
    singleLine = false,
    showInsertButtons,
    insertLabel,
    "aria-label": ariaLabel,
  } = props;
  const t = useT();
  const editorRef = useRef<HTMLDivElement>(null);

  const syncRaw = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const raw = htmlToRaw(editor.innerHTML, singleLine);
    onChange(raw);
  };

  const insertPlaceholder = (key: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const raw = htmlToRaw(editor.innerHTML, singleLine) + `{{${key}}}`;
      editor.innerHTML = rawToHtml(raw, placeholders);
      syncRaw();
      return;
    }
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    span.contentEditable = "false";
    span.dataset.placeholder = key;
    span.className = chipClass;
    span.textContent = placeholders[key] || key;
    range.deleteContents();
    range.insertNode(span);
    range.setStartAfter(span);
    range.setEndAfter(span);
    sel.removeAllRanges();
    sel.addRange(range);
    editor.normalize();
    syncRaw();
  };

  useImperativeHandle(ref, () => ({ insertPlaceholder }));

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const currentRaw = htmlToRaw(editor.innerHTML, singleLine);
    if (currentRaw === value) return;
    editor.innerHTML = rawToHtml(value, placeholders);
  }, [value, placeholders, singleLine]);

  const insertHtmlAtCursor = (html: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      editor.innerHTML += html;
      editor.normalize();
      syncRaw();
      return;
    }
    const range = sel.getRangeAt(0);
    const frag = range.createContextualFragment(html);
    range.deleteContents();
    range.insertNode(frag);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    editor.normalize();
    syncRaw();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && singleLine) {
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" && !singleLine) {
      e.preventDefault();
      insertHtmlAtCursor("<br>");
      return;
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    const sanitized = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    insertHtmlAtCursor(sanitized);
  };

  return (
    <div className="space-y-2">
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline={!singleLine}
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        onInput={syncRaw}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={cn(
          "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          "outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
          singleLine && "min-h-[2.5rem] whitespace-nowrap",
          className
        )}
        data-placeholder={placeholder}
      />
      {showInsertButtons && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{insertLabel ?? t("Insertar dato:")}</span>
          {Object.entries(placeholders).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => insertPlaceholder(key)}
              className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs hover:bg-muted"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
