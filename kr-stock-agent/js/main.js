// js/main.js
import { 
  getApiKey, getTheme, setTheme, 
  openSettingsModal, saveSettings, closeSettingsModal, logPortfolioSnapshot
} from './api.js';
import { loadPortfolio, renderPortfolio, getAvgBuy, getHoldingQty, calcRealizedPnL, calcUnrealizedPnL, exportTradesToCSV } from './portfolio.js';
import { renderDash } from './dashboard.js';
import { fetchCurrentPrices } from './price_api.js';
import { 
  toggleScan, showTab, selectGrp, confirmBuy, closeBuyModal, 
  selectSellType, updateSellPreview, confirmSell, closeSellModal,
  openBuyModal, openSellModal, openDetail, closeDetail, analyzeSpecificStock
} from './app.js';

async function handleRefreshPrices() {
  const active = state.portfolio.positions.filter(p => p.status === 'holding');
  const tickers = [...new Set(active.map(p => p.ticker))];
  if (tickers.length === 0) return;
  state.isLoadingPrices = true;
  updateVisibleTab();
  const prices = await fetchCurrentPrices(tickers);
  state.currentPrices = { ...state.currentPrices, ...prices };
  state.isLoadingPrices = false;
  updateVisibleTab();
}

function updateVisibleTab() {
  if (document.getElementById('tab-portfolio')?.classList.contains('active')) renderPortfolio();
  if (document.getElementById('tab-dash')?.classList.contains('active')) renderDash();
}

function updateThemeButtons(theme) {
  document.getElementById('theme-auto').classList.toggle('selected', theme === 'auto');
  document.getElementById('theme-light').classList.toggle('selected', theme === 'light');
  document.getElementById('theme-dark').classList.toggle('selected', theme === 'dark');
}

async function handleSnapshot() {
  const active = state.portfolio.positions.filter(p => p.status === 'holding');
  const totalInvested = active.reduce((s, p) => s + getAvgBuy(p) * getHoldingQty(p), 0);
  const totalRealizedPnL = state.portfolio.positions.reduce((s, p) => s + calcRealizedPnL(p), 0);
  
  let totalUnrealizedPnL = 0;
  active.forEach(p => {
    if (state.currentPrices[p.ticker] != null) {
      const u = calcUnrealizedPnL(p, state.currentPrices[p.ticker]);
      if (u != null) totalUnrealizedPnL += u;
    }
  });

  const data = {
    total_invested: totalInvested,
    realized_pnl: totalRealizedPnL,
    unrealized_pnl: totalUnrealizedPnL,
    net_pnl: totalRealizedPnL + totalUnrealizedPnL,
    ticker_count: active.length
  };

  const ok = await logPortfolioSnapshot(data);
  if (ok) addLog('📊', '포트폴리오 스냅샷이 구글 시트에 기록되었습니다.');
  else alert('스냅샷 기록 실패. Google Apps Script URL을 확인하세요.');
}

// Global modal dismiss functionality
document.addEventListener('click', e => { 
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// Attach static event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Navigation & Scan
  document.getElementById('btn-settings')?.addEventListener('click', openSettingsModal);
  document.getElementById('scanBtn')?.addEventListener('click', toggleScan);
  document.getElementById('btn-specific-analyze')?.addEventListener('click', analyzeSpecificStock);
  
  document.getElementById('tb-discover')?.addEventListener('click', () => showTab('discover'));
  document.getElementById('tb-portfolio')?.addEventListener('click', () => showTab('portfolio'));
  document.getElementById('tb-dash')?.addEventListener('click', () => showTab('dash'));

  // Settings Modal
  document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings);
  document.getElementById('btn-close-settings')?.addEventListener('click', closeSettingsModal);

  // Buy Modal
  document.querySelectorAll('.grp-opt').forEach(el => {
    el.addEventListener('click', () => selectGrp(el.dataset.grp));
  });
  document.getElementById('btn-confirm-buy')?.addEventListener('click', confirmBuy);
  document.getElementById('btn-close-buy')?.addEventListener('click', closeBuyModal);

  // Sell Modal
  document.getElementById('sellTypePartial')?.addEventListener('click', () => selectSellType('partial'));
  document.getElementById('sellTypeAll')?.addEventListener('click', () => selectSellType('all'));
  document.getElementById('sellPrice')?.addEventListener('input', updateSellPreview);
  document.getElementById('sellQty')?.addEventListener('input', updateSellPreview);
  document.getElementById('btn-confirm-sell')?.addEventListener('click', confirmSell);
  document.getElementById('btn-close-sell')?.addEventListener('click', closeSellModal);

  // Theme Buttons
  const t = getTheme();
  setTheme(t);
  updateThemeButtons(t);

  document.getElementById('theme-auto').addEventListener('click', () => { setTheme('auto'); updateThemeButtons('auto'); });
  document.getElementById('theme-light').addEventListener('click', () => { setTheme('light'); updateThemeButtons('light'); });
  document.getElementById('theme-dark').addEventListener('click', () => { setTheme('dark'); updateThemeButtons('dark'); });
  document.getElementById('btn-export-csv')?.addEventListener('click', () => { exportTradesToCSV(); });

  // Event Delegation for dynamically generated buttons (data-action)
  document.body.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'buy_init') {
      const idx = btn.dataset.idx;
      const grp = btn.dataset.grp;
      if (idx !== undefined && state._CARD_STORE[idx]) {
        openBuyModal(state._CARD_STORE[idx], grp);
      }
    } else if (action === 'sell_init') {
      if (id) openSellModal(id);
    } else if (action === 'detail') {
      if (id) openDetail(id);
    } else if (action === 'close_detail') {
      closeDetail();
    } else if (action === 'refresh_prices') {
      handleRefreshPrices();
    } else if (action === 'snapshot') {
      handleSnapshot();
    }
  });

  // Initial setup
  loadPortfolio();
  showTab('discover'); // Ensure discovering tab is active by default
});
