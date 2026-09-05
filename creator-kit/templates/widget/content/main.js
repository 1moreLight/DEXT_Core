const clock = document.querySelector("#clock");
const cpu = document.querySelector("#cpu");
const memory = document.querySelector("#memory");
dext.subscribe("time.read", ({ epochMs }) => { clock.textContent = new Date(epochMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); });
dext.subscribe("hardware.cpu.read", ({ usage }) => { cpu.value = usage; });
dext.subscribe("hardware.memory.read", ({ usedPercent }) => { memory.value = usedPercent; });
