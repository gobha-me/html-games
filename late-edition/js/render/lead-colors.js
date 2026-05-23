// Late Edition — single source of truth for lead-flavor colors.
//
// 1.3.1: the v1.3.0 playtest reported lead markers reading as architectural
// detail (a red pip on the Darkroom roof). The fix re-skinned the marker
// as a hovering flavor-colored diamond; this file collapses the duplicated
// flavor→color maps that lived in js/render/renderer.js (LEAD_FLAVOR_COLOR
// as 0x ints) and js/hud.js Minimap (MINIMAP_LEAD_COLOR as '#' hex strings)
// into one definition. Both callers now import from here.
//
// Hex stock: muted noir palette tuned against --paper fog (#c8c4bc).

export const LEAD_FLAVOR_HEX = {
  vice:     '#8a3a4a',  // wine
  violence: '#4a3a3a',  // dried blood
  money:    '#6a7a4a',  // tarnished olive
  labor:    '#4a5a7a',  // worker blue
};

const DEFAULT_HEX = '#6a6a6a';

export function leadColorHex(flavor) {
  return LEAD_FLAVOR_HEX[flavor] ?? DEFAULT_HEX;
}

// THREE.js consumers want 0xRRGGBB ints. Trivial conversion; co-located so
// renderer.js doesn't need to do the parse itself.
export function leadColorInt(flavor) {
  return parseInt(leadColorHex(flavor).slice(1), 16);
}
