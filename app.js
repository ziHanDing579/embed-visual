// app.js
// Wires the UI together: capture sentences, embed them, define axes, plot points,
// and let the user promote any captured sentence to be the new axis.

import { CONFIG } from "./config.js";
import { getEmbedding } from "./embeddings.js";
import { normalize, cosineSimilarity, clamp01, makeOrthogonalTo } from "./linalg.js";
import { Plot } from "./chart.js";

const state = {
  sentences: [], // { id, text, embedding: number[] }
  axisId: null, // id of the sentence acting as the embedding (Y) axis
  yAxis: null, // unit vector: embedding of the axis sentence
  xAxis: null, // unit vector: orthogonal to yAxis
  points: [], // { id, text, x, y, isAxis }
};

let seq = 0;
const nextId = () => `s${++seq}`;

// ---- DOM refs -------------------------------------------------------------
const els = {
  form: document.getElementById("capture-form"),
  input: document.getElementById("sentence-input"),
  submit: document.getElementById("submit-btn"),
  list: document.getElementById("sentence-list"),
  count: document.getElementById("count"),
  mode: document.getElementById("mode"),
  axisReadout: document.getElementById("axis-readout"),
  status: document.getElementById("status"),
  svg: document.getElementById("plot"),
};

const plot = new Plot(els.svg);
els.mode.textContent = CONFIG.USE_MOCK ? "MOCK" : "LIVE";

// ---- Core logic -----------------------------------------------------------

/** Set sentence `id` as the axis: its embedding is Y, a fresh orthogonal vector is X. */
function setAxis(id) {
  const s = state.sentences.find((x) => x.id === id);
  if (!s) return;
  state.axisId = id;
  state.yAxis = normalize(s.embedding);
  state.xAxis = makeOrthogonalTo(state.yAxis, CONFIG.ORTHO_SEED, s.embedding.length);
  recomputeAndRender();
}

/** Recompute every point's coordinates against the current axes and repaint. */
function recomputeAndRender() {
  if (!state.xAxis || !state.yAxis) {
    state.points = [];
  } else {
    state.points = state.sentences.map((s) => ({
      id: s.id,
      text: s.text,
      x: clamp01(cosineSimilarity(s.embedding, state.xAxis)),
      y: clamp01(cosineSimilarity(s.embedding, state.yAxis)),
      isAxis: s.id === state.axisId,
    }));
  }
  plot.render(state.points);
  renderList();
  renderAxisReadout();
}

async function addSentence(text) {
  setBusy(true, "Embedding…");
  try {
    const embedding = await getEmbedding(text);
    const entry = { id: nextId(), text, embedding };
    state.sentences.push(entry);

    // First sentence defines the axes automatically.
    if (state.axisId === null) {
      setAxis(entry.id);
    } else {
      recomputeAndRender();
    }
    setStatus(`Plotted “${truncate(text, 40)}”`);
  } catch (err) {
    console.error(err);
    setStatus(
      CONFIG.USE_MOCK
        ? "Something went wrong generating the embedding."
        : "Couldn't reach the embedding endpoint. Check EMBEDDING_ENDPOINT in config.js, or set USE_MOCK to true.",
      true
    );
  } finally {
    setBusy(false);
  }
}

// ---- Rendering: sidebar + readouts ----------------------------------------

function renderList() {
  els.count.textContent = String(state.sentences.length);
  els.list.replaceChildren();

  for (const s of state.sentences) {
    const isAxis = s.id === state.axisId;
    const p = state.points.find((pt) => pt.id === s.id);

    const row = document.createElement("button");
    row.type = "button";
    row.className = "row" + (isAxis ? " row-axis" : "");
    row.setAttribute("aria-pressed", String(isAxis));
    row.title = isAxis ? "Current axis" : "Set as axis";
    row.addEventListener("click", () => {
      if (!isAxis) setAxis(s.id);
    });

    const tag = document.createElement("span");
    tag.className = "row-tag";
    tag.textContent = isAxis ? "AXIS" : "SET";

    const txt = document.createElement("span");
    txt.className = "row-text";
    txt.textContent = s.text;

    const coord = document.createElement("span");
    coord.className = "row-coord";
    coord.textContent = p ? `${p.x.toFixed(2)}, ${p.y.toFixed(2)}` : "";

    row.append(tag, txt, coord);
    els.list.appendChild(row);
  }
}

function renderAxisReadout() {
  const s = state.sentences.find((x) => x.id === state.axisId);
  if (!s) {
    els.axisReadout.innerHTML = `<span class="ar-label">AXIS</span><span class="ar-empty">none yet</span>`;
    return;
  }
  els.axisReadout.innerHTML = `<span class="ar-label">AXIS</span>`;
  const q = document.createElement("span");
  q.className = "ar-text";
  q.textContent = s.text;
  els.axisReadout.appendChild(q);
}

// ---- UI plumbing ----------------------------------------------------------

function setBusy(busy, label) {
  els.submit.disabled = busy;
  els.input.disabled = busy;
  els.submit.textContent = busy ? label || "…" : "Plot";
  if (!busy) els.input.focus();
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle("is-error", isError);
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = els.input.value.trim();
  if (!text) return;
  els.input.value = "";
  addSentence(text);
});

// First paint.
recomputeAndRender();
setStatus(
  CONFIG.USE_MOCK
    ? "Running on the local mock. Set USE_MOCK to false in config.js for real embeddings."
    : "Ready."
);