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

// ============ 卸载插件 ============
// 用 WPS 原生接口 WpsAddonMgr.disable 卸载，不走 localhost:58890。
// 原因（2026-08-04 实测）：插件页面在 https 域，请求 http://127.0.0.1:58890 属混合内容，
// 被 WPS 内置浏览器拦截，58890 协议只能在外部浏览器（publish.html）里用。
// 发布参数须与 publish.html 一致：
var ADDON_NAME = 'wps-translate';
var ADDON_TYPE = 'et';
var ADDON_URL  = 'https://lizzstudio.github.io/wps-translate/';

function uninstallAddon() {
    if (!window.confirm('确定要卸载「单元格翻译」插件吗？\n卸载后重启 WPS 表格即生效。')) return;
    if (typeof WpsAddonMgr === 'undefined' || !WpsAddonMgr.disable) {
        alert('当前环境不支持一键卸载，请重新打开 publish.html，点「卸载」。');
        return;
    }
    WpsAddonMgr.disable({
        name: ADDON_NAME,
        addonType: ADDON_TYPE,
        online: 'true',
        url: ADDON_URL
    }, function (result) {
        // 卸载后回读配置确认是否已移除，以实际结果为准
        WpsAddonMgr.getAllConfig(function (cfg) {
            var removed = false;
            if (cfg && cfg.response) {
                removed = String(cfg.response).indexOf('wps-translate') < 0;
            }
            if (removed) {
                alert('卸载成功！请重启 WPS 表格，插件即从功能区消失。');
            } else {
                alert('卸载失败：' + ((result && result.msg) || '未知错误') + '（可重新打开 publish.html 手动卸载）');
            }
        });
    });
}
