// Run with: node tests/interface.cjs
// Source structure and behavior checks; these do not replace visual browser QA.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pages = fs.readdirSync(root).filter(file => file.endsWith('.html'));
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const attribute = (tag, name) => tag.match(new RegExp('\\b' + name + '="([^"]*)"'))?.[1];

for (const page of pages) {
  const html = read(page).replace(/<!--[\s\S]*?-->/g, '');
  const tags = [...html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)];
  const stack = [];
  for (const [markup, closing, name] of tags) {
    const tag = name.toLowerCase();
    if (voidTags.has(tag)) continue;
    if (closing) assert.equal(stack.pop(), tag, `${page}: mismatched closing ${markup}`);
    else stack.push(tag);
  }
  assert.deepEqual(stack, [], `${page}: unclosed tags`);
  const openings = tags.filter(tag => !tag[1]);
  assert.equal(openings.filter(tag => tag[2] === 'h1').length, 1, `${page}: expected one h1`);
  const mains = openings.filter(tag => tag[2] === 'main');
  assert.equal(mains.length, 1, `${page}: expected one main landmark`);
  assert.equal(attribute(mains[0][0], 'id'), 'main-content', `${page}: main target`);
  assert.equal(attribute(mains[0][0], 'tabindex'), '-1', `${page}: main must accept skip-link focus`);
  const ids = openings.map(tag => attribute(tag[0], 'id')).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, `${page}: duplicate IDs`);
  const skips = openings.filter(tag => tag[2] === 'a' && (attribute(tag[0], 'class') || '').split(' ').includes('skip-link'));
  assert.equal(skips.length, 1, `${page}: expected one skip link`);
  assert.equal(attribute(skips[0][0], 'href'), '#main-content', `${page}: skip-link destination`);
  if (page !== 'index.html') {
    const chapter = html.match(/<nav\b[^>]*class="chapter-nav"[^>]*>([\s\S]*?)<\/nav>/);
    assert(chapter, `${page}: missing chapter navigation`);
    const active = [...chapter[1].matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)];
    assert.equal(active.length, 1, `${page}: one current chapter required`);
    assert.equal(attribute(active[0][0], 'href'), page, `${page}: incorrect current chapter`);
  }
}
console.log(`PASS: ${pages.length} balanced pages, one h1/main, valid skip targets, unique IDs, current chapter links.`);

// Mobile summaries must retain all of the desktop comparison's terms.
const services = read('services.html');
const table = services.match(/<table class="table align-middle matrix-table">([\s\S]*?)<\/table>/)[1];
const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].slice(1).map(match =>
  [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(cell => cell[1].trim()));
const summaries = [...services.matchAll(/<article class="package-summary[^\"]*"[\s\S]*?<\/article>/g)];
assert.equal(summaries.length, 3);
summaries.forEach(([markup], index) => {
  const terms = [...markup.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)];
  assert.deepEqual(terms.map(term => [term[1], term[2]]), rows.map(row => [row[0], row[index + 1]]));
});
for (const page of pages) {
  const scripts = [...read(page).matchAll(/<script([^>]*)src="([^"]+)"[^>]*>/g)];
  assert.deepEqual(scripts.map(match => match[2]), ['vendor/bootstrap/bootstrap.bundle.min.js', 'script.js', 'motion.js']);
  assert(scripts.every(match => /\bdefer\b/.test(match[1])), `${page}: scripts must not block parsing`);
}
console.log('PASS: mobile comparison matches desktop; all pages use deferred local scripts in dependency order.');

function element() {
  const classes = new Set();
  return {
    attrs: {}, events: {}, value: '', textContent: '', checked: false,
    classList: {
      toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(name, callback) { this.events[name] = callback; }
  };
}
const code = read('script.js');
function setup(hash = '', includeCalculator = false) {
  const home = element(), about = element();
  home.classList.toggle('active', true);
  home.setAttribute('aria-current', 'location');
  const nodes = { about: { offsetTop: 1000 } };
  if (includeCalculator) {
    for (const id of ['qtyStarter', 'qtyBusiness', 'qtyPremium', 'incomeForm', 'totalCost', 'resRevenue', 'resDiscount', 'resCollected', 'resReferrals', 'resCosts', 'resNet', 'resYear', 'resBreak', 'calcStatus', 'launchDiscount', 'referralReward']) nodes[id] = element();
    nodes.qtyStarter.value = '2'; nodes.qtyBusiness.value = '1'; nodes.qtyPremium.value = '0';
  }
  const costs = [...read('financial.html').matchAll(/class="text-end cost">([^<]+)/g)].map(match => ({ textContent: match[1] }));
  const document = {
    documentElement: { scrollTop: 0 },
    getElementById: id => nodes[id] || null,
    querySelector(selector) {
      if (selector === '#mainNav .nav-link[href="#home"]') return home;
      if (selector === '#mainNav .nav-link[href="#about"]') return about;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '#mainNav .nav-link[href^="#"]') return [home, about];
      if (selector === '.cost') return costs;
      if (selector === '.results dd') return Object.entries(nodes).filter(([id]) => id.startsWith('res')).map(([, value]) => value);
      return [];
    }
  };
  const window = { location: { hash, search: '' }, scrollY: 0, events: {}, addEventListener(name, callback) { this.events[name] = callback; } };
  vm.runInNewContext(code, { document, window, URLSearchParams, Date });
  return { home, about, nodes, window };
}
function assertCurrent(current, other) {
  assert.equal(current.attrs['aria-current'], 'location');
  assert(current.classList.contains('active'));
  assert.equal(other.attrs['aria-current'], undefined);
  assert.equal(other.classList.contains('active'), false);
}
const nav = setup();
nav.about.events.click(); assertCurrent(nav.about, nav.home);
nav.home.events.click(); assertCurrent(nav.home, nav.about);
nav.window.scrollY = 900; nav.window.events.scroll(); assertCurrent(nav.about, nav.home);
nav.window.scrollY = 100; nav.window.events.scroll(); assertCurrent(nav.home, nav.about);
const deepLink = setup('#about'); assertCurrent(deepLink.about, deepLink.home);
console.log('PASS: Home/About click, scroll, and deep-link states keep active styling and aria-current synchronized.');

const { nodes } = setup('', true);
const peso = value => '\u20b1' + value.toLocaleString('en-PH');
assert.equal(nodes.totalCost.textContent, peso(12000));
assert.equal(nodes.resRevenue.textContent, peso(13500));
assert.equal(nodes.resNet.textContent, peso(12000));
assert.equal(nodes.resBreak.textContent, '1 month');
nodes.launchDiscount.checked = true;
nodes.referralReward.checked = true;
nodes.incomeForm.events.input();
assert.equal(nodes.resDiscount.textContent, peso(4050));
assert.equal(nodes.resReferrals.textContent, peso(945));
assert.equal(nodes.resNet.textContent, peso(7005));
assert.equal(nodes.resBreak.textContent, '2 months');
nodes.qtyStarter.value = '5';
nodes.incomeForm.events.input();
assert(nodes.calcStatus.textContent.includes('five projects'));
assert.equal(nodes.resNet.textContent, '\u2014');
nodes.qtyStarter.value = nodes.qtyBusiness.value = '0';
nodes.incomeForm.events.input();
assert.equal(nodes.resNet.textContent, peso(-1500));
assert.equal(nodes.resBreak.textContent, 'Not reached at this volume');
assert.equal(nodes.calcStatus.textContent, '');
console.log('PASS: calculator startup sum, baseline, launch/referral costs, launch cap, and zero-sales recovery.');
