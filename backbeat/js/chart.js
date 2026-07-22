/**
 * BACKBEAT — chart loading.
 * A chart is JSON: { title, artist, audio, bpm, offset, notes: [{time, lane}] }
 * time is in seconds (float), lane 0-3. notes sorted by time.
 */

export async function loadManifest(base = 'charts/') {
  const res = await fetch(base + 'manifest.json');
  if (!res.ok) throw new Error('chart manifest not found');
  return res.json();
}

export async function loadChart(base, file) {
  const res = await fetch(base + file);
  if (!res.ok) throw new Error('chart not found: ' + file);
  const chart = await res.json();
  // normalize: sort notes by time, coerce types
  chart.notes = (chart.notes || [])
    .map(n => ({ time: Number(n.time), lane: Number(n.lane) }))
    .filter(n => Number.isFinite(n.time) && n.lane >= 0 && n.lane <= 3)
    .sort((a, b) => a.time - b.time);
  chart.offset = Number(chart.offset) || 0;
  return chart;
}
