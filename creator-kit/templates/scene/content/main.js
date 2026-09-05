const clock = document.querySelector("#clock");
const title = document.querySelector("#title");
const artist = document.querySelector("#artist");
const volume = document.querySelector("#volume");
dext.subscribe("time.read", ({ epochMs }) => { clock.textContent = new Date(epochMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); });
dext.subscribe("now-playing.read", (media) => { title.textContent = media.title || "没有正在播放的媒体"; artist.textContent = media.artist || ""; });
dext.subscribe("system.volume.read", (value) => { volume.value = value.level; });
