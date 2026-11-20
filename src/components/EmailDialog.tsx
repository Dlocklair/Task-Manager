import { useEffect, useMemo, useState } from "react";
import { Copy, Download, FileText, Link2, Mail, Share2 } from "lucide-react";
import { mailtoLink } from "../lib/mail";
import { fileName, outlineDocx, outlineText, type Outline } from "../lib/outline";
import { useStore } from "../lib/store";
import { Modal } from "./ui";

/**
 * Send a list of tasks by email. The email body is an easy-to-read outline. A Word document of the same
 * outline can go with it: on a phone or tablet the share sheet attaches it to a new email; on a computer
 * it downloads, ready to attach.
 */
export function EmailDialog({ to, outline: base, personId, onClose }: { to: string[]; outline: Outline; personId?: string; onClose(): void }) {
  const s = useStore();
  const link = personId ? s.shareLinkFor(personId) : undefined;
  const linkUrl = link ? s.shareUrl(link) : null;
  const canLink = !!personId && !!s.api.createShareLink;
  const [making, setMaking] = useState(false);
  // With an update link, the email ends with it so the person can mark tasks done and add notes.
  const outline = useMemo<Outline>(
    () => (linkUrl ? { ...base, outro: [...base.outro, `Update these tasks (mark them done, add a note): ${linkUrl}`] } : base),
    [base, linkUrl],
  );
  const text = useMemo(() => outlineText(outline), [outline]);
  const [file, setFile] = useState<File | null>(null);
  const [view, setView] = useState(false);
  // Made as soon as the dialog opens, so Share can open the share sheet straight from the tap.
  useEffect(() => {
    let live = true;
    outlineDocx(outline)
      .then((blob) => live && setFile(new File([blob], fileName(outline.title), { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })))
      .catch(() => live && s.toast("The Word document could not be made."));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outline]);

  const canShare = !!file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  const download = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: outline.title, text });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) s.toast("Sharing did not work here. Download the Word document instead.");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      s.toast("Copied. Paste it into any email or message.");
    } catch {
      s.toast("Copying is blocked in this browser.");
    }
  };

  return (
    <Modal title="Email tasks" onClose={onClose}>
      <div className="form email-dialog">
        <p className="field-hint">
          {to.length ? <>To <strong>{to.join(", ")}</strong>. </> : null}
          The email lists each task as a numbered outline with its due date, priority, details and subtasks.
        </p>

        {canLink && !linkUrl && (
          <div className="email-link-offer">
            <span>Add an update link so they can mark tasks done and add notes. Their changes show up here.</span>
            <button
              type="button"
              className="btn small"
              disabled={making}
              onClick={async () => {
                setMaking(true);
                await s.createShareLink(personId!);
                setMaking(false);
              }}
            >
              <Link2 size={15} />{making ? "Making link…" : "Add update link"}
            </button>
          </div>
        )}
        {linkUrl && <p className="field-hint email-link-on"><Link2 size={14} /> The email includes their update link.</p>}

        <div className="email-actions">
          <a className="btn primary" href={mailtoLink(to, outline.title, text)} onClick={() => window.setTimeout(onClose, 300)}>
            <Mail size={16} />Open in my email
          </a>
          {canShare && (
            <button type="button" className="btn" onClick={() => void share()}>
              <Share2 size={16} />Send Word document…
            </button>
          )}
          <button type="button" className="btn" disabled={!file} onClick={download}>
            <Download size={16} />Download Word document
          </button>
          <button type="button" className="btn quiet" onClick={() => void copy()}>
            <Copy size={16} />Copy text
          </button>
        </div>

        <p className="field-hint">
          {canShare
            ? "Send Word document opens the share sheet. Pick Mail and the document is attached; add the address there."
            : "Email links cannot attach files, so download the Word document and attach it to the email that opens."}
        </p>

        <button type="button" className="btn quiet small email-preview-toggle" aria-expanded={view} onClick={() => setView(!view)}>
          <FileText size={15} />{view ? "Hide preview" : "Preview the email"}
        </button>
        {view && <pre className="email-preview">{text}</pre>}
      </div>
    </Modal>
  );
}
