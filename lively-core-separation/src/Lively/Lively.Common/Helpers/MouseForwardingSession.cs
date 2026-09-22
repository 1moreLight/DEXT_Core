using System;
using System.Collections.Generic;
using System.Linq;

namespace Lively.Common.Helpers
{
    /// <summary>Owns one forwarded primary-button gesture, including its original recipients.</summary>
    public sealed class MouseForwardingSession
    {
        public sealed class Target
        {
            public IntPtr Handle { get; }
            public int OriginX { get; }
            public int OriginY { get; }
            public Target(IntPtr handle, int originX, int originY)
            { Handle = handle; OriginX = originX; OriginY = originY; }
        }

        private Target[] targets = Array.Empty<Target>();
        private readonly Action<IntPtr, int, int, int, IntPtr> send;
        public bool IsActive => targets.Length != 0;

        public MouseForwardingSession(Action<IntPtr, int, int, int, IntPtr> send)
        { this.send = send ?? throw new ArgumentNullException(nameof(send)); }

        public void Begin(IEnumerable<Target> recipients, int x, int y, int modifiers)
        {
            if (IsActive) return; // Duplicate raw DOWN must not create a second gesture.
            targets = recipients.Where(target => target.Handle != IntPtr.Zero).ToArray();
            Send(targets, x, y, 0x0201, (modifiers & 0x000c) | 1);
        }

        public void Move(int x, int y, int modifiers) =>
            Send(targets, x, y, 0x0200, (modifiers & 0x000c) | 1);

        public void End(int x, int y, int modifiers)
        {
            var recipients = targets;
            targets = Array.Empty<Target>(); // Release exactly once, even across focus/monitor changes.
            Send(recipients, x, y, 0x0202, modifiers & 0x000c);
        }

        private void Send(Target[] recipients, int x, int y, int message, int buttons)
        {
            foreach (var target in recipients)
                send(target.Handle, x - target.OriginX, y - target.OriginY, message, (IntPtr)buttons);
        }
    }
}
