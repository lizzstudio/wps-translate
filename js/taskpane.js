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
    maybeRunUninstall();
};

// ============ 卸载插件（任务窗格内执行） ============
// 背景：ribbon 环境无 WpsAddonMgr，且插件页面（https）内请求 localhost:58890 属混合内容被内置浏览器拦截。
// 方案：优先用 WpsAddonMgr.disable（若 taskpane 环境有）；否则用 OAAssist 打开在线卸载页（外部浏览器对 localhost 有豁免，可正常卸载）。
var ONLINE_PUBLISH = 'https://lizzstudio.github.io/wps-translate/publish.html';

function maybeRunUninstall() {
    var req = window.Application.PluginStorage.getItem("uninstall_request");
    if (req !== "1") return;
    window.Application.PluginStorage.setItem("uninstall_request", "0");
    setTimeout(doUninstall, 300);
}

// 面板内的"卸载插件"按钮入口
function uninstallFromPane() {
    setTimeout(doUninstall, 100);
}

function doUninstall() {
    if (!window.confirm('确定要卸载「单元格翻译」插件吗？\n卸载后重启 WPS 表格即生效。')) return;
    // 方式一：WPS 原生管理接口
    if (typeof WpsAddonMgr !== 'undefined' && WpsAddonMgr.disable) {
        WpsAddonMgr.disable({
            name: 'wps-translate', addonType: 'et', online: 'true',
            url: 'https://lizzstudio.github.io/wps-translate/'
        }, function (result) {
            // 回读配置确认是否已移除
            WpsAddonMgr.getAllConfig(function (cfg) {
                var removed = cfg && cfg.response && String(cfg.response).indexOf('wps-translate') < 0;
                if (removed) {
                    alert('卸载成功！请重启 WPS 表格，插件即从功能区消失。');
                } else {
                    alert('卸载失败：' + ((result && result.msg) || '未知错误') + '（可重新打开 publish.html 手动卸载）');
                }
            });
        });
        return;
    }
    // 方式二：OAAssist 打开在线卸载页（外部浏览器可访问 localhost:58890）
    if (typeof wps !== 'undefined' && wps.OAAssist && wps.OAAssist.ShellExecute) {
        wps.OAAssist.ShellExecute(ONLINE_PUBLISH);
        alert('已为您打开卸载页面：\n' + ONLINE_PUBLISH + '\n请在浏览器里点「卸载」，完成后重启 WPS 表格。');
        return;
    }
    // 方式三：兜底
    alert('请重新打开发布包里的 publish.html，点「卸载」完成卸载。');
}
