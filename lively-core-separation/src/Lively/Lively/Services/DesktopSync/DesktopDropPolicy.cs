namespace Lively.Services.DesktopSync;

internal enum DesktopDropEffect { None, Copy, Move, Link }

internal static class DesktopDropPolicy
{
    // Modifier bits are the private Player protocol: Ctrl=1, Shift=2, Alt=4.
    // This selects intent only; it must not acknowledge an OLE MOVE before completion.
    internal static DesktopDropEffect Select(string allowedEffects, int modifiers, bool sameVolume)
    {
        if (modifiers < 0 || modifiers > 7) return DesktopDropEffect.None;
        var allowed = allowedEffects switch
        {
            "all" or "uninitialized" => 7,
            "copy" => 1,
            "move" => 2,
            "link" => 4,
            "copyMove" => 3,
            "copyLink" => 5,
            "linkMove" => 6,
            _ => 0
        };
        var requested = (modifiers & 4) != 0 || (modifiers & 3) == 3 ? 4
            : (modifiers & 1) != 0 ? 1
            : (modifiers & 2) != 0 ? 2 : 0;
        if (requested == 0)
        {
            var preferred = sameVolume ? 2 : 1;
            requested = (allowed & preferred) != 0 ? preferred
                : (allowed & 1) != 0 ? 1 : (allowed & 2) != 0 ? 2 : 4;
        }
        if ((allowed & requested) == 0) return DesktopDropEffect.None;
        return requested switch { 1 => DesktopDropEffect.Copy, 2 => DesktopDropEffect.Move, _ => DesktopDropEffect.Link };
    }
}