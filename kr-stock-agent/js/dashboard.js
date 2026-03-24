// js/dashboard.js
import { state } from './state.js';
import { fmt$, fmtP, esc } from './utils.js';
import { getAvgBuy, getHoldingQty, calcRealizedPnL, calcUnrealizedPnL } from './portfolio.js';

function getSellTrades() {
  return state.portfolio.trades.filter(t => t.type === 'sell' && t.pnl != null);
}

function roundPnl(v) { return Math.round(v * 100) / 100; }

function aggMonthly(year) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    key: `${year}-${String(i + 1).padStart(2, '0')}`,
    label: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'][i],
    pnl: 0, trades: 0, wins: 0
  }));
  getSellTrades().forEach(t => {
    if (!t.date || typeof t.date !== 'string' || t.date.length < 7) return;
    if (!t.date.startsWith(String(year))) return;
    const m = parseInt(t.date.slice(5, 7), 10) - 1;
    if (m < 0 || m > 11) return;
    months[m].pnl = roundPnl(months[m].pnl + (t.pnl ?? 0));
    months[m].trades++;
    if ((t.pnl ?? 0) > 0) months[m].wins++;
  });
  return months;
}

function aggYearly() {
  const map = {};
  getSellTrades().forEach(t => {
    if (!t.date || typeof t.date !== 'string') return;
    const y = t.date.slice(0, 4);
    if (!y || y.length !== 4) return;
    if (!map[y]) map[y] = { key: y, label: y + '년', pnl: 0, trades: 0, wins: 0 };
    map[y].pnl = roundPnl(map[y].pnl + (t.pnl ?? 0));
    map[y].trades++;
    if ((t.pnl ?? 0) > 0) map[y].wins++;
  });
  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
}

export function getAvailableYears() {
  const years = new Set();
  getSellTrades().forEach(t => {
    if (t.date && typeof t.date === 'string' && t.date.length >= 4) {
      const y = parseInt(t.date.slice(0, 4), 10);
      if (!isNaN(y)) years.add(y);
    }
  });
  if (years.size === 0) years.add(new Date().getFullYear());
  return [...years].sort((a, b) => a - b);
}

export function switchPeriod(p) {
  state.dashPeriod = p;
  renderDash();
}

export function changeYear(delta) {
  const years = getAvailableYears();
  const minY = years.reduce((a, b) => Math.min(a, b), new Date().getFullYear() - 1);
  const maxY = years.reduce((a, b) => Math.max(a, b), new Date().getFullYear());
  state.dashYear = Math.max(minY, Math.min(maxY, state.dashYear + delta));
  if (state.dashChart) { state.dashChart.destroy(); state.dashChart = null; }
  renderDash();
}

export function renderPeriodChart(rows) {
  const canvas = document.getElementById('dashChart');
  if (!canvas) return;
  if (state.dashChart) { state.dashChart.destroy(); state.dashChart = null; }
  
  const labels = rows.map(r => r.label);
  const data = rows.map(r => Math.round(r.pnl * 100) / 100);
  
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const green = isDark ? 'rgba(52, 211, 153, 0.85)' : 'rgba(16, 185, 129, 0.85)';
  const greenB = isDark ? '#34d399' : '#10b981';
  const red = isDark ? 'rgba(248, 113, 113, 0.85)' : 'rgba(239, 68, 68, 0.85)';
  const redB = isDark ? '#f87171' : '#ef4444';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  
  const colors = data.map(v => v >= 0 ? green : red);
  const borderColors = data.map(v => v >= 0 ? greenB : redB);
  
  state.dashChart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: borderColors, borderWidth: 1.5, borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1e293b' : '#0f172a', titleColor: '#94a3b8', bodyColor: '#f8fafc',
          padding: 12, cornerRadius: 8,
          callbacks: { label: ctx => { const v = ctx.parsed.y; return (v >= 0 ? '+' : '') + fmt$(v); } },
          titleFont: { family: 'JetBrains Mono, monospace', size: 12 }, bodyFont: { family: 'JetBrains Mono, monospace', size: 13, weight: '600' }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'JetBrains Mono, monospace', size: 10 }, maxRotation: 0, maxTicksLimit: state.dashPeriod === 'monthly' ? 12 : 10 }, border: { display: false } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'JetBrains Mono, monospace', size: 10 }, callback: v => v === 0 ? '$0' : (v > 0 ? '+' : '') + fmt$(v) }, border: { display: false } }
      }
    }
  });
}

export function renderAllocationChart() {
  const canvas = document.getElementById('allocChart');
  if (!canvas) return;
  if (state.dashAllocChart) { state.dashAllocChart.destroy(); state.dashAllocChart = null; }

  const active = state.portfolio.positions.filter(p => p.status === 'holding');
  if (active.length === 0) return;

  const dataMap = {};
  active.forEach(p => {
    const qty = getHoldingQty(p);
    const price = state.currentPrices[p.ticker] || getAvgBuy(p);
    const value = qty * price;
    dataMap[p.ticker] = (dataMap[p.ticker] || 0) + value;
  });

  const labels = Object.keys(dataMap);
  const data = Object.values(dataMap);
  
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const colors = [
    'rgba(99, 102, 241, 0.8)',  // Indigo
    'rgba(236, 72, 153, 0.8)',  // Pink
    'rgba(245, 158, 11, 0.8)',  // Amber
    'rgba(16, 185, 129, 0.8)',  // Emerald
    'rgba(59, 130, 246, 0.8)',  // Blue
    'rgba(139, 92, 246, 0.8)',  // Violet
    'rgba(244, 63, 94, 0.8)',   // Rose
  ];

  state.dashAllocChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        hoverOffset: 4,
        borderWidth: isDark ? 2 : 1,
        borderColor: isDark ? '#1e293b' : '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: isDark ? '#94a3b8' : '#64748b',
            font: { family: 'JetBrains Mono, monospace', size: 11 },
            padding: 20,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: isDark ? '#1e293b' : '#0f172a',
          padding: 12,
          callbacks: {
            label: ctx => {
              const v = ctx.parsed;
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const p = ((v / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${fmt$(v)} (${p}%)`;
            }
          }
        }
      }
    }
  });
}

export function renderDash() {
  const cont = document.getElementById('dashContent');
  if (!cont) return;
  const active = state.portfolio.positions.filter(p => p.status === 'holding');
  
  const totalInvested = active.reduce((s, p) => s + getAvgBuy(p) * getHoldingQty(p), 0);
  const totalRealizedPnL = roundPnl(state.portfolio.positions.reduce((s, p) => s + calcRealizedPnL(p), 0));
  
  let totalUnrealizedPnL = 0;
  let hasRealtimePrices = Object.keys(state.currentPrices).length > 0;
  active.forEach(p => {
     if (state.currentPrices[p.ticker] != null) {
        const u = calcUnrealizedPnL(p, state.currentPrices[p.ticker]);
        if (u != null) totalUnrealizedPnL += u;
     }
  });
  totalUnrealizedPnL = roundPnl(totalUnrealizedPnL);
  
  const totalNetPnL = roundPnl(totalRealizedPnL + totalUnrealizedPnL);
  const pnlBg = totalNetPnL >= 0 ? 'var(--buy)' : 'var(--sell)';

  const monthlyRows = aggMonthly(state.dashYear);
  const yearlyRows = aggYearly();
  
  if (state.portfolio.trades.filter(t => t.type === 'sell').length === 0 && active.length === 0) {
    cont.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><div class="empty-t">데이터가 부족합니다</div><div class="empty-s">매수/매도 기록이 추가되면 성과 통계 및 차트를 보여드립니다.</div></div>';
    return;
  }

  const statusText = state.isLoadingPrices ? '⏳ 갱신 중...' : (hasRealtimePrices ? '✅ 시세 연동됨' : '⚠️ 조회 전');

  let html = '<div style="padding:0 16px;">';
  
  html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; margin-bottom: 8px;">
    <span style="font-size:12px;color:var(--text-3);font-weight:600;">손익 요약 (${statusText})</span>
    <div style="display:flex; gap:8px;">
      <button data-action="snapshot" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;color:var(--text-2);box-shadow:var(--sh);">📸 스냅샷</button>
      <button data-action="refresh_prices" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;color:var(--text-2);box-shadow:var(--sh);">${state.isLoadingPrices ? '⏳' : '🔄 시세 갱신'}</button>
    </div>
  </div>`;
  
  html += '<div style="background:' + pnlBg + ';color:white;border-radius:var(--r-xl);padding:24px 20px;margin:10px 0 16px;box-shadow:var(--sh-lg);transition:background 0.3s ease;">';
  html += '<div style="font-size:12px;opacity:0.8;font-weight:600">총 누적 손익 (Net PnL)</div>';
  html += '<div style="font-size:36px;font-weight:700;margin-bottom:12px;">' + (totalNetPnL >= 0 ? '+' : '') + fmt$(totalNetPnL) + '</div>';
  
  html += '<div style="display:flex;gap:16px;font-size:13px;border-top:1px solid rgba(255,255,255,0.2);padding-top:12px;">';
  html += `<div style="flex:1"><div style="opacity:0.8;font-size:11px;margin-bottom:2px;font-weight:600">실현 (확정)</div><div style="font-family:var(--mono);font-weight:700;font-size:15px;">${totalRealizedPnL>=0?'+':''}${fmt$(totalRealizedPnL)}</div></div>`;
  html += `<div style="flex:1"><div style="opacity:0.8;font-size:11px;margin-bottom:2px;font-weight:600">미실현 (보유)</div><div style="font-family:var(--mono);font-weight:700;font-size:15px;">${totalUnrealizedPnL>=0?'+':''}${fmt$(totalUnrealizedPnL)}</div></div>`;
  html += '</div>';
  html += '</div>';
  
  html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;margin-bottom:12px;box-shadow:var(--sh);">';
  html += '<div style="font-size:13px;font-weight:700;margin-bottom:8px;">자산 배분 현황</div>';
  html += '<div style="position:relative;height:180px;margin-top:10px;"><canvas id="allocChart"></canvas></div>';
  html += '</div>';

  html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;margin-bottom:12px;box-shadow:var(--sh);">';
  html += '<div style="font-size:13px;font-weight:700;margin-bottom:8px;">월별 실현 손익 차트</div>';
  html += '<div style="position:relative;height:220px;margin-top:16px;"><canvas id="dashChart"></canvas></div>';
  html += '</div></div>';

  cont.innerHTML = html;

  requestAnimationFrame(() => {
    const chartRows = state.dashPeriod === 'monthly' ? monthlyRows : yearlyRows;
    renderPeriodChart(chartRows);
    renderAllocationChart();
  });
}
