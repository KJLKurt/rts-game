/** Refresh live readouts without replacing focused controls or scrolled queues. */
export function updateLiveHTML(root: HTMLElement, html: string): void {
  const focused =
    document.activeElement instanceof HTMLElement &&
    root.contains(document.activeElement)
      ? document.activeElement
      : null;
  const template = document.createElement("template");
  template.innerHTML = html;
  reconcile(root, template.content);
  if (focused?.isConnected && document.activeElement !== focused)
    focused.focus({ preventScroll: true });
}
/** Match controls by their action target, never their changing label/count.
 * Different actions/targets intentionally get a new node rather than retargeting a press.
 */
export function liveElementKey(element: Pick<Element, "getAttribute">): string | null {
  const explicit = element.getAttribute("data-live-key");
  if (explicit !== null) return JSON.stringify(["live", explicit]);
  const action = element.getAttribute("data-action");
  return action === null ? null : JSON.stringify(["action", action, element.getAttribute("data-id") ?? ""]);
}
function key(node: Node): string | null {
  return node instanceof Element ? liveElementKey(node) : null;
}
function compatible(a: Node, b: Node): boolean {
  return (
    a.nodeType === b.nodeType &&
    (!(a instanceof Element) ||
      (b instanceof Element && a.tagName === b.tagName))
  );
}
function reconcile(current: Node, desired: Node): void {
  const existing = [...current.childNodes];
  const keyed = new Map(
    existing
      .filter((node) => key(node) !== null)
      .map((node) => [key(node), node]),
  );
  const used = new Set<Node>();
  let cursor = current.firstChild;
  for (const wanted of [...desired.childNodes]) {
    const wantedKey = key(wanted);
    let node: Node | null | undefined =
      wantedKey !== null ? keyed.get(wantedKey) : cursor;
    if (
      !node ||
      used.has(node) ||
      !compatible(node, wanted) ||
      key(node) !== wantedKey
    )
      node = wanted.cloneNode(true);
    if (node !== cursor) current.insertBefore(node, cursor);
    used.add(node);
    if (node instanceof Element && wanted instanceof Element) {
      for (const attribute of [...node.attributes])
        if (!wanted.hasAttribute(attribute.name))
          node.removeAttribute(attribute.name);
      for (const attribute of [...wanted.attributes])
        if (node.getAttribute(attribute.name) !== attribute.value)
          node.setAttribute(attribute.name, attribute.value);
      reconcile(node, wanted);
    } else if (node.nodeValue !== wanted.nodeValue)
      node.nodeValue = wanted.nodeValue;
    cursor = node.nextSibling;
  }
  for (const node of existing) if (!used.has(node)) current.removeChild(node);
}
