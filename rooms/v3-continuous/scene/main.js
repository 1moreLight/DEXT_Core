(() => {
  const instanceId = crypto.randomUUID();
  document.documentElement.dataset.instanceId = instanceId;
  document.getElementById('navigate').addEventListener('click', () => {
    window.Dext?.actions?.activate('navigate');
  });
  function connect() {
    if (!window.Dext?.desk?.subscribe) return;
    window.Dext.desk.subscribe(snapshot => {
      document.body.dataset.desk = snapshot.targetDeskId || snapshot.currentDeskId;
      document.getElementById('status').textContent = `${snapshot.currentDeskId} · revision ${snapshot.revision} · instance ${instanceId.slice(0,8)}`;
    });
  }
  addEventListener('dext:ready', connect, {once:true});
  connect();
})();
