// ============ Word 文档翻译：任务窗格逻辑 ============

var DEFAULTS = {
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash'
};
// 翻译设置存 localStorage（CEF Local Storage 落盘持久；PluginStorage 不持久）
function getSetting(key, def) {
    try {
        var v = localStorage.getItem(key);
        return (v && v !== 'null') ? v : def;
    } catch (e) { return def; }
}
function getKey() { return getSetting('wps_translate_key', ''); }
function getApiUrl() { return getSetting('wps_translate_api', DEFAULTS.apiUrl); }
function getModel() { return getSetting('wps_translate_model', DEFAULTS.model); }

// ============ 授权激活（一码一机） ============
var LICENSE_API = 'https://wps-license-wps-license-vgiirgrkbu.cn-hangzhou.fcapp.run';   // 激活服务器（阿里云FC）
var DEVICE_KEY = 'wps_translate_device_id';
var LIC_CODE_KEY = 'wps_translate_license';
var LIC_DEV_KEY = 'wps_translate_bound_device';

// 设备标识：存 localStorage（WPS 加载项用 CEF 内核，Local Storage 落盘到
// %APPDATA%\kingsoft\wps\addons\...\jsapi\cache\Local Storage\leveldb，跨会话持久）。
// 实测 PluginStorage 不持久，故激活相关数据一律用 localStorage。
function getDeviceId() {
    var id = '';
    try { id = localStorage.getItem(DEVICE_KEY) || ''; } catch (e) {}
    if (!id) {
        id = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
        try { localStorage.setItem(DEVICE_KEY, id); } catch (e) {}
    }
    return id;
}

// localStorage 可用性自检
function lsOk() {
    try {
        if (!window.localStorage) return false;
        var t = '__t_' + Date.now();
        localStorage.setItem(t, '1');
        var ok = localStorage.getItem(t) === '1';
        localStorage.removeItem(t);
        return ok;
    } catch (e) { return false; }
}

function getLicense() {
    try { return localStorage.getItem(LIC_CODE_KEY) || ''; } catch (e) { return ''; }
}
function getBoundDevice() {
    try { return localStorage.getItem(LIC_DEV_KEY) || ''; } catch (e) { return ''; }
}

function isActivated() {
    var code = getLicense();
    var bound = getBoundDevice();
    return !!(code && bound && bound === getDeviceId());
}

function updateLicUI() {
    var st = document.getElementById('licStatus');
    var info = document.getElementById('licInfo');
    var dev = getDeviceId();
    var ls = lsOk() ? 'localStorage ✅' : '⚠️ 不支持';
    if (isActivated()) {
        // 已激活：隐藏激活卡片，标题旁显示"已激活"徽标
        document.getElementById('licCard').style.display = 'none';
        document.getElementById('activatedBadge').style.display = 'inline';
        return;
    }
    // 未激活：显示激活卡片
    document.getElementById('licCard').style.display = '';
    document.getElementById('activatedBadge').style.display = 'none';
    st.innerHTML = '🔒 未激活';
    st.style.color = '#c0392b';
    info.innerHTML = '设备：' + dev.slice(0, 12) + '… | 存储：' + ls;
    document.getElementById('licenseKey').value = getLicense();
}

function doActivate() {
    var code = document.getElementById('licenseKey').value.trim();
    if (!code) { showLicMsg('请输入激活码', true); return; }
    if (!LICENSE_API) { showLicMsg('激活服务未配置', true); return; }
    showLicMsg('激活中…');
    fetch(LICENSE_API + '/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, device: getDeviceId() })
    }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.ok) {
            localStorage.setItem(LIC_CODE_KEY, code);
            localStorage.setItem(LIC_DEV_KEY, getDeviceId());
            showLicMsg('✓ 激活成功');
            updateLicUI();
        } else {
            showLicMsg((d && d.msg) || '激活失败', true);
        }
    }).catch(function (e) {
        showLicMsg('网络错误：' + e.message, true);
    });
}

function showLicMsg(msg, isErr) {
    var el = document.getElementById('licMsg');
    el.innerHTML = msg;
    el.style.color = isErr ? '#c0392b' : '#2e7d32';
}

function saveSettings() {
    var key = document.getElementById('apikey').value.trim();
    if (!key) { document.getElementById('keyStatus').innerHTML = 'Key 不能为空'; return; }
    localStorage.setItem('wps_translate_key', key);
    localStorage.setItem('wps_translate_api',
        document.getElementById('apiurl').value.trim() || DEFAULTS.apiUrl);
    localStorage.setItem('wps_translate_model',
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

// 读取当前选中文字（WPS 文字：Application.Selection.Text）
function getSelection() {
    try {
        var app = window.Application;
        var sel = app.Selection;
        if (!sel) return null;
        var text = '';
        try { text = sel.Text || ''; } catch (e) { text = ''; }
        if (text) text = text.replace(/[\r\n\b]/g, ' ').trim();
        if (!text) return null;
        return { text: text };
    } catch (e) { return null; }
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

// 选中翻译（轮询选中文字变化）
var lastSel = '', busy = false;
async function tick() {
    var sel = getSelection();
    if (!sel || busy) return;
    if (sel.text === lastSel) return;
    lastSel = sel.text;
    var text = sel.text.length > 2000 ? sel.text.slice(0, 2000) + '…' : sel.text;
    document.getElementById('cellinfo').innerHTML = '📄 已选中文字';
    document.getElementById('src').innerHTML = text || '(未选中文字)';
    var LANGNAME = { zh: '中文', en: '英文', ja: '日文', ko: '韩文' };
    document.getElementById('detectedLang').innerHTML = sel.text ? (LANGNAME[detectLang(sel.text)] || '其他') : '—';
    document.getElementById('dst').innerHTML = '翻译中…';
    if (!sel.text) { document.getElementById('dst').innerHTML = '(未选中文字)'; return; }
    if (!isActivated()) {
        document.getElementById('dst').innerHTML = '🔒 未激活：请在面板顶部输入激活码并点「激活」';
        return;
    }
    var key = getKey();
    if (!key) { document.getElementById('dst').innerHTML = '⚠️ 请先填写 API Key'; return; }
    busy = true;
    try {
        document.getElementById('dst').innerHTML = await doTranslate(sel.text, key, getTarget(sel.text));
    } catch (e) {
        document.getElementById('dst').innerHTML = '翻译失败：' + e.message;
    } finally { busy = false; }
}

window.onload = function () {
    document.getElementById('apikey').value = getKey();
    document.getElementById('apiurl').value = getApiUrl();
    document.getElementById('model').value = getModel();
    // 轮询 2000ms：降低 Selection 读取频率，避免阻塞 WPS 文字 UI
    setInterval(tick, 2000);
    updateLicUI();
};

