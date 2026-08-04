// ============ 单元格中英翻译：功能区逻辑 ============

// 加载项启动时调用，自动打开翻译任务窗格
function OnAddinLoad(ribbonUI) {
    if (typeof (window.Application.ribbonUI) != "object") {
        window.Application.ribbonUI = ribbonUI;
    }
    if (typeof (window.Application.Enum) != "object") {
        window.Application.Enum = WPS_Enum;
    }
    // 延迟等待 Application 就绪后自动打开翻译面板
    setTimeout(openTranslatePane, 500);
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
    var tsId = window.Application.PluginStorage.getItem("taskpane_id");
    if (!tsId) {
        var pane = window.Application.CreateTaskPane(GetUrlPath() + "/ui/taskpane.html");
        window.Application.PluginStorage.setItem("taskpane_id", pane.ID);
        pane.Visible = true;
    } else {
        var pane = window.Application.GetTaskPane(tsId);
        pane.Visible = true;
    }
}

// ============ 卸载插件（走 WPS 本地服务 58890） ============
// 协议与 wpsjs 官方 publish.html 一致：查已安装列表 → 对当前插件发 disable
// 插件发布参数（publish 时写入 publish.html）：
var ADDON_NAME = 'wps-translate';   // 发布名
var ADDON_TYPE = 'et';              // 表格加载项

var _serverVersion = 'wait';
var _serverId = getServerId();

function guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getServerId() {
    if (window.localStorage) {
        if (!localStorage.getItem("serverId"))
            localStorage.setItem("serverId", guid());
        return localStorage.getItem("serverId");
    }
    return guid();
}

// UTF-8 base64（兼容中文）
function encode(u) {
    return btoa(unescape(encodeURIComponent(u)));
}

// 按 serverVersion 决定是否带 serverId 编码，与官方 publish.html 保持一致
function FormatSendData(data) {
    var strData = JSON.stringify(data);
    if (_serverVersion >= "1.0.2" && _serverId != undefined) {
        return JSON.stringify({ serverId: _serverId, data: encode(strData) });
    }
    return encode(strData);
}

function FormartData(element, cmd) {
    return FormatSendData({
        cmd: cmd,
        name: element.name, url: element.url, addonType: element.addonType,
        online: element.online, version: element.version, customDomain: element.customDomain
    });
}

// 向 WPS 本地服务发 POST
function post58890(url, payload, callback) {
    try {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.onload = function () { callback && callback(xhr); };
        xhr.onerror = function () { callback && callback(null); };
        xhr.timeout = 4000;
        xhr.ontimeout = function () { callback && callback(null); };
        xhr.send(payload);
    } catch (e) {
        callback && callback(null);
    }
}

function uninstallAddon() {
    if (!window.confirm('确定要卸载「单元格翻译」插件吗？\n卸载后重启 WPS 表格即生效。')) return;
    // 1) 取本地服务版本（决定编码方式）
    post58890('http://127.0.0.1:58890/version', JSON.stringify({ serverId: _serverId }), function (xhr) {
        if (!xhr || xhr.status !== 200) {
            alert('无法连接 WPS 本地服务，请确认 WPS 正在运行；或重新打开 publish.html 卸载。');
            return;
        }
        _serverVersion = xhr.responseText;
        loadAndUninstall();
    });
}

function loadAndUninstall() {
    var baseData = (_serverVersion >= "1.0.2" && _serverId != undefined) ? JSON.stringify({ serverId: _serverId }) : '';
    post58890('http://127.0.0.1:58890/publishlist', baseData, function (xhr) {
        if (!xhr || xhr.status !== 200) { alert('获取已安装插件列表失败。'); return; }
        var list = null;
        try { list = JSON.parse(xhr.responseText); } catch (e) { alert('解析列表失败：' + e.message); return; }
        var target = null;
        for (var i = 0; i < list.length; i++) {
            if (list[i].name === ADDON_NAME && list[i].addonType === ADDON_TYPE) { target = list[i]; break; }
        }
        if (!target) { alert('未找到已安装的「单元格翻译」插件，可能已卸载。'); return; }
        doDisable(target);
    });
}

function doDisable(element) {
    post58890('http://127.0.0.1:58890/deployaddons/runParams', FormartData(element, 'disable'), function (xhr) {
        if (xhr && (xhr.responseText === 'OK' || (xhr.responseText === '' && xhr.status === 200))) {
            alert('卸载成功！请重启 WPS 表格，插件即从功能区消失。');
        } else {
            alert('卸载失败。请重新打开 publish.html，在列表中点「卸载」。');
        }
    });
}
