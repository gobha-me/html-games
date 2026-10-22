import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('../', import.meta.url));

function run(command, args, input) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    input,
    timeout: 30_000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `Process killed: ${result.signal}`);
  return result;
}

function lint(tool, args, source) {
  return run(process.execPath, [path.join(root, 'node_modules/.bin', tool), ...args], source);
}

function fixture(name) {
  return readFileSync(path.join(root, 'tests/fixtures', name), 'utf8');
}

const jsCases = [
  ['undefined-variable.js', 'no-undef'],
  ['loose-equality.js', 'eqeqeq'],
  ['unused-variable.js', 'no-unused-vars'],
];

for (const [name, rule] of jsCases) {
  test(`ESLint rejects ${name} with ${rule} and a failing exit code`, () => {
    // Use the production browser config without unignoring the fixture directory.
    const args = ['--stdin', '--stdin-filename', 'js/lint-fixture.js', '--format', 'json'];
    const result = lint('eslint', args, fixture(name));
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const messages = JSON.parse(result.stdout).flatMap((entry) => entry.messages);
    assert.deepEqual(messages.map((message) => message.ruleId), [rule], result.stdout);
    assert.equal(messages[0].severity, 2);
  });
}

test('ESLint rejects implicit globals in classic browser scripts', async () => {
  // ES module declarations cannot create window globals. Keep production modules
  // as modules and exercise this rule using a classic script with the same rules.
  const eslint = new ESLint({
    cwd: root,
    overrideConfig: { languageOptions: { sourceType: 'script' } },
  });
  const [result] = await eslint.lintText(fixture('implicit-global.js'), {
    filePath: 'js/lint-fixture.js',
  });
  assert.equal(result.errorCount, 1);
  assert.deepEqual(result.messages.map((message) => message.ruleId), ['no-implicit-globals']);
});

test('stylelint rejects invalid CSS hex and returns a failing exit code', () => {
  const result = lint('stylelint', [
    '--stdin-filename', 'css/lint-fixture.css', '--formatter', 'json',
  ], fixture('invalid-color.css'));
  assert.equal(result.status, 2, result.stdout + result.stderr);
  // Stylelint 17 writes diagnostics to stderr, reserving stdout for fixed code.
  const warnings = JSON.parse(result.stderr).flatMap((entry) => entry.warnings);
  assert.deepEqual(warnings.map((warning) => warning.rule), ['declaration-property-value-no-unknown', 'color-no-hex']);
  assert.equal(warnings[0].severity, 'error');
  assert.ok(warnings[0].text.includes('#zzzzzz'), result.stderr);
});

function validateHtml(source, expectedRule) {
  const result = lint('html-validate', [
    '--stdin', '--stdin-filename', 'index.html', '--formatter', 'json',
  ], source);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const messages = JSON.parse(result.stdout).flatMap((entry) => entry.messages);
  assert.ok(messages.some((message) => message.ruleId === expectedRule && message.severity === 2),
    result.stdout);
  return messages;
}

for (const [name, rule] of [
  ['duplicate-id.html', 'no-dup-id'],
  ['whitespace-id.html', 'valid-id'],
]) {
  test(`html-validate rejects ${name} with ${rule} and a failing exit code`, () => {
    validateHtml(fixture(name), rule);
  });
}

test('restoring the malformed projection ID in the real page fails validation', () => {
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  const broken = html.replace('id="paper-projected-readers"', 'id="paper-projected- readers"');
  assert.notEqual(broken, html, 'The projection element must exist in the real page');
  const messages = validateHtml(broken, 'valid-id');
  assert.ok(messages.some((message) => message.ruleId === 'valid-id'
    && message.message.includes('paper-projected- readers')));
});

test('normal ESLint discovery excludes every deliberately bad JS fixture', async () => {
  const eslint = new ESLint({ cwd: root });
  for (const name of [...jsCases.map(([name]) => name), 'implicit-global.js']) {
    assert.equal(await eslint.isPathIgnored(path.join(root, 'tests/fixtures', name)), true, name);
  }
});

for (const script of ['lint:js', 'lint:css', 'lint:html']) {
  test(`real sources pass npm run ${script} with bad fixtures present`, () => {
    const result = run('npm', ['run', script]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
