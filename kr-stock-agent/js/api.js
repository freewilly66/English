// js/api.js

import { addLog } from './utils.js';

export function closeSettingsModal() {
  document.getElementById('settingsModal')?.classList.remove('open');
}

export function getApiKey() {
  return localStorage.getItem('gemini_api_key') || '';
}

export function getFinnhubApiKey() {
  return localStorage.getItem('finnhub_api_key') || '';
}

export function getGasUrl() {
  return localStorage.getItem('gas_url') || '';
}

export function getTheme() {
  return localStorage.getItem('us_theme') || 'auto';
}

export function setTheme(t) {
  localStorage.setItem('us_theme', t);
  const b = document.body;
  b.classList.remove('light-mode', 'dark-mode');
  if (t === 'light') b.classList.add('light-mode');
  else if (t === 'dark') b.classList.add('dark-mode');
}

export function saveSettings() {
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

export function openSettingsModal() {
  document.getElementById('apiKeyInput').value = getApiKey();
  document.getElementById('apiKeyFinnhubInput').value = getFinnhubApiKey();
  document.getElementById('gasUrlInput').value = getGasUrl();
  document.getElementById('settingsModal')?.classList.add('open');
}

export async function logToSheet(dataArray, type = 'recommendations') {
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

export async function fetchSheetHistory() {
  const url = getGasUrl();
  if (!url) return [];
  try {
    // Specify type=recommendations to only pull stock recommendation history
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'type=recommendations');
    if (!res.ok) return [];
    return await res.json();
  } catch(e) { console.error('Sheet fetch error:', e); return []; }
}

export async function logPortfolioSnapshot(snapshotData) {
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

export function pj(str) {
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

export const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro-latest",
  "gemini-pro"
];

let lastApiErrorMsg = '모든 모델의 할당량이 초과되었거나 사용 불가 상태입니다. 내일 다시 시도하세요.';

export function callAgent(sys, usr, retries = 2, modelIdx = 0) {
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
