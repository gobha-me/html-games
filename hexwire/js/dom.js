// Tiny hyperscript helper. h(tag, props, ...children) -> HTMLElement.
// props: style (string), class, html (innerHTML), on<Event> handlers, value, or plain attrs.
export function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'style') e.setAttribute('style', v);
      else if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'value') e.value = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    }
  }
  add(e, kids);
  return e;
}

function add(parent, kids) {
  for (const kid of kids) {
    if (kid == null || kid === false || kid === true) continue;
    if (Array.isArray(kid)) { add(parent, kid); continue; }
    parent.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
}

// Clear a node's children.
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
