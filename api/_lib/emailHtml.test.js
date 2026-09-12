const assert = require("assert");
const { sanitizeEmailHtml, resolveEmailHtml, escHtml } = require("./emailHtml");

assert.strictEqual(escHtml("<b>"), "&lt;b&gt;");

const dirty = `<h2 onclick="alert(1)">Hi</h2><script>evil()</script><p style="color:red;url(x)">Ok</p><a href="javascript:alert(1)">x</a><a href="https://ok.example">y</a><iframe src="x"></iframe>`;
const clean = sanitizeEmailHtml(dirty);
assert.ok(!/script/i.test(clean));
assert.ok(!/iframe/i.test(clean));
assert.ok(!/onclick/i.test(clean));
assert.ok(!/javascript:/i.test(clean));
assert.ok(clean.includes("<h2>"));
assert.ok(clean.includes("https://ok.example"));
assert.ok(!clean.includes("url("));

const fromText = resolveEmailHtml({ text: "Hello <world>" });
assert.ok(fromText.includes("&lt;world&gt;"));

console.log("emailHtml.test.js OK");
