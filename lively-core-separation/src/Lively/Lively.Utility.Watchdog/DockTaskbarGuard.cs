using Lively.Common.Helpers;
using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;

namespace Lively.Utility.Watchdog
{
    internal static class DockTaskbarGuard
    {
        internal static void Run(string[] args)
        {
            string lease = args.Length == 6 ? args[5] : "";
            try
            {
                int corePid, dockPid; long coreStarted, dockStarted; Guid leaseId;
                if (args.Length != 6 || !int.TryParse(args[1], out corePid) || corePid <= 0 ||
                    !long.TryParse(args[2], out coreStarted) || coreStarted <= 0 ||
                    !int.TryParse(args[3], out dockPid) || dockPid <= 0 ||
                    !long.TryParse(args[4], out dockStarted) || dockStarted <= 0 ||
                    !Guid.TryParseExact(lease, "D", out leaseId) || leaseId == Guid.Empty ||
                    !DextDockTaskbarRecovery.IsProcessAlive(corePid, coreStarted) ||
                    !DextDockTaskbarRecovery.IsProcessAlive(dockPid, dockStarted))
                    throw new ArgumentException("Invalid Dock guard process identity");
                using (var mutex = new Mutex(false, DextDockTaskbarRecovery.MutexName))
                {
                    bool held;
                    try { held = mutex.WaitOne(0); } catch (AbandonedMutexException) { held = true; }
                    if (!held) throw new InvalidOperationException("Another Dock recovery guard owns the taskbar");
                    try
                    {
                        if (!DextDockTaskbarRecovery.RecoverUnderMutex(null, corePid, coreStarted))
                            throw new InvalidOperationException("Previous taskbar recovery is not complete");
                        Monitor(corePid, coreStarted, dockPid, dockStarted, lease);
                    }
                    finally { mutex.ReleaseMutex(); }
                }
            }
            catch (Exception error) { Reply(lease, "FAULT", error.GetType().Name); }
        }

        private static void Monitor(int corePid, long coreStarted, int dockPid, long dockStarted, string lease)
        {
            var commands = new ConcurrentQueue<string>();
            int inputClosed = 0;
            var reader = Task.Run(async () =>
            {
                try
                {
                    string line;
                    while ((line = await Console.In.ReadLineAsync()) != null)
                    {
                        if (line.Length > 128 || commands.Count >= 32) break;
                        commands.Enqueue(line);
                    }
                }
                catch { }
                finally { Interlocked.Exchange(ref inputClosed, 1); }
            });
            var heartbeat = Stopwatch.GetTimestamp();
            bool wanted = false, normalQuit = false;
            string reported = null;
            DextDockTaskbarRecovery recovery = null;
            PublishState(lease, "READY", ref reported);
            try
            {
                while (DextDockTaskbarRecovery.IsProcessAlive(corePid, coreStarted) &&
                    DextDockTaskbarRecovery.IsProcessAlive(dockPid, dockStarted) &&
                    Volatile.Read(ref inputClosed) == 0)
                {
                    string command; bool received = false;
                    while (commands.TryDequeue(out command))
                    {
                        var fields = command.Split(' ');
                        if (fields.Length == 2 && fields[0] == "QUIT" && fields[1] == lease)
                        { normalQuit = true; break; }
                        if (fields.Length != 3 || fields[0] != "STATE" || fields[1] != lease ||
                            fields[2] != "0" && fields[2] != "1") continue;
                        heartbeat = Stopwatch.GetTimestamp();
                        wanted = fields[2] == "1";
                        received = true;
                    }
                    if (normalQuit || (Stopwatch.GetTimestamp() - heartbeat) / (double)Stopwatch.Frequency > 5) break;
                    if (wanted)
                    {
                        if (recovery == null)
                        {
                            using (var own = Process.GetCurrentProcess())
                                recovery = DextDockTaskbarRecovery.Capture(lease, corePid, coreStarted,
                                    own.Id, own.StartTime.ToUniversalTime().Ticks);
                        }
                        PublishState(lease, recovery != null && recovery.Hide() ? "HIDDEN" : "WAITING", ref reported);
                    }
                    else if (recovery != null)
                    {
                        if (recovery.Restore())
                        {
                            recovery = null;
                            PublishState(lease, "RESTORED", ref reported);
                        }
                        else PublishState(lease, "RESTORE_PENDING", ref reported);
                    }
                    if (received) Reply(lease, "PULSE", reported ?? "READY");
                    Thread.Sleep(125);
                }
            }
            finally
            {
                // Parent failure/heartbeat loss must not leave an orphan top
                // window above the restored Windows taskbar. Only this exact
                // Dock identity is eligible; normal release leaves closure to Core.
                if (!normalQuit && DextDockTaskbarRecovery.IsProcessAlive(dockPid, dockStarted))
                {
                    try { using (var dock = Process.GetProcessById(dockPid)) dock.Kill(); } catch { }
                }
                bool restored = recovery == null;
                for (var attempt = 0; recovery != null && attempt < 40; attempt++)
                {
                    try { restored = recovery.Restore(); if (restored) break; } catch { }
                    Thread.Sleep(125);
                }
                Reply(lease, restored ? "RESTORED" : "RESTORE_PENDING", "");
            }
        }

        private static void PublishState(string lease, string state, ref string previous)
        {
            if (state == previous) return;
            previous = state;
            Reply(lease, state, "");
        }
        private static void Reply(string lease, string state, string detail)
        {
            try { Console.WriteLine(state + " " + lease + (detail.Length == 0 ? "" : " " + detail)); Console.Out.Flush(); }
            catch { }
        }
    }
}