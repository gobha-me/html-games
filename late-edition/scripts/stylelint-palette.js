import stylelint from 'stylelint';
import { PALETTE } from '../js/palette.js';

const tokens = new Map(Object.entries(PALETTE).map(([key, value]) =>
  [`--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value.toLowerCase()]));

// Stylelint overrides match files, not selectors. Run the actual core rules on a
// cloned AST without root token declarations, so the exception cannot leak into
// nested rules or an entire stylesheet. art.test.mjs checks root names/values.
const ruleName = 'late-edition/palette';
export default stylelint.createPlugin(ruleName, (enabled) => async (root, result) => {
  if (!enabled) return;
  const scoped = root.clone();
  scoped.walkRules((rule) => {
    if (rule.selector === ':root' && rule.parent.type === 'root') {
      for (const node of [...rule.nodes]) {
        if (node.type === 'decl' && tokens.get(node.prop) === node.value.toLowerCase()) node.remove();
      }
    }
  });
  await (await stylelint.rules['color-no-hex'])(true)(scoped, result);
  await (await stylelint.rules['function-disallowed-list'])(['rgb', 'rgba', 'hsl', 'hsla'])(scoped, result);
});
