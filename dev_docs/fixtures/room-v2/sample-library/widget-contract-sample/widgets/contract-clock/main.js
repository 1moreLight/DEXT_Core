const clock = document.getElementById("clock");
function updateClock() {
  clock.textContent = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}
updateClock();
setInterval(updateClock, 1000);
