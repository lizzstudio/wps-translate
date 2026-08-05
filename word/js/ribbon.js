// ============ Word 文档翻译：功能区逻辑（弹窗方案，避开 CreateTaskPane 卡顿） ============

function OnAddinLoad(ribbonUI) {
    if (typeof (window.Application.ribbonUI) != "object") {
        window.Application.ribbonUI = ribbonUI;
    }
    if (typeof (window.Application.Enum) != "object") {
        window.Application.Enum = WPS_Enum;
    }
    return true;
}

function OnAction(control) {
    if (control.Id === "btnTranslatePane") { doTranslateDialog(); }
    else if (control.Id === "btnSettings") { showSettingsDialog(); }
    else if (control.Id === "btnUninstall") { uninstallAddon(); }
    return true;
}

function GetImage(control) {
    return "images/1.svg";
}
function GetUninstallImage(control) {
    return "images/3.svg";
}

// ============ 配置读取（localStorage，wps_ 前缀与 Excel 独立） ============
function getSetting(key, def) {
    try { var v = localStorage.getItem(key); return (v && v !== 'null') ? v : def; } catch (e) { return def; }
}
function getKey() { return getSetting('wps_translate_key', ''); }
function getApiUrl() { return getSetting('wps_translate_api', 'https://open.bigmodel.cn/api/paas/v4/chat/completions'); }
function getModel() { return getSetting('wps_translate_model', 'glm-4-flash'); }

// ============ 激活（一码一机） ============
var LICENSE_API = 'https://wps-license-wps-license-vgiirgrkbu.cn-hangzhou.fcapp.run';
function getDeviceId() {
    var id = '';
    try { id = localStorage.getItem('wps_translate_device_id') || ''; } catch (e) {}
    if (!id) {
        id = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
        try { localStorage.setItem('wps_translate_device_id', id); } catch (e) {}
    }
    return id;
}
function isActivated() {
    try {
        return !!(localStorage.getItem('wps_translate_license') && localStorage.getItem('wps_translate_bound_device') === getDeviceId());
    } catch (e) { return false; }
}

// ============ 翻译 ============
function detectLang(text) {
    if (/[一-鿿]/.test(text)) return 'zh';
    if (/[ぁ-んァ-ン]/.test(text)) return 'ja';
    if (/[가-힣]/.test(text)) return 'ko';
    return 'en';
}
function getTarget(text) { return detectLang(text) === 'zh' ? '英文' : '中文'; }
async function doTranslate(text, key) {
    var url = getApiUrl();
    if (url.indexOf('/chat/completions') < 0) url = url.replace(/\/+$/, '') + '/chat/completions';
    var resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: getModel(),
            messages: [{ role: 'user', content: '请把下面的内容翻译成' + getTarget(text) + '，只输出翻译结果，不要任何解释：\n' + text }],
            temperature: 0.1
        })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    return data.choices[0].message.content.trim();
}
function getSelectionText() {
    try {
        var sel = window.Application.Selection;
        if (!sel) return '';
        var t = '';
        try { t = sel.Text || ''; } catch (e) { t = ''; }
        return t.replace(/[\r\n\b]/g, ' ').trim();
    } catch (e) { return ''; }
}

// ============ 按钮处理 ============
function doTranslateDialog() {
    // 弹窗常驻：只弹一个，定位到右侧（模拟侧边栏），弹窗内轮询选中文字自动翻译
    try {
        if (localStorage.getItem('wps_dialog_open') === '1') { alert('翻译弹窗已打开，直接选中文字即可自动翻译'); return; }
        var url = GetUrlPath() + '/ui/dialog.html';
        var pw = 440, ph = 460;   // 弹窗宽高（窄长，贴近侧边栏）
        var dpr = window.devicePixelRatio || 1;
        try {
            var app = wps.Application;   // WPS 程序窗口
            // 弹窗靠右：左边 = 程序窗口右边界 - 弹窗宽 - 边距（磅转像素）
            var windowLeft = (app.Left + app.Width - pw - 30) / 72 * 96 * dpr;
            var windowTop = 60 / 72 * 96 * dpr;
            wps.ShowDialogEx(url, '文档智能翻译', pw * dpr, ph * dpr, false, true, true, undefined, undefined, undefined, undefined, windowLeft, windowTop);
        } catch (e2) {
            window.Application.ShowDialog(url, '文档智能翻译', pw, ph, false);
        }
    } catch (e) { alert('打开翻译弹窗失败：' + e.message); }
}

function showSettingsDialog() {
    window.Application.ShowDialog(GetUrlPath() + '/ui/settings.html', '设置', 420, 460, false);
}

// ============ 卸载插件 ============
var ADDON_NAME = 'wps-word-translate';
var ADDON_TYPE = 'wps';
var ADDON_URL  = 'https://lizzstudio.github.io/wps-translate/word/';
var ONLINE_PUBLISH = ADDON_URL + 'publish.html';

function uninstallAddon() {
    try {
        if (!window.confirm('确定要卸载「Word文档翻译」插件吗？\n卸载后重启 WPS 文字即生效。')) return;
        if (typeof WpsAddonMgr !== 'undefined' && WpsAddonMgr.disable) {
            WpsAddonMgr.disable({ name: ADDON_NAME, addonType: ADDON_TYPE, online: 'true', url: ADDON_URL }, function (result) {
                WpsAddonMgr.getAllConfig(function (cfg) {
                    var removed = cfg && cfg.response && String(cfg.response).indexOf(ADDON_NAME) < 0;
                    if (removed) alert('卸载成功！请重启 WPS 文字，插件即从功能区消失。');
                    else alert('卸载失败：' + ((result && result.msg) || '未知错误') + '。请重新打开 publish.html 手动卸载。');
                });
            });
            return;
        }
        if (typeof wps !== 'undefined' && wps.OAAssist && wps.OAAssist.ShellExecute) {
            wps.OAAssist.ShellExecute(ONLINE_PUBLISH);
            alert('已为您打开浏览器卸载页：\n' + ONLINE_PUBLISH + '\n请在浏览器里点「卸载」，完成后重启 WPS 文字。');
            return;
        }
        _serverVersion = 'wait';
        post58890('http://localhost:58890/version', JSON.stringify({ serverId: getServerId() }), function (xhr) {
            if (xhr && xhr.status === 200) { _serverVersion = xhr.responseText; loadAndUninstall(); }
            else alert('本机 WPS 服务不可达。请重新打开发布包里的 publish.html，点「卸载」。');
        });
    } catch (e) { alert('卸载异常：' + e.message); }
}

// ---- 58890 协议 ----
var _serverVersion = 'wait';
var _serverId = getServerId();
function guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
function getServerId() {
    try {
        if (window.localStorage) {
            if (!localStorage.getItem("serverId")) localStorage.setItem("serverId", guid());
            return localStorage.getItem("serverId");
        }
    } catch (e) {}
    return guid();
}
function encode(u) { return btoa(unescape(encodeURIComponent(u))); }
function FormatSendData(data) {
    var s = JSON.stringify(data);
    if (_serverVersion >= "1.0.2" && _serverId !== undefined) return JSON.stringify({ serverId: _serverId, data: encode(s) });
    return encode(s);
}
function FormartData(el, cmd) {
    return FormatSendData({ cmd: cmd, name: el.name, url: el.url, addonType: el.addonType,
        online: el.online, version: el.version, customDomain: el.customDomain });
}
function post58890(url, payload, callback) {
    try {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.onload = function () { callback && callback(xhr); };
        xhr.onerror = function () { callback && callback(null); };
        xhr.timeout = 4000;
        xhr.ontimeout = function () { callback && callback(null); };
        xhr.send(payload);
    } catch (e) { callback && callback(null); }
}
function loadAndUninstall() {
    var baseData = (_serverVersion >= "1.0.2" && _serverId !== undefined) ? JSON.stringify({ serverId: _serverId }) : '';
    post58890('http://localhost:58890/publishlist', baseData, function (xhr) {
        if (!xhr || xhr.status !== 200) { alert('获取已安装列表失败。'); return; }
        var list = null;
        try { list = JSON.parse(xhr.responseText); } catch (e) { alert('解析列表失败：' + e.message); return; }
        var target = null;
        for (var i = 0; i < list.length; i++) {
            if (list[i].name === ADDON_NAME && list[i].addonType === ADDON_TYPE) { target = list[i]; break; }
        }
        if (!target) { alert('未找到已安装的「Word文档翻译」插件，可能已卸载。'); return; }
        doDisable(target);
    });
}
function doDisable(el) {
    post58890('http://localhost:58890/deployaddons/runParams', FormartData(el, 'disable'), function (xhr) {
        if (xhr && (xhr.responseText === 'OK' || (xhr.responseText === '' && xhr.status === 200))) {
            alert('卸载成功！请重启 WPS 文字，插件即从功能区消失。');
        } else alert('卸载失败。请重新打开 publish.html，点「卸载」。');
    });
}
