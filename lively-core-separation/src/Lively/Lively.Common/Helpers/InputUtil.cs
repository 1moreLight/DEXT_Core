using Lively.Common.Helpers.Pinvoke;
using System;
using System.Drawing;
using System.Runtime.InteropServices;

namespace Lively.Common.Helpers
{
    public static class InputUtil
    {
        static readonly IntPtr MK_LBUTTON = (IntPtr)0x0001;
        static readonly IntPtr MK_RBUTTON = (IntPtr)0x0002;

        public static bool IsMouseButtonsSwapped { get; } =
            NativeMethods.GetSystemMetrics((int)NativeMethods.SystemMetric.SM_SWAPBUTTON) != 0;

        public static void MouseLeftButtonDown(IntPtr hwnd, int x, int y) =>
            ForwardMessageMouse(hwnd, x, y, (int)NativeMethods.WM.LBUTTONDOWN, MK_LBUTTON);

        public static void MouseLeftButtonUp(IntPtr hwnd, int x, int y) =>
            ForwardMessageMouse(hwnd, x, y, (int)NativeMethods.WM.LBUTTONUP, IntPtr.Zero);

        public static void MouseRightButtonDown(IntPtr hwnd, int x, int y) =>
            ForwardMessageMouse(hwnd, x, y, (int)NativeMethods.WM.RBUTTONDOWN, MK_RBUTTON);

        public static void MouseRightButtonUp(IntPtr hwnd, int x, int y) =>
            ForwardMessageMouse(hwnd, x, y, (int)NativeMethods.WM.RBUTTONUP, IntPtr.Zero);

        public static void MouseMove(IntPtr hwnd, int x, int y) =>
            ForwardMessageMouse(hwnd, x, y, (int)NativeMethods.WM.MOUSEMOVE, (IntPtr)MouseModifiers);

        // RawInput owns the forwarded button state; only sample keyboard modifiers here.
        public static int MouseModifiers =>
            ((GetAsyncKeyState(0x10) & 0x8000) != 0 ? 0x0004 : 0) |
            ((GetAsyncKeyState(0x11) & 0x8000) != 0 ? 0x0008 : 0);

        public static bool IsPrimaryMouseButtonDown =>
            (GetAsyncKeyState(IsMouseButtonsSwapped ? 0x02 : 0x01) & 0x8000) != 0;

        [DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int virtualKey);

        /// <summary>
        /// Forward mouse input to the active/inactive window.
        /// </summary>
        /// <param name="hwnd">Target window handle</param>
        /// <param name="x">Cursor pos x</param>
        /// <param name="y">Cursor pos y</param>
        /// <param name="msg">mouse message</param>
        /// <param name="wParam">additional msg parameter</param>
        public static void ForwardMessageMouse(IntPtr hwnd, int x, int y, int msg, IntPtr wParam)
        {
            // The low-order word specifies the x-coordinate of the cursor, the high-order word specifies the y-coordinate of the cursor.
            // Ref: https://docs.microsoft.com/en-us/windows/win32/inputdev/wm-mousemove
            // Client coordinates may be negative while a captured drag crosses a display edge.
            uint lParam = ((uint)unchecked((ushort)y) << 16) | unchecked((ushort)x);
            NativeMethods.PostMessageW(hwnd, msg, wParam, (UIntPtr)lParam);
        }

        /// <summary>
        /// Forward key input to the active/inactive window.
        /// </summary>
        /// <param name="hwnd">Target window handle</param>
        /// <param name="msg">key press msg</param>
        /// <param name="wParam">Virtual-Key code</param>
        /// <param name="scanCode">OEM code of the key</param>
        /// <param name="isPressed">Key is pressed</param>
        public static void ForwardMessageKeyboard(IntPtr hwnd, int msg, IntPtr wParam, int scanCode, bool isPressed)
        {
            //Ref:
            // https://docs.microsoft.com/en-us/windows/win32/inputdev/wm-keydown
            // https://docs.microsoft.com/en-us/windows/win32/inputdev/wm-keyup
            uint lParam = 1u; //press
            lParam |= (uint)scanCode << 16; //oem code
            lParam |= 1u << 24; //extended key
            lParam |= 0u << 29; //context code; Note: Alt key combos wont't work
            /* Same as:
             * lParam = isPressed ? (lParam |= 0u << 30) : (lParam |= 1u << 30); //prev key state
             * lParam = isPressed ? (lParam |= 0u << 31) : (lParam |= 1u << 31); //transition state
             */
            lParam = isPressed ? lParam : (lParam |= 3u << 30);
            NativeMethods.PostMessageW(hwnd, msg, wParam, (UIntPtr)lParam);
        }

        /// <summary>
        /// Converts global mouse position to per-display localized coordinates.
        /// </summary>
        public static Point ToMouseDisplayLocal(int x, int y, Rectangle displayBounds)
        {
            x += -1 * displayBounds.X;
            y += -1 * displayBounds.Y;
            return new Point(x, y);
        }

        /// <summary>
        /// Converts global mouse position to span-local coordinates.
        /// </summary>
        public static Point ToMouseSpanLocal(int x, int y, Rectangle virtualScreenBounds)
        {
            x -= virtualScreenBounds.Location.X;
            y -= virtualScreenBounds.Location.Y;
            return new Point(x, y);
        }
    }
}
