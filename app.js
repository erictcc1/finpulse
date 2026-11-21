/**
 * ============================================================================
 * FinPulse Pro — 共用核心引擎 (app.js)
 * 職責：
 * 1. 本機資料庫 (db)、匯率表 (fxStore)、動態幣別表 (currencyRegistry) 讀寫
 * 2. Google Drive API 直接讀寫同步引擎 (drive.file 最小安全權限，純前端免後端)
 * 3. 多幣別原幣核算與基準幣折算（缺匯率時安全顯示「未設匯率 / 匯率待填」）
 * 4. 共用頂部導航列、手機底部導航、全域匯率 Modal 與 4 大 KPI 卡片渲染
 * ============================================================================
 */

const STORAGE_KEY = 'finpulse_pro_multicurrency_v2';
const FX_STORAGE_KEY = 'fx_rates_v1';
const CURRENCY_REG_KEY = 'currency_registry_v1';
const PROMOTE_DRAFT_KEY = 'finpulse_promote_draft_temp';
const GDRIVE_CFG_KEY = 'finpulse_gdrive_cfg_v1';
const GDRIVE_SYNC_FILENAME = 'FinPulse_Pro_Cloud_Sync.json';

// 預設幣別登錄表（包含澳元 AUD 等常用幣別，並支援使用者動態新增任意幣別）
const DEFAULT_CURRENCY_REGISTRY = {
    HKD: { code: 'HKD', symbol: 'HK$', label: '港幣' },
    USD: { code: 'USD', symbol: 'US$', label: '美元' },
    AUD: { code: 'AUD', symbol: 'A$', label: '澳元' },
    JPY: { code: 'JPY', symbol: '¥', label: '日圓' },
    EUR: { code: 'EUR', symbol: '€', label: '歐元' },
    CNY: { code: 'CNY', symbol: '¥', label: '人民幣' },
    GBP: { code: 'GBP', symbol: '£', label: '英鎊' },
    SGD: { code: 'SGD', symbol: 'S$', label: '新加坡元' }
};

function getRelativeDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
}

const DEFAULT_FX_RATES = {
    base: 'HKD',
    updatedDate: getRelativeDate(0),
    rates: {
        HKD: 1.0,
        USD: 7.78,
        AUD: 5.08,
        JPY: 0.051,
        EUR: 8.45,
        CNY: 1.08,
        GBP: 9.85,
        SGD: 5.80
    }
};

const DEFAULT_DATA = {
    accounts: [
        { id: 'acc_hsbc_hkd', category: 'bank', institutionName: '匯豐銀行 HSBC', subAccountName: '港元儲蓄戶口', currency: 'HKD', initialBalance: 85000, feeRule: { flat: 0, pct: 0 } },
        { id: 'acc_hsbc_usd', category: 'bank', institutionName: '匯豐銀行 HSBC', subAccountName: '外幣往來戶口 (USD)', currency: 'USD', initialBalance: 3200, feeRule: { flat: 0, pct: 0 } },
        { id: 'acc_fidelity_usd', category: 'broker', institutionName: '富達 Fidelity', subAccountName: '美債與固定收益戶口', currency: 'USD', initialBalance: 5400, feeRule: { flat: 15, pct: 0.05 } },
        { id: 'acc_ib_usd', category: 'broker', institutionName: 'IB 盈透證券', subAccountName: '美元期貨與保證金戶口', currency: 'USD', initialBalance: 8000, feeRule: { flat: 2, pct: 0.01 } },
        { id: 'acc_ib_jpy', category: 'broker', institutionName: 'IB 盈透證券', subAccountName: '日圓資產與套利戶口', currency: 'JPY', initialBalance: 450000, feeRule: { flat: 200, pct: 0.01 } }
    ],
    cashflows: [
        { id: 'cf_01', accountId: 'acc_hsbc_hkd', type: 'income', category: '薪金收入', amount: 38000, fee: 0, feeCurrency: 'HKD', date: getRelativeDate(-14), note: '11月正職薪金入帳' },
        { id: 'cf_02', accountId: 'acc_hsbc_hkd', type: 'expense', category: '日常餐飲', amount: 2450, fee: 0, feeCurrency: 'HKD', date: getRelativeDate(-11), note: '每週餐飲與超市採購' },
        {
            id: 'cf_fx_01',
            type: 'transfer',
            fromAccountId: 'acc_hsbc_hkd',
            fromAmount: 15560,
            fromCurrency: 'HKD',
            toAccountId: 'acc_fidelity_usd',
            toAmount: 2000,
            toCurrency: 'USD',
            fxRate: 7.78,
            fee: 50,
            feeCurrency: 'HKD',
            feeAccountId: 'acc_hsbc_hkd',
            date: getRelativeDate(-9),
            note: '匯豐換匯 2,000 USD 轉入富達買債 (電匯手續費 HK$50 獨立扣除)'
        },
        { id: 'cf_03', accountId: 'acc_fidelity_usd', type: 'income', category: '債息/派息', amount: 425, fee: 0, feeCurrency: 'USD', date: getRelativeDate(-6), note: 'US Treasury 半年期派息' },
        { id: 'cf_04', accountId: 'acc_hsbc_hkd', type: 'expense', category: '住屋與水電', amount: 11500, fee: 0, feeCurrency: 'HKD', date: getRelativeDate(-4), note: '租金與管理費' },
        { id: 'cf_05', accountId: 'acc_ib_usd', type: 'income', category: '期貨/投資平倉', amount: 680, fee: 4.5, feeCurrency: 'USD', date: getRelativeDate(-2), note: '短線國債期貨平倉獲利' }
    ],
    holdings: [
        {
            id: 'hd_01',
            accountId: 'acc_fidelity_usd',
            assetType: 'treasury',
            name: 'US Treasury Note 4.25% (1年期)',
            principal: 20000,
            purchasePrice: 98.85,
            brokerFee: 15,
            actualCost: 19785.00,
            couponRate: 4.25,
            yieldRate: 4.68,
            startDate: getRelativeDate(-60),
            maturityDate: getRelativeDate(125),
            payoutNote: '每半年派息一次 (下次 2027-03-26)'
        },
        {
            id: 'hd_02',
            accountId: 'acc_fidelity_usd',
            assetType: 'deposit',
            name: '富達美元貨幣基金 / 3個月定存',
            principal: 15000,
            purchasePrice: 100,
            brokerFee: 0,
            actualCost: 15000,
            couponRate: 4.50,
            yieldRate: 4.50,
            startDate: getRelativeDate(-20),
            maturityDate: getRelativeDate(70),
            payoutNote: '到期連本帶息自動撥入富達美元戶口'
        },
        {
            id: 'hd_03',
            accountId: 'acc_ib_usd',
            assetType: 'futures',
            name: '2-Year T-Note Futures (ZT 國債期貨)',
            principal: 10000,
            purchasePrice: 102.15,
            brokerFee: 2.5,
            actualCost: 10217.50,
            couponRate: 3.90,
            yieldRate: 4.15,
            startDate: getRelativeDate(-10),
            maturityDate: getRelativeDate(28),
            payoutNote: '季月合約到期前平倉或展期'
        }
    ],
    simDrafts: [
        {
            draftId: 'sim_demo_01',
            savedDate: getRelativeDate(-2),
            accountId: 'acc_fidelity_usd',
            currency: 'USD',
            title: '6個月美國短債 T-Bill (富達)',
            assetType: 'treasury',
            principal: 50000,
            fees: 25,
            startDate: getRelativeDate(0),
            targetDate: getRelativeDate(182),
            days: 182,
            basis: 360,
            rates: { low: 4.10, mid: 4.45, high: 4.80 },
            results: { netLow: 1011.39, netMid: 1099.86, netHigh: 1188.33 }
        }
    ]
};

function loadDatabase() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.accounts && parsed.cashflows && parsed.holdings) {
                return { simDrafts: [], ...parsed };
            }
        }
    } catch (e) {
        console.warn('讀取本機資料庫失敗，改用預設資料:', e);
    }
    const cloned = JSON.parse(JSON.stringify(DEFAULT_DATA));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cloned));
    return cloned;
}

function loadFxRates() {
    try {
        const raw = localStorage.getItem(FX_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.rates) {
                return {
                    base: parsed.base || 'HKD',
                    updatedDate: parsed.updatedDate || getRelativeDate(0),
                    rates: { ...DEFAULT_FX_RATES.rates, ...parsed.rates }
                };
            }
        }
    } catch (e) {
        console.warn('讀取本機匯率表失敗:', e);
    }
    const cloned = JSON.parse(JSON.stringify(DEFAULT_FX_RATES));
    localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(cloned));
    return cloned;
}

window.db = loadDatabase();
window.fxStore = loadFxRates();

function loadCurrencyRegistry() {
    try {
        const raw = localStorage.getItem(CURRENCY_REG_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        const merged = { ...DEFAULT_CURRENCY_REGISTRY, ...parsed };
        Object.keys((window.fxStore && window.fxStore.rates) || {}).forEach(code => {
            if (!merged[code]) merged[code] = { code, symbol: code + ' ', label: code };
        });
        (window.db.accounts || []).forEach(acc => {
            if (acc.currency && !merged[acc.currency]) {
                merged[acc.currency] = { code: acc.currency, symbol: acc.currency + ' ', label: acc.currency };
            }
        });
        localStorage.setItem(CURRENCY_REG_KEY, JSON.stringify(merged));
        return merged;
    } catch (e) {
        return { ...DEFAULT_CURRENCY_REGISTRY };
    }
}

window.currencyRegistry = loadCurrencyRegistry();
window.currencyDisplayMode = sessionStorage.getItem('fp_curr_mode') || 'original';
window.baseCurrency = sessionStorage.getItem('fp_base_curr') || 'HKD';

function saveCurrencyRegistry() {
    localStorage.setItem(CURRENCY_REG_KEY, JSON.stringify(window.currencyRegistry));
}

function saveDatabase() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
    renderGlobalKPIs();
    if (typeof window.onPageDataUpdated === 'function') {
        window.onPageDataUpdated();
    }
}

// ============================================================================
// Google Drive 直接讀寫同步引擎 (Google Identity Services + Drive REST API v3)
// ============================================================================

function loadGDriveConfig() {
    try {
        const raw = localStorage.getItem(GDRIVE_CFG_KEY);
        return raw ? JSON.parse(raw) : { clientId: '', fileId: '', lastSyncTime: '', autoUploadOnSave: false };
    } catch (e) {
        return { clientId: '', fileId: '', lastSyncTime: '', autoUploadOnSave: false };
    }
}

window.gdriveConfig = loadGDriveConfig();
window.gdriveAccessToken = sessionStorage.getItem('fp_gdrive_token') || '';
window.gdriveTokenExpiresAt = parseInt(sessionStorage.getItem('fp_gdrive_exp') || '0', 10);

function saveGDriveConfig() {
    localStorage.setItem(GDRIVE_CFG_KEY, JSON.stringify(window.gdriveConfig));
}

function ensureGoogleGsiScript() {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
            resolve();
            return;
        }
        const existing = document.getElementById('google-gsi-script');
        if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('無法載入 Google 授權元件')));
            return;
        }
        const script = document.createElement('script');
        script.id = 'google-gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('無法連線至 Google 授權服務，請檢查網路'));
        document.head.appendChild(script);
    });
}

async function getValidGDriveToken(forcePrompt = false) {
    const clientId = (window.gdriveConfig.clientId || '').trim();
    if (!clientId) {
        toggleCloudModal(true);
        throw new Error('請先設定 Google OAuth Client ID');
    }

    const now = Date.now();
    if (!forcePrompt && window.gdriveAccessToken && window.gdriveTokenExpiresAt > now + 60000) {
        return window.gdriveAccessToken;
    }

    await ensureGoogleGsiScript();

    return new Promise((resolve, reject) => {
        try {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/drive.file',
                callback: (resp) => {
                    if (resp.error) {
                        reject(new Error(`Google 授權失敗: ${resp.error}`));
                        return;
                    }
                    window.gdriveAccessToken = resp.access_token;
                    const expiresInMs = (parseInt(resp.expires_in || '3599', 10)) * 1000;
                    window.gdriveTokenExpiresAt = Date.now() + expiresInMs;
                    sessionStorage.setItem('fp_gdrive_token', window.gdriveAccessToken);
                    sessionStorage.setItem('fp_gdrive_exp', String(window.gdriveTokenExpiresAt));
                    resolve(window.gdriveAccessToken);
                }
            });
            tokenClient.requestAccessToken({ prompt: forcePrompt ? 'consent' : '' });
        } catch (err) {
            reject(err);
        }
    });
}

async function findOrCreateCloudFileId(token) {
    // 1. 若已有快取 fileId，先確認該檔案仍存在且未被移入垃圾桶
    if (window.gdriveConfig.fileId) {
        const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${window.gdriveConfig.fileId}?fields=id,trashed`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (checkRes.ok) {
            const meta = await checkRes.json();
            if (meta && !meta.trashed) return meta.id;
        }
    }

    // 2. 搜尋雲端硬碟中同名的同步檔
    const q = encodeURIComponent(`name='${GDRIVE_SYNC_FILENAME}' and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!searchRes.ok) throw new Error('搜尋 Google Drive 同步檔案失敗');
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
        window.gdriveConfig.fileId = searchData.files[0].id;
        saveGDriveConfig();
        return searchData.files[0].id;
    }

    // 3. 若尚無檔案則建立一個新的空 JSON 檔
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: GDRIVE_SYNC_FILENAME,
            mimeType: 'application/json'
        })
    });
    if (!createRes.ok) throw new Error('在 Google Drive 建立同步檔案失敗');
    const created = await createRes.json();
    window.gdriveConfig.fileId = created.id;
    saveGDriveConfig();
    return created.id;
}

async function uploadToGoogleDrive() {
    try {
        showToast('正在連線 Google Drive 並上傳最新資料...');
        const token = await getValidGDriveToken(false);
        const fileId = await findOrCreateCloudFileId(token);

        const payload = {
            app: 'FinPulse Pro',
            schemaVersion: 2,
            syncedAt: new Date().toISOString(),
            db: window.db,
            fxStore: window.fxStore,
            currencyRegistry: window.currencyRegistry
        };

        const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload, null, 2)
        });

        if (!uploadRes.ok) throw new Error(`上傳失敗 (HTTP ${uploadRes.status})`);

        const nowStr = new Date().toLocaleString('zh-HK', { hour12: false });
        window.gdriveConfig.lastSyncTime = `已上傳 ${nowStr}`;
        saveGDriveConfig();
        updateCloudStatusUI();
        showToast(`☁️ 已成功寫入 Google Drive (${GDRIVE_SYNC_FILENAME})！`);
    } catch (err) {
        console.error(err);
        showToast(err.message || '上傳至 Google Drive 失敗', 'error');
    }
}

async function downloadFromGoogleDrive() {
    try {
        showToast('正在從 Google Drive 讀取雲端資料...');
        const token = await getValidGDriveToken(false);
        const q = encodeURIComponent(`name='${GDRIVE_SYNC_FILENAME}' and trashed=false`);
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!searchRes.ok) throw new Error('搜尋 Google Drive 檔案失敗');
        const searchData = await searchRes.json();

        if (!searchData.files || searchData.files.length === 0) {
            showToast(`雲端硬碟中找不到 ${GDRIVE_SYNC_FILENAME}，請先執行一次「上傳至雲端」`, 'error');
            return;
        }

        const fileId = searchData.files[0].id;
        window.gdriveConfig.fileId = fileId;

        const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!fileRes.ok) throw new Error(`讀取雲端檔案內容失敗 (HTTP ${fileRes.status})`);

        const parsed = await fileRes.json();
        const importedDb = parsed.db ? parsed.db : parsed;
        if (!importedDb || !importedDb.accounts || !importedDb.cashflows || !importedDb.holdings) {
            throw new Error('雲端檔案內容格式不符或為空');
        }

        window.db = { simDrafts: [], ...importedDb };
        if (parsed.fxStore) {
            window.fxStore = parsed.fxStore;
            localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(window.fxStore));
        }
        if (parsed.currencyRegistry) {
            window.currencyRegistry = { ...DEFAULT_CURRENCY_REGISTRY, ...parsed.currencyRegistry };
            saveCurrencyRegistry();
        }
        window.currencyRegistry = loadCurrencyRegistry();

        const nowStr = new Date().toLocaleString('zh-HK', { hour12: false });
        window.gdriveConfig.lastSyncTime = `已下載 ${nowStr}`;
        saveGDriveConfig();
        saveDatabase();
        renderSharedChrome(window.CURRENT_PAGE_ID);
        updateCloudStatusUI();
        showToast('☁️ 已從 Google Drive 讀取並覆蓋更新本機資料！');
    } catch (err) {
        console.error(err);
        showToast(err.message || '從 Google Drive 讀取失敗', 'error');
    }
}

function saveGDriveClientIdFromModal() {
    const input = document.getElementById('gdrive-client-id-input');
    if (!input) return;
    window.gdriveConfig.clientId = input.value.trim();
    saveGDriveConfig();
    updateCloudStatusUI();
    showToast('已儲存 Google OAuth Client ID！');
}

function toggleCloudModal(show) {
    const modal = document.getElementById('cloud-sync-modal');
    if (!modal) return;
    if (show) {
        const inp = document.getElementById('gdrive-client-id-input');
        if (inp) inp.value = window.gdriveConfig.clientId || '';
        updateCloudStatusUI();
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

function updateCloudStatusUI() {
    const statusText = document.getElementById('cloud-sync-status-text');
    if (statusText) {
        const hasId = !!(window.gdriveConfig.clientId || '').trim();
        statusText.innerHTML = hasId
            ? `狀態：<span class="text-emerald-400 font-semibold">已設定 Client ID</span> · ${window.gdriveConfig.lastSyncTime || '尚未執行同步'}`
            : `狀態：<span class="text-amber-400 font-semibold">尚未設定 Google Client ID</span>（請參閱 GOOGLE_DRIVE_SETUP.md）`;
    }
    const headerBadge = document.getElementById('header-cloud-status');
    if (headerBadge) {
        headerBadge.textContent = (window.gdriveConfig.clientId || '').trim() ? '☁️ 雲端硬碟' : '☁️ 設定雲端';
    }
}

// ============================================================================
// 貨幣換算與格式化工具
// ============================================================================

function getCurrencySymbol(code) {
    if (!code) return '';
    const reg = window.currencyRegistry[code];
    return reg && reg.symbol ? reg.symbol : (code + ' ');
}

function getCurrencyDisplayOption(code) {
    const reg = window.currencyRegistry[code];
    if (!reg) return `${code}`;
    return reg.label && reg.label !== code ? `${code} (${reg.label})` : code;
}

function convertCurrency(amount, fromCurr, toCurr) {
    if (amount === null || amount === undefined || isNaN(amount)) return null;
    if (fromCurr === toCurr) return amount;
    const rates = window.fxStore.rates || {};
    const fromToHkd = fromCurr === 'HKD' ? 1 : parseFloat(rates[fromCurr]);
    const toToHkd = toCurr === 'HKD' ? 1 : parseFloat(rates[toCurr]);

    if (!fromToHkd || isNaN(fromToHkd) || fromToHkd <= 0 || !toToHkd || isNaN(toToHkd) || toToHkd <= 0) {
        return null;
    }
    return (amount * fromToHkd) / toToHkd;
}

function formatMoney(amount, currency, decimals = 0) {
    const sym = getCurrencySymbol(currency);
    const absVal = Math.abs(amount).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
    return `${amount < 0 ? '-' : ''}${sym}${absVal}`;
}

function formatMultiCurrencySummary(currencyMap, decimals = 0) {
    const entries = Object.entries(currencyMap).filter(([_, val]) => Math.abs(val) > 0.001);
    if (entries.length === 0) return formatMoney(0, window.baseCurrency, decimals);

    if (window.currencyDisplayMode === 'converted') {
        let totalInBase = 0;
        const missingCurrencies = [];

        entries.forEach(([curr, val]) => {
            const converted = convertCurrency(val, curr, window.baseCurrency);
            if (converted === null) {
                missingCurrencies.push(curr);
            } else {
                totalInBase += converted;
            }
        });

        if (missingCurrencies.length > 0) {
            const partialStr = totalInBase !== 0 ? `部分 ≈ ${formatMoney(totalInBase, window.baseCurrency, decimals)} · ` : '';
            return `${partialStr}未設匯率 / 匯率待填 (${missingCurrencies.join(', ')})`;
        }
        return `≈ ${formatMoney(totalInBase, window.baseCurrency, decimals)}`;
    } else {
        return entries.map(([curr, val]) => `${curr} ${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`).join(' · ');
    }
}

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const colors = type === 'error'
        ? 'bg-rose-950/95 border-rose-500 text-rose-200'
        : 'bg-terminal-card/95 border-emerald-500 text-emerald-200';
    toast.className = `pointer-events-auto border ${colors} px-4 py-3 rounded-xl shadow-2xl text-xs sm:text-sm font-medium flex items-center justify-between gap-3 transition-all duration-300`;
    toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" class="text-white/60 hover:text-white">✕</button>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ============================================================================
// 帳戶動態原幣餘額與手續費計算
// ============================================================================

function getAccountDynamicBalance(acc) {
    let bal = acc.initialBalance || 0;
    window.db.cashflows.forEach(cf => {
        if (cf.type === 'transfer') {
            if (cf.fromAccountId === acc.id) bal -= (cf.fromAmount || 0);
            if (cf.toAccountId === acc.id) bal += (cf.toAmount || 0);
            const feeTargetAcc = cf.feeAccountId || cf.fromAccountId;
            if (feeTargetAcc === acc.id && cf.fee > 0) {
                const feeInAccCurr = convertCurrency(cf.fee, cf.feeCurrency || cf.fromCurrency, acc.currency);
                if (feeInAccCurr !== null) bal -= feeInAccCurr;
            }
        } else if (cf.accountId === acc.id) {
            bal += cf.type === 'income' ? cf.amount : -cf.amount;
            if (cf.fee > 0) {
                const feeInAccCurr = convertCurrency(cf.fee, cf.feeCurrency || acc.currency, acc.currency);
                if (feeInAccCurr !== null) bal -= feeInAccCurr;
            }
        }
    });
    return bal;
}

function getAccountLabel(accountId) {
    const acc = window.db.accounts.find(a => a.id === accountId);
    if (!acc) return '未知戶口';
    return `${acc.institutionName} · ${acc.subAccountName} (${acc.currency})`;
}

function calculateAccountDefaultFee(acc, principal) {
    if (!acc || !acc.feeRule) return 0;
    const flat = acc.feeRule.flat || 0;
    const pctFee = principal * ((acc.feeRule.pct || 0) / 100);
    return +Math.max(flat, pctFee).toFixed(2);
}

// ============================================================================
// 共用導航列、幣別控制、匯率表 Modal、雲端硬碟 Modal 與 KPI 渲染
// ============================================================================

const NAV_ITEMS = [
    { id: 'overview', href: 'index.html', icon: '🧭', label: '資金定位與總覽', shortLabel: '資金定位' },
    { id: 'cashflow', href: 'cashflow.html', icon: '📈', label: '現金流與換匯', shortLabel: '現金流/換匯' },
    { id: 'holdings', href: 'holdings.html', icon: '🏛️', label: '國債 / 定存 / 期貨', shortLabel: '國債/期貨' },
    { id: 'calculator', href: 'calculator.html', icon: '🧮', label: '三情境試算機', shortLabel: '三情境試算' },
    { id: 'accounts', href: 'accounts.html', icon: '🏦', label: '平台與手續費設定', shortLabel: '平台設定' }
];

function renderSharedChrome(activePageId) {
    const headerHost = document.getElementById('shared-header');
    if (headerHost) {
        const codes = Object.keys(window.currencyRegistry);
        const baseOptions = codes.map(c => `<option value="${c}" class="bg-terminal-card" ${c === window.baseCurrency ? 'selected' : ''}>${c}</option>`).join('');

        const xlNavHtml = NAV_ITEMS.map(item => {
            const active = item.id === activePageId;
            return `<a href="${item.href}" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${active ? 'bg-terminal-accent text-white shadow' : 'text-terminal-muted hover:text-white'}">${item.icon} ${item.label}</a>`;
        }).join('');

        const mdNavHtml = NAV_ITEMS.map(item => {
            const active = item.id === activePageId;
            return `<a href="${item.href}" class="px-3 py-1.5 rounded-lg text-xs font-medium transition ${active ? 'bg-terminal-accent text-white' : 'text-terminal-muted hover:text-white'}">${item.icon} ${item.label}</a>`;
        }).join('');

        const hasCloudClientId = !!(window.gdriveConfig && (window.gdriveConfig.clientId || '').trim());

        headerHost.innerHTML = `
            <header class="glass-header sticky top-0 z-40 px-3 sm:px-4 py-2.5">
                <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
                    <a href="index.html" class="flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-900/30 shrink-0">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                            </svg>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-base sm:text-lg text-white tracking-tight">FinPulse <span class="text-blue-400">Pro</span></span>
                                <span class="hidden sm:flex text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium items-center gap-1">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    本機 + Drive 雙模
                                </span>
                            </div>
                        </div>
                    </a>

                    <nav class="hidden xl:flex items-center bg-terminal-bg p-1 rounded-xl border border-terminal-border">
                        ${xlNavHtml}
                    </nav>

                    <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <div class="flex items-center bg-terminal-bg border border-terminal-border rounded-xl p-0.5 text-xs">
                            <button onclick="setCurrencyDisplayMode('original')" class="px-2 py-1 rounded-lg font-medium transition ${window.currencyDisplayMode === 'original' ? 'bg-terminal-hover text-white' : 'text-terminal-muted hover:text-white'}">
                                原幣
                            </button>
                            <button onclick="setCurrencyDisplayMode('converted')" class="px-2 py-1 rounded-lg font-medium transition ${window.currencyDisplayMode === 'converted' ? 'bg-blue-600 text-white' : 'text-terminal-muted hover:text-white'}">
                                折合
                            </button>
                            <select onchange="changeBaseCurrency(this.value)" title="選擇折合基準幣別" class="bg-transparent text-blue-400 font-mono font-bold text-xs px-1.5 py-1 focus:outline-none cursor-pointer">
                                ${baseOptions}
                            </select>
                        </div>

                        <button onclick="toggleFxModal(true)" class="px-2.5 py-1.5 rounded-xl bg-terminal-card hover:bg-terminal-hover border border-terminal-border text-xs font-medium text-amber-400 transition flex items-center gap-1">
                            <span>💱 匯率</span>
                            <span class="hidden md:inline text-[10px] text-terminal-muted font-mono">${window.fxStore.updatedDate}</span>
                        </button>

                        <button onclick="toggleCloudModal(true)" class="px-2.5 py-1.5 rounded-xl bg-terminal-card hover:bg-terminal-hover border ${hasCloudClientId ? 'border-blue-500/40 text-blue-300' : 'border-terminal-border text-terminal-text'} text-xs font-medium transition flex items-center gap-1">
                            <span id="header-cloud-status">${hasCloudClientId ? '☁️ 雲端硬碟' : '☁️ 設定雲端'}</span>
                        </button>
                    </div>
                </div>

                <div class="hidden md:flex xl:hidden max-w-7xl mx-auto mt-2 pt-2 border-t border-terminal-border/60 gap-2">
                    ${mdNavHtml}
                </div>
            </header>
        `;
    }

    // 手機版底部導航列
    const mobileNavHost = document.getElementById('shared-mobile-nav');
    if (mobileNavHost) {
        mobileNavHost.innerHTML = `
            <nav class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-terminal-card/95 backdrop-blur-md border-t border-terminal-border grid grid-cols-5 py-1.5 px-1">
                ${NAV_ITEMS.map(item => {
                    const active = item.id === activePageId;
                    return `
                        <a href="${item.href}" class="flex flex-col items-center py-1 ${active ? 'text-blue-400' : 'text-terminal-muted'}">
                            <span class="text-base">${item.icon}</span>
                            <span class="text-[10px] font-medium mt-0.5">${item.shortLabel}</span>
                        </a>
                    `;
                }).join('')}
            </nav>
        `;
    }

    // 確保全域匯率 Modal 存在於 DOM 中
    if (!document.getElementById('fx-modal')) {
        const modalDiv = document.createElement('div');
        modalDiv.id = 'fx-modal';
        modalDiv.className = 'hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4';
        modalDiv.innerHTML = `
            <div class="bg-terminal-card border border-terminal-border rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between pb-3 border-b border-terminal-border">
                    <div>
                        <h3 class="text-base font-bold text-white">💱 本機幣別登錄與匯率表 (fx_rates_v1)</h3>
                        <p class="text-xs text-terminal-muted mt-0.5">支援新增任意自訂幣別（如 AUD、CAD、CHF）與匯率，純本機儲存零 API 費</p>
                    </div>
                    <button onclick="toggleFxModal(false)" class="text-terminal-muted hover:text-white p-1">✕</button>
                </div>

                <div class="flex items-center justify-between bg-terminal-bg px-3 py-2 rounded-xl border border-terminal-border text-xs">
                    <span class="text-terminal-muted">匯率更新日期：</span>
                    <input type="date" id="fx-updated-date" class="bg-transparent font-mono text-amber-400 font-semibold focus:outline-none">
                </div>

                <div class="bg-terminal-bg/90 border border-blue-500/30 rounded-xl p-3 space-y-2.5">
                    <div class="text-xs font-semibold text-blue-300">➕ 新增自訂幣別（例如澳元 AUD、加元 CAD、瑞郎 CHF）</div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input type="text" id="new-curr-code" maxlength="5" placeholder="代碼 (如 AUD)" class="bg-terminal-card border border-terminal-border rounded-lg px-2.5 py-1.5 text-xs font-mono uppercase text-white focus:outline-none focus:border-blue-500">
                        <input type="text" id="new-curr-label" placeholder="名稱 (如 澳元)" class="bg-terminal-card border border-terminal-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500">
                        <input type="number" step="0.0001" min="0" id="new-curr-rate" placeholder="1單位 = ? HKD" class="bg-terminal-card border border-terminal-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-amber-400 focus:outline-none focus:border-blue-500">
                    </div>
                    <button type="button" onclick="addCustomCurrencyFromModal()" class="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition">
                        + 加入幣別並同步至全站選單
                    </button>
                </div>

                <div id="fx-rates-inputs" class="grid grid-cols-1 sm:grid-cols-2 gap-2.5"></div>

                <div class="flex gap-2 pt-2">
                    <button onclick="saveFxRates()" class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition">
                        💾 儲存本機匯率表
                    </button>
                    <button onclick="toggleFxModal(false)" class="px-4 py-2.5 rounded-xl bg-terminal-bg hover:bg-terminal-hover border border-terminal-border text-xs text-terminal-muted">
                        取消
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);
    }

    // 確保全域 Google Drive 雲端同步 Modal 存在於 DOM 中
    if (!document.getElementById('cloud-sync-modal')) {
        const cloudModal = document.createElement('div');
        cloudModal.id = 'cloud-sync-modal';
        cloudModal.className = 'hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4';
        cloudModal.innerHTML = `
            <div class="bg-terminal-card border border-terminal-border rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
                <div class="flex items-center justify-between pb-3 border-b border-terminal-border">
                    <div>
                        <h3 class="text-base font-bold text-white">☁️ Google Drive 雲端硬碟直接讀寫同步</h3>
                        <p class="text-xs text-terminal-muted mt-0.5">使用最小安全權限 (drive.file)，僅讀寫專屬同步檔 ${GDRIVE_SYNC_FILENAME}</p>
                    </div>
                    <button onclick="toggleCloudModal(false)" class="text-terminal-muted hover:text-white p-1">✕</button>
                </div>

                <div id="cloud-sync-status-text" class="bg-terminal-bg px-3 py-2.5 rounded-xl border border-terminal-border text-xs text-terminal-text"></div>

                <div class="space-y-1.5">
                    <label class="block text-xs text-terminal-muted">Google OAuth 2.0 用戶端編號 (Client ID)</label>
                    <div class="flex gap-2">
                        <input type="text" id="gdrive-client-id-input" placeholder="貼上 xxxx.apps.googleusercontent.com" class="flex-1 bg-terminal-bg border border-terminal-border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500">
                        <button type="button" onclick="saveGDriveClientIdFromModal()" class="px-3.5 py-2 rounded-xl bg-terminal-hover hover:bg-blue-600 border border-terminal-border text-xs font-semibold text-white transition">
                            儲存 ID
                        </button>
                    </div>
                    <p class="text-[11px] text-terminal-muted">初次使用請參考專案內的 <code class="text-blue-400">GOOGLE_DRIVE_SETUP.md</code> 免費申請一組 Client ID（約 2 分鐘）。</p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button type="button" onclick="uploadToGoogleDrive()" class="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-blue-900/30 transition flex items-center justify-center gap-1.5">
                        <span>☁️⬆ 上傳並覆寫至雲端</span>
                    </button>
                    <button type="button" onclick="downloadFromGoogleDrive()" class="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-emerald-900/30 transition flex items-center justify-center gap-1.5">
                        <span>☁️⬇ 從雲端讀取並還原</span>
                    </button>
                </div>

                <div class="flex justify-end pt-1">
                    <button type="button" onclick="toggleCloudModal(false)" class="px-4 py-2 rounded-xl bg-terminal-bg hover:bg-terminal-hover border border-terminal-border text-xs text-terminal-muted">
                        關閉
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(cloudModal);
    }

    renderGlobalKPIs();
}

function renderGlobalKPIs() {
    const kpiHost = document.getElementById('shared-kpis');
    if (!kpiHost) return;

    const cashByCurr = {};
    window.db.accounts.forEach(acc => {
        const bal = getAccountDynamicBalance(acc);
        cashByCurr[acc.currency] = (cashByCurr[acc.currency] || 0) + bal;
    });

    const investByCurr = {};
    const profitByCurr = {};
    let nearestHolding = null;
    let minDaysLeft = 999999;

    window.db.holdings.forEach(h => {
        const acc = window.db.accounts.find(a => a.id === h.accountId);
        const curr = acc ? acc.currency : 'USD';
        const totalDays = Math.max(1, Math.ceil((new Date(h.maturityDate) - new Date(h.startDate)) / (1000 * 60 * 60 * 24)));
        const profit = (h.principal - h.actualCost) + (h.principal * (h.couponRate / 100) * (totalDays / 365));

        investByCurr[curr] = (investByCurr[curr] || 0) + h.actualCost;
        profitByCurr[curr] = (profitByCurr[curr] || 0) + profit;

        const daysLeft = Math.ceil((new Date(h.maturityDate) - new Date()) / (1000 * 60 * 60 * 24));
        if (daysLeft >= 0 && daysLeft < minDaysLeft) {
            minDaysLeft = daysLeft;
            nearestHolding = h;
        }
    });

    const feesByCurr = {};
    window.db.cashflows.forEach(cf => {
        if (cf.fee > 0) {
            const fCurr = cf.feeCurrency || cf.fromCurrency || 'HKD';
            feesByCurr[fCurr] = (feesByCurr[fCurr] || 0) + cf.fee;
        }
    });
    window.db.holdings.forEach(h => {
        if (h.brokerFee > 0) {
            const acc = window.db.accounts.find(a => a.id === h.accountId);
            const fCurr = acc ? acc.currency : 'USD';
            feesByCurr[fCurr] = (feesByCurr[fCurr] || 0) + h.brokerFee;
        }
    });

    const nearestAcc = nearestHolding ? window.db.accounts.find(a => a.id === nearestHolding.accountId) : null;

    kpiHost.innerHTML = `
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div class="bg-terminal-card border border-terminal-border rounded-2xl p-4 flex flex-col justify-between">
                <div class="flex items-center justify-between text-xs text-terminal-muted mb-1.5">
                    <span>流動現金總結餘</span>
                    <span class="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">${window.currencyDisplayMode === 'original' ? '原幣分組' : `折合 ${window.baseCurrency}`}</span>
                </div>
                <div class="text-lg sm:text-xl font-bold font-mono text-white tabular-nums leading-snug">${formatMultiCurrencySummary(cashByCurr, 0)}</div>
                <div class="text-[11px] text-terminal-muted mt-1.5">分佈於 ${window.db.accounts.length} 個銀行與平台戶口</div>
            </div>

            <div class="bg-terminal-card border border-terminal-border rounded-2xl p-4 flex flex-col justify-between">
                <div class="flex items-center justify-between text-xs text-terminal-muted mb-1.5">
                    <span>在途投資成本 (國債/定存/期貨)</span>
                    <span class="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono">ACTIVE</span>
                </div>
                <div class="text-lg sm:text-xl font-bold font-mono text-white tabular-nums leading-snug">${formatMultiCurrencySummary(investByCurr, 0)}</div>
                <div class="text-[11px] text-emerald-400 mt-1.5">預估到期總淨賺：+${formatMultiCurrencySummary(profitByCurr, 0)}</div>
            </div>

            <div class="bg-terminal-card border border-terminal-border rounded-2xl p-4 flex flex-col justify-between">
                <div class="flex items-center justify-between text-xs text-terminal-muted mb-1.5">
                    <span>累計手續費與換匯摩擦成本</span>
                    <span class="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono">FEES</span>
                </div>
                <div class="text-lg sm:text-xl font-bold font-mono text-amber-400 tabular-nums leading-snug">${formatMultiCurrencySummary(feesByCurr, 1)}</div>
                <div class="text-[11px] text-terminal-muted mt-1.5">獨立核算，不混入轉帳本金</div>
            </div>

            <div class="bg-terminal-card border border-terminal-border rounded-2xl p-4 flex flex-col justify-between">
                <div class="flex items-center justify-between text-xs text-terminal-muted mb-1.5">
                    <span>最近到期持倉提醒</span>
                    <span class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono">MATURITY</span>
                </div>
                <div class="text-base sm:text-lg font-bold text-white truncate">${nearestHolding ? nearestHolding.name : '尚無未到期持倉'}</div>
                <div class="text-[11px] text-amber-400 mt-1.5 font-mono">${nearestHolding ? `倒數 ${minDaysLeft} 天 (${nearestHolding.maturityDate}) · ${nearestAcc ? nearestAcc.institutionName : ''}` : '--'}</div>
            </div>
        </section>
    `;
}

function setCurrencyDisplayMode(mode) {
    window.currencyDisplayMode = mode;
    sessionStorage.setItem('fp_curr_mode', mode);
    renderSharedChrome(window.CURRENT_PAGE_ID);
    if (typeof window.onPageDataUpdated === 'function') window.onPageDataUpdated();
}

function changeBaseCurrency(newBase) {
    window.baseCurrency = newBase;
    sessionStorage.setItem('fp_base_curr', newBase);
    if (window.currencyDisplayMode === 'original') {
        setCurrencyDisplayMode('converted');
    } else {
        renderSharedChrome(window.CURRENT_PAGE_ID);
        if (typeof window.onPageDataUpdated === 'function') window.onPageDataUpdated();
    }
}

function toggleFxModal(show) {
    const modal = document.getElementById('fx-modal');
    if (!modal) return;
    if (show) {
        document.getElementById('fx-updated-date').value = window.fxStore.updatedDate || getRelativeDate(0);
        const container = document.getElementById('fx-rates-inputs');
        const allCodes = Object.keys(window.currencyRegistry);
        container.innerHTML = allCodes
            .filter(c => c !== 'HKD')
            .map(curr => {
                const rateVal = (window.fxStore.rates && window.fxStore.rates[curr] !== undefined && window.fxStore.rates[curr] > 0)
                    ? window.fxStore.rates[curr]
                    : '';
                const isMissing = !rateVal;
                return `
                    <div class="bg-terminal-bg border ${isMissing ? 'border-rose-500/60' : 'border-terminal-border'} rounded-xl p-2.5">
                        <div class="flex items-center justify-between mb-1">
                            <label class="text-[11px] text-terminal-muted">1 <span class="text-white font-mono font-bold">${getCurrencyDisplayOption(curr)}</span> = ? HKD</label>
                            ${isMissing ? '<span class="text-[10px] text-rose-400 font-semibold">匯率待填</span>' : ''}
                        </div>
                        <input type="number" step="0.0001" min="0" id="fx-input-${curr}" value="${rateVal}" placeholder="未設匯率 (輸入數字)" class="w-full bg-terminal-card border border-terminal-border rounded-lg px-2.5 py-1 text-sm font-mono font-bold text-amber-400 focus:outline-none">
                    </div>
                `;
            }).join('');
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

function addCustomCurrencyFromModal() {
    const rawCode = (document.getElementById('new-curr-code').value || '').trim().toUpperCase();
    const rawLabel = (document.getElementById('new-curr-label').value || '').trim();
    const rateInput = parseFloat(document.getElementById('new-curr-rate').value);

    if (!rawCode || !/^[A-Z]{2,5}$/.test(rawCode)) {
        showToast('請輸入 2 至 5 個英文字母的幣別代碼（例如 AUD、CAD、CHF）', 'error');
        return;
    }

    const validRate = (!isNaN(rateInput) && rateInput > 0) ? rateInput : 0;
    window.currencyRegistry[rawCode] = {
        code: rawCode,
        symbol: rawCode + ' ',
        label: rawLabel || rawCode
    };
    saveCurrencyRegistry();

    if (!window.fxStore.rates) window.fxStore.rates = { HKD: 1.0 };
    if (rawCode !== 'HKD') {
        window.fxStore.rates[rawCode] = validRate;
    }
    window.fxStore.updatedDate = document.getElementById('fx-updated-date').value || getRelativeDate(0);
    localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(window.fxStore));

    document.getElementById('new-curr-code').value = '';
    document.getElementById('new-curr-label').value = '';
    document.getElementById('new-curr-rate').value = '';

    renderSharedChrome(window.CURRENT_PAGE_ID);
    toggleFxModal(true);
    if (typeof window.onPageDataUpdated === 'function') window.onPageDataUpdated();
    showToast(validRate > 0
        ? `已新增幣別 ${rawCode} (${window.currencyRegistry[rawCode].label})，匯率 ${validRate}`
        : `已新增幣別 ${rawCode}，目前標示為「匯率待填」，原幣帳目不受影響`
    );
}

function saveFxRates() {
    const newDate = document.getElementById('fx-updated-date').value || getRelativeDate(0);
    Object.keys(window.currencyRegistry).forEach(curr => {
        if (curr === 'HKD') {
            window.fxStore.rates.HKD = 1.0;
            return;
        }
        const inp = document.getElementById(`fx-input-${curr}`);
        if (inp) {
            const val = parseFloat(inp.value);
            window.fxStore.rates[curr] = (!isNaN(val) && val > 0) ? val : 0;
        }
    });
    window.fxStore.updatedDate = newDate;
    localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(window.fxStore));
    toggleFxModal(false);
    renderSharedChrome(window.CURRENT_PAGE_ID);
    if (typeof window.onPageDataUpdated === 'function') window.onPageDataUpdated();
    showToast(`已更新本機匯率表 (${newDate})，零雲端流量消耗！`);
}
