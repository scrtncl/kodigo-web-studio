const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
function setup(reduced = false) {
  let doc;
  const element = () => ({ hidden: false, attrs: {}, events: {}, tagName: 'BUTTON',
    addEventListener(name, fn) { this.events[name] = fn; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    getAttribute(name) { return this.attrs[name]; },
    focus() { doc.activeElement = this; }, contains(node) { return this === node; }
  });
  const slides = ['Dashboard', 'Diagnosis', 'Devices'].map(title => {
    const el = element(); el.attrs['data-slide-title'] = title; el.animations = [];
    el.animate = () => { const a = { cancel() { this.cancelled = true; } }; el.animations.push(a); return a; };
    return el;
  });
  const indicators = slides.map(element), prev = element(), next = element(), status = element(), controls = element(), stage = element(), carousel = element(), preference = element();
  preference.matches = reduced; controls.hidden = true;
  carousel.querySelectorAll = selector => selector === '[data-carousel-slide]' ? slides : indicators;
  carousel.querySelector = selector => ({ '[data-carousel-prev]': prev, '[data-carousel-next]': next, '[data-carousel-status]': status, '[data-carousel-controls]': controls, '.carousel-stage': stage })[selector];
  doc = { activeElement: null, getElementById: id => id === 'networkCarousel' ? carousel : null, querySelector: () => null, querySelectorAll: () => [] };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8'), {
    document: doc, window: { location: { hash: '' }, addEventListener() {}, matchMedia: () => preference }, Date
  });
  return { slides, indicators, prev, next, status, controls, stage, carousel, preference, doc };
}
const s = setup();
const current = () => s.slides.findIndex(slide => !slide.hidden);
assert.equal(current(), 0); assert.equal(s.controls.hidden, false);
s.prev.events.click(); assert.equal(current(), 2);
s.next.events.click(); assert.equal(current(), 0);
s.indicators[1].events.click(); assert.equal(current(), 1);
assert.equal(s.indicators[1].attrs['aria-current'], 'true');
assert.equal(s.indicators[0].attrs['aria-current'], undefined);
assert.equal(s.status.textContent, 'Slide 2 of 3: Diagnosis');
s.carousel.events.keydown({ key: 'ArrowRight', target: s.indicators[1], preventDefault() {} });
assert.equal(current(), 2); assert.equal(s.doc.activeElement, s.indicators[2]);
s.carousel.events.keydown({ key: 'Home', target: s.next, preventDefault() {} }); assert.equal(current(), 0);
s.doc.activeElement = s.slides[0];
s.next.events.click(); assert.equal(s.doc.activeElement, s.indicators[1]);
s.stage.events.pointerdown({ pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 40 });
s.stage.events.pointerup({ pointerId: 1, clientX: 100, clientY: 45 }); assert.equal(current(), 2);
let blockedSwipeClick = false;
s.stage.events.click({ detail: 1, preventDefault() { blockedSwipeClick = true; }, stopPropagation() {} });
assert(blockedSwipeClick, 'swiping must not also open the screenshot modal');
s.stage.events.pointerdown({ pointerType: 'touch', pointerId: 2, clientX: 200, clientY: 40 });
s.stage.events.pointerup({ pointerId: 2, clientX: 195, clientY: 200 }); assert.equal(current(), 2);
s.preference.matches = true; s.preference.events.change();
assert(s.slides[2].animations.at(-1).cancelled);
const quiet = setup(true); quiet.next.events.click(); assert.equal(quiet.slides[1].animations.length, 0);
console.log('PASS: carousel wrapping, indicators, keyboard navigation, focus safety, swipe direction, and reduced motion.');
const portfolio = fs.readFileSync(path.join(__dirname, '..', 'portfolio.html'), 'utf8');
const gallery = portfolio.slice(portfolio.indexOf('id="networkCarousel"'), portfolio.indexOf('<!-- Skills demonstration banner -->'));
assert.equal((gallery.match(/data-carousel-slide\b/g) || []).length, 7);
assert.equal((gallery.match(/data-carousel-index=/g) || []).length, 7);
assert(!gallery.includes('<iframe'));
for (const name of ['network-doctor','network-map','router-center','device-manager','ai-technician','settings','help']) {
  assert(gallery.includes('src="images/' + name + '.png"'));
  assert(fs.existsSync(path.join(__dirname, '..', 'images', name + '.png')));
}
console.log('PASS: all seven supplied screenshots replace the embedded previews.');
