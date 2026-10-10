using System;
namespace Dext.Core.Rooms;
internal enum DockHost { None, Theme, Application }

// A request selects the preferred host. Only an explicit release transfers the live slot.
internal sealed class DockHostOwnership
{
    private readonly object gate = new();
    private DockHost owner;
    private DockHost requested = DockHost.Theme;
    private bool stopping;
    public event Action? Changed;
    public DockHost Owner { get { lock(gate) return owner; } }
    public bool ApplicationRequested => IsRequested(DockHost.Application);
    public bool IsRequested(DockHost host) { lock(gate) return !stopping && host != DockHost.None && requested == host; }
    public void SetApplicationRequested(bool value) => Request(value ? DockHost.Application : DockHost.Theme);
    public void Request(DockHost host)
    {
        if(host is not (DockHost.None or DockHost.Theme or DockHost.Application))throw new ArgumentOutOfRangeException(nameof(host));
        lock(gate) { if(stopping || requested==host)return; requested=host; }
        Changed?.Invoke();
    }
    public bool TryAcquire(DockHost host)
    {
        lock(gate)
        {
            if(stopping || host==DockHost.None || host!=requested ||
                owner!=DockHost.None && owner!=host) return false;
            owner=host;return true;
        }
    }
    public void Release(DockHost host)
    {
        lock(gate) { if(host==DockHost.None || owner!=host)return;owner=DockHost.None; }
        Changed?.Invoke();
    }
    public void Shutdown()
    {
        lock(gate){if(stopping)return;stopping=true;}
        Changed?.Invoke();
    }
}
