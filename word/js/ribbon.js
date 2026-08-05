// ============ Word 文档翻译：功能区逻辑 ============
// 卸载按钮在功能区自包含执行（不依赖任务窗格 onload，避免面板已打开时 onload 不重跑导致无反应）

// 加载项启动时调用，自动打开翻译任务窗格
function OnAddinLoad(ribbonUI) {
    if (typeof (window.Application.ribbonUI) != "object") {
        window.Application.ribbonUI = ribbonUI;
    }
    if (typeof (window.Application.Enum) != "object") {
        window.Application.Enum = WPS_Enum;
    }
    // 临时移除自动打开面板（排查：CreateTaskPane 可能阻塞 WPS 文字）
    // setTimeout(openTranslatePane, 500);
    return true;
}

function OnAction(control) {
    if (control.Id === "btnTranslatePane") {
        openTranslatePane();
    } else if (control.Id === "btnUninstall") {
        uninstallAddon();
    }
    return true;
}

function GetImage(control) {
    return "images/1.svg";
}

function GetUninstallImage(control) {
    return "images/3.svg";
}

function openTranslatePane() {
    var tsId = window.Application.PluginStorage.getItem("wps_taskpane_id");
    if (!tsId) {
        var pane = window.Application.CreateTaskPane(GetUrlPath() + "/ui/taskpane2.html");
        window.Application.PluginStorage.setItem("wps_taskpane_id", pane.ID);
        pane.Visible = true;
    } else {
        var pane = window.Application.GetTaskPane(tsId);
        pane.Visible = true;
    }
}

// ============ 卸载插件 ============
var ADDON_NAME = 'wps-word-translate';
var ADDON_TYPE = 'wps';
var ADDON_URL  = 'https://lizzstudio.github.io/wps-translate/word/';
var ONLINE_PUBLISH = ADDON_URL + 'publish.html';

function uninstallAddon() {
    try {
        if (!window.confirm('确定要卸载「Word文档翻译」插件吗？\n卸载后重启 WPS 文字即生效。')) return;

        // ① 原生管理接口（若存在，纯内卸载）
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

        // ② OAAssist 打开系统浏览器访问在线卸载页（外部浏览器对 localhost 混合内容有豁免）
        if (typeof wps !== 'undefined' && wps.OAAssist && wps.OAAssist.ShellExecute) {
            wps.OAAssist.ShellExecute(ONLINE_PUBLISH);
            alert('已为您打开浏览器卸载页：\n' + ONLINE_PUBLISH + '\n请在浏览器里点「卸载」，完成后重启 WPS 文字。');
            return;
        }

        // ③ 直接请求本机服务（用 localhost，部分内核对 localhost 豁免混合内容）
        _serverVersion = 'wait';
        post58890('http://localhost:58890/version', JSON.stringify({ serverId: getServerId() }), function (xhr) {
            if (xhr && xhr.status === 200) {
                _serverVersion = xhr.responseText;
                loadAndUninstall();
            } else {
                alert('本机 WPS 服务不可达（混合内容拦截）。请重新打开发布包里的 publish.html，点「卸载」。');
            }
        });
    } catch (e) {
        alert('卸载异常：' + e.message + '\n请重新打开发布包里的 publish.html 手动卸载。');
    }
}

// ---- 本地服务 58890 协议（与官方 publish.html 一致，localhost 版）----
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
function encode(u) {
    return btoa(unescape(encodeURIComponent(u)));
}
function FormatSendData(data) {
    var s = JSON.stringify(data);
    if (_serverVersion >= "1.0.2" && _serverId !== undefined) {
        return JSON.stringify({ serverId: _serverId, data: encode(s) });
    }
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
        if (!xhr || xhr.status !== 200) { alert('获取已安装列表失败。请重新打开 publish.html 手动卸载。'); return; }
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
        } else {
            alert('卸载失败。请重新打开 publish.html，点「卸载」。');
        }
    });
}

