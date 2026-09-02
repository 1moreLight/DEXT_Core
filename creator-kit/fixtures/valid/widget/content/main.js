addEventListener("message", (event) => { if (event.data?.capability === "time.read") document.querySelector("#clock").textContent = event.data.data.iso; });
