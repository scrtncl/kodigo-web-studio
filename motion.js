// Progressive motion: content is visible without JS and navigation is never delayed.
(function () {
  "use strict";
  var root = document.documentElement;
  var preference = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reduceMotion = function () { return preference && preference.matches; };
  var animations = new Set();
  var pendingReveals = new Set();
  var observer;

  function showContent(element) {
    element.classList.remove("scroll-pending");
    pendingReveals.delete(element);
  }
  function revealAll() {
    if (observer) observer.disconnect();
    pendingReveals.forEach(showContent);
  }

  function animateOnce(element, delay) {
    showContent(element);
    if (reduceMotion() || !element.animate || element.contains(document.activeElement)) return;
    var animation;
    try {
      animation = element.animate([
        { opacity: 0, transform: "translateY(28px)" },
        { opacity: 1, transform: "translateY(0)" }
      ], { duration: 760, delay: delay, fill: "backwards", easing: "cubic-bezier(.16,1,.3,1)" });
    } catch (error) {
      return; // Keep the content visible if an animation cannot start.
    }
    animations.add(animation);
    var clear = function () { animations.delete(animation); };
    animation.onfinish = clear;
    animation.oncancel = clear;
  }

  // Only offscreen content is prepared, after its observer is successfully attached.
  // Without JS, IntersectionObserver, or WAAPI, everything remains visible.
  if (window.IntersectionObserver && !reduceMotion()) {
    try {
      observer = new IntersectionObserver(function (entries) {
        var sequence = 0;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          animateOnce(entry.target, Math.min(sequence++ * 100, 200));
        });
      }, { threshold: 0, rootMargin: "0px 0px -32px 0px" });
      var candidates = Array.from(document.querySelectorAll(".section-header, .featured-project-grid, .directory-card, .service-card, .work, .market-row, .about-grid > div, .facts, .quote-pair > blockquote, #about > .container > .plain-list, .timeline li, .calculator-panel, .contact-grid > div, .next-section-banner, .addons > li"));
      // Batch layout reads before changing styles.
      candidates.filter(function (element) {
        // Leave the initial viewport ready to use, including deep-linked sections.
        return element.animate && element.getBoundingClientRect &&
          element.getBoundingClientRect().top >= window.innerHeight &&
          !element.contains(document.activeElement);
      }).forEach(function (element) {
        observer.observe(element);
        pendingReveals.add(element);
        element.classList.add("scroll-pending");
      });
    } catch (error) {
      revealAll();
    }
  }

  function cancelMotion() {
    animations.forEach(function (animation) { animation.cancel(); });
    animations.clear();
  }
  if (preference && preference.addEventListener) {
    preference.addEventListener("change", function () {
      if (reduceMotion()) {
        revealAll();
        cancelMotion();
      }
    });
  }
  document.addEventListener("focusin", function () {
    // Keyboard users must never wait for a control to become visible.
    pendingReveals.forEach(function (element) {
      if (element.contains(document.activeElement)) {
        observer.unobserve(element);
        showContent(element);
      }
    });
    cancelMotion();
  });
  window.addEventListener("beforeprint", function () { revealAll(); cancelMotion(); });

  // Indeterminate progress appears only while the browser is actually loading.
  function finishPageLoad() { root.classList.remove("page-loading"); }
  if (document.readyState !== "complete") {
    root.classList.add("page-loading");
    window.addEventListener("load", finishPageLoad, { once: true });
    // Third-party fonts/CDNs must not leave a permanent activity indicator.
    window.setTimeout(finishPageLoad, 8000);
  }
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) { finishPageLoad(); revealAll(); cancelMotion(); }
  });

  function watchImage(image, host, status) {
    function settle() {
      if (!image.getAttribute("src") || !image.complete) return;
      var failed = image.naturalWidth === 0;
      host.classList.remove("asset-loading");
      host.classList.toggle("asset-error", failed);
      host.setAttribute("aria-busy", "false");
      status.textContent = failed ? "Preview unavailable. Please try again later." : "";
      status.hidden = !failed;
    }
    function start() {
      if (!image.getAttribute("src")) return;
      host.classList.remove("asset-error");
      host.classList.add("asset-loading");
      host.setAttribute("aria-busy", "true");
      status.textContent = "Loading preview";
      status.hidden = false;
      settle(); // Cached images may already be complete before handlers run.
    }
    image.addEventListener("load", settle);
    image.addEventListener("error", settle);
    start();
    return start;
  }
  document.querySelectorAll("[data-image-stage]").forEach(function (host) {
    var image = host.querySelector("img");
    var status = host.querySelector(".asset-status");
    if (!image || !status) return;
    var start = watchImage(image, host, status);
    if (image.id === "modalImg") {
      var modal = document.getElementById("portfolioModal");
      // script.js registers first and supplies the selected source and title.
      modal.addEventListener("show.bs.modal", start);
      modal.addEventListener("hidden.bs.modal", function () {
        host.classList.remove("asset-loading", "asset-error");
        host.setAttribute("aria-busy", "false");
        status.hidden = true;
      });
    }
  });

  // Brief visual confirmation after a valid calculator update; no fake counting.
  var calculator = document.getElementById("incomeForm");
  var result = document.querySelector(".result-primary");
  var resultAnimation;
  if (calculator && result) {
    function confirmCalculation() {
      if (reduceMotion() || !result.animate || document.getElementById("calcStatus").textContent) return;
      if (resultAnimation) resultAnimation.cancel();
      resultAnimation = result.animate([
        { boxShadow: "0 0 0 0 rgba(134,239,239,.32)" },
        { boxShadow: "0 0 0 7px rgba(134,239,239,0)" }
      ], { duration: 420, easing: "ease-out" });
      animations.add(resultAnimation);
      var current = resultAnimation;
      current.onfinish = current.oncancel = function () { animations.delete(current); };
    }
    calculator.addEventListener("input", confirmCalculation);
    calculator.addEventListener("submit", confirmCalculation);
  }
}());
