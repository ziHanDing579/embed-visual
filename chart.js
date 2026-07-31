// chart.js
// A dependency-free SVG scatter plot confined to the first quadrant [0,1] x [0,1].
// X = similarity to the orthogonal axis, Y = similarity to the embedding axis.
// Points are keyed by id so that changing the axis animates them to new positions.

const NS = "http://www.w3.org/2000/svg";
const TICKS = [0, 0.25, 0.5, 0.75, 1];

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export class Plot {
  constructor(svg) {
    this.svg = svg;
    this.W = 760;
    this.H = 560;
    this.pad = { t: 28, r: 28, b: 58, l: 62 };
    this.nodes = new Map(); // id -> <g> for a point

    this.svg.setAttribute("viewBox", `0 0 ${this.W} ${this.H}`);
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", "Scatter plot of sentence similarities");

    this._buildStatic();
  }

  get plotW() {
    return this.W - this.pad.l - this.pad.r;
  }
  get plotH() {
    return this.H - this.pad.t - this.pad.b;
  }
  px(x) {
    return this.pad.l + x * this.plotW;
  }
  py(y) {
    return this.pad.t + (1 - y) * this.plotH;
  }

  _buildStatic() {
    const { pad } = this;
    const x0 = this.px(0);
    const y0 = this.py(0);
    const x1 = this.px(1);
    const y1 = this.py(1);

    // Recessed plate.
    this.svg.appendChild(
      el("rect", {
        x: pad.l,
        y: pad.t,
        width: this.plotW,
        height: this.plotH,
        rx: 6,
        class: "plate-bg",
      })
    );

    // Grid + tick labels.
    const grid = el("g", { class: "grid" });
    for (const t of TICKS) {
      const gx = this.px(t);
      const gy = this.py(t);
      grid.appendChild(el("line", { x1: gx, y1, x2: gx, y2: y1, class: "gridline" }));
      grid.appendChild(el("line", { x1: x0, y1: gy, x2: x1, y2: gy, class: "gridline" }));

      const tx = el("text", { x: gx, y: y0 + 20, class: "tick" });
      tx.textContent = t.toFixed(2);
      grid.appendChild(tx);

      if (t !== 0) {
        const ty = el("text", { x: x0 - 12, y: gy + 4, class: "tick tick-y" });
        ty.textContent = t.toFixed(2);
        grid.appendChild(ty);
      }
    }
    this.svg.appendChild(grid);

    // Axes (the L in the corner).
    this.svg.appendChild(el("line", { x1: x0, y1: y0, x2: x1, y2: y0, class: "axis" }));
    this.svg.appendChild(el("line", { x1: x0, y1: y0, x2: x0, y2: y1, class: "axis" }));

    // Axis titles.
    const xt = el("text", { x: (x0 + x1) / 2, y: this.H - 16, class: "axis-title" });
    xt.textContent = "similarity  →  orthogonal axis";
    this.svg.appendChild(xt);

    const yt = el("text", {
      x: 18,
      y: (y0 + y1) / 2,
      class: "axis-title",
      transform: `rotate(-90 18 ${(y0 + y1) / 2})`,
    });
    yt.textContent = "similarity  →  embedding axis";
    this.svg.appendChild(yt);

    // Layer that holds the data points (drawn on top).
    this.pointsLayer = el("g", { class: "points" });
    this.svg.appendChild(this.pointsLayer);

    // Empty-state prompt.
    this.empty = el("text", {
      x: this.px(0.5),
      y: this.py(0.5),
      class: "empty-note",
    });
    this.empty.textContent = "Plot a sentence to define the first axis";
    this.svg.appendChild(this.empty);
  }

  /**
   * Render the given points.
   * @param {{id:string,text:string,x:number,y:number,isAxis:boolean}[]} points
   */
  render(points) {
    this.empty.style.display = points.length ? "none" : "";

    const seen = new Set();

    for (const p of points) {
      seen.add(p.id);
      let g = this.nodes.get(p.id);
      if (!g) {
        g = el("g", { class: "pt", tabindex: "0" });
        const halo = el("circle", { r: 12, class: "pt-halo" });
        const dot = el("circle", { r: 5.5, class: "pt-dot" });
        const title = el("title");
        g.appendChild(halo);
        g.appendChild(dot);
        g.appendChild(title);
        this.pointsLayer.appendChild(g);
        this.nodes.set(p.id, g);
      }

      g.setAttribute("transform", `translate(${this.px(p.x)} ${this.py(p.y)})`);
      g.classList.toggle("is-axis", p.isAxis);
      g.querySelector("title").textContent =
        `${p.text}\n( x ${p.x.toFixed(3)},  y ${p.y.toFixed(3)} )`;
      g.setAttribute(
        "aria-label",
        `${p.text}. orthogonal ${p.x.toFixed(2)}, embedding ${p.y.toFixed(2)}`
      );
    }

    // Remove points no longer present.
    for (const [id, g] of this.nodes) {
      if (!seen.has(id)) {
        g.remove();
        this.nodes.delete(id);
      }
    }
  }
}