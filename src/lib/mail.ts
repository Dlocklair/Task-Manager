/**
 * Builds a mailto link that opens the person's own mail app with recipients,
 * a subject and a plain-text list. Long lists are cut short so the link still works.
 */
export function mailtoLink(to: string[], subject: string, lines: string[]): string {
  const MAX = 1800;
  let body = lines.join("\n");
  if (body.length > MAX) body = `${body.slice(0, MAX).replace(/\n[^\n]*$/, "")}\n…and more in the app.`;
  return `mailto:${to.map((a) => encodeURIComponent(a)).join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
