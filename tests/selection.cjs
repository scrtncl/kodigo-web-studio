const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const nodes = Object.fromEntries(['packageFinder', 'finderPages', 'finderGallery', 'finderFeature', 'finderResult', 'finderResultTitle', 'finderReason', 'finderContact'].map(id => [id, {
  value: '', hidden: true, events: {}, textContent: '', href: '',
  addEventListener(name, callback) { this.events[name] = callback; },
  reportValidity() { return ['finderPages','finderGallery','finderFeature'].every(key => nodes[key].value); },
  focus() { this.focused = true; }
}]));
const context = {
  document: { getElementById: id => nodes[id] || null, querySelector: () => null, querySelectorAll: () => [] },
  window: { location: { hash: '' }, addEventListener() {} }, Date
};
vm.runInNewContext(fs.readFileSync(path.join(root, 'script.js'), 'utf8'), context);
const cases = [
  ['1','no','basic','starter'], ['1','yes','basic','business'], ['5','no','basic','business'],
  ['8','no','basic','premium'], ['1','no','calculator','premium'], ['5','yes','booking','premium'],
  ['more','yes','basic','general'], ['1','no','payments','general'],
  ['unsure','yes','basic','undecided'], ['1','unsure','basic','undecided'], ['1','no','unsure','undecided']
];
for (const [pages, gallery, feature, plan] of cases) {
  nodes.finderPages.value = pages; nodes.finderGallery.value = gallery; nodes.finderFeature.value = feature;
  nodes.packageFinder.events.submit({ preventDefault() {} });
  assert.equal(nodes.finderContact.href, 'contact.html?plan=' + plan);
  assert.equal(nodes.finderResult.hidden, false);
  assert(nodes.finderResult.focused);
  assert(nodes.finderReason.textContent.length > 20);
  nodes.packageFinder.events.change();
  assert.equal(nodes.finderResult.hidden, true, 'changing answers must clear stale recommendations');
}
assert.equal(context.recommendPackage('invalid', 'no', 'basic'), null);
nodes.finderPages.value = '';
nodes.packageFinder.events.submit({ preventDefault() {} });
assert.equal(nodes.finderResult.hidden, true);
for (const file of fs.readdirSync(path.join(root, 'previews'))) {
  const html = fs.readFileSync(path.join(root, 'previews', file), 'utf8');
  assert(!/<script\b|\bon\w+\s*=|<form\b|<a\b|<link\b|<iframe\b/i.test(html), file + ': no live actions or external resources');
  assert(html.includes("default-src 'none'"));
  assert(!/\b(?:10|172|192\.168)\.\d+\./.test(html), file + ': no private network addresses');
  for (const control of html.matchAll(/<(?:button|input|select|textarea)\b[^>]*>/gi)) assert(/\bdisabled\b/.test(control[0]));
  assert(html.includes('Sample data only'));
}
console.log('PASS: recommendation paths, inquiry destinations, stale-result clearing, validation, focus, and static preview isolation.');
