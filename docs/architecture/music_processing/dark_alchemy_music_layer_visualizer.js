window.startDarkAlchemyVisualizer = function startDarkAlchemyVisualizer({ canvas, state, laneDefs, laneActive }) {
  const c = canvas.getContext("2d");

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const now = performance.now();
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#0a0c0d";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#26302e";
    for (let i = 0; i < 16; i++) {
      const x = i * w / 16;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
    }
    const ids = laneDefs.map(l => l[0]);
    ids.forEach((id, idx) => drawLane(id, idx, w));
    state.flashes = state.flashes.filter(f => now - f.t < 380);
    state.flashes.forEach(f => drawFlash(f, ids, w, now));
    requestAnimationFrame(draw);
  }

  function drawLane(id, idx, w) {
    const y = 18 + idx * 24;
    c.fillStyle = laneActive(id) ? laneDefs[idx][4] : "#3a4541";
    c.globalAlpha = laneActive(id) ? 0.9 : 0.28;
    c.fillRect(18, y, w - 36, 4);
    c.globalAlpha = 1;
    c.fillStyle = "#9ba8a2";
    c.font = "12px Segoe UI";
    c.fillText(laneDefs[idx][1], 20, y - 4);
  }

  function drawFlash(f, ids, w, now) {
    const idx = ids.indexOf(f.id);
    if (idx < 0) return;
    const age = (now - f.t) / 380;
    const x = w - 36 - age * (w - 70);
    const y = 20 + idx * 24;
    c.fillStyle = laneDefs[idx][4];
    c.globalAlpha = 1 - age;
    c.beginPath();
    c.arc(x, y + 1, 7 + (1 - age) * 8, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }

  draw();
};
