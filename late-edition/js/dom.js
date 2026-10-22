// Small keyed view descriptions: dynamic copy is always text, never HTML.
export function h(tag, className, content = [], attrs = {}, key = null) {
  return { tag, className, content, attrs, key };
}

const previousAttrs = new WeakMap();
const nodeKeys = new WeakMap();

// Replacing identical text still invalidates paper paint/blend regions in Blink.
// Keep the actual text node even when its copy changes; UI ticks must be silent
// for unchanged values, including empty strings (PR 101).
export function setText(node, value) {
  const text = String(value);
  if (node.textContent === text) return;
  if (node.childNodes.length === 1 && node.firstChild.nodeType === Node.TEXT_NODE) node.firstChild.data = text;
  else node.textContent = text;
}

// Only insert/move/remove changed keys. In particular, a tick must not detach a
// focused/pressed button just because its countdown or progress text changed.
export function reconcile(parent, views) {
  const existing = new Map(Array.from(parent.children, (node) => [nodeKeys.get(node), node]));
  // Remove obsolete siblings first so a surviving focused row need not move
  // merely because a preceding lead expired. Its key and order still match.
  const wanted = new Set(views.map((view, index) => view.key ?? index));
  for (const [key, node] of existing) {
    if (!wanted.has(key)) {
      node.remove();
      existing.delete(key);
    }
  }
  let cursor = parent.firstElementChild;
  views.forEach((view, index) => {
    const key = view.key ?? index;
    let node = existing.get(key);
    if (node && node.localName !== view.tag) {
      if (cursor === node) cursor = node.nextElementSibling;
      node.remove();
      node = null;
    }
    if (!node) node = document.createElement(view.tag);
    existing.delete(key);
    nodeKeys.set(node, key);
    if (node.className !== view.className) node.className = view.className;
    const attrs = { ...view.attrs };
    if (view.tag === 'button') attrs.type = 'button';
    for (const name of Object.keys(previousAttrs.get(node) ?? {})) {
      if (!(name in attrs)) node.removeAttribute(name);
    }
    for (const [name, value] of Object.entries(attrs)) {
      if (node.getAttribute(name) !== String(value)) node.setAttribute(name, value);
    }
    previousAttrs.set(node, attrs);
    if (Array.isArray(view.content)) {
      reconcile(node, view.content);
    } else {
      setText(node, view.content);
    }
    if (node !== cursor) parent.insertBefore(node, cursor);
    cursor = node.nextElementSibling;
  });
  for (const node of existing.values()) node.remove();
}
