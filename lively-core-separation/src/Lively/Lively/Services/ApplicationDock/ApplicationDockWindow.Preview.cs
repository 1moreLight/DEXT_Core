using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;

namespace Lively.Services.ApplicationDock;

internal sealed partial class ApplicationDockWindow
{
    private readonly DispatcherTimer previewOpenTimer = new() { Interval = TimeSpan.FromMilliseconds(300) };
    private readonly DispatcherTimer previewCloseTimer = new() { Interval = TimeSpan.FromMilliseconds(250) };
    private DockPreviewWindow preview;
    private IReadOnlyList<DockGroup> previewGroups = Array.Empty<DockGroup>();
    private Button previewAnchor;
    private string pendingPreviewKey;

    private void InitializePreview()
    {
        previewOpenTimer.Tick += (_, _) =>
        {
            previewOpenTimer.Stop();
            if (previewAnchor?.IsMouseOver == true) OpenPreview(previewAnchor, pendingPreviewKey);
        };
        previewCloseTimer.Tick += (_, _) =>
        {
            previewCloseTimer.Stop();
            if (preview?.IsMouseOver != true && previewAnchor?.IsMouseOver != true) ClosePreview();
        };
        IsVisibleChanged += (_, _) => { if (!IsVisible) ClosePreview(); };
        Closed += (_, _) =>
        {
            previewOpenTimer.Stop(); previewCloseTimer.Stop();
            preview?.Close(); preview = null;
        };
    }

    private void AttachPreview(Button button, DockGroup group)
    {
        if (group.Windows.Count == 0) return;
        button.ToolTip = null;
        button.MouseEnter += (_, _) =>
        {
            previewCloseTimer.Stop();
            previewAnchor = button;
            pendingPreviewKey = group.Key;
            if (preview?.IsVisible == true && preview.GroupKey == group.Key) return;
            previewOpenTimer.Stop(); previewOpenTimer.Start();
        };
        button.MouseLeave += (_, _) =>
        {
            previewOpenTimer.Stop();
            previewCloseTimer.Stop(); previewCloseTimer.Start();
        };
        button.ContextMenuOpening += (_, _) => ClosePreview();
    }

    private void OpenPreview(Button button, string key)
    {
        previewOpenTimer.Stop(); previewCloseTimer.Stop();
        if (!IsVisible || !button.IsLoaded) return;
        var group = previewGroups.FirstOrDefault(g => g.Key == key);
        if (group == null || group.Windows.Count == 0) { ClosePreview(); return; }
        if (preview == null)
        {
            preview = new DockPreviewWindow((selectedGroup, task) =>
            {
                ClosePreview();
                click(selectedGroup, task);
            }) { Owner = this };
            preview.MouseEnter += (_, _) => previewCloseTimer.Stop();
            preview.MouseLeave += (_, _) => { previewCloseTimer.Stop(); previewCloseTimer.Start(); };
        }
        previewAnchor = button;
        preview.ShowFor(group, Left + button.TranslatePoint(new Point(button.ActualWidth / 2, 0), this).X, Top);
    }

    private void UpdatePreview(IReadOnlyList<DockGroup> groups)
    {
        previewGroups = groups;
        if (preview?.IsVisible == true)
        {
            preview.UpdateGroup(groups.FirstOrDefault(g => g.Key == preview.GroupKey));
            if (previewAnchor?.IsLoaded == true)
                preview.FollowAnchor(Left + previewAnchor.TranslatePoint(new Point(previewAnchor.ActualWidth / 2, 0), this).X, Top);
        }
    }

    private void ClosePreview()
    {
        previewOpenTimer.Stop(); previewCloseTimer.Stop();
        preview?.HidePreview();
        pendingPreviewKey = null;
    }
}
