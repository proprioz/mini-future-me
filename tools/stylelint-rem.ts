// Stylelint rule of the project (.stylelintrc.json): UI sizes in rem, never in px, so the interface
// scales with the screen like the 3D scene (see `html` in src/style.css). Allowed: thin lines of 1 or
// 2 px, and 999px, the radius of a pill.
import stylelint from 'stylelint';

const { createPlugin, utils } = stylelint;

const ruleName = 'mini-future-me/rem-only';
const messages = utils.ruleMessages(ruleName, {
  rejected: (value: string) => `${value}: use rem (px only for 1–2px lines and the 999px of a pill)`,
});

const PX = /(?<![\w.-])(-?\d*\.?\d+)px\b/g;

const allowed = (px: number, prop: string) => Math.abs(px) <= 2 || (px === 999 && prop.endsWith('radius'));

const rule: stylelint.Rule = (enabled) => (root, result) => {
  if (!enabled) return;
  root.walkDecls((decl) => {
    for (const match of decl.value.replace(/url\([^)]*\)/g, '').matchAll(PX)) {
      if (allowed(Number(match[1]), decl.prop)) continue;
      utils.report({ ruleName, result, node: decl, word: match[0], message: messages.rejected(match[0]) });
    }
  });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default createPlugin(ruleName, rule);
