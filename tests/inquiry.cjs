// Run with: node tests/inquiry.cjs
// Lightweight DOM doubles exercise form behavior without sending email.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
function setup(search = '', clipboard) {
  let focused;
  const nodes = {};
  for (const id of ['contactForm','cPlan','cMessage','cName','cEmail','cBusiness','cLaunch','cFeatures','formStatus','copyInquiry','manualCopy','inquiryText','navMenu']) {
    const classes = new Set();
    nodes[id] = {
      value: id === 'cPlan' ? 'general' : '', textContent: '', hidden: true, attrs: {}, events: {},
      classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x),
        toggle: (x, on) => on ? classes.add(x) : classes.delete(x) },
      addEventListener(type, callback) { this.events[type] = callback; },
      setAttribute(key, value) { this.attrs[key] = value; },
      focus() { focused = id; }, select() { this.selected = true; },
      checkValidity() { return id === 'cEmail' ? /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.value) : this.value.length > 0; }
    };
  }
  const document = { body: { hasAttribute: () => false }, getElementById: id => nodes[id] || null,
    querySelector: () => null, querySelectorAll: () => [] };
  let collapsed = 0;
  const bootstrap = { Collapse: { getOrCreateInstance: () => ({ hide() { collapsed++; } }) } };
  const window = { location: { search, hash: '', href: '' }, addEventListener() {}, bootstrap };
  vm.runInNewContext(code, { document, window, navigator: { clipboard }, URLSearchParams, Date, bootstrap });
  return { nodes, window, focused: () => focused, collapsed: () => collapsed };
}
function fill(nodes) {
  nodes.cName.value = 'Sample & Co'; nodes.cEmail.value = 'test@example.com';
  nodes.cMessage.value = 'A small website for a local bakery.';
}
function submit(nodes) { nodes.contactForm.events.submit({ preventDefault() {} }); }
async function main() {
  const undecided = setup('?plan=undecided');
  assert.equal(undecided.nodes.cPlan.value, 'undecided');
  assert(undecided.nodes.cMessage.value.includes('help choosing'));
  fill(undecided.nodes);
  undecided.nodes.cBusiness.value = 'Bakery & cafe';
  undecided.nodes.cLaunch.value = '2027-03-01';
  undecided.nodes.cFeatures.value = 'Menu, gallery & inquiry form';
  submit(undecided.nodes);
  const detailedBody = new URL(undecided.window.location.href).searchParams.get('body');
  assert(detailedBody.includes('Business type: Bakery & cafe'));
  assert(detailedBody.includes('Preferred launch date: 2027-03-01'));
  assert(detailedBody.includes('Required features: Menu, gallery & inquiry form'));
  assert(detailedBody.includes('Help choosing a package'));
  for (const plan of ['starter','business','premium']) {
    const {nodes} = setup('?plan=' + plan);
    assert.equal(nodes.cPlan.value, plan);
    assert(nodes.cMessage.value.includes('package'));
  }
  assert.equal(setup('?plan=unknown').nodes.cPlan.value, 'general');
  const {nodes, window, focused, collapsed} = setup('?plan=starter');
  nodes.cMessage.value += 'I need a menu and photos.';
  nodes.cPlan.value = 'premium'; nodes.cPlan.events.change();
  assert(nodes.cMessage.value.includes('Premium Site'));
  assert(nodes.cMessage.value.endsWith('I need a menu and photos.'));
  assert(!nodes.cMessage.value.includes('Starter Page'));
  nodes.cMessage.value = 'Entirely custom wording stays untouched.';
  nodes.cPlan.value = 'business'; nodes.cPlan.events.change();
  assert.equal(nodes.cMessage.value, 'Entirely custom wording stays untouched.');
  submit(nodes); assert.equal(focused(), 'cName'); assert.equal(window.location.href, '');
  nodes.cName.value = '   '; submit(nodes); assert.equal(nodes.cName.attrs['aria-invalid'], 'true');
  fill(nodes); nodes.cEmail.value = 'invalid'; submit(nodes); assert.equal(focused(), 'cEmail');
  nodes.cEmail.value = 'test@example.com';
  nodes.contactForm.events.input({ target: nodes.cEmail });
  assert.equal(nodes.cEmail.attrs['aria-invalid'], 'false');
  nodes.cMessage.value = '    short   '; submit(nodes); assert.equal(focused(), 'cMessage');
  fill(nodes); submit(nodes);
  const mail = new URL(window.location.href);
  assert.equal(mail.protocol, 'mailto:');
  assert(mail.searchParams.get('subject').includes('Business Site'));
  assert(mail.searchParams.get('body').includes('Sample & Co'));
  nodes.navMenu.classList.add('show');
  nodes.navMenu.events.click({ target: { closest: () => ({}) } }); assert.equal(collapsed(), 1);
  nodes.navMenu.events.click({ target: { closest: () => null } }); assert.equal(collapsed(), 1);
  // Missing clipboard and denied access both expose selectable plain text.
  for (const clipboard of [undefined, { writeText: async () => { throw Error('Denied'); } }]) {
    const t = setup('', clipboard); fill(t.nodes);
    await t.nodes.copyInquiry.events.click();
    assert.equal(t.nodes.manualCopy.hidden, false); assert.equal(t.nodes.inquiryText.selected, true);
    assert(t.nodes.inquiryText.value.includes('To: enriquez.carlbenedict@student.auf.edu.ph'));
    assert.equal(t.nodes.copyInquiry.disabled, false); assert.equal(t.window.location.href, '');
  }
  let copied;
  const success = setup('', { writeText: async text => { copied = text; } }); fill(success.nodes);
  await success.nodes.copyInquiry.events.click(); assert(copied.includes('local bakery'));
  assert(success.nodes.formStatus.textContent.includes('Nothing has been sent'));
  assert.equal(success.nodes.manualCopy.hidden, true);
  // A late clipboard response must not display stale confirmation after an edit.
  let finish;
  const race = setup('', { writeText: () => new Promise(resolve => { finish = resolve; }) }); fill(race.nodes);
  race.nodes.copyInquiry.textContent = 'Copy inquiry instead';
  const pending = race.nodes.copyInquiry.events.click();
  assert.equal(race.nodes.copyInquiry.textContent, 'Copying inquiry...');
  assert.equal(race.nodes.copyInquiry.attrs['aria-busy'], 'true');
  assert.equal(race.nodes.copyInquiry.disabled, true);
  race.nodes.cMessage.value += ' New details';
  race.nodes.contactForm.events.input({ target: race.nodes.cMessage }); finish(); await pending;
  assert(race.nodes.formStatus.classList.contains('d-none'));
  assert.equal(race.nodes.copyInquiry.textContent, 'Copy inquiry instead');
  assert.equal(race.nodes.copyInquiry.attrs['aria-busy'], 'false');
  assert.equal(race.nodes.copyInquiry.disabled, false);
  console.log('PASS: package autofill/switching, preserved custom text, validation/focus, email encoding, clipboard success/fallback/race, mobile menu close.');
  for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root,file), 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(ids.length, new Set(ids).size, file + ': duplicate ID');
    for (const match of html.matchAll(/aria-describedby="([^"]+)"/g)) {
      for (const id of match[1].split(' ')) assert(ids.includes(id), file + ': missing description ' + id);
    }
    for (const match of html.matchAll(/(?:href|src|data-img)="([^"]+)"/g)) {
      const url = match[1]; if (/^(https?:|mailto:|tel:|data:)/.test(url)) continue;
      const [name, hash] = url.split('#'); const target = name.split('?')[0] || file;
      assert(fs.existsSync(path.join(root,target)), file + ': missing ' + target);
      if (hash && target.endsWith('.html')) assert(fs.readFileSync(path.join(root,target),'utf8').includes('id="'+hash+'"'));
    }
  }
  console.log('PASS: all eight pages have valid local references, unique IDs, and accessible description targets.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
