// ============================================================
// Kodigo Web Studio — script.js
// Founder: Carl Benedict C. Enriquez
// Modular script that runs safely across all pages
// ============================================================

// 1. Set the contact email in one place — change this to yours
var CONTACT_EMAIL = "enriquez.carlbenedict@student.auf.edu.ph";

// 2. Update the copyright year automatically (on every page)
var yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// 3. One source of truth for the Home / About visual and accessible state.
var inPageNavLinks = document.querySelectorAll('#mainNav .nav-link[href^="#"]');
var currentSectionLink;
function setCurrentSection(link) {
  if (currentSectionLink === link) return;
  currentSectionLink = link;
  inPageNavLinks.forEach(function (item) {
    item.classList.toggle("active", item === link);
    if (item === link) item.setAttribute("aria-current", "location");
    else item.removeAttribute("aria-current");
  });
}
inPageNavLinks.forEach(function (link) {
  link.addEventListener("click", function () {
    setCurrentSection(link);
  });
});

// Scroll position tracker to toggle Home / About highlight smoothly
window.addEventListener("scroll", function () {
  var aboutSec = document.getElementById("about");
  var homeLink = document.querySelector('#mainNav .nav-link[href="#home"]');
  var aboutLink = document.querySelector('#mainNav .nav-link[href="#about"]');

  if (aboutSec && homeLink && aboutLink) {
    var scrollPos = window.scrollY || document.documentElement.scrollTop;
    var aboutTrigger = aboutSec.offsetTop - 180;
    if (scrollPos >= aboutTrigger) {
      setCurrentSection(aboutLink);
    } else {
      setCurrentSection(homeLink);
    }
  }
}, { passive: true });

// Check initial hash on page load (e.g. index.html#about)
if (window.location.hash === "#about") {
  var initialHome = document.querySelector('#mainNav .nav-link[href="#home"]');
  var initialAbout = document.querySelector('#mainNav .nav-link[href="#about"]');
  if (initialHome && initialAbout) {
    setCurrentSection(initialAbout);
  }
}

// Portfolio Lightbox Modal Handler
var portfolioModal = document.getElementById("portfolioModal");
if (portfolioModal) {
  portfolioModal.addEventListener("show.bs.modal", function (e) {
    var trigger = e.relatedTarget;
    if (!trigger) return;
    var imgSrc = trigger.getAttribute("data-img");
    var title = trigger.getAttribute("data-title");
    var desc = trigger.getAttribute("data-desc");

    var modalTitle = portfolioModal.querySelector("#modalTitle");
    var modalImg = portfolioModal.querySelector("#modalImg");
    var modalDesc = portfolioModal.querySelector("#modalDesc");

    if (modalTitle) modalTitle.textContent = title;
    if (modalImg) {
      modalImg.src = imgSrc;
      modalImg.alt = title + " screenshot";
    }
    if (modalDesc) modalDesc.textContent = desc;
  });
}

// 4. Show a dashed placeholder if the founder photo is missing
var photo = document.querySelector("#founderPhoto img");
var frame = document.getElementById("founderPhoto");
if (photo && frame) {
  if (photo.complete && photo.naturalWidth === 0) {
    frame.classList.add("no-photo");
  } else {
    photo.addEventListener("error", function () {
      frame.classList.add("no-photo");
    });
  }
}

// ============================================================
// 5. Financial proposal: startup costs sum & income calculator
// (Runs on financial.html or any page with the calculator)
// ============================================================
function peso(n) {
  return "\u20B1" + n.toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

var totalCostEl = document.getElementById("totalCost");
var startupTotal = 0;
if (totalCostEl) {
  var costCells = document.querySelectorAll(".cost");
  for (var i = 0; i < costCells.length; i++) {
    startupTotal += Number(costCells[i].textContent.replace(/,/g, ""));
  }
  totalCostEl.textContent = peso(startupTotal);
}

var incomeForm = document.getElementById("incomeForm");
var MONTHLY_COSTS = 1500;

function calculate() {
  var starterInput  = document.getElementById("qtyStarter");
  var businessInput = document.getElementById("qtyBusiness");
  var premiumInput  = document.getElementById("qtyPremium");
  if (!starterInput || !businessInput || !premiumInput) return;

  var starter = Number(starterInput.value);
  var business = Number(businessInput.value);
  var premium = Number(premiumInput.value);
  var launch = document.getElementById("launchDiscount");
  var referral = document.getElementById("referralReward");
  var status = document.getElementById("calcStatus");
  var invalid = [starter, business, premium].some(function (n) {
    return !Number.isInteger(n) || n < 0 || n > 100;
  });
  var overLaunchLimit = launch && launch.checked && starter + business + premium > 5;
  if (status) status.textContent = invalid
    ? "Enter whole project quantities from 0 to 100."
    : overLaunchLimit ? "Launch pricing is limited to five projects. Reduce the quantities or turn off the launch scenario." : "";
  if (invalid || overLaunchLimit) {
    document.querySelectorAll(".results dd").forEach(function (result) { result.textContent = "—"; });
    return;
  }

  var revenue = starter * 3500 + business * 6500 + premium * 12000;
  var discount = launch && launch.checked ? revenue * 0.3 : 0;
  var collected = revenue - discount;
  var rewards = referral && referral.checked ? collected * 0.1 : 0;
  var net = collected - rewards - MONTHLY_COSTS;
  [["resDiscount", discount], ["resCollected", collected], ["resReferrals", rewards]].forEach(function (entry) {
    var output = document.getElementById(entry[0]);
    if (output) output.textContent = peso(entry[1]);
  });

  var resRev   = document.getElementById("resRevenue");
  var resCosts = document.getElementById("resCosts");
  var resNet   = document.getElementById("resNet");
  var resYear  = document.getElementById("resYear");
  var resBreak = document.getElementById("resBreak");

  if (resRev)   resRev.textContent   = peso(revenue);
  if (resCosts) resCosts.textContent = peso(MONTHLY_COSTS);
  if (resNet)   resNet.textContent   = peso(net);
  if (resYear)  resYear.textContent  = peso(net * 12);

  if (resBreak) {
    if (net > 0 && startupTotal > 0) {
      var months = Math.ceil(startupTotal / net);
      resBreak.textContent = months + (months === 1 ? " month" : " months");
    } else if (net > 0) {
      resBreak.textContent = "1 month";
    } else {
      resBreak.textContent = "Not reached at this volume";
    }
  }
}

if (incomeForm) {
  incomeForm.addEventListener("submit", function (e) {
    e.preventDefault();
    calculate();
  });
  incomeForm.addEventListener("input", calculate);
  // Initial run
  calculate();
}

// ============================================================
// 6. Contact form validation & email launch
// (Runs on contact.html or any page with #contactForm)
// ============================================================
var contactForm = document.getElementById("contactForm");
if (contactForm) {
  var planSelect = document.getElementById("cPlan");
  var messageArea = document.getElementById("cMessage");
  var status = document.getElementById("formStatus");
  var copyButton = document.getElementById("copyInquiry");
  var manualCopy = document.getElementById("manualCopy");
  var inquiryText = document.getElementById("inquiryText");
  var planLabels = {
    general: "General consultation / custom project",
    undecided: "Help choosing a package",
    starter: "Starter Page (\u20B13,500)",
    business: "Business Site (\u20B16,500)",
    premium: "Premium Site (\u20B112,000)"
  };
  var lastIntro = "";
  var draftVersion = 0;

  function selectedPlan() {
    return planLabels[planSelect.value] || planLabels.general;
  }

  function showStatus(text) {
    status.textContent = text;
    status.classList.remove("d-none");
  }

  function clearDraftFeedback() {
    draftVersion++;
    status.classList.add("d-none");
    manualCopy.hidden = true;
    inquiryText.value = "";
  }

  function updatePackageIntro() {
    var intro = planSelect.value === "undecided"
      ? "Hi Carl, I need help choosing the right website package."
      : planSelect.value === "general"
      ? "Hi Carl, I would like to discuss a website for my business."
      : "Hi Carl, I would like to inquire about the " + selectedPlan() + " package.";
    // Only replace text we generated. Never overwrite a visitor's own message.
    if (!messageArea.value.trim()) {
      messageArea.value = intro + "\n\n";
    } else if (lastIntro && messageArea.value.startsWith(lastIntro)) {
      messageArea.value = intro + messageArea.value.slice(lastIntro.length);
    }
    lastIntro = intro;
    clearDraftFeedback();
  }

  var planParam = new URLSearchParams(window.location.search).get("plan");
  if (Object.prototype.hasOwnProperty.call(planLabels, planParam)) {
    planSelect.value = planParam;
    updatePackageIntro();
  }
  planSelect.addEventListener("change", updatePackageIntro);

  function validateField(field) {
    var trimmed = field.value.trim();
    var valid = field.checkValidity() && trimmed.length > 0;
    if (field === messageArea) valid = valid && trimmed.length >= 10;
    field.classList.toggle("is-invalid", !valid);
    field.setAttribute("aria-invalid", String(!valid));
    return valid;
  }

  contactForm.addEventListener("input", function (event) {
    clearDraftFeedback();
    if (event.target.classList.contains("is-invalid")) validateField(event.target);
  });
  contactForm.addEventListener("change", clearDraftFeedback);

  function buildInquiry() {
    var fields = [document.getElementById("cName"), document.getElementById("cEmail"), messageArea];
    var firstInvalid = null;
    fields.forEach(function (field) {
      if (!validateField(field) && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) {
      manualCopy.hidden = true;
      showStatus("Please check the highlighted fields before preparing or copying your inquiry.");
      firstInvalid.focus();
      return null;
    }
    var name = fields[0].value.trim();
    var email = fields[1].value.trim();
    var subject = "Kodigo Project Inquiry [" + selectedPlan() + "] from " + name;
    var body = "Package: " + selectedPlan() + "\n\nClient Message:\n" + messageArea.value.trim() +
      "\n\nClient Contact: " + name + " (" + email + ")";
    var optionalDetails = [];
    [["cBusiness", "Business type"], ["cLaunch", "Preferred launch date"], ["cFeatures", "Required features"]].forEach(function (entry) {
      var field = document.getElementById(entry[0]);
      if (field && field.value.trim()) optionalDetails.push(entry[1] + ": " + field.value.trim());
    });
    if (optionalDetails.length) body += "\n\nProject details:\n" + optionalDetails.join("\n");
    return { subject: subject, body: body,
      text: "To: " + CONTACT_EMAIL + "\nSubject: " + subject + "\n\n" + body };
  }

  contactForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var inquiry = buildInquiry();
    if (!inquiry) return;
    window.location.href = "mailto:" + CONTACT_EMAIL + "?subject=" + encodeURIComponent(inquiry.subject) +
      "&body=" + encodeURIComponent(inquiry.body);
    showStatus("Your draft is ready for your email app. Send it there to complete your inquiry. If no app opens, use Copy inquiry instead.");
  });

  copyButton.addEventListener("click", async function () {
    var inquiry = buildInquiry();
    if (!inquiry) return;
    var version = draftVersion;
    var buttonLabel = copyButton.textContent;
    copyButton.disabled = true;
    copyButton.textContent = "Copying inquiry...";
    copyButton.setAttribute("aria-busy", "true");
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(inquiry.text);
      if (version !== draftVersion) return;
      manualCopy.hidden = true;
      showStatus("Inquiry copied. Paste it into your email app and send it to " + CONTACT_EMAIL + ". Nothing has been sent yet.");
    } catch (error) {
      if (version !== draftVersion) return;
      manualCopy.hidden = false;
      inquiryText.value = inquiry.text;
      inquiryText.focus();
      inquiryText.select();
      showStatus("Automatic copying is unavailable. Copy the selected text below and paste it into your email app.");
    } finally {
      copyButton.disabled = false;
      copyButton.textContent = buttonLabel;
      copyButton.setAttribute("aria-busy", "false");
    }
  });
}

// Scope guidance, not a quote. Keep advanced and uncertain work open for discussion.
function recommendPackage(pages, gallery, feature) {
  if (!["1", "5", "8", "more", "unsure"].includes(pages) ||
      !["no", "yes", "unsure"].includes(gallery) ||
      !["basic", "calculator", "booking", "payments", "unsure"].includes(feature)) return null;
  if (pages === "more" || feature === "payments") return { plan: "general", title: "Let's scope a custom project", reason: "More than eight pages, payments, or live reservation availability need a separate scope and quote." };
  if ([pages, gallery, feature].includes("unsure")) return { plan: "undecided", title: "Let's choose together", reason: "You do not need every detail decided. A short discussion will help define the pages and features you actually need." };
  if (pages === "8" || feature === "calculator" || feature === "booking") return { plan: "premium", title: "Premium Site - proposed price \u20B112,000", reason: "Your scope needs up to eight pages or an interactive feature. Booking collects requests; payments and live reservations are quoted separately." };
  if (pages === "5" || gallery === "yes") return { plan: "business", title: "Business Site - proposed price \u20B16,500", reason: "Up to five pages and a photo or product gallery fit this package. It gives your visitors more space to explore your offerings." };
  return { plan: "starter", title: "Starter Page - proposed price \u20B13,500", reason: "A single page with key information and direct contact links matches your needs." };
}
var packageFinder = document.getElementById("packageFinder");
if (packageFinder) {
  var finderResult = document.getElementById("finderResult");
  packageFinder.addEventListener("change", function () { finderResult.hidden = true; });
  packageFinder.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!packageFinder.reportValidity()) return;
    var suggestion = recommendPackage(document.getElementById("finderPages").value,
      document.getElementById("finderGallery").value, document.getElementById("finderFeature").value);
    if (!suggestion) return;
    document.getElementById("finderResultTitle").textContent = suggestion.title;
    document.getElementById("finderReason").textContent = suggestion.reason;
    document.getElementById("finderContact").href = "contact.html?plan=" + suggestion.plan;
    finderResult.hidden = false;
    finderResult.focus({ preventScroll: true });
  });
}

// Close an expanded mobile menu after choosing an in-page destination.
var navMenu = document.getElementById("navMenu");
if (navMenu) {
  navMenu.addEventListener("click", function (event) {
    var link = event.target.closest("a[href]");
    if (link && navMenu.classList.contains("show") && window.bootstrap) {
      bootstrap.Collapse.getOrCreateInstance(navMenu, { toggle: false }).hide();
    }
  });
}
