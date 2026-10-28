/* ==========================================================================
   Lubica Bielikova — page behaviour
   1. Navigation
   2. English self-check
   3. Service links fill the enquiry form
   4. Enquiry form (POST /api/contact)
   5. Chat assistant (POST /api/chat)
   6. Footer year
   7. Motion (GSAP)
   ========================================================================== */

(function () {
  "use strict";
  var localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  var configuredApiBase = document.body.getAttribute("data-api-base") || "";
  var apiBase = localHost ? "" : configuredApiBase;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = Boolean(window.gsap && window.ScrollTrigger);

  /* 1. Navigation ---------------------------------------------------------- */
  var navToggle = document.getElementById("nav-toggle");
  var primaryNav = document.getElementById("primary-nav");

  function setNav(open) {
    if (!navToggle || !primaryNav) return;
    primaryNav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
  }

  if (navToggle && primaryNav) {
    navToggle.addEventListener("click", function () {
      setNav(!primaryNav.classList.contains("is-open"));
    });
    primaryNav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setNav(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && primaryNav.classList.contains("is-open")) {
        setNav(false);
        navToggle.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1023) setNav(false);
    });
  }

  /* 2. English self-check -------------------------------------------------- */
  var questions = [
    {
      question: "She ___ in Bratislava since 2020.",
      options: ["lives", "has lived", "is living"],
      answer: 1,
    },
    {
      question: "If I ___ more time, I would join the meeting.",
      options: ["have", "will have", "had"],
      answer: 2,
    },
    {
      question: "The documents ___ before the appointment began.",
      options: ["had been translated", "have translated", "were translating"],
      answer: 0,
    },
    {
      question: "Which sentence sounds most natural?",
      options: [
        "I look forward to hear from you.",
        "I look forward to hearing from you.",
        "I look forward hearing from you.",
      ],
      answer: 1,
    },
    {
      question: "The witness gave a ___ account of the events.",
      options: ["comprehensive", "comprehensively", "comprehend"],
      answer: 0,
    },
  ];
  var letters = ["A", "B", "C", "D"];

  var quizForm = document.getElementById("quiz-form");
  var quizQuestion = document.getElementById("quiz-question");
  var quizOptions = document.getElementById("quiz-options");
  var quizProgress = document.getElementById("quiz-progress");
  var quizFill = document.getElementById("quiz-progress-fill");
  var quizMessage = document.getElementById("quiz-message");
  var quizNext = document.getElementById("quiz-next");
  var quizRestart = document.getElementById("quiz-restart");
  var quizResult = document.getElementById("quiz-result");

  var questionIndex = 0;
  var score = 0;
  var answered = false;

  function setMessage(text, isError) {
    quizMessage.textContent = text;
    quizMessage.classList.toggle("is-error", Boolean(isError));
  }

  function renderQuestion() {
    var current = questions[questionIndex];
    answered = false;
    quizQuestion.textContent = current.question;
    quizProgress.textContent = "Question " + (questionIndex + 1) + " of " + questions.length;
    quizFill.style.width = ((questionIndex + 1) / questions.length) * 100 + "%";
    setMessage("", false);
    quizNext.innerHTML =
      'Check answer <svg class="icon icon--sm" aria-hidden="true"><use href="#icon-arrow-right"></use></svg>';
    quizOptions.replaceChildren();

    current.options.forEach(function (option, index) {
      var label = document.createElement("label");
      label.className = "option";

      var input = document.createElement("input");
      input.type = "radio";
      input.name = "answer";
      input.value = String(index);
      input.required = true;
      input.className = "sr-only";

      var mark = document.createElement("span");
      mark.className = "option__mark";
      mark.textContent = letters[index];

      var text = document.createElement("span");
      text.className = "option__text";
      text.textContent = option;

      input.addEventListener("change", function () {
        quizOptions.querySelectorAll(".option").forEach(function (item) {
          item.removeAttribute("data-on");
        });
        label.setAttribute("data-on", "true");
      });

      label.append(input, mark, text);
      quizOptions.append(label);
    });
  }

  function showResult() {
    quizForm.hidden = true;
    quizResult.hidden = false;
    quizRestart.hidden = false;
    quizResult.replaceChildren();

    var heading = document.createElement("strong");
    heading.textContent = "You scored " + score + " out of " + questions.length + ".";

    var note = document.createElement("p");
    note.textContent =
      score >= 4
        ? "Strong result on this short grammar check. It is not a formal proficiency level."
        : score >= 2
          ? "A useful start. This short quiz covers only a sample of English."
          : "This mini-quiz is only a small sample of English.";

    quizResult.append(heading, note);
  }

  if (quizForm) {
    quizForm.addEventListener("submit", function (event) {
      event.preventDefault();

      if (answered) {
        questionIndex += 1;
        if (questionIndex < questions.length) {
          renderQuestion();
        } else {
          showResult();
        }
        return;
      }

      var selected = quizForm.querySelector('input[name="answer"]:checked');
      if (!selected) {
        setMessage("Choose an answer to continue.", true);
        return;
      }

      answered = true;
      var correct = Number(selected.value) === questions[questionIndex].answer;
      if (correct) score += 1;

      quizOptions.querySelectorAll("input").forEach(function (input) {
        input.disabled = true;
      });

      var tiles = quizOptions.querySelectorAll(".option");
      tiles[questions[questionIndex].answer].setAttribute("data-on", "true");
      if (!correct) selected.closest(".option").classList.add("option--wrong");

      setMessage(
        correct ? "Correct." : "Not quite — the answer is “" + questions[questionIndex].options[questions[questionIndex].answer] + "”.",
        !correct
      );

      quizNext.innerHTML =
        (questionIndex === questions.length - 1 ? "Show score" : "Next question") +
        ' <svg class="icon icon--sm" aria-hidden="true"><use href="#icon-arrow-right"></use></svg>';
    });

    quizRestart.addEventListener("click", function () {
      questionIndex = 0;
      score = 0;
      answered = false;
      quizForm.hidden = false;
      quizResult.hidden = true;
      quizRestart.hidden = true;
      renderQuestion();
    });

    renderQuestion();
  }

  /* 3. Service links fill the enquiry form ---------------------------------- */
  var serviceSelect = document.querySelector('#contact-form select[name="service"]');

  document.querySelectorAll("[data-service]").forEach(function (link) {
    link.addEventListener("click", function () {
      if (!serviceSelect) return;
      var wanted = link.getAttribute("data-service");
      for (var i = 0; i < serviceSelect.options.length; i += 1) {
        if (serviceSelect.options[i].value === wanted) {
          serviceSelect.selectedIndex = i;
          break;
        }
      }
    });
  });

  /* 4. Enquiry form --------------------------------------------------------- */
  var contactForm = document.getElementById("contact-form");
  var contactMessage = document.getElementById("contact-message");

  if (contactForm) {
    contactForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var submitButton = contactForm.querySelector('button[type="submit"]');
      var originalLabel = submitButton.innerHTML;

      submitButton.disabled = true;
      submitButton.textContent = "Sending…";
      contactMessage.textContent = "";
      contactMessage.classList.remove("is-error");

      try {
        var response = await fetch(new URL("/api/contact", apiBase || window.location.origin), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(contactForm))),
        });
        var result = await response.json();
        if (!response.ok) throw new Error(result.error || "Your enquiry could not be sent.");
        contactMessage.textContent = result.message;
        contactForm.reset();
      } catch (error) {
        contactMessage.textContent =
          error.message || "A network error stopped the enquiry from being sent.";
        contactMessage.classList.add("is-error");
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalLabel;
      }
    });
  }

  /* 5. Chat assistant ------------------------------------------------------- */
  var chatLauncher = document.getElementById("chat-launcher");
  var chatPanel = document.getElementById("chat-panel");
  var chatClose = document.getElementById("chat-close");
  var chatForm = document.getElementById("chat-form");
  var chatInput = document.getElementById("chat-input");
  var chatMessages = document.getElementById("chat-messages");

  function setChat(open) {
    if (!chatPanel || !chatLauncher) return;
    chatPanel.hidden = !open;
    chatLauncher.setAttribute("aria-expanded", String(open));
    if (open) chatInput.focus();
  }

  if (chatLauncher && chatPanel) {
    chatLauncher.addEventListener("click", function () {
      setChat(chatPanel.hidden);
    });

    chatClose.addEventListener("click", function () {
      setChat(false);
      chatLauncher.focus();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !chatPanel.hidden) {
        setChat(false);
        chatLauncher.focus();
      }
    });

    chatForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var message = chatInput.value.trim();
      if (!message) return;

      var bubble = document.createElement("p");
      bubble.className = "bubble bubble--user";
      bubble.textContent = message;
      chatMessages.append(bubble);
      chatInput.value = "";
      chatInput.disabled = true;

      var pending = document.createElement("p");
      pending.className = "bubble";
      pending.textContent = "Thinking…";
      chatMessages.append(pending);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      try {
        var response = await fetch(new URL("/api/chat", apiBase || window.location.origin), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: message }),
        });
        var result = await response.json();
        if (!response.ok) throw new Error(result.error || "The assistant could not reply.");
        pending.textContent = result.reply;
      } catch (error) {
        pending.textContent = error.message || "A network error stopped the assistant from replying.";
      } finally {
        chatInput.disabled = false;
        chatInput.focus();
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    });
  }

  /* 6. Footer year ---------------------------------------------------------- */
  var year = document.getElementById("current-year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* 7. Motion --------------------------------------------------------------- */
  function initMotion() {
    if (!hasGsap) return;
    gsap.registerPlugin(ScrollTrigger);
    if (reduceMotion) return;

    var intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .from(".line__inner", { yPercent: 106, duration: 0.9, stagger: 0.07 }, 0.08)
      .from(".pano__img", { scale: 1.07, duration: 1.2 }, 0.2);

    /* Safety net: if frames are throttled (background tab, some embeds), the
       finished state is applied without waiting on the ticker. */
    window.setTimeout(function () {
      intro.progress(1);
    }, 1200);

    gsap.fromTo(
      ".pano__img",
      { yPercent: -5 },
      {
        yPercent: 5,
        ease: "none",
        scrollTrigger: { trigger: ".pano", start: "top bottom", end: "bottom top", scrub: 0.6 },
      }
    );

    var servicesImage = document.querySelector(".services__figure-img");
    if (servicesImage) {
      gsap.from(servicesImage, {
        scale: 1.06,
        duration: 1.2,
        ease: "power2.out",
        scrollTrigger: { trigger: servicesImage.closest("figure"), start: "top 94%", once: true },
      });
    }

    if (window.matchMedia("(pointer: fine)").matches) {
      document.querySelectorAll(".magnetic").forEach(function (element) {
        var xTo = gsap.quickTo(element, "x", { duration: 0.45, ease: "power3" });
        var yTo = gsap.quickTo(element, "y", { duration: 0.45, ease: "power3" });

        element.addEventListener("pointermove", function (event) {
          var rect = element.getBoundingClientRect();
          xTo(((event.clientX - rect.left) / rect.width) * 8 - 4);
          yTo(((event.clientY - rect.top) / rect.height) * 6 - 3);
        });

        element.addEventListener("pointerleave", function () {
          xTo(0);
          yTo(0);
        });
      });
    }

    window.addEventListener("load", function () {
      ScrollTrigger.refresh();
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        ScrollTrigger.refresh();
      });
    }
  }

  initMotion();
})();
