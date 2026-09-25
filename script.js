/* ==================================================================
   MJ PORTFOLIO — scroll scenes
   GSAP + ScrollTrigger drive every scene. Lenis smooths the scroll.
   Each scene is one pinned viewport with a scrubbed timeline, so the
   page plays like a motion-graphics video controlled by the scrollbar.

   Quick tuning:
   - unit()        scroll distance (px) per timeline second. Bigger = slower.
   - Scene builders below (buildOpening, buildSkills, ...) hold the timelines.
   ================================================================== */
(() => {
  "use strict";

  const html = document.documentElement;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, "0");

  // Plain static page if the libraries are missing or the visitor prefers reduced motion.
  if (
    !window.gsap ||
    !window.ScrollTrigger ||
    !window.Lenis ||
    !html.classList.contains("anim")
  ) {
    html.classList.remove("anim");
    window.__booted = true;
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  const TOTAL_LEVELS = 5;

  /** Scroll distance in px that one second of a scene timeline lasts. */
  const unit = () => Math.max(380, window.innerHeight * 0.46);

  // ---------------------------------------------------------------
  // Smooth scroll
  // ---------------------------------------------------------------
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  window.lenis = lenis;
  lenis.stop(); // locked until the boot screen is done
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function splitChars(el) {
    const text = el.textContent;
    el.textContent = "";
    return Array.from(text).map((ch) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = ch;
      el.appendChild(s);
      return s;
    });
  }

  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    return words.map((w, i) => {
      const s = document.createElement("span");
      s.className = "w";
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
      return s;
    });
  }

  /** Pin `pinEl` while `tl` plays, scrubbed by scroll. */
  function pinScene(section, pinEl, tl, extra = {}) {
    return ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: () => "+=" + Math.round(tl.duration() * unit()),
      pin: pinEl,
      scrub: true,
      animation: tl,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      ...extra,
    });
  }

  /** Scroll position that shows timeline time `t` of a pinned scene. */
  const scrollAt = (st, tl, t) =>
    st.start + (t / tl.duration()) * (st.end - st.start);

  const landing = {}; // nav target name -> () => scroll position

  // ---------------------------------------------------------------
  // Boot: typed hello (time-based, plays once after the loader)
  // ---------------------------------------------------------------
  const block = $("#cursor-block");
  const hint = $("#scroll-hint");
  const typeEls = $$("[data-type]");
  const chars = typeEls.flatMap(splitChars);
  const line2Chars = $$(".ch", $$(".hero-title .line")[1]);
  const lastLine2 = chars.indexOf(line2Chars[line2Chars.length - 1]);

  const typeTl = gsap.timeline({ paused: true });
  typeTl
    .to(
      chars,
      { opacity: 1, duration: 0.001, stagger: 0.07, ease: "none" },
      0.3,
    )
    .set(block, { opacity: 1 }, 0.3 + lastLine2 * 0.07 + 0.12)
    .add(() => block.classList.add("blink"), ">")
    .to(hint, { opacity: 1, duration: 0.001 }, ">+0.4");

  // ---------------------------------------------------------------
  // 01 · START — zoom into the cursor block, then explainer statements
  // ---------------------------------------------------------------
  // ---------------------------------------------------------------
  // 01 · START — zoom into the cursor block, then powergrid showcase
  // Replace the existing buildOpening() function in script.js with this.
  // ---------------------------------------------------------------
  function buildOpening() {
    const section = $("#opening");
    const pinEl = $(".pin", section);
    const group = $("#zoom-group");
    const whiteLayer = $("#open-white");
    const stage = $("#stage");
    const grid = $("#powergrid", stage); // was: const statement = $(".statement", stage);

    // Where the block sits and how far to scale so it swallows the screen.
    const geom = () => {
      const bw = block.offsetWidth;
      const bh = block.offsetHeight;
      const ox = block.offsetLeft + bw / 2;
      const oy = block.offsetTop + bh / 2;
      const gx = group.offsetLeft + ox;
      const gy = group.offsetTop + oy;
      const dx = Math.max(gx, window.innerWidth - gx);
      const dy = Math.max(gy, window.innerHeight - gy);
      const s = Math.max(dx / (bw / 2), dy / (bh / 2)) * 1.06;
      return { ox, oy, s };
    };

    const tl = gsap.timeline({ defaults: { ease: "none" } });

    // Camera zooms into the block. translate(o·(1−s)) + scale(s) = zoom about the block centre.
    tl.to(
      group,
      {
        scale: () => geom().s,
        x: () => geom().ox * (1 - geom().s),
        y: () => geom().oy * (1 - geom().s),
        ease: "power3.in",
        duration: 2,
      },
      0,
    );
    tl.to(hint, { opacity: 0, duration: 0.25 }, 0);
    tl.set(whiteLayer, { autoAlpha: 0 }, 2); // the block now fills the screen

    // The powergrid reads as one block: fade/settle in, hold, then the stage zooms out.
    tl.fromTo(
      grid,
      { autoAlpha: 0, y: 18 },
      { autoAlpha: 1, y: 0, duration: 0.7, ease: "power2.out" },
      2.15,
    );
    const HOLD = 2.6;

    // Zoom out: the black screen shrinks to a window, then vanishes into the white page.
    const T = 2 + HOLD;
    tl.to(stage, { scale: 0.2, duration: 1.1, ease: "power3.inOut" }, T);
    tl.fromTo(
      stage,
      { scale: 0.2 },
      { scale: 0, duration: 0.7, ease: "power3.in", immediateRender: false },
      T + 1.3,
    );
    tl.to({}, { duration: 0.3 }, T + 2);

    let skipped = false;
    const st = pinScene(section, pinEl, tl, {
      onUpdate: (self) => {
        // Scrolling before the typing finishes: show everything, stop the blink.
        if (!skipped && self.progress > 0.002) {
          skipped = true;
          typeTl.progress(1);
          block.classList.remove("blink");
          gsap.set(block, { opacity: 1 });
        }
        // Scrolled all the way back to the very top: force the hero back to its
        // resting state so it can't get stuck mid-zoom or hidden.
        if (self.progress === 0) {
          gsap.set(group, { scale: 1, x: 0, y: 0 });
          gsap.set(whiteLayer, { autoAlpha: 1 });
          gsap.set(chars, { opacity: 1 });
          gsap.set(block, { opacity: 1 });
        }
      },
    });
    landing.opening = () => 0;
    return st;
  }

  // ---------------------------------------------------------------
  // 02 · SKILLS — word-by-word text, zoom out to the inventory
  // ---------------------------------------------------------------
  function buildSkills() {
    const section = $("#skills");
    const pinEl = $(".pin", section);
    const about = $("#about-layer");
    const skillsLayer = $("#skills-layer");
    const words = splitWords($("#about-text"));
    const slots = $$(".slot", skillsLayer);
    const countEl = $("#skills-count");
    const marquee = $("#marquee");

    gsap.set(skillsLayer, { autoAlpha: 0, scale: 1.8 });
    gsap.set(slots, { autoAlpha: 0, scale: 0 });
    countEl.textContent = "00";

    const tl = gsap.timeline({ defaults: { ease: "none" } });
    tl.fromTo(
      words,
      { opacity: 0.12 },
      { opacity: 1, duration: 0.3, stagger: 0.045 },
      0,
    );

    const readEnd = tl.duration();
    tl.to(
      about,
      { scale: 0.12, autoAlpha: 0, duration: 1.1, ease: "power3.in" },
      readEnd + 0.5,
    );
    tl.to(
      skillsLayer,
      { scale: 1, autoAlpha: 1, duration: 1.2, ease: "power3.out" },
      readEnd + 0.9,
    );

    tl.addLabel("slots", readEnd + 1.9);
    tl.to(
      slots,
      {
        autoAlpha: 1,
        scale: 1,
        duration: 0.3,
        stagger: 0.3,
        ease: "back.out(2.4)",
      },
      "slots",
    );
    const counter = { v: 0 };
    tl.to(
      counter,
      {
        v: slots.length,
        duration: 0.3 * (slots.length - 1) + 0.3,
        snap: { v: 1 },
        onUpdate: () => (countEl.textContent = pad(counter.v)),
      },
      "slots",
    );
    tl.to({}, { duration: 0.9 });
    tl.to(marquee, { xPercent: -12, duration: tl.duration() }, 0);

    const st = pinScene(section, pinEl, tl);
    landing.skills = () =>
      scrollAt(st, tl, tl.labels.slots + slots.length * 0.3);
    return st;
  }

  // ---------------------------------------------------------------
  // 03 · WORK — four levels, each one an iris zoom into a new background
  // ---------------------------------------------------------------
  function buildWork() {
    const section = $("#work");
    const pinEl = $(".pin", section);
    const levels = $$(".level", pinEl);
    const inners = levels.map((l) => $(".level-inner", l));
    const dots = $$("#pager i");

    gsap.set(levels.slice(1), { clipPath: "inset(50% 50% 50% 50%)" });
    gsap.set(inners.slice(1), { scale: 0.5, autoAlpha: 0 });

    const tl = gsap.timeline({ defaults: { ease: "none" } });
    tl.to({}, { duration: 0.7 });

    const marks = [0];
    levels.forEach((level, i) => {
      if (i === 0) return;
      const T = tl.duration();
      tl.to(
        inners[i - 1],
        { scale: 1.4, autoAlpha: 0, duration: 1.1, ease: "power2.in" },
        T,
      );
      tl.to(
        level,
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: "power3.inOut" },
        T,
      );
      tl.to(
        inners[i],
        { scale: 1, autoAlpha: 1, duration: 1.1, ease: "power3.out" },
        T + 0.35,
      );
      tl.to({}, { duration: 0.9 }, T + 1.45);
      marks.push(T + 0.9);
    });

    tl.eventCallback("onUpdate", () => {
      const t = tl.time();
      let active = 0;
      marks.forEach((m, i) => {
        if (t >= m) active = i;
      });
      dots.forEach((d, i) => d.classList.toggle("on", i === active));
    });

    // Level 1 plays in on arrival (time-based), before the scrub takes over.
    const first = levels[0];
    const introEls = [
      ...$$(".level-num, .level-title, .level-desc, .tags, .btn", first),
      $(".level-shot", first),
    ];
    const intro = gsap.from(introEls, {
      autoAlpha: 0,
      scale: 0.85,
      duration: 0.5,
      stagger: 0.08,
      ease: "steps(4)",
      paused: true,
    });
    ScrollTrigger.create({
      trigger: section,
      start: "top 65%",
      animation: intro,
      toggleActions: "play none none reverse",
    });

    const st = pinScene(section, pinEl, tl);
    landing.work = () => scrollAt(st, tl, 0.35);
    return st;
  }

  // ---------------------------------------------------------------
  // 04 · XP — a side-scrolling level; the world moves, the player runs
  // ---------------------------------------------------------------
  function buildXP() {
    const section = $("#xp");
    const pinEl = $(".pin", section);
    const track = $("#xp-track");
    const sky = $("#xp-sky");
    const player = $("#player");
    const cards = $$(".xp-card", track);
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);

    const tl = gsap.timeline({ defaults: { ease: "none" } });
    tl.to(track, { x: () => -dist(), duration: 1 }, 0);
    tl.fromTo(
      sky,
      { backgroundPosition: "0px 100%" },
      { backgroundPosition: () => -dist() * 0.4 + "px 100%", duration: 1 },
      0,
    );

    let runTimer;
    const st = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: () => "+=" + Math.round(dist() * 1.1 + window.innerHeight * 0.3),
      pin: pinEl,
      scrub: true,
      animation: tl,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: () => {
        player.classList.add("run");
        clearTimeout(runTimer);
        runTimer = setTimeout(() => player.classList.remove("run"), 140);
        const mid = window.innerWidth * 0.5;
        cards.forEach((c) =>
          c.classList.toggle("reached", c.getBoundingClientRect().left < mid),
        );
      },
    });
    landing.xp = () => st.start;
    return st;
  }

  // ---------------------------------------------------------------
  // 05 · CONTACT — the cursor block returns and grows into the final screen
  // ---------------------------------------------------------------
  function buildFinale() {
    const section = $("#contact");
    const pinEl = $(".pin", section);
    const ink = $("#finale");
    const title = $("#finale-title");
    const items = [
      $(".finale-copy", ink),
      ...$$(".contact-links li", ink),
      $(".btn", ink),
    ];

    const smallBlock = () => {
      const iy = Math.max(0, (window.innerHeight - 28) / 2);
      const ix = Math.max(0, (window.innerWidth - 20) / 2);
      return `inset(${iy}px ${ix}px ${iy}px ${ix}px)`;
    };

    gsap.set([title, ...items], { autoAlpha: 0 });

    const tl = gsap.timeline({ defaults: { ease: "none" } });
    tl.fromTo(
      ink,
      { clipPath: smallBlock },
      { clipPath: "inset(0px 0px 0px 0px)", duration: 1.7, ease: "power3.in" },
      0,
    );
    tl.fromTo(
      title,
      { scale: 0.25, autoAlpha: 0, transformOrigin: "0% 50%" },
      {
        scale: 1,
        autoAlpha: 1,
        transformOrigin: "0% 50%",
        duration: 0.6,
        ease: "steps(6)",
      },
      1.5,
    );
    tl.addLabel("clear", 2.1);
    tl.to(
      items,
      { autoAlpha: 1, duration: 0.3, stagger: 0.18, ease: "steps(3)" },
      "clear",
    );
    tl.to({}, { duration: 0.8 });

    const st = pinScene(section, pinEl, tl);
    landing.contact = () => scrollAt(st, tl, tl.duration() - 0.3);
    return st;
  }

  // ---------------------------------------------------------------
  // Build scenes in page order (pin spacers must exist before later triggers measure)
  // ---------------------------------------------------------------
  buildOpening();
  buildSkills();
  buildWork();
  buildXP();
  buildFinale();
  landing.bonus = () =>
    $("#bonus").getBoundingClientRect().top + window.scrollY;

  // ---------------------------------------------------------------
  // HUD: current level label + scroll progress bar
  // ---------------------------------------------------------------
  const hudLevel = $("#hud-level");
  function setLevel(section) {
    const n = Number(section.dataset.lvl);
    hudLevel.textContent =
      n <= TOTAL_LEVELS
        ? `LVL ${pad(n)}/${pad(TOTAL_LEVELS)} ${section.dataset.name}`
        : "BONUS STAGE";
  }
  $$("[data-lvl]").forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: "top 55%",
      end: "bottom 55%",
      onToggle: (self) => self.isActive && setLevel(section),
    });
  });

  gsap.to("#progress-fill", {
    scaleX: 1,
    ease: "none",
    scrollTrigger: { start: 0, end: "max", scrub: true },
  });

  // ---------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------
  const skip = $(".skip");
  if (skip) skip.dataset.go = "work";
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-go]");
    if (!link) return;
    const go = landing[link.dataset.go];
    if (!go) return;
    e.preventDefault();
    lenis.scrollTo(go(), {
      duration: 2.2,
      easing: (t) => 1 - Math.pow(1 - t, 4),
    });
  });

  // ---------------------------------------------------------------
  // Cursor: a 1-bit square that inverts whatever is under it
  // ---------------------------------------------------------------
  if (matchMedia("(pointer: fine)").matches) {
    html.classList.add("has-cursor");
    const cur = $("#cursor");
    const qx = gsap.quickTo(cur, "x", { duration: 0.14, ease: "power3" });
    const qy = gsap.quickTo(cur, "y", { duration: 0.14, ease: "power3" });
    window.addEventListener("pointermove", (e) => {
      qx(e.clientX);
      qy(e.clientY);
    });
    document.addEventListener("pointerover", (e) => {
      const hot = e.target.closest("a, button, .tile");
      gsap.to(cur, {
        scale: hot ? 2.4 : 1,
        duration: 0.15,
        ease: "steps(3)",
        overwrite: "auto",
      });
    });
    document.addEventListener("pointerdown", () =>
      gsap.to(cur, { scale: 0.6, duration: 0.08, overwrite: "auto" }),
    );
    document.addEventListener("pointerup", () =>
      gsap.to(cur, { scale: 1, duration: 0.12, overwrite: "auto" }),
    );
  }

  // ---------------------------------------------------------------
  // Loader
  // ---------------------------------------------------------------
  const loader = $("#loader");
  const fill = $("#loader-fill");
  const num = $("#loader-num");
  const prog = { v: 0 };
  const paint = () => {
    const v = Math.round(prog.v);
    num.textContent = v;
    fill.style.width = v + "%";
  };

  function exitLoader() {
    gsap.fromTo(
      loader,
      { clipPath: "inset(0% 0% 0% 0%)" },
      {
        clipPath: "inset(0% 0% 100% 0%)",
        duration: 0.9,
        ease: "steps(9)",
        onComplete: () => {
          loader.remove();
          lenis.start();
          typeTl.play();
        },
      },
    );
  }

  const pageLoaded = new Promise((resolve) =>
    document.readyState === "complete"
      ? resolve()
      : window.addEventListener("load", resolve, { once: true }),
  );
  const minTime = new Promise((resolve) => setTimeout(resolve, 1100));

  gsap.to(prog, { v: 88, duration: 1.2, ease: "power1.out", onUpdate: paint });
  Promise.all([document.fonts.ready, pageLoaded, minTime]).then(() => {
    ScrollTrigger.refresh();
    gsap.killTweensOf(prog);
    gsap.to(prog, {
      v: 100,
      duration: 0.4,
      ease: "none",
      onUpdate: paint,
      onComplete: exitLoader,
    });
  });

  window.__booted = true;
})();
