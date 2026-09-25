/* ==================================================================
   POWER-UPS SHOWCASE — hover-triggered demos
   Append this to script.js (or include as its own <script> after
   vendor/three.min.js is loaded — see note below).

   Design:
   - Nothing initializes until the user first hovers a tile ("lazy init").
   - Each demo has its own start()/stop() so the render loop is only
     ever running for the ONE tile currently hovered, never more than one
     at a time — keeps this cheap even with Three.js in the mix.
   - Tiles with no JS demo (pixels, motion) just get the .is-active
     class toggled for touch devices; desktop relies on :hover in CSS.
   ================================================================== */

(function () {
  var grid = document.getElementById("powergrid");
  if (!grid) return;

  var tiles = grid.querySelectorAll(".ptile");
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --------------------------------------------------------------
  // Registry: one entry per data-demo value. Each has init() (called
  // once, lazily) and start()/stop() (called on every hover in/out).
  // --------------------------------------------------------------
  var demos = {
    three: {
      ready: false,
      scene: null,
      camera: null,
      renderer: null,
      mesh: null,
      raf: null,
      init: function (canvas) {
        // Requires THREE to be loaded globally (vendor/three.min.js).
        // If you don't already load Three.js on this page, add:
        // <script src="vendor/three.min.js"></script> before this file.
        if (typeof THREE === "undefined") {
          console.warn("Three.js not loaded — skipping 3D tile demo.");
          return;
        }
        var w = canvas.clientWidth || 200;
        var h = canvas.clientHeight || 150;

        this.renderer = new THREE.WebGLRenderer({
          canvas: canvas,
          alpha: true,
          antialias: true,
        });
        this.renderer.setSize(w, h, false);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        this.camera.position.z = 4;

        var geo = new THREE.IcosahedronGeometry(1.3, 0);
        var mat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          wireframe: true,
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.scene.add(this.mesh);

        this.ready = true;
      },
      start: function () {
        if (!this.ready || reduced) return;
        var self = this;
        (function loop() {
          self.raf = requestAnimationFrame(loop);
          self.mesh.rotation.x += 0.012;
          self.mesh.rotation.y += 0.018;
          self.renderer.render(self.scene, self.camera);
        })();
      },
      stop: function () {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = null;
      },
    },

    particles: {
      ready: false,
      ctx: null,
      w: 0,
      h: 0,
      points: [],
      raf: null,
      init: function (canvas) {
        this.ctx = canvas.getContext("2d");
        this.w = canvas.width = canvas.clientWidth;
        this.h = canvas.height = canvas.clientHeight;
        var count = 40;
        this.points = [];
        for (var i = 0; i < count; i++) {
          this.points.push({
            x: Math.random() * this.w,
            y: Math.random() * this.h,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6,
          });
        }
        this.ready = true;
      },
      start: function () {
        if (!this.ready || reduced) return;
        var self = this;
        (function loop() {
          self.raf = requestAnimationFrame(loop);
          var ctx = self.ctx;
          ctx.clearRect(0, 0, self.w, self.h);
          ctx.fillStyle = "#fff";
          self.points.forEach(function (p) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > self.w) p.vx *= -1;
            if (p.y < 0 || p.y > self.h) p.vy *= -1;
            ctx.fillRect(p.x, p.y, 2, 2);
          });
          // simple connecting lines for a "network" feel
          ctx.strokeStyle = "rgba(255,255,255,0.25)";
          for (var i = 0; i < self.points.length; i++) {
            for (var j = i + 1; j < self.points.length; j++) {
              var a = self.points[i],
                b = self.points[j];
              var dx = a.x - b.x,
                dy = a.y - b.y;
              if (dx * dx + dy * dy < 3000) {
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
              }
            }
          }
        })();
      },
      stop: function () {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = null;
      },
    },
  };

  // --------------------------------------------------------------
  // Wire up hover behavior per tile
  // --------------------------------------------------------------
  tiles.forEach(function (tile) {
    var demoName = tile.dataset.demo; // "three" | "particles" | undefined
    var canvas = tile.querySelector(".ptile-canvas");
    var demo = demoName ? demos[demoName] : null;

    tile.addEventListener("mouseenter", function () {
      if (!demo || !canvas) return; // pixels/motion tiles: CSS handles it
      if (!demo.ready) demo.init(canvas);
      demo.start();
    });

    tile.addEventListener("mouseleave", function () {
      if (!demo) return;
      demo.stop();
    });

    // Touch fallback: tap toggles .is-active so CSS hover-styles apply,
    // and starts/stops the same demo loop.
    tile.addEventListener(
      "touchstart",
      function () {
        tiles.forEach(function (t) {
          if (t !== tile) t.classList.remove("is-active");
        });
        var wasActive = tile.classList.contains("is-active");
        tile.classList.toggle("is-active");
        if (demo && canvas) {
          if (!wasActive) {
            if (!demo.ready) demo.init(canvas);
            demo.start();
          } else {
            demo.stop();
          }
        }
      },
      { passive: true },
    );
  });
})();
