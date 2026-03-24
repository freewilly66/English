// Standalone Bundle to avoid Chrome file:// CORS issues


// --- js/state.js ---
const state = {
  portfolio: { positions: [], trades: [] },
  discoveries: { ultra: [], short: [], long: [], debate: null },
  _CARD_STORE: [],
  scanning: false,
  stopReq: false,
  currentBuyStock: null,
  currentSellPosId: null,
  currentDetailPosId: null,
  sellTypeMode: 'partial',
  selectedGrp: 'ultra',
  dashPeriod: 'monthly',
  dashYear: new Date().getFullYear(),
  dashChart: null,
  dashAllocChart: null,
  currentPrices: {},
  isLoadingPrices: false
};



// --- js/utils.js ---
// js/utils.js

const TODAY = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

function pg(p) { document.getElementById('pg').style.width = p + '%'; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function uid() {
  try { return crypto.randomUUID(); }
  catch(e) { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
}

function fmt$(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—';
  const abs = Math.abs(n);
  const str = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? '-' + str : str;
}

function fmtP(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—';
  const s = n >= 0 ? '+' : '';
  return s + (n * 100).toFixed(2) + '%';
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function localDateStr(d) {
  const dt = d || new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addLog(icon, html) {
  const el = document.getElementById('agentLog');
  if (!el) return;
  const d = document.createElement('div');
  d.className = 'alog';
  d.innerHTML = `<span class="al-icon">${icon}</span> ${html}`;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
  if (el.children.length > 40) el.firstChild.remove();
}



// --- js/api.js ---
// js/api.js


function closeSettingsModal() {
  document.getElementById('settingsModal')?.classList.remove('open');
}

function getApiKey() {
  return localStorage.getItem('gemini_api_key') || '';
}

function getFinnhubApiKey() {
  return localStorage.getItem('finnhub_api_key') || '';
}

function getGasUrl() {
  return localStorage.getItem('gas_url') || '';
}

function getTheme() {
  return localStorage.getItem('us_theme') || 'auto';
}

function setTheme(t) {
  localStorage.setItem('us_theme', t);
  const b = document.body;
  b.classList.remove('light-mode', 'dark-mode');
  if (t === 'light') b.classList.add('light-mode');
  else if (t === 'dark') b.classList.add('dark-mode');
}

function saveSettings() {
  const gKey = document.getElementById('apiKeyInput').value.trim();
  const fhKey = document.getElementById('apiKeyFinnhubInput').value.trim();
  const gasUrl = document.getElementById('gasUrlInput').value.trim();
  
  if (gKey) localStorage.setItem('gemini_api_key', gKey);
  else localStorage.removeItem('gemini_api_key');
  
  if (fhKey) localStorage.setItem('finnhub_api_key', fhKey);
  else localStorage.removeItem('finnhub_api_key');

  if (gasUrl) localStorage.setItem('gas_url', gasUrl);
  else localStorage.removeItem('gas_url');

  closeSettingsModal();
  addLog('✅', '설정이 저장되었습니다.');
}

function openSettingsModal() {
  document.getElementById('apiKeyInput').value = getApiKey();
  document.getElementById('apiKeyFinnhubInput').value = getFinnhubApiKey();
  document.getElementById('gasUrlInput').value = getGasUrl();
  document.getElementById('settingsModal')?.classList.add('open');
}

async function logToSheet(dataArray, type = 'recommendations') {
  const url = getGasUrl();
  if (!url || !dataArray || dataArray.length === 0) return false;
  
  // Add type to each row if not present
  const payload = dataArray.map(row => ({ ...row, type: row.type || type }));
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    });
    // With no-cors, we can't read the response, but the data will be sent.
    return true;
  } catch(e) { console.error('Sheet log error:', e); return false; }
}

async function fetchSheetHistory() {
  const url = getGasUrl();
  if (!url) return [];
  try {
    // Specify type=recommendations to only pull stock recommendation history
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'type=recommendations');
    if (!res.ok) return [];
    return await res.json();
  } catch(e) { console.error('Sheet fetch error:', e); return []; }
}

async function logPortfolioSnapshot(snapshotData) {
  const url = getGasUrl();
  if (!url || !snapshotData) return false;
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify([{ ...snapshotData, type: 'portfolio', date: new Date().toISOString() }]),
      headers: { 'Content-Type': 'application/json' }
    });
    return true;
  } catch(e) { console.error('Snapshot log error:', e); return false; }
}

function pj(str) {
  if (!str) return null;
  try {
    const s = str.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(s);
  } catch (e) {}
  try {
    let depth = 0, start = -1, inStr = false, escape = false;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (escape) { escape = false; continue; }
      if (c === '\\' && inStr) { escape = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') { if (depth === 0) start = i; depth++; }
      else if (c === '}') { depth--; if (depth === 0 && start >= 0) return JSON.parse(str.slice(start, i + 1)); }
    }
  } catch (e) {}
  return null;
}

const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro-latest",
  "gemini-pro"
];

let lastApiErrorMsg = '모든 모델의 할당량이 초과되었거나 사용 불가 상태입니다. 내일 다시 시도하세요.';

function callAgent(sys, usr, retries = 2, modelIdx = 0) {
  return new Promise(function(resolve, reject) {
    const apiKey = getApiKey();
    if (!apiKey) {
      reject(new Error('API 키가 없습니다. 우측 상단 ⚙️ 아이콘을 눌러 키를 설정하세요.'));
      return;
    }
    
    if (modelIdx >= FALLBACK_MODELS.length) {
      reject(new Error(lastApiErrorMsg));
      return;
    }

    const model = FALLBACK_MODELS[modelIdx];
    var xhr = new XMLHttpRequest();
    // Google Gemini API (CORS 문제 없음)
    xhr.open('POST', 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 30000;

    xhr.ontimeout = function() {
      reject(new Error('API 타임아웃 (30초 초과)'));
    };
    xhr.onerror = function() {
      reject(new Error('API 네트워크 오류'));
    };
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      
      // 429 Too Many Requests 처리 (무료 티어 분당 호출량 / 일일 할당량 제한 대응)
      if (xhr.status === 429) {
        if (retries > 0) {
          console.warn('HTTP 429 on ' + model + '. Retrying in 22 seconds...');
          setTimeout(function() {
            resolve(callAgent(sys, usr, retries - 1, modelIdx));
          }, 22000); 
        } else {
          console.warn('HTTP 429 on ' + model + ' exhausted. Switching to next model...');
          lastApiErrorMsg = '호출 한도(Rate Limit) 초과 지속. 잠시 후 재시도 바랍니다.';
          resolve(callAgent(sys, usr, 2, modelIdx + 1));
        }
        return;
      }

      if (xhr.status >= 400) {
        let msg = xhr.responseText;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed.error && parsed.error.message) msg = parsed.error.message;
        } catch (e) {}
        
        lastApiErrorMsg = `[API ${xhr.status} 오류] ${msg}`;
        
        // 모델이 존재하지 않거나(404) 권한오류(403)등인 경우 다음 모델로 폴백
        if (xhr.status === 404 || xhr.status === 403) {
          console.warn('HTTP ' + xhr.status + ' on ' + model + '. Msg: ' + msg + '. Switching to next model...');
          resolve(callAgent(sys, usr, 2, modelIdx + 1));
          return;
        }
        
        reject(new Error(lastApiErrorMsg));
        return;
      }
      if (xhr.status === 0) {
        reject(new Error('네트워크 오류 (status 0)'));
        return;
      }
      
      var raw = xhr.responseText || '';
      var data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        addLog('⚠', '응답 파싱 오류');
        resolve('');
        return;
      }
      
      try {
        var t = data.candidates[0].content.parts[0].text;
        resolve(t.trim());
      } catch (e) {
        reject(new Error(data.error?.message || 'API 응답에서 텍스트를 찾을 수 없습니다.'));
      }
    };

    xhr.send(JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ parts: [{ text: usr }] }],
      generationConfig: { temperature: 0.2 }
    }));
  });
}


// --- js/price_api.js ---
// js/price_api.js

async function fetchCurrentPrices(tickers) {
  if (!tickers || tickers.length === 0) return {};
  const results = {};
  
  const promises = tickers.map(async (ticker) => {
    let symbol = ticker.toUpperCase();
    if (/^\d{6}$/.test(symbol)) symbol += ".KS"; // 기본 코스피
    
    try {
      const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
      let res = await fetch(`https://corsproxy.io/?` + encodeURIComponent(targetUrl));
      
      if (!res.ok && symbol.endsWith('.KS')) {
        symbol = ticker + ".KQ"; // 코스닥으로 재시도
        const targetUrl2 = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
        res = await fetch(`https://corsproxy.io/?` + encodeURIComponent(targetUrl2));
      }
      
      if (res.ok) {
        const data = await res.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price) results[ticker] = price;
      }
    } catch(e) {
      console.warn(`Failed to fetch price for ${symbol}`, e);
    }
  });

  await Promise.all(promises);
  return results;
}

async function fetchHistoricalData(ticker, days=30) {
  if (!ticker) return null;
  let symbol = ticker.toUpperCase();
  if (/^\d{6}$/.test(symbol)) symbol += ".KS";
  
  try {
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`;
    let res = await fetch(`https://corsproxy.io/?` + encodeURIComponent(targetUrl));
    
    if (!res.ok && symbol.endsWith('.KS')) {
      symbol = ticker + ".KQ";
      const targetUrl2 = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`;
      res = await fetch(`https://corsproxy.io/?` + encodeURIComponent(targetUrl2));
    }
    
    if (!res.ok) return null;
    
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    
    const quote = result.indicators?.quote?.[0];
    if (!quote) return null;
    
    const closes = quote.close;
    const highs = quote.high;
    const lows = quote.low;
    
    const validData = [];
    for(let i=0; i<closes.length; i++) {
        if(closes[i] != null && highs[i] != null && lows[i] != null) {
            validData.push({ close: closes[i], high: highs[i], low: lows[i] });
        }
    }
    return validData.slice(-days); 
  } catch(e) {
    console.warn(`Failed to fetch history for ${symbol}`, e);
    return null;
  }
}

async function fetchHistoricalPrices(ticker, days=30) {
  const data = await fetchHistoricalData(ticker, days);
  if (!data) return null;
  return data.map(d => d.close);
}

// ATR(Average True Range) 및 지지/저항(Support/Resistance) 계산
function calculateTechnicalBounds(histData) {
  if (!histData || histData.length < 5) return null;
  let trSum = 0;
  let highest = histData[0].high, lowest = histData[0].low;
  const current = histData[histData.length-1].close;
  
  for(let i=1; i<histData.length; i++) {
    const high = histData[i].high;
    const low = histData[i].low;
    const prevClose = histData[i-1].close;
    
    highest = Math.max(highest, high);
    lowest = Math.min(lowest, low);
    
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    const tr = Math.max(tr1, tr2, tr3);
    trSum += tr;
  }
  const atr = trSum / (histData.length - 1);
  return {
    current: current,
    support: lowest,
    resistance: highest,
    atr: Math.round(atr * 100) / 100
  };
}


// --- js/portfolio.js ---
// js/portfolio.js

function loadPortfolio() {
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

function savePortfolio() {
  try {
    localStorage.setItem('us_portfolio', JSON.stringify(state.portfolio));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
      alert('⚠ 저장 공간이 부족합니다.\n오래된 거래 데이터를 정리하거나 브라우저 저장소를 확인해주세요.');
    }
  }
}

// Helpers
function getAvgBuy(pos) {
  if (!pos?.buyTrades?.length) return 0;
  const t = pos.buyTrades.reduce((a, b) => ({ amt: a.amt + (b.price || 0) * (b.qty || 0), qty: a.qty + (b.qty || 0) }), { amt: 0, qty: 0 });
  return t.qty > 0 ? t.amt / t.qty : 0;
}

function getHoldingQty(pos) {
  if (!pos) return 0;
  const bought = (pos.buyTrades || []).reduce((s, t) => s + (t.qty || 0), 0);
  const sold = (pos.sellTrades || []).reduce((s, t) => s + (t.qty || 0), 0);
  return bought - sold;
}

function calcUnrealizedPnL(pos, currentPrice) {
  const hq = getHoldingQty(pos);
  const avg = getAvgBuy(pos);
  if (currentPrice == null || !avg || hq <= 0) return null;
  return (currentPrice - avg) * hq;
}

function calcRealizedPnL(pos) {
  return (pos.sellTrades || []).reduce((s, t) => s + (t.pnl ?? 0), 0);
}

function getDaysHeld(pos) {
  if (!pos.createdAt) return 0;
  const dt = new Date(pos.createdAt);
  if (isNaN(dt.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24)));
}

// Rendering
function renderPortfolio() {
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

function exportTradesToCSV() {
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


// --- js/dashboard.js ---
// js/dashboard.js

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

function getAvailableYears() {
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

function switchPeriod(p) {
  state.dashPeriod = p;
  renderDash();
}

function changeYear(delta) {
  const years = getAvailableYears();
  const minY = years.reduce((a, b) => Math.min(a, b), new Date().getFullYear() - 1);
  const maxY = years.reduce((a, b) => Math.max(a, b), new Date().getFullYear());
  state.dashYear = Math.max(minY, Math.min(maxY, state.dashYear + delta));
  if (state.dashChart) { state.dashChart.destroy(); state.dashChart = null; }
  renderDash();
}

function renderPeriodChart(rows) {
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

function renderAllocationChart() {
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

function renderDash() {
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


// --- js/app.js ---
// js/app.js

const SYS_GEO = `당신은 한국 시장 지정학 리스크 분석 에이전트입니다. 오늘: ${TODAY}. 북한 도발 리스크, 미중 패권 갈등에 낀 한국 수출 기업(반도체/자동차)의 영향, 그리고 외인/기관의 양매수 등 수급 동향을 중점적으로 분석합니다. JSON만 반환: {"risk_level":"낮음|보통|높음","foreign_fund_flow":"유입|유출|단기순환","key_events":["이슈1"],"benefiting_kr":["섹터"]}`;
const SYS_MACRO = `당신은 한국 거시경제 분석 에이전트입니다. 오늘: ${TODAY}. 한국은행 기준금리, 원/달러 환율 방향성, 코리아 디스카운트(지배구조/밸류업), 수출입 무역수지 등을 상시 모니터링합니다. JSON만 반환: {"kospi":"상승|하락|횡보","krw_usd":"원화강세|원화약세|보통","bok_signal":"긴축|완화|중립","export_status":"강세|약세|보통","regime":"강세|약세|불확실"}`;
const SYS_SECTOR = `당신은 한국 섹터 모멘텀 분석 에이전트입니다. 오늘: ${TODAY}. 한국 특유의 빠른 테마주 순환매(반도체, 이차전지, 밸류업, 바이오, 방산 등)를 분석합니다. JSON만 반환: {"top_sectors":[{"name":"섹터","momentum":"강|중|약"}],"hot_themes":["단기급등테마1","테마2","테마3"]}`;
const SYS_SENTIMENT = `당신은 한국 주식 시장 센티먼트 분석 에이전트입니다. 오늘: ${TODAY}. 금융투자소득세(금투세) 논란, 개인 신용잔고(빚투) 비율, 증시 예탁금 증감 등을 종합하여 개미투자자들의 심리를 분석합니다. JSON만 반환: {"sentiment_score":0~100,"mood":"공포|중립|탐욕","key_drivers":["상승요인|하락요인"]}`;
const SYS_TECH = `당신은 한국 주식 기술적 분석 에이전트입니다. 오늘: ${TODAY}. 캔들 패턴, 이동평균선, 외국인 누적 순매수 등을 통해 차트를 분석합니다. 
[중요] 함께 전달되는 ATR(변동성)과 지지/저항(Support/Resistance) 데이터를 반드시 참고하여, 현실적인 기술적 밴드를 분석하세요.
JSON만 반환: {"trend":"상승|하락|횡보","signal":"매수|매도|중립","volatility_opinion":"변동성(ATR) 기반 의견"}`;
const SYS_ANOM = `당신은 한국 주식 이상 신호 탐지 에이전트입니다. 오늘: ${TODAY}. 급격한 거래량 변화나 공시 관련 테마주 신호를 포착합니다. JSON만 반환: {"unusual_stocks":["종목코드","종목코드"],"reasons":{"종목코드":"이유"}}`;
const SYS_PIONEER = `당신은 한국 강소기업 및 유니콘 후보 발굴 에이전트입니다. 오늘: ${TODAY}. 
목표: 기술력이 뛰어나고 향후 글로벌 시장 진출 가능성이 높은 한국 기업 발굴. 
JSON만 반환: {"pioneers":[{"ticker":"종목코드(6자리)","company":"회사명","market_cap":"시총","revenue_growth":"성장률","tam":"시장규모","key_advantage":"장점","catalysts":["이슈"],"risks":["위험"],"themes":["테마"],"why_next_giant":"이유","entry":"0원","target_1yr":"0원","stop_loss":"0원"}]}`;

const SYS_REVIEW = `당신은 한국 투자 결과 평가 및 자기 반성 에이전트입니다. 오늘: ${TODAY}. 과거 추천 종목의 성과를 분석하여 오늘의 탐색 에이전트들에게 교훈을 전달합니다. 3~4문장으로 요약하십시오.`;

const SYS_SPECIFIC_BULL = `당신은 한국 주식 심층 강세론자(Perma-Bull)입니다. 오늘: ${TODAY}.
제공된 종목(KOSPI/KOSDAQ)의 펀더멘탈, 모멘텀, 뉴스를 바탕으로 극단적인 장점과 잠재력을 찾아내어 강력한 매수 또는 상승 논리를 3~4문장으로 제안하세요. 테마/수급 상황도 긍정적으로 해석하세요.
JSON만 반환: {"opinion":"강세론자의 의견"}`;

const SYS_SPECIFIC_BEAR = `당신은 한국 주식 심층 비관론자(Perma-Bear)입니다. 오늘: ${TODAY}.
제공된 종목의 코리아 디스카운트, 밸류에이션 부담, 경쟁 심화, 환율 타격 등 최악의 시나리오를 엄격하게 경고하며 조심해야 할 논리를 3~4문장으로 작성하세요.
JSON만 반환: {"opinion":"비관론자의 의견"}`;

const SYS_SPECIFIC_CIO = `당신은 한국 주식 최고 투자 책임자(CIO)입니다. 오늘: ${TODAY}.
강세론자와 비관론자의 의견, 수학적 변동폭(ATR 및 지지/저항) 추세를 종합하여 이 한국 주식에 대한 최종 결론을 내립니다.
아래 JSON 포맷 1개만 반환하십시요. 목표가(target)와 손절가(stop_loss)는 반드시 전달된 수학적 가이드라인에 맞게 합리적으로 계산하세요.
{"cio_summary":"최종 심층 분석 의견 (장단점 종합)","opportunities":[{"ticker":"티커","company":"정확한 회사명","group":"ULTRA|SHORT|LONG","signal":"BUY|WATCH|SELL","confidence":85,"current_price":"0원","entry":"0원","target":"0원","stop_loss":"0원","hold":"투자 기간","reason":"추천 또는 관망 근거","catalyst":"주요 촉매제(이슈)","themes":["관련 테마"],"is_pioneer":false}]}
`;

function SYS_BULL_SCREEN(geo, macro, sector, anom, pioneer, reflection) {
  return `당신은 한국 시장용 공격적 강세론자 투자 전문가입니다. 오늘: ${TODAY}.
[지정학] ${JSON.stringify(geo||{})}
[매크로] ${JSON.stringify(macro||{})}
[섹터] ${JSON.stringify(sector||{})}
[이상신호] ${JSON.stringify(anom||{})}
[강소후보] ${JSON.stringify(pioneer)}
[과거 성찰] ${reflection || '데이터 없음'}
가장 큰 수익이 기대되는 한국 주식 3-4개를 골라주세요. JSON만 반환: {"opinion":"의견","recommendations":[{"ticker":"6자리코드","company":"회사명","signal":"BUY","entry":"0원","target":"0원","stop_loss":"0원","reason":"이유"}]}`;
}

function SYS_BEAR_SCREEN(geo, macro, sector, anom, pioneer, reflection) {
  return `당신은 한국 시장용 보수적 비관론자(가치투자/안전제일) 전문가입니다. 오늘: ${TODAY}.
[지정학] ${JSON.stringify(geo||{})}
[매크로] ${JSON.stringify(macro||{})}
[섹터] ${JSON.stringify(sector||{})}
[이상신호] ${JSON.stringify(anom||{})}
[강소후보] ${JSON.stringify(pioneer)}
[과거 성찰] ${reflection || '데이터 없음'}
코리아 디스카운트(지배구조, 부족한 배당) 리스크를 엄격하게 따지고, 가장 방어적이며 저평가된 우량 한국 주식 3-4개를 골라주세요. JSON만 반환: {"opinion":"의견","recommendations":[{"ticker":"6자리코드","company":"회사명","signal":"WATCH|BUY","entry":"0원","target":"0원","stop_loss":"0원","reason":"이유"}]}`;
}


function SYS_HEAD_SCREEN(bull_opinion, bear_opinion, reflection, ta_data) {
  return `당신은 최고 투자 책임자(CIO)입니다. 오늘: ${TODAY}.
[과거 분석 반성] ${reflection || '데이터 없음'}

강세론자의 의견:
${bull_opinion}

비관론자(가치투자자)의 의견:
${bear_opinion}

[참고 데이터 - 기술적 분석, 정량적 변동성(ATR) 및 가격 가이드라인]:
${JSON.stringify(ta_data||{})}

위의 텍스트 토론뿐만 아니라, [참고 데이터]에 포함된 기술적 데이터(현재가, ATR, 지지선, 저항선 등)를 바탕으로 합리적인 매매 가격을 도출하세요.
목표가(target)와 손절가(stop_loss)는 반드시 수학적 변동폭(ATR) 수치와 지지/저항선을 참고하여 허무맹랑하지 않은 계산된 숫자를 제시해야 합니다. 
(예: 전고점 저항선 부근에서 목표가 설정, 최근 지지선을 손절선으로 설정)

최종 투자 기회 3-4개를 JSON 포맷으로 엄선하여 반환하세요.
JSON만 반환: {"cio_summary":"선정 이유","opportunities":[{"ticker":"000000","company":"회사","group":"ULTRA|SHORT|LONG","signal":"BUY|WATCH","confidence":85,"current_price":"0원","entry":"0원","target":"0원","stop_loss":"0원","hold":"6개월","reason":"근거","catalyst":"촉매","themes":["테마"],"is_pioneer":false}]}`;
}

async function toggleScan() {
  if (state.scanning) {
    state.stopReq = true;
    document.getElementById('scanBtn').innerHTML = '⏹ 중단 중...';
    return;
  }
  
  if (!getApiKey()) {
    openSettingsModal();
    return;
  }
  
  state.scanning = true; state.stopReq = false;
  state._CARD_STORE = [];
  state.discoveries = { ultra: [], short: [], long: [], debate: null };
  
  document.getElementById('scanBtn').innerHTML = '⏹ 중단';
  document.getElementById('agentStrip').style.display = '';
  document.getElementById('agentLog').innerHTML = '';
  renderDiscovery();
  pg(5);
  addLog('🚀', `<span class="hl">자율 탐색 시작</span> — ${esc(TODAY)}`);

  let reflectionContext = "";
  try {
    const history = await fetchSheetHistory();
    if (history.length > 0) {
      addLog('🧠', '과거 추천 내역 분석 및 자기 반성 중...');
      const tickers = [...new Set(history.map(h => h.ticker))];
      const prices = await fetchCurrentPrices(tickers).catch(() => ({}));
      
      const historySummary = history.slice(-10).map(h => {
        const cur = prices[h.ticker] || '알수없음';
        return `[${h.date}] ${h.ticker}: 추천가 ${h.current_price_at_recommendation} -> 현재가 ${cur} (이유: ${h.reason.slice(0,50)}...)`;
      }).join('\n');

      reflectionContext = await callAgent(SYS_REVIEW, `과거 분석 데이터:\n${historySummary}\n\n위 데이터를 바탕으로 오늘의 탐색에서 주의해야 할 점이나 반성할 점을 요약하세요.`);
      addLog('📝', `<b>AI 오답 노트:</b> ${esc(reflectionContext)}`);
    }
  } catch(e) { console.warn('Reflection skip:', e); }

  try {
    const ctx = {};
    const pipe = [
      { id:'geo', sys:SYS_GEO, msg:`오늘 미국 주식에 영향을 줄 지정학 리스크 파악`, icon:'🌏', name:'지정학' },
      { id:'macro', sys:SYS_MACRO, msg:`오늘 미국 거시경제 파악`, icon:'📊', name:'매크로' },
      { id:'sentiment', sys:SYS_SENTIMENT, msg:`오늘 시장의 전반적인 투자 심리(Sentiment) 분석`, icon:'🎭', name:'센티먼트' },
      { id:'sector', sys:SYS_SECTOR, msg:`오늘 강한 섹터와 핫 테마 파악`, icon:'📈', name:'섹터' },
      { id:'anom', sys:SYS_ANOM, msg:`오늘 이상 거래량 종목 찾기`, icon:'⚡', name:'이상신호' },
      { id:'pioneer', sys:SYS_PIONEER, msg:`초기성장주 후보 발굴`, icon:'🚀', name:'초기성장주' }
    ];

    for (let i = 0; i < pipe.length; i++) {
      if (state.stopReq) break;
      const p = pipe[i];
      addLog(p.icon, `${esc(p.name)} 에이전트 탐색 중...`);
      try {
        const raw = await callAgent(p.sys, p.msg);
        ctx[p.id] = pj(raw);
        if (p.id === 'macro' && ctx.macro?.kospi) addLog('✅', `코스피 방향성: <span class="hl">${esc(ctx.macro.kospi)}</span>`);
        else if (p.id === 'sentiment' && ctx.sentiment?.mood) addLog('🎭', `심리: <span class="hl">${esc(ctx.sentiment.mood)}</span> (${ctx.sentiment.sentiment_score}점)`);
        else if (p.id === 'sector' && ctx.sector?.top_sectors) addLog('✅', `강세: <span class="hl">${esc((ctx.sector.top_sectors||[]).slice(0,2).map(s=>s.name).join(', '))}</span>`);
        else if (p.id === 'pioneer' && ctx.pioneer?.pioneers) {
          const pp = ctx.pioneer.pioneers;
          addLog('🚀', `초기성장주: <span class="hl">${pp.slice(0,3).map(p=>esc(p.ticker)).join(' · ')}</span>`);
          for (const pn of pp) {
            if (!pn.ticker) continue;
            state.discoveries.long.push({
              ticker: pn.ticker, company: pn.company, group: 'long', signal: 'BUY', confidence: 70,
              current_price: pn.entry||'—', entry: pn.entry||'—', target: pn.target_1yr||'—', stop_loss: pn.stop_loss||'—',
              hold: '장기 보유', is_pioneer: true, reason: pn.why_next_giant||'강소기업 발굴',
              catalyst: (pn.catalysts||[])[0]||'', themes: [...(pn.themes||[]), '🚀 Pioneer'], pioneer_data: pn
            });
          }
        }
      } catch(e) {
        addLog('⚠', `${esc(p.name)}: ${e.message.slice(0,40)}`);
      }
      if (i < pipe.length - 1) await sleep(7500);
      pg(5 + (i + 1) * 10);
    }
    
    // Phase 1.5: Technical Analysis for Candidates
    if (!state.stopReq) {
      const candidates = [...new Set(state.discoveries.long.map(d => d.ticker))];
      if (candidates.length > 0) {
        addLog('📊', `후보 종목(${candidates.join(', ')}) 기술적 지표 및 변동성 분석 중...`);
        ctx.ta = {};
        for (const ticker of candidates) {
          if (state.stopReq) break;
          const histObj = await fetchHistoricalData(ticker, 20); 
          if (histObj && histObj.length > 5) {
             const closes = histObj.map(h => h.close);
             const bounds = calculateTechnicalBounds(histObj);
             const boundsTxt = bounds ? `[정량적 기준] 현재가: ${bounds.current}, 지지선: ${bounds.support}, 저항선: ${bounds.resistance}, 평균변동폭(ATR): ${bounds.atr}` : '데이터 없음';
             
             const rawTA = await callAgent(SYS_TECH, `종목: ${ticker}\n최근 20일 종가: ${closes.join(', ')}\n${boundsTxt}\n위 데이터를 바탕으로 기술적 지표와 현실적인 매매 신호를 분석하세요.`);
             const parsedTA = pj(rawTA) || {};
             if (bounds) parsedTA.math_bounds = bounds;
             ctx.ta[ticker] = parsedTA;
          }
          await sleep(2000);
        }
      }
    }

    if (!state.stopReq) {
      addLog('🗣️', '강세론자와 비관론자 간의 종목 발굴 토론 중...');
      pg(65);
      try {
        const safeCtx = {
          geo: ctx.geo ? JSON.stringify(ctx.geo).slice(0,500) : null,
          macro: ctx.macro ? JSON.stringify(ctx.macro).slice(0,300) : null,
          sentiment: ctx.sentiment ? JSON.stringify(ctx.sentiment).slice(0,300) : null,
          sector: ctx.sector ? JSON.stringify(ctx.sector).slice(0,400) : null,
          anom: ctx.anom ? JSON.stringify(ctx.anom).slice(0,300) : null,
          ta: ctx.ta ? JSON.stringify(ctx.ta).slice(0,600) : null,
          pioneerTickers: (ctx.pioneer?.pioneers||[]).map(p=>p.ticker).slice(0,5),
        };
        const bullSys = SYS_BULL_SCREEN(safeCtx.geo, safeCtx.macro, safeCtx.sector, safeCtx.anom, safeCtx.pioneerTickers, reflectionContext);
        const bearSys = SYS_BEAR_SCREEN(safeCtx.geo, safeCtx.macro, safeCtx.sector, safeCtx.anom, safeCtx.pioneerTickers, reflectionContext);
        
        const bullRaw = await callAgent(bullSys, `오늘(${TODAY}) 가장 강력한 상승 논리를 가진 주식 3-4개를 JSON으로 골라주세요.`);
        const bullData = pj(bullRaw) || { opinion: bullRaw, recommendations: [] };
        await sleep(7500);
        
        const bearRaw = await callAgent(bearSys, `오늘(${TODAY}) 가장 방어적이고 리스크가 적은 주식 3-4개를 JSON으로 골라주세요.`);
        const bearData = pj(bearRaw) || { opinion: bearRaw, recommendations: [] };
        
        if (state.stopReq) return;
        addLog('⚖️', '수석 CIO 에이전트가 토론을 종합하여 최종 종목 선정 중...');
        pg(85);
        
        const bullOpinionTxt = bullData.opinion || bullRaw;
        const bearOpinionTxt = bearData.opinion || bearRaw;
        const headSys = SYS_HEAD_SCREEN(bullOpinionTxt, bearOpinionTxt, reflectionContext, ctx.ta);
        const cioRaw = await callAgent(headSys, `최종 투자 기회 3-4개를 JSON 포맷으로 엄선하여 반환하세요.`);
        const cioData = pj(cioRaw);
        
        if (cioData?.opportunities?.length > 0) {
          state.discoveries.debate = {
            bull: bullOpinionTxt,
            bear: bearOpinionTxt,
            cio: cioData.cio_summary || '토론 결과를 바탕으로 최적의 종목을 도출했습니다.'
          };
          
          const sheetLogs = [];
          
          // 1. Log CIO recommendations
          for (const opp of cioData.opportunities) {
            const grp = (opp.group||'SHORT').toLowerCase();
            const isDupe = state.discoveries.long.some(d => d.ticker === opp.ticker && d.is_pioneer);
            if (!isDupe) {
              if (grp === 'ultra' || grp === 'ultra-short') state.discoveries.ultra.push(opp);
              else if (grp === 'long') state.discoveries.long.push(opp);
              else state.discoveries.short.push(opp);
            }
            sheetLogs.push({
              date: TODAY, ticker: opp.ticker, company: opp.company, agent_role: 'CIO',
              signal: opp.signal, entry: opp.entry, target: opp.target, stop_loss: opp.stop_loss,
              hold: opp.hold,
              reason: opp.reason, opinion: cioData.cio_summary, current_price: opp.current_price
            });
          }
          
          // 2. Log Bull recommendations
          (bullData.recommendations || []).forEach(r => {
            sheetLogs.push({
              date: TODAY, ticker: r.ticker, company: r.company, agent_role: 'Bull',
              signal: r.signal || 'BUY', entry: r.entry, target: r.target, stop_loss: r.stop_loss,
              reason: r.reason, opinion: bullData.opinion, current_price: r.entry
            });
          });
          
          // 3. Log Bear recommendations
          (bearData.recommendations || []).forEach(r => {
            sheetLogs.push({
              date: TODAY, ticker: r.ticker, company: r.company, agent_role: 'Bear',
              signal: r.signal || 'WATCH', entry: r.entry, target: r.target, stop_loss: r.stop_loss,
              reason: r.reason, opinion: bearData.opinion, current_price: r.entry
            });
          });
          
          if (sheetLogs.length > 0) {
            logToSheet(sheetLogs).then(ok => {
              if (ok) console.log('Detailed agent logs sent to Google Sheet');
            });
          }

          const total = state.discoveries.ultra.length + state.discoveries.short.length + state.discoveries.long.length;
          addLog('✅', `<span class="hl">${total}개 종목 스크리닝 및 발굴 완료</span>`);
        } else {
          addLog('⚠', '최종 발굴 실패. 결과 파싱 오류.');
        }

      } catch(e) {
        addLog('⚠', `발굴 오류: ${e.message}`);
      }
      pg(100);
    }
  } finally {
    state.scanning = false;
    document.getElementById('scanBtn').innerHTML = '▶ 재탐색';
    renderDiscovery();
    setTimeout(() => pg(0), 1000);
  }
}

async function analyzeSpecificStock() {
  const inputEl = document.getElementById('specificTickerInput');
  if (!inputEl) return;
  let tickerRaw = inputEl.value.trim();
  if (!tickerRaw) { alert('종목명 또는 종목코드 6자리를 입력해주세요 (예: 삼성전자, 005930)'); return; }

  if (!getApiKey()) {
    openSettingsModal();
    return;
  }

  if (state.scanning) {
    alert('현재 전체 스캔이 진행 중입니다. 중단 후 다시 시도하거나 완료 시까지 기다려주세요.');
    return;
  }

  state.scanning = true;
  inputEl.value = '';
  document.getElementById('agentStrip').style.display = '';
  document.getElementById('agentLog').innerHTML = '';
  pg(10);

  let ticker = tickerRaw.replace(/\s/g, '');
  if (!/^\d{6}$/.test(ticker)) {
    addLog('🔎', `"${esc(tickerRaw)}"의 종목 코드를 검색 중...`);
    const prompt = `사용자가 한국 주식을 검색하려고 "${tickerRaw}"를 입력했습니다. 이 기업의 정확한 한국 증권(코스피/코스닥) 종목코드 6자리 숫자만 답변하세요. (다른 부가 설명 없이 오직 6자리 숫자만 출력, 예: 005930)`;
    try {
      const aiResp = await callAgent('당신은 한국 주식 종목코드 변환기입니다.', prompt);
      ticker = (aiResp || '').trim().replace(/[^0-9]/g, '');
      if (!ticker || ticker.length !== 6) {
        throw new Error('티커 변환 실패');
      }
      addLog('💡', `검색된 종목 코드: <span class="hl">${esc(ticker)}</span>`);
    } catch (e) {
      addLog('⚠', '종목 코드를 자동으로 찾을 수 없습니다. 정확한 6자리 숫자를 입력해주세요.');
      state.scanning = false;
      pg(0);
      return;
    }
  }

  addLog('🔍', `<span class="hl">${esc(ticker)}</span> 집중 심층 분석 시작... — ${esc(TODAY)}`);
  
  try {
    const histObj = await fetchHistoricalData(ticker, 20); 
    pg(50);

    if (!histObj || histObj.length < 5) {
      addLog('⚠', '가격 데이터를 가져올 수 없습니다. 종목코드를 다시 확인하세요.');
      return;
    }

    const closes = histObj.map(h => h.close);
    const bounds = calculateTechnicalBounds(histObj);
    const currentPrice = `${bounds.current}원`;
    const boundsTxt = `[수학적 기준] 현재가: ${bounds.current}, 1차 지지선: ${bounds.support}, 단기 저항선: ${bounds.resistance}, 평균변동폭(ATR): ${bounds.atr}`;

    const promptBase = `종목코드: ${ticker}\n현재가: ${currentPrice}\n최근 20일 종가: ${closes.join(', ')}\n${boundsTxt}`;
    addLog('🥊', `조회된 가격 기반 강세론자(Bull) vs 비관론자(Bear)의 심층 토론 대결 중...`);
    
    // Run Bull and Bear sequentially with a slight delay to prevent 429 Rate Limit
    const bullRaw = await callAgent(SYS_SPECIFIC_BULL, promptBase);
    await sleep(7500);
    const bearRaw = await callAgent(SYS_SPECIFIC_BEAR, promptBase);
    const bullData = pj(bullRaw) || { opinion: bullRaw || "가치 상승 기대" };
    const bearData = pj(bearRaw) || { opinion: bearRaw || "리스크 주의 요망" };
    pg(75);

    addLog('⚖️', `수석 CIO 에이전트가 토론과 수학적 ATR 지표를 종합하여 판결 중...`);
    const cioPrompt = `${promptBase}\n\n[강세론자 의견]\n${bullData.opinion}\n\n[비관론자 의견]\n${bearData.opinion}\n\n양측의 의견과 기술적 변동 폭(ATR)을 정확히 연동하여, 허무맹랑하지 않은 현실적인 매매 전략(목표가/손절가 명시)을 JSON으로 판결하세요.`;
    
    const cioRaw = await callAgent(SYS_SPECIFIC_CIO, cioPrompt);
    const data = pj(cioRaw);
    
    if (data && data.opportunities && data.opportunities.length > 0) {
      const opp = data.opportunities[0];
      opp.ticker = ticker;
      
      const grp = (opp.group||'SHORT').toLowerCase();
      if (grp === 'ultra' || grp === 'ultra-short') state.discoveries.ultra.unshift(opp);
      else if (grp === 'long') state.discoveries.long.unshift(opp);
      else state.discoveries.short.unshift(opp);
      
      state.discoveries.debate = {
        bull: bullData.opinion,
        bear: bearData.opinion,
        cio: `${data.cio_summary || opp.reason}\n\n--- [정량적 기술 지표 요약] ---\n${boundsTxt}`
      };

      const sheetLogs = [{
        date: TODAY, ticker: opp.ticker, company: opp.company, agent_role: 'Single_Target',
        signal: opp.signal, entry: opp.entry, target: opp.target, stop_loss: opp.stop_loss,
        hold: opp.hold,
        reason: opp.reason, opinion: data.cio_summary, current_price: currentPrice
      }];
      logToSheet(sheetLogs).catch(()=>{});
      
      addLog('✅', `<span class="hl">${esc(ticker)} 심층 토론 및 판결 완료</span>`);
    } else {
      addLog('⚠', '분석 실패 (데이터 파싱 오류 이거나 종목명 인식 불가)');
    }
  } catch(e) {
    addLog('⚠', `오류: ${e.message}`);
  } finally {
    state.scanning = false;
    pg(100);
    renderDiscovery();
    setTimeout(() => pg(0), 1000);
  }
}

function renderDiscovery() {
  state._CARD_STORE = [];
  const cont = document.getElementById('discoverContent');
  const total = state.discoveries.ultra.length + state.discoveries.short.length + state.discoveries.long.length;
  if (total === 0 && !state.scanning) {
    cont.innerHTML = `<div class="empty"><div class="empty-icon">🛰️</div><div class="empty-t">탐색 준비 완료</div><div class="empty-s">상단 <strong>▶ 탐색</strong> 버튼을 눌러 전체 스캔을 진행하거나, <br>검색창을 통해 특정 종목을 집중 분석하세요.</div></div>`;
    return;
  }
  
  let html = '<div class="disc-pad">';
  
  if (state.discoveries.debate) {
    html += `<div style="margin-bottom: 24px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-xl); box-shadow: var(--sh);">
      <div style="padding: 16px; border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">⚖️</span> AI 투자 위원회 토론 기록
      </div>
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 16px;">
        <div style="background: rgba(16, 185, 129, 0.05); border-left: 3px solid var(--buy); padding: 12px; border-radius: 6px;">
          <div style="font-size: 11px; font-weight: 700; color: var(--buy); margin-bottom: 8px;">🐂 강세론자 (Perma-Bull)</div>
          <div style="font-size: 12px; line-height: 1.5; color: var(--text-2); white-space: pre-wrap; max-height: 200px; overflow-y: auto;">${esc(state.discoveries.debate.bull)}</div>
        </div>
        <div style="background: rgba(239, 68, 68, 0.05); border-left: 3px solid var(--sell); padding: 12px; border-radius: 6px;">
          <div style="font-size: 11px; font-weight: 700; color: var(--sell); margin-bottom: 8px;">🐻 비관론자 (Perma-Bear)</div>
          <div style="font-size: 12px; line-height: 1.5; color: var(--text-2); white-space: pre-wrap; max-height: 200px; overflow-y: auto;">${esc(state.discoveries.debate.bear)}</div>
        </div>
        <div style="background: var(--bg-sub); border-left: 3px solid #6366f1; padding: 12px; border-radius: 6px;">
          <div style="font-size: 11px; font-weight: 700; color: #6366f1; margin-bottom: 8px;">👔 수석 CIO (Synthesizer)</div>
          <div style="font-size: 13px; font-weight: 600; line-height: 1.6; color: var(--text); white-space: pre-wrap;">${esc(state.discoveries.debate.cio)}</div>
        </div>
      </div>
    </div>`;
  }

  const grps = [
    { key: 'ultra', icon: '⚡', label: '초단기 (1주일 이내)', data: state.discoveries.ultra },
    { key: 'short', icon: '📅', label: '단기 (2-3개월)', data: state.discoveries.short },
    { key: 'long', icon: '♾️', label: '장기 보유', data: state.discoveries.long }
  ];
  
  for (const grp of grps) {
    if (grp.data.length === 0) continue;
    html += `<div class="grp-section"><div class="grp-header">
      <span class="grp-badge ${grp.key}">${grp.icon} ${grp.key.toUpperCase()}</span>
      <span class="grp-label">${grp.label}</span>
    </div>`;
    for (const s of grp.data) html += renderDiscCard(s, grp.key);
    html += '</div>';
  }
  html += '</div>';
  cont.innerHTML = html;
}

function renderDiscCard(s, grpKey) {
  const sig = s.signal || 'WATCH';
  const sigLbl = sig === 'BUY' ? '▲ 매수' : sig === 'SELL' ? '▼ 매도' : '◈ 주목';
  const _si = state._CARD_STORE.push(s) - 1;

  let themesHtml = (s.themes||[]).slice(0,3).map(t => {
    return `<span style="font-size:10px;font-family:var(--mono);background:var(--bg-muted);color:var(--text-2);padding:2px 8px;border-radius:12px;font-weight:600">${esc(t)}</span>`;
  }).join(' ');

  return `<div class="disc-card">
    <div class="dc-top">
      <div>
        <div class="dc-ticker">${esc(s.ticker || '—')}</div>
        <div class="dc-name">${esc(s.company || '')}</div>
        <div style="display:flex;gap:6px;margin-top:8px">${themesHtml}</div>
      </div>
      <div class="dc-right">
        <span class="sig-badge ${sig}">${sigLbl}</span>
        <span class="dc-conf">신뢰도 ${esc(String(s.confidence || '—'))}%</span>
      </div>
    </div>
    
    <div class="dc-prices">
      <div class="dp"><span class="dpl">현재가</span><span class="dpv">${esc(s.current_price || '—')}</span></div>
      <div class="dp"><span class="dpl">진입가</span><span class="dpv g">${esc(s.entry || '—')}</span></div>
      <div class="dp"><span class="dpl">목표/손절<br><span style="font-size:10px;color:var(--text-4);font-weight:400;margin-top:2px;display:inline-block">${esc(s.hold||'보유기간 미정')}</span></span><span class="dpv" style="font-size:13px"><span class="r">${esc(s.target || '—')}</span> <span style="color:var(--text-4)">/</span> <span class="a" style="color:var(--watch)">${esc(s.stop_loss || '—')}</span></span></div>
    </div>
    
    <div class="dc-reason">${esc(s.reason || '').replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')}</div>
    
    <div class="dc-footer">
      <span class="dc-cat">${s.catalyst ? `⚡ ${esc(s.catalyst)}` : ''}</span>
      <button class="btn-primary" data-action="buy_init" data-idx="${_si}" data-grp="${grpKey}">+ 매수 기록</button>
    </div>
  </div>`;
}

// UI Tabs
function showTab(t) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
  const targetPane = document.getElementById('tab-' + t);
  const targetBtn = document.getElementById('tb-' + t);
  if (targetPane) targetPane.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');
  document.getElementById('agentStrip').style.display = (t === 'discover' && state.scanning) ? '' : 'none';
  if (t === 'portfolio') renderPortfolio();
  if (t === 'dash') renderDash();
}

// Buy Logic
function openBuyModal(stock, grpKey) {
  state.currentBuyStock = stock;
  state.selectedGrp = grpKey || 'ultra';
  document.getElementById('buyModalTitle').textContent = `${state.currentBuyStock.ticker} 매수 기록`;
  const entryNum = parseFloat((state.currentBuyStock.entry || '').replace(/[^0-9.]/g, ''));
  if (!isNaN(entryNum) && isFinite(entryNum)) document.getElementById('buyPrice').value = Math.round(entryNum);
  else document.getElementById('buyPrice').value = '';
  document.getElementById('buyQty').value = '';
  document.getElementById('buyDate').value = localDateStr();
  selectGrp(state.selectedGrp);
  document.getElementById('buyModal').classList.add('open');
}

function closeBuyModal() { document.getElementById('buyModal').classList.remove('open'); }

function selectGrp(grp) {
  state.selectedGrp = grp;
  document.querySelectorAll('.grp-opt').forEach(el => {
    el.classList.remove('selected');
    if (el.dataset.grp === grp) el.classList.add('selected');
  });
}

function confirmBuy() {
  const price = parseFloat(document.getElementById('buyPrice').value);
  const qty = parseInt(document.getElementById('buyQty').value);
  const date = document.getElementById('buyDate').value;
  if (!price || !qty || price <= 0 || qty <= 0) { alert('매수가와 수량을 올바르게 입력해주세요.'); return; }
  if (!date) { alert('날짜를 입력해주세요.'); return; }
  if (!state.currentBuyStock || !state.currentBuyStock.ticker) { alert('종목 오류.'); return; }
  
  const s = state.currentBuyStock;
  const existIdx = state.portfolio.positions.findIndex(p => p.ticker === s.ticker && p.status === 'holding' && p.group === state.selectedGrp);
  if (existIdx >= 0) {
    state.portfolio.positions[existIdx].buyTrades.push({ id: uid(), date, price, qty, amount: price * qty });
  } else {
    state.portfolio.positions.push({
      id: uid(), ticker: s.ticker, company: s.company, group: state.selectedGrp,
      signal: s.signal, agentTarget: s.target, agentStop: s.stop_loss,
      agentEntry: s.entry, agentReason: s.reason, agentCatalyst: s.catalyst,
      holdPlan: s.hold, themes: s.themes || [],
      buyTrades: [{ id: uid(), date, price, qty, amount: price * qty }],
      sellTrades: [], status: 'holding', createdAt: new Date().toISOString()
    });
  }
  state.portfolio.trades.push({ id: uid(), type: 'buy', ticker: s.ticker, date, price, qty, amount: price * qty });
  savePortfolio();
  closeBuyModal();
  showTab('portfolio');
}

// Sell and Detail Logic
function openSellModal(posId) {
  state.currentSellPosId = posId;
  const pos = state.portfolio.positions.find(p => p.id === posId);
  if (!pos) return;
  const hq = getHoldingQty(pos);
  document.getElementById('sellModalTitle').textContent = `${pos.ticker} 매도 기록`;
  document.getElementById('sellPrice').value = '';
  document.getElementById('sellQty').value = hq;
  selectSellType('partial');
  document.getElementById('sellPreview').style.display = 'none';
  document.getElementById('agentSellThinking').style.display = 'none';
  document.getElementById('agentSellRec').style.display = 'none';
  document.getElementById('sellModal').classList.add('open');
}

function closeSellModal() { document.getElementById('sellModal').classList.remove('open'); }

function selectSellType(type) {
  state.sellTypeMode = type;
  document.getElementById('sellTypePartial').classList.toggle('selected', type === 'partial');
  document.getElementById('sellTypeAll').classList.toggle('selected', type === 'all');
  if (type === 'all') {
    const pos = state.portfolio.positions.find(p => p.id === state.currentSellPosId);
    if (pos) document.getElementById('sellQty').value = getHoldingQty(pos);
    document.getElementById('sellQty').disabled = true;
  } else {
    document.getElementById('sellQty').disabled = false;
  }
  updateSellPreview();
}

function updateSellPreview() {
  const pos = state.portfolio.positions.find(p => p.id === state.currentSellPosId);
  if (!pos) return;
  const price = parseFloat(document.getElementById('sellPrice').value);
  const qty = parseInt(document.getElementById('sellQty').value);
  const prev = document.getElementById('sellPreview');
  if (!price || !qty || price <= 0 || qty <= 0) { prev.style.display = 'none'; return; }
  const hq = getHoldingQty(pos);
  prev.style.display = '';
  if (qty > hq) {
    document.getElementById('spPnl').textContent = `⚠ 수량 초과`;
    return;
  }
  const avg = getAvgBuy(pos);
  const pnl = (price - avg) * qty;
  const rate = avg > 0 ? pnl / (avg * qty) : 0;
  
  document.getElementById('spAvgBuy').textContent = fmt$(avg);
  document.getElementById('spSellAmt').textContent = fmt$(price * qty);
  document.getElementById('spPnl').textContent = (pnl >= 0 ? '+' : '') + fmt$(pnl);
  document.getElementById('spPnl').style.color = pnl >= 0 ? 'var(--buy)' : 'var(--sell)';
  document.getElementById('spRate').textContent = (rate >= 0 ? '+' : '') + fmtP(rate);
  document.getElementById('spRate').style.color = rate >= 0 ? 'var(--buy)' : 'var(--sell)';
}

function confirmSell() {
  const pos = state.portfolio.positions.find(p => p.id === state.currentSellPosId);
  if (!pos) return;
  const price = parseFloat(document.getElementById('sellPrice').value);
  const qty = parseInt(document.getElementById('sellQty').value);
  if (!price || !qty || price <= 0 || qty <= 0) { alert('매도가/수량 오류.'); return; }
  const hq = getHoldingQty(pos);
  if (qty > hq) { alert('보유 수량 초과.'); return; }
  const avg = getAvgBuy(pos);
  const pnl = avg > 0 ? Math.round((price - avg) * qty * 100) / 100 : null;
  const amount = Math.round(price * qty * 100) / 100;
  const date = localDateStr();
  
  const trade = { id: uid(), date, price, qty, amount, pnl };
  pos.sellTrades.push(trade);
  state.portfolio.trades.push({ id: uid(), type: 'sell', ticker: pos.ticker, date, price, qty, amount, pnl });
  if (getHoldingQty(pos) === 0) pos.status = 'closed';
  
  savePortfolio();
  closeSellModal();
  renderPortfolio();
}

async function openDetail(posId) {
  const pos = state.portfolio.positions.find(p => p.id === posId);
  if (!pos) return;
  
  const avg = getAvgBuy(pos);
  const hq = getHoldingQty(pos);
  
  // Header with Ticker and Name
  let html = `<div style="margin-bottom:20px;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <div style="font-family:var(--mono);font-size:24px;font-weight:700;">${esc(pos.ticker)}</div>
        <div style="font-size:13px;color:var(--text-3);font-weight:500;">${esc(pos.company || '')}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:var(--text-4);font-family:var(--mono);">평균 단가</div>
        <div style="font-size:18px;font-weight:700;font-family:var(--mono);">${fmt$(avg)}</div>
      </div>
    </div>
  </div>`;

  // Chart Container
  html += `<div style="background:var(--bg-sub); border:1px solid var(--border); border-radius:var(--r-lg); padding:16px; margin-bottom:20px;">
    <div style="font-size:12px; font-weight:700; margin-bottom:12px; color:var(--text-2);">최근 30일 주가 추이 (Closing)</div>
    <div style="position:relative; height:180px;"><canvas id="historyChart"></canvas></div>
    <div id="historyLoading" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:12px; color:var(--text-4);">데이터 불러오는 중...</div>
  </div>`;
  
  html += `<div style="margin-bottom:20px;line-height:1.6;">
    <div style="font-size:11px;color:var(--text-3);font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">AI 분석 근거</div>
    <div style="font-size:14px;color:var(--text-2);background:var(--bg-sub);padding:14px;border-radius:var(--r);border:1px solid var(--border-sm);">${esc(pos.agentReason || 'AI 분석 데이터가 없습니다.')}</div>
  </div>`;
  
  html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
    <div style="background:var(--bg-sub);padding:12px;border-radius:var(--r);border:1px solid var(--border-sm);">
      <div style="font-size:10px;color:var(--text-4);font-family:var(--mono);margin-bottom:4px;">보유 수량</div>
      <div style="font-size:16px;font-weight:700;font-family:var(--mono);">${hq}주</div>
    </div>
    <div style="background:var(--bg-sub);padding:12px;border-radius:var(--r);border:1px solid var(--border-sm);">
      <div style="font-size:10px;color:var(--text-4);font-family:var(--mono);margin-bottom:4px;">보유 기간</div>
      <div style="font-size:16px;font-weight:700;font-family:var(--mono);">${Math.floor((Date.now() - new Date(pos.createdAt).getTime())/(1000*60*60*24))}일</div>
    </div>
  </div>`;
  
  html += '<button class="modal-submit" style="width:100%;" data-action="close_detail">닫기</button>';
  
  document.getElementById('detailTitle').textContent = `종목 상세 분석`;
  document.getElementById('detailBody').innerHTML = html;
  document.getElementById('detailModal').classList.add('open');

  // Fetch and Render Chart
  const history = await fetchHistoricalPrices(pos.ticker);
  const loadingEl = document.getElementById('historyLoading');
  if (loadingEl) loadingEl.style.display = 'none';

  if (history && history.length > 0) {
    const ctx = document.getElementById('historyChart').getContext('2d');
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const color = pos.ticker.charCodeAt(0) % 2 === 0 ? '#6366f1' : '#ec4899';

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: history.map((_, i) => i),
        datasets: [{
          data: history,
          borderColor: color,
          backgroundColor: color + '20',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true, mode: 'index', intersect: false } },
        scales: {
          x: { display: false },
          y: { 
            grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
            ticks: { color: isDark ? '#64748b' : '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }
          }
        }
      }
    });
  } else {
    if (loadingEl) {
      loadingEl.textContent = '데이터를 불러올 수 없습니다.';
      loadingEl.style.display = 'block';
    }
  }
}

function closeDetail() { document.getElementById('detailModal').classList.remove('open'); }


// --- js/main.js ---
// js/main.js

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

