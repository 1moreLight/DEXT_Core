using Dext.Core.Rooms;

internal static class DockPinScopeChecks
{
    internal static void Run(Action<string, Action> check)
    {
        static void Require(bool ok, string message) { if (!ok) throw new Exception(message); }
        check("right-click follows global when desk additions are missing or empty", () =>
        {
            Require(DockPinAppend.FollowsGlobal(null) && DockPinAppend.FollowsGlobal(0), "missing and empty lists follow global");
            Require(!DockPinAppend.FollowsGlobal(1), "a stored addition is desk-local");
            Require(DockPinAppend.RightClickScope(true, null) == "global" && DockPinAppend.RightClickScope(true, 0) == "global",
                "right-click scope matches PinScope for follow-global");
            Require(DockPinAppend.RightClickScope(false, 3) == "global", "no navigation edits the global list");
            Require(DockPinAppend.RightClickScope(true, 1) == "desk", "non-empty additions stay on the desk list");
            var onlyGlobal = DockPinAppend.LegacyAdditions(new[] { @"C:\Windows\notepad.exe" }, new[] { @"C:\Windows\notepad.exe" }, path => path);
            Require(onlyGlobal.Length == 0, "migration of a global-only override stores an empty addition list");
            Require(DockPinAppend.RightClickEffect(true, onlyGlobal.Length, pinned: true, targetIsDeskAddition: false) == "unpin-global",
                "unpinning a global pin after that migration edits the global list");
            Require(DockPinAppend.RightClickEffect(true, 0, pinned: false, targetIsDeskAddition: false) == "pin-global",
                "pinning while the desk list is empty writes the global list");
            Require(DockPinAppend.RightClickEffect(true, null, pinned: true, targetIsDeskAddition: false) == "unpin-global",
                "a missing desk list also unpins from global");
            Require(DockPinAppend.RightClickEffect(true, 2, pinned: true, targetIsDeskAddition: false) == "reject-global-unpin",
                "a real desk list still refuses to remove a global pin as a desk edit");
        });
    }
}
