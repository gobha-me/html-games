import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export function recordParticleArcs(api) {
  const arcs = [];
  // Canvas/DOM are external boundaries. The real renderer and its real
  // drawParticles function execute; this port only records Canvas calls.
  const context = {
    save() {}, restore() {}, beginPath() {}, fill() {},
    arc(...args) { arcs.push(args); },
  };
  const canvas = { width: 300, height: 600, getContext: () => context };
  api.document.getElementById = () => canvas;
  api.window.addEventListener = () => {};
  const path = fileURLToPath(new URL('../js/renderer.js', import.meta.url));
  vm.runInContext(readFileSync(path, 'utf8'), api, { filename: path });
  api.initRenderer();
  api.drawParticles();
  return arcs;
}
