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
        // 卸载逻辑放在任务窗格执行：ribbon 环境无 WpsAddonMgr，taskpane 环境有 wps.OAAssist
        window.Application.PluginStorage.setItem("uninstall_request", "1");
        openTranslatePane();
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
