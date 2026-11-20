/**
 * Builds a mailto link that opens the person's own mail app with recipients, a subject and a plain-text body.
 * Very long bodies are cut short so the link still opens; the Word document carries the full list.
 */
export function mailtoLink(to: string[], subject: string, body: string): string {
  const MAX = 6000;
  let text = body;
  if (text.length > MAX) text = `${text.slice(0, MAX).replace(/\n[^\n]*$/, "")}\n\n…and more. The Word document has the full list.`;
  return `mailto:${to.map((a) => encodeURIComponent(a)).join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text.replace(/\n/g, "\r\n"))}`;
}
