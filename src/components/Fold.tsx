import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * A section that starts folded to save space. The header shows the name, a count and a one-line
 * preview; clicking it opens the section so you can read or enter data. compact is the smaller
 * version used inside an opened subtask.
 */
export function Fold({
  title,
  count,
  preview,
  empty,
  open: forceOpen,
  compact = false,
  children,
}: {
  title: string;
  count?: number;
  preview?: string;
  empty?: string;
  /** When this turns true the section opens (for example, an unsaved note draft). */
  open?: boolean;
  compact?: boolean;
  children: (opened: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(!!forceOpen);
  // Becomes true only when the person opens it, so an empty field can go straight into editing.
  const [byClick, setByClick] = useState(false);
  const id = useId();

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const peek = preview?.trim();
  return (
    <section className={"fold" + (open ? " is-open" : "") + (compact ? " compact" : "")}>
      <button
        type="button"
        className="fold-head"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          setByClick(!open);
        }}
      >
        <ChevronRight size={compact ? 15 : 16} className="fold-chev" aria-hidden="true" />
        <span className="fold-title">{title}</span>
        {count !== undefined && count > 0 && <span className="fold-count">{count}</span>}
        {!open && <span className={"fold-peek" + (peek ? "" : " is-empty")}>{peek || empty}</span>}
      </button>
      {open && (
        <div className="fold-body" id={id}>
          {children(byClick)}
        </div>
      )}
    </section>
  );
}

/** The first line of formatted text with its list marks removed, for a folded preview. */
export function firstLine(text: string | null | undefined): string {
  const line = (text ?? "").split("\n").find((l) => l.trim()) ?? "";
  return line.trim().replace(/^([-*•]|\d{1,3}[.)]) /, "");
}
