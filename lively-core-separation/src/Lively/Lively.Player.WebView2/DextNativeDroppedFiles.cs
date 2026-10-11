using Microsoft.Web.WebView2.Core;
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;

namespace Lively.Player.WebView2
{
    // Called only after the official top document and active desktop scope have
    // been checked. Paths come from native disk File objects, never JSON fields.
    internal static class DextNativeDroppedFiles
    {
        internal const int MaximumFiles = 256;
        internal static bool TryRead(IReadOnlyList<object> objects, out string[] paths)
        {
            paths = Array.Empty<string>();
            if (objects == null || objects.Count == 0 || objects.Count > MaximumFiles) return false;
            var result = new List<string>(objects.Count);
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var length = 0;
            try
            {
                foreach (var item in objects)
                {
                    if (!(item is CoreWebView2File file)) return false;
                    var path = file.Path;
                    if (string.IsNullOrWhiteSpace(path) || path.IndexOf('\0') >= 0 || !Path.IsPathRooted(path)) return false;
                    // GetPathRoot alone accepts drive-relative C:foo. Native disk
                    // objects must have either an absolute drive root or UNC root.
                    var root = Path.GetPathRoot(path);
                    if (string.IsNullOrEmpty(root) || (root.Length < 3 && !root.StartsWith(@"\\", StringComparison.Ordinal))) return false;
                    var fullPath = Path.GetFullPath(path);
                    length += fullPath.Length;
                    if (length > 131072) return false;
                    if (seen.Add(fullPath)) result.Add(fullPath);
                }
            }
            catch (Exception error) when (error is ArgumentException || error is IOException ||
                error is NotSupportedException || error is COMException || error is InvalidOperationException)
            { return false; }
            if (result.Count == 0) return false;
            paths = result.ToArray();
            return true;
        }
    }
}