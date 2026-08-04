// ============ 单元格中英翻译：任务窗格逻辑 ============

var DEFAULTS = {
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash'
};
function getSetting(key, def) {
    var v = window.Application.PluginStorage.getItem(key);
    return (v && v !== 'null') ? v : def;
}
function getKey() { return getSetting('translate_key', ''); }
function getApiUrl() { return getSetting('translate_api', DEFAULTS.apiUrl); }
function getModel() { return getSetting('translate_model', DEFAULTS.model); }

function saveSettings() {
    var key = document.getElementById('apikey').value.trim();
    if (!key) { document.getElementById('keyStatus').innerHTML = 'Key 不能为空'; return; }
    window.Application.PluginStorage.setItem('translate_key', key);
    window.Application.PluginStorage.setItem('translate_api',
        document.getElementById('apiurl').value.trim() || DEFAULTS.apiUrl);
    window.Application.PluginStorage.setItem('translate_model',
        document.getElementById('model').value.trim() || DEFAULTS.model);
    document.getElementById('keyStatus').innerHTML = '✓ 已保存';
    setTimeout(function(){ document.getElementById('keyStatus').innerHTML = ''; }, 2000);
}

// 检测语言：中/日/韩/英（拉丁语系归为英文）
function detectLang(text) {
    if (/[一-鿿]/.test(text)) return 'zh';
    if (/[ぁ-んァ-ン]/.test(text)) return 'ja';
    if (/[가-힣]/.test(text)) return 'ko';
    return 'en';
}

// 读取当前选中单元格
function getActiveCell() {
    try {
        var app = window.Application;
        var cell = null;
        try { cell = app.ActiveCell; } catch (e) { cell = null; }
        if (!cell) {
            var sel = app.Selection;
            if (sel && sel.Address) cell = sel;
        }
        if (!cell) return null;
        var val = '';
        try { val = cell.Value2 != null ? String(cell.Value2) : ''; } catch (e2) { val = ''; }
        return { addr: cell.Address, value: val };
    } catch (e3) { return null; }
}

// 调用智谱翻译
async function doTranslate(text, key, target) {
    var url = getApiUrl();
    if (url && url.indexOf('/chat/completions') < 0)
        url = url.replace(/\/+$/, '') + '/chat/completions';
    var resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: getModel(),
            messages: [{ role: 'user', content: '请把下面的内容翻译成' + target + '，只输出翻译结果，不要任何解释：\n' + text }],
            temperature: 0.1
        })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    return data.choices[0].message.content.trim();
}

// 目标语言：按用户选择（多语言），auto 则随源语言反向
var LANG = { zh: '中文', en: '英文', ja: '日文', ko: '韩文', fr: '法文', de: '德文',
             es: '西班牙文', ru: '俄文', pt: '葡萄牙文', ar: '阿拉伯文' };
function getTarget(text) {
    var t = document.getElementById('target').value;
    if (LANG[t]) return LANG[t];
    return detectLang(text) === 'zh' ? '英文' : '中文';
}

// 单选翻译（轮询选中变化）
var lastAddr = '', lastVal = '', busy = false;
async function tick() {
    var cell = getActiveCell();
    if (!cell || busy) return;
    if (cell.addr === lastAddr && cell.value === lastVal) return;
    lastAddr = cell.addr; lastVal = cell.value;
    document.getElementById('cellinfo').innerHTML = '📍 单元格：' + cell.addr;
    document.getElementById('src').innerHTML = cell.value || '(空单元格)';
    var LANGNAME = { zh: '中文', en: '英文', ja: '日文', ko: '韩文' };
    document.getElementById('detectedLang').innerHTML = cell.value ? (LANGNAME[detectLang(cell.value)] || '其他') : '—';
    document.getElementById('dst').innerHTML = '翻译中…';
    if (!cell.value) { document.getElementById('dst').innerHTML = '(空)'; return; }
    var key = getKey();
    if (!key) { document.getElementById('dst').innerHTML = '⚠️ 请先填写 API Key'; return; }
    busy = true;
    try {
        document.getElementById('dst').innerHTML = await doTranslate(cell.value, key, getTarget(cell.value));
    } catch (e) {
        document.getElementById('dst').innerHTML = '翻译失败：' + e.message;
    } finally { busy = false; }
}

window.onload = function () {
    document.getElementById('apikey').value = getKey();
    document.getElementById('apiurl').value = getApiUrl();
    document.getElementById('model').value = getModel();
    setInterval(tick, 600);
};

