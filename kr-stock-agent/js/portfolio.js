// js/portfolio.js
import { state } from './state.js';
import { uid, esc, fmt$, fmtP } from './utils.js';
import { fetchCurrentPrices } from './price_api.js';

export function loadPortfolio() {
  try {
    const d = localStorage.getItem('us_portfolio');
    if (d) {
      const parsed = JSON.parse(d);
      state.portfolio = {
        positions: Array.isArray(parsed.positions) ? parsed.positions.map(sanitizePos) : [],
        trades: Array.isArray(parsed.trades) ? parsed.trades.map(sanitizeTrade) : [],
      };
    }
  } catch (e) {
    console.warn('Portfolio 로드 실패, 초기화합니다.', e);
    state.portfolio = { positions: [], trades: [] };
  }
}

function sanitizePos(p) {
  return {
    ...p,
    buyTrades: Array.isArray(p.buyTrades) ? p.buyTrades : [],
    sellTrades: Array.isArray(p.sellTrades) ? p.sellTrades : [],
    status: p.status || 'holding',
    group: (['ultra','short','long'].includes((p.group||'').toLowerCase())) ? (p.group||'').toLowerCase() : 'long',
  };
}

function sanitizeTrade(t) {
  return {
    ...t,
    id: t.id || uid(),
    type: (t.type === 'buy' || t.type === 'sell') ? t.type : 'buy',
    ticker: String(t.ticker || ''),
    price: isFinite(Number(t.price)) ? Number(t.price) : 0,
    qty: isFinite(Number(t.qty)) ? Math.max(0, Math.floor(Number(t.qty))) : 0,
    amount: isFinite(Number(t.amount)) ? Number(t.amount) : 0,
    pnl: t.pnl != null && isFinite(Number(t.pnl)) ? Number(t.pnl) : null,
    date: typeof t.date === 'string' ? t.date : '',
  };
}

export function savePortfolio() {
  try {
    localStorage.setItem('us_portfolio', JSON.stringify(state.portfolio));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
      alert('⚠ 저장 공간이 부족합니다.\n오래된 거래 데이터를 정리하거나 브라우저 저장소를 확인해주세요.');
    }
  }
}

// Helpers
export function getAvgBuy(pos) {
  if (!pos?.buyTrades?.length) return 0;
  const t = pos.buyTrades.reduce((a, b) => ({ amt: a.amt + (b.price || 0) * (b.qty || 0), qty: a.qty + (b.qty || 0) }), { amt: 0, qty: 0 });
  return t.qty > 0 ? t.amt / t.qty : 0;
}

export function getHoldingQty(pos) {
  if (!pos) return 0;
  const bought = (pos.buyTrades || []).reduce((s, t) => s + (t.qty || 0), 0);
  const sold = (pos.sellTrades || []).reduce((s, t) => s + (t.qty || 0), 0);
  return bought - sold;
}

export function calcUnrealizedPnL(pos, currentPrice) {
  const hq = getHoldingQty(pos);
  const avg = getAvgBuy(pos);
  if (currentPrice == null || !avg || hq <= 0) return null;
  return (currentPrice - avg) * hq;
}

export function calcRealizedPnL(pos) {
  return (pos.sellTrades || []).reduce((s, t) => s + (t.pnl ?? 0), 0);
}

export function getDaysHeld(pos) {
  if (!pos.createdAt) return 0;
  const dt = new Date(pos.createdAt);
  if (isNaN(dt.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24)));
}

// Rendering
export function renderPortfolio() {
  const cont = document.getElementById('portfolioContent');
  if (!cont) return;
  const active = state.portfolio.positions.filter(p => p.status === 'holding');
  const closed = state.portfolio.positions.filter(p => p.status === 'closed');
  
  if (active.length === 0 && closed.length === 0) {
    cont.innerHTML = `<div class="empty"><div class="empty-icon">💼</div><div class="empty-t">보유 종목 없음</div><div class="empty-s">탐색 탭에서 추천 종목을 매수 기록하면 여기에 표시됩니다.</div></div>`;
    return;
  }
  
  const grpOrder = ['ultra', 'short', 'long'];
  const grpMeta = {
    ultra: { icon: '⚡', label: '초단기 보유 중' },
    short: { icon: '📅', label: '단기 보유 중' },
    long: { icon: '♾️', label: '장기 보유 중' }
  };
  
  let html = '<div class="port-pad" style="padding: 0 16px;">';
  
  // Real-time price header
  if (active.length > 0) {
    const hasAnyPrice = Object.keys(state.currentPrices).length > 0;
    const statusText = state.isLoadingPrices ? '불러오는 중...' : (hasAnyPrice ? '적용됨' : '대기중 (Finnhub API 필요)');
    const btnText = state.isLoadingPrices ? '⏳ 갱신 중...' : '🔄 시세 갱신';
    
    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; margin-bottom: 8px;">
      <span style="font-size:12px;color:var(--text-3);font-weight:600;">실시간 시세: ${statusText}</span>
      <button data-action="refresh_prices" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;color:var(--text-2);box-shadow:var(--sh);">${btnText}</button>
    </div>`;
  }
  
  for (const grp of grpOrder) {
    const items = active.filter(p => p.group === grp);
    if (items.length === 0) continue;
    const gm = grpMeta[grp];
    html += `<div class="sec-hdr"><span class="sec-title">${gm.icon} ${gm.label}</span><span class="sec-count">${items.length}</span></div>`;
    for (const pos of items) html += renderPosCard(pos);
  }
  if (closed.length > 0) {
    html += `<div class="sec-hdr" style="margin-top:20px"><span class="sec-title">🏁 청산 완료</span><span class="sec-count">${closed.length}</span></div>`;
    for (const pos of closed) html += renderClosedRow(pos);
  }
  html += '</div>';
  cont.innerHTML = html;
}

function renderPosCard(pos) {
  const avg = getAvgBuy(pos);
  const hq = getHoldingQty(pos);
  const realizedPnL = calcRealizedPnL(pos);
  
  const livePrice = state.currentPrices[pos.ticker];
  const agentTargetNum = parseFloat((pos.agentTarget || '').replace(/[$,]/g, ''));
  
  const unr = (livePrice != null) ? calcUnrealizedPnL(pos, livePrice) : null;
  const targetUnr = (isNaN(agentTargetNum) || !isFinite(agentTargetNum)) ? null : calcUnrealizedPnL(pos, agentTargetNum);
  
  const displayUnr = unr !== null ? unr : targetUnr;
  const hasUnr = displayUnr !== null;
  const isReal = unr !== null;

  const pnlBgColor = !hasUnr 
    ? (realizedPnL > 0 ? 'var(--buy)' : realizedPnL < 0 ? 'var(--sell)' : 'var(--border)')
    : (displayUnr > 0 ? 'var(--buy)' : displayUnr < 0 ? 'var(--sell)' : (realizedPnL > 0 ? 'var(--buy)' : realizedPnL < 0 ? 'var(--sell)' : 'var(--border)'));
    
  const days = getDaysHeld(pos);
  const pnlRatePct = (hasUnr && avg > 0 && hq > 0) ? Math.abs((displayUnr / (avg * hq)) * 100) : 0;

  return `<div class="pos-card" style="background:var(--bg);border:1px solid var(--border);border-left:4px solid ${pnlBgColor};border-radius:var(--r-lg);margin-bottom:12px;box-shadow:var(--sh);">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:16px 16px 12px;">
      <div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-family:var(--mono);font-size:20px;font-weight:700;letter-spacing:-.02em;">${esc(pos.ticker)}</span>
          <span class="grp-badge ${pos.group}" style="font-size:10px;padding:2px 8px;">${pos.group === 'ultra' ? '⚡' : pos.group === 'short' ? '📅' : '♾️'} ${pos.group.toUpperCase()}</span>
        </div>
        <div style="font-size:12px;color:var(--text-3);margin-top:2px;font-weight:500;">${esc(pos.company || '')}</div>
      </div>
      <div style="text-align:right;">
        ${hasUnr ? `<div style="font-family:var(--mono);font-size:16px;font-weight:700;color:${displayUnr >= 0 ? 'var(--buy)' : 'var(--sell)'}">${fmt$(Math.abs(displayUnr))}</div>
        <div style="font-size:11px;font-family:var(--mono);color:${displayUnr >= 0 ? 'var(--buy)' : 'var(--sell)'}">${displayUnr >= 0 ? '▲' : '▼'} ${pnlRatePct.toFixed(2)}% <span style="font-size:10px;color:var(--text-4)">(${isReal ? '현재가' : '목표가'})</span></div>`
        : `<div style="color:var(--text-4);font-family:var(--mono);font-weight:600">—</div>`}
        ${realizedPnL !== 0 ? `<div style="font-size:10px;font-family:var(--mono);color:${realizedPnL >= 0 ? 'var(--buy)' : 'var(--sell)'};margin-top:6px">${realizedPnL >= 0 ? '+' : ''}${fmt$(realizedPnL)} 실현</div>` : ''}
      </div>
    </div>
    
    <div style="display:grid;grid-template-columns:repeat(3,1fr);background:var(--bg-sub);border-top:1px solid var(--border-sm);border-bottom:1px solid var(--border-sm);">
      <div style="padding:10px 12px;border-right:1px solid var(--border-sm);display:flex;flex-direction:column;gap:2px">
        <span style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);font-family:var(--mono);font-weight:600;">평균매수가</span>
        <span style="font-size:13px;font-weight:600;font-family:var(--mono);">${fmt$(avg)}</span>
      </div>
      <div style="padding:10px 12px;border-right:1px solid var(--border-sm);display:flex;flex-direction:column;gap:2px">
        <span style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);font-family:var(--mono);font-weight:600;">보유수량</span>
        <span style="font-size:13px;font-weight:600;font-family:var(--mono);">${hq}주</span>
      </div>
      <div style="padding:10px 12px;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);font-family:var(--mono);font-weight:600;">보유기간</span>
        <span style="font-size:13px;font-weight:600;font-family:var(--mono);">${days}일</span>
      </div>
    </div>
    
    <div style="display:flex;gap:12px;padding:12px 16px;align-items:center;">
      <div style="flex:1;font-size:11px;color:var(--text-3);line-height:1.4;">
        ${pos.agentCatalyst ? `<span style="font-weight:600">촉매:</span> ${esc(pos.agentCatalyst)}` : 'AI 기록 대기 중'}
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <button data-action="detail" data-id="${esc(pos.id)}" style="background:var(--bg-sub);border:1px solid var(--border);color:var(--text-2);font-size:12px;font-weight:600;padding:8px 14px;border-radius:8px;cursor:pointer;transition:background 0.2s;">상세</button>
        <button data-action="sell_init" data-id="${esc(pos.id)}" style="background:var(--sell-bg);border:1px solid var(--sell-bd);color:var(--sell);font-size:12px;font-weight:600;padding:8px 14px;border-radius:8px;cursor:pointer;transition:opacity 0.2s;">매도 ▼</button>
      </div>
    </div>
  </div>`;
}

function renderClosedRow(pos) {
  const realizedPnL = calcRealizedPnL(pos);
  const avg = getAvgBuy(pos);
  const totalSold = (pos.sellTrades || []).reduce((s, t) => s + (t.qty || 0), 0);
  const sellCostBasis = (pos.sellTrades || []).reduce((s, t) => s + ((t.amount || 0) - (t.pnl ?? 0)), 0);
  const rate = sellCostBasis > 0 ? realizedPnL / sellCostBasis : 0;
  
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:var(--bg);border:1px solid var(--border);border-left:3px solid var(--border-sm);border-radius:var(--r-lg);margin-bottom:8px;box-shadow:var(--sh);">
    <div style="display:flex;flex-direction:column;gap:4px;">
      <span style="font-family:var(--mono);font-size:15px;font-weight:700;">${esc(pos.ticker)} <span style="font-size:11px;color:var(--text-3);font-family:var(--font);font-weight:500;">${esc(pos.company || '')}</span></span>
      <span style="font-size:11px;color:var(--text-3);font-family:var(--mono);font-weight:500;">매수 ${fmt$(avg)} · ${totalSold}주 청산 · ${getDaysHeld(pos)}일</span>
    </div>
    <div style="text-align:right;">
      <div style="font-family:var(--mono);font-size:15px;font-weight:700;color:${realizedPnL >= 0 ? 'var(--buy)' : 'var(--sell)'}">${realizedPnL >= 0 ? '+' : ''}${fmt$(realizedPnL)}</div>
      <div style="font-size:11px;font-family:var(--mono);font-weight:600;margin-top:2px;color:${rate >= 0 ? 'var(--buy)' : 'var(--sell)'}">${fmtP(rate)}</div>
    </div>
  </div>`;
}

export function exportTradesToCSV() {
  const trades = state.portfolio.trades;
  if (trades.length === 0) { alert('내보낼 거래 내역이 없습니다.'); return; }

  let csv = 'Date,Type,Ticker,Price,Qty,Amount,PnL\n';
  trades.forEach(t => {
    csv += `${t.date},${t.type},${t.ticker},${t.price},${t.qty},${t.amount},${t.pnl ?? ''}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `us_stock_trades_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
