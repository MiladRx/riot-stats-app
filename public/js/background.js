(function () {
  var canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  document.body.prepend(canvas);

  var ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  var orbs = [
    { x: 0.12, y: 0.08,  r: 0.55, color: '10,132,255',  opacity: 0.055, speed: 0.00012, angle: 0,    drift: 0.06 },
    { x: 0.88, y: 0.90,  r: 0.50, color: '191,90,242',  opacity: 0.045, speed: 0.00009, angle: 2.1,  drift: 0.07 },
    { x: 0.50, y: 0.45,  r: 0.45, color: '10,132,255',  opacity: 0.02,  speed: 0.00015, angle: 4.2,  drift: 0.04 },
    { x: 0.75, y: 0.15,  r: 0.40, color: '191,90,242',  opacity: 0.025, speed: 0.00011, angle: 1.0,  drift: 0.05 },
    { x: 0.20, y: 0.80,  r: 0.42, color: '61,165,255',  opacity: 0.025, speed: 0.00008, angle: 3.5,  drift: 0.05 },
  ];

  function draw() {
    if (window._bgStop) return;
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    orbs.forEach(function (o) {
      o.angle += o.speed * 16;
      var cx = (o.x + Math.sin(o.angle * 1.3) * o.drift) * w;
      var cy = (o.y + Math.cos(o.angle)       * o.drift) * h;
      var radius = o.r * Math.min(w, h);

      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0,   'rgba(' + o.color + ',' + o.opacity + ')');
      grad.addColorStop(0.5, 'rgba(' + o.color + ',' + (o.opacity * 0.4) + ')');
      grad.addColorStop(1,   'rgba(' + o.color + ',0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  draw();
})();
