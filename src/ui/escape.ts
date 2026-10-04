/** Escape untrusted text for quoted HTML attributes and text nodes. Never accept HTML. */
export function escapeText(value: unknown): string {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]!);
}
