// js/utils.js

export const TODAY = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

export function pg(p) { document.getElementById('pg').style.width = p + '%'; }
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export function uid() {
  try { return crypto.randomUUID(); }
  catch(e) { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
}

export function fmt$(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—';
  const abs = Math.abs(n);
  const str = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? '-' + str : str;
}

export function fmtP(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—';
  const s = n >= 0 ? '+' : '';
  return s + (n * 100).toFixed(2) + '%';
}

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

export function localDateStr(d) {
  const dt = d || new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addLog(icon, html) {
  const el = document.getElementById('agentLog');
  if (!el) return;
  const d = document.createElement('div');
  d.className = 'alog';
  d.innerHTML = `<span class="al-icon">${icon}</span> ${html}`;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
  if (el.children.length > 40) el.firstChild.remove();
}

