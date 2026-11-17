// Run with: node tests/motion.cjs
// DOM doubles check lifecycle and progressive enhancement, not visual timing.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'motion.js'), 'utf8');

function target() {
  const listeners = new Map(), classes = new Set();
  return {
    attrs: {}, textContent: '', hidden: true,
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      toggle(name, on) { on ? classes.add(name) : classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    setAttribute(name, value) { this.attrs[name] = value; },
    getAttribute(name) { return this.attrs[name] ?? null; },
    addEventListener(name, fn, options) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push({ fn, once: options?.once });
    },
    emit(name, event = {}) {
      for (const item of [...(listeners.get(name) || [])]) {
        item.fn(event);
        if (item.once) listeners.set(name, listeners.get(name).filter(other => other !== item));
      }
    }
  };
}
function reveal(enabled = true) {
  const element = target(); element.animations = []; element.child = {};
  element.top = 1000;
  element.getBoundingClientRect = () => ({ top: element.top });
  element.contains = node => node === element || node === element.child;
  if (enabled) element.animate = function (frames, options) {
    const animation = { frames, options, cancelled: false,
      cancel() { this.cancelled = true; if (this.oncancel) this.oncancel(); },
      finish() { if (this.onfinish) this.onfinish(); }
    };
    element.animations.push(animation); return animation;
  };
  return element;
}
function imageStage({ src = 'preview.jpg', complete = false, naturalWidth = 0, modal = false } = {}) {
  const image = target(), host = target(), status = target();
  image.id = modal ? 'modalImg' : 'preview';
  image.complete = complete; image.naturalWidth = naturalWidth;
  if (src) image.setAttribute('src', src);
  host.querySelector = selector => selector === 'img' ? image : selector === '.asset-status' ? status : null;
  return { image, host, status };
}
function setup({ optional = true, reduced = false, readyState = 'complete', reveals = [], images = [], calculator = false, activeElement = null } = {}) {
  const root = target(), document = target(), window = target(), modal = target();
  const preference = target(); preference.matches = reduced;
  const timers = [], observers = [];
  window.innerHeight = 800;
  const form = calculator ? target() : null, result = calculator ? reveal() : null, calcStatus = target();
  document.documentElement = root; document.readyState = readyState; document.activeElement = activeElement;
  document.querySelectorAll = selector => selector === '[data-image-stage]' ? images.map(item => item.host) : reveals;
  document.getElementById = id => ({ portfolioModal: modal, incomeForm: form, calcStatus })[id] || null;
  document.querySelector = selector => selector === '.result-primary' ? result : null;
  window.setTimeout = (fn, delay) => { timers.push({ fn, delay }); return timers.length; };
  class Observer {
    constructor(callback, options) { this.callback = callback; this.options = options; this.observed = new Set(); this.disconnected = false; observers.push(this); }
    observe(element) { if (element.failObserve) throw new Error('Observer unavailable'); this.observed.add(element); }
    unobserve(element) { this.observed.delete(element); }
    disconnect() { this.disconnected = true; this.observed.clear(); }
    deliver(elements, visible = true) {
      const entries = elements.filter(element => this.observed.has(element)).map(element => ({ target: element, isIntersecting: visible }));
      if (entries.length) this.callback(entries);
    }
  }
  const context = { window, document, Set };
  if (optional) {
    window.matchMedia = () => preference;
    window.IntersectionObserver = context.IntersectionObserver = Observer;
  }
  vm.runInNewContext(source, context);
  return { root, document, window, preference, observers, timers, modal, form, result, calcStatus };
}

// Optional browser capabilities are enhancements, not prerequisites.
const withoutApis = setup({ optional: false, reveals: [reveal(false)] });
assert.equal(withoutApis.observers.length, 0);
const noAnimation = reveal(false), partial = setup({ reveals: [noAnimation] });
partial.observers[0].deliver([noAnimation]);
assert.equal(partial.observers[0].observed.size, 0);

const skipped = reveal(), reduced = setup({ reduced: true, reveals: [skipped], calculator: true });
assert.equal(reduced.observers.length, 0); assert.equal(skipped.animations.length, 0);
reduced.form.emit('input'); assert.equal(reduced.result.animations.length, 0);

// Opening a page must not hide or animate controls already in the viewport.
const visible = reveal(); visible.top = 200;
const above = reveal(); above.top = -100;
const initial = setup({ reveals: [visible, above] });
initial.observers[0].deliver([visible, above]);
assert.equal(initial.observers[0].observed.size, 0);
for (const element of [visible, above]) {
  assert.equal(element.classList.contains('scroll-pending'), false);
  assert.equal(element.animations.length, 0);
}

const elements = [reveal(), reveal(), reveal(), reveal()];
const motion = setup({ reveals: elements, calculator: true });
motion.observers[0].deliver(elements, false);
assert(elements.every(element => element.animations.length === 0));
motion.observers[0].deliver(elements);
assert.deepEqual(elements.map(element => element.animations[0].options.delay), [0, 100, 200, 200]);
assert(elements.every(element => element.animations[0].options.duration === 760));
assert(elements.every(element => element.animations[0].options.fill === 'backwards'));
motion.observers[0].deliver(elements);
assert(elements.every(element => element.animations.length === 1));
motion.form.emit('input'); assert.equal(motion.result.animations.length, 1);
motion.calcStatus.textContent = 'Invalid quantity'; motion.form.emit('input');
assert.equal(motion.result.animations.length, 1);
motion.preference.matches = true; motion.preference.emit('change');
assert(motion.observers[0].disconnected);
assert(elements.every(element => element.animations[0].cancelled));
assert(motion.result.animations[0].cancelled);

// Focus both prevents a pending reveal and immediately cancels active ones.
const focused = reveal(), focusSetup = setup({ reveals: [focused], activeElement: focused.child });
focusSetup.observers[0].deliver([focused]); assert.equal(focused.animations.length, 0);
const running = reveal(), focusCancel = setup({ reveals: [running] });
focusCancel.observers[0].deliver([running]); focusCancel.document.emit('focusin');
assert(running.animations[0].cancelled);

// Offscreen preparation removes the visible-then-pop effect without trapping content.
const below = reveal(); below.top = 1000;
const belowSetup = setup({ reveals: [below] });
assert(below.classList.contains('scroll-pending'));
assert.equal(belowSetup.observers[0].options.threshold, 0);
belowSetup.observers[0].deliver([below]);
assert.equal(below.classList.contains('scroll-pending'), false);
assert.equal(below.animations.length, 1);
for (const exit of ['focus', 'reduce', 'restore', 'print']) {
  const hidden = reveal(); hidden.top = 1000;
  const state = setup({ reveals: [hidden] });
  if (exit === 'focus') { state.document.activeElement = hidden.child; state.document.emit('focusin'); }
  if (exit === 'reduce') { state.preference.matches = true; state.preference.emit('change'); }
  if (exit === 'restore') state.window.emit('pageshow', { persisted: true });
  if (exit === 'print') state.window.emit('beforeprint');
  assert.equal(hidden.classList.contains('scroll-pending'), false, exit);
  assert.equal(state.observers[0].observed.size, 0, exit);
}
const fallback = reveal(); fallback.top = 1000;
const broken = reveal(); broken.failObserve = true;
setup({ reveals: [fallback, broken] });
assert.equal(fallback.classList.contains('scroll-pending'), false);
const badAnimation = reveal(); badAnimation.top = 1000;
badAnimation.animate = () => { throw new Error('Animation unavailable'); };
const badState = setup({ reveals: [badAnimation] });
badState.observers[0].deliver([badAnimation]);
assert.equal(badAnimation.classList.contains('scroll-pending'), false);
const unanimated = reveal(false); unanimated.top = 1000;
setup({ reveals: [unanimated] });
assert.equal(unanimated.classList.contains('scroll-pending'), false);

assert.equal(setup().root.classList.contains('page-loading'), false);
const loading = setup({ readyState: 'interactive' });
assert(loading.root.classList.contains('page-loading'));
loading.window.emit('load'); assert.equal(loading.root.classList.contains('page-loading'), false);
const timeout = setup({ readyState: 'loading' });
assert.equal(timeout.timers[0].delay, 8000); timeout.timers[0].fn();
assert.equal(timeout.root.classList.contains('page-loading'), false);
const restoredElement = reveal(), restored = setup({ readyState: 'interactive', reveals: [restoredElement] });
restored.observers[0].deliver([restoredElement]); restored.window.emit('pageshow', { persisted: true });
assert.equal(restored.root.classList.contains('page-loading'), false);
assert(restoredElement.animations[0].cancelled);

const cached = imageStage({ complete: true, naturalWidth: 800 });
const pending = imageStage();
const failed = imageStage({ complete: true });
const modalImage = imageStage({ src: '', modal: true });
const assets = setup({ images: [cached, pending, failed, modalImage] });
assert.equal(cached.host.attrs['aria-busy'], 'false'); assert(cached.status.hidden);
assert.equal(cached.host.classList.contains('asset-loading'), false);
assert(pending.host.classList.contains('asset-loading')); assert.equal(pending.host.attrs['aria-busy'], 'true');
pending.image.complete = true; pending.image.naturalWidth = 400; pending.image.emit('load');
assert(pending.status.hidden); assert.equal(pending.host.attrs['aria-busy'], 'false');
assert(failed.host.classList.contains('asset-error')); assert.equal(failed.status.hidden, false);
assert(failed.status.textContent.includes('unavailable'));
assert.equal(modalImage.host.classList.contains('asset-loading'), false);
assert.equal(modalImage.host.attrs['aria-busy'], undefined);

// Simulate script.js supplying a new source before the modal's motion listener.
modalImage.image.setAttribute('src', 'first.jpg'); assets.modal.emit('show.bs.modal');
assert(modalImage.host.classList.contains('asset-loading'));
modalImage.image.setAttribute('src', 'second.jpg'); assets.modal.emit('show.bs.modal');
modalImage.image.emit('load'); // An old queued event while the current source is incomplete.
assert(modalImage.host.classList.contains('asset-loading'));
modalImage.image.complete = true; modalImage.image.naturalWidth = 500; modalImage.image.emit('load');
assert.equal(modalImage.host.classList.contains('asset-loading'), false); assert(modalImage.status.hidden);
modalImage.image.setAttribute('src', 'missing.jpg'); modalImage.image.complete = false; assets.modal.emit('show.bs.modal');
modalImage.image.complete = true; modalImage.image.naturalWidth = 0; modalImage.image.emit('error');
assert(modalImage.host.classList.contains('asset-error'));
assets.modal.emit('hidden.bs.modal');
assert.equal(modalImage.host.classList.contains('asset-error'), false); assert(modalImage.status.hidden);
modalImage.image.setAttribute('src', 'cached.jpg'); modalImage.image.complete = true; modalImage.image.naturalWidth = 600;
assets.modal.emit('show.bs.modal'); assert(modalImage.status.hidden); assert.equal(modalImage.host.attrs['aria-busy'], 'false');

console.log('PASS: missing optional APIs, reduced motion and preference cancellation, one-shot reveals, focus safety, load/timeout/bfcache, cached/pending/failed images, modal source changes and reset.');
