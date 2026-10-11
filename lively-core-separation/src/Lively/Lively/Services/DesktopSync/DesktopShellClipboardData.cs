using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace Lively.Services.DesktopSync;

internal sealed record DesktopClipboardSnapshot(uint Sequence,IReadOnlyList<string> Files,DesktopDropEffect Effect);

internal static class DesktopShellClipboardData
{
    // CF_HDROP is DROPFILES (20 bytes) followed by a double-NUL-terminated list.
    // https://learn.microsoft.com/windows/win32/shell/clipboard
    internal static byte[] EncodeFiles(IReadOnlyList<string> files)
    {
        if(files.Count is <1 or >256)throw new ArgumentOutOfRangeException(nameof(files));
        if(files.Any(path=>string.IsNullOrEmpty(path)||path.Length>32767||path.Contains('\0')||!Path.IsPathFullyQualified(path)))
            throw new ArgumentException("Clipboard files must be absolute paths.",nameof(files));
        var names=Encoding.Unicode.GetBytes(string.Join("\0",files)+"\0\0");
        var result=new byte[20+names.Length];
        BinaryPrimitives.WriteUInt32LittleEndian(result,20); // pFiles
        BinaryPrimitives.WriteInt32LittleEndian(result.AsSpan(16),1); // fWide
        names.CopyTo(result,20);return result;
    }
    internal static byte[] EncodeEffect(bool cut)
    {
        var bytes=new byte[4];BinaryPrimitives.WriteUInt32LittleEndian(bytes,cut?2u:1u);return bytes;
    }
    internal static DesktopDropEffect DecodeEffect(byte[]? bytes)
    {
        if(bytes is null)return DesktopDropEffect.Copy;
        if(bytes.Length<4)return DesktopDropEffect.None;
        var value=BinaryPrimitives.ReadUInt32LittleEndian(bytes);
        return (value&1)!=0?DesktopDropEffect.Copy:(value&2)!=0?DesktopDropEffect.Move:DesktopDropEffect.None;
    }
    internal static string[] RemainingAfterMove(DesktopClipboardSnapshot snapshot,DesktopTransferResult result)
    {
        if(snapshot.Effect!=DesktopDropEffect.Move)return snapshot.Files.ToArray();
        var moved=result.Items.Where(item=>item.Status=="completed").Select(item=>Path.GetFullPath(item.Source))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        return snapshot.Files.Where(path=>!moved.Contains(Path.GetFullPath(path))).ToArray();
    }
}
