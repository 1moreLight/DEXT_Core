using System;
namespace Dext.Core.Rooms;
internal enum DockHost { None, Theme, Application }

// A request selects the preferred host. Only an explicit release transfers the live slot.
internal sealed class DockHostOwnership
{
    private readonly object gate = new();
    private DockHost owner;
    private bool applicationRequested, stopping;
    public event Action? Changed;
    public DockHost Owner { get { lock(gate) return owner; } }
    public bool ApplicationRequested { get { lock(gate) return applicationRequested; } }
    public void SetApplicationRequested(bool value)
    {
        lock(gate) { if(stopping || applicationRequested==value)return; applicationRequested=value; }
        Changed?.Invoke();
    }
    public bool TryAcquire(DockHost host)
    {
        lock(gate)
        {
            if(stopping || host==DockHost.None || (host==DockHost.Application)!=applicationRequested ||
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
