// js/price_api.js

export async function fetchCurrentPrices(tickers) {
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

export async function fetchHistoricalData(ticker, days=30) {
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

export async function fetchHistoricalPrices(ticker, days=30) {
  const data = await fetchHistoricalData(ticker, days);
  if (!data) return null;
  return data.map(d => d.close);
}

// ATR(Average True Range) 및 지지/저항(Support/Resistance) 계산
export function calculateTechnicalBounds(histData) {
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
