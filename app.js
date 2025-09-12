// ===============================
// ESP32 Power Tracker Frontend
// ===============================

// Connect WebSocket to ESP32
const WS_PORT = 81;
const ws = new WebSocket("ws://" + location.hostname + ":" + WS_PORT);

// Show device IP
document.getElementById('ip').innerText = location.hostname;

// -------------------------------
// Date & Time Updater
// -------------------------------
function updateDateTime(){
  const now = new Date();
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const day = days[now.getDay()];
  const dd = String(now.getDate()).padStart(2,"0");
  const mm = String(now.getMonth()+1).padStart(2,"0");
  const yyyy = now.getFullYear();

  let hh = now.getHours();
  const min = String(now.getMinutes()).padStart(2,"0");
  const sec = String(now.getSeconds()).padStart(2,"0");
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12; hh = hh ? hh : 12; // convert to 12h

  const timeStr = `${hh}:${min}:${sec} ${ampm}`;
  const dateStr = `${dd}/${mm}/${yyyy}`;
  document.getElementById("datetime").textContent = `${timeStr} · ${dateStr} · ${day}`;
}
setInterval(updateDateTime,1000);
updateDateTime();

// -------------------------------
// Build live monitoring tiles
// -------------------------------
const liveDiv = document.getElementById("live");
for (let i = 1; i <= 4; i++) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.id = "tile"+i;
  tile.innerHTML = `
    <h4>Load ${i}</h4>
    <div class="kv"><span>Voltage:</span><span id="v${i}">0 V</span></div>
    <div class="kv"><span>Current:</span><span id="c${i}">0 A</span></div>
    <div class="kv"><span>Power:</span><span id="p${i}">0 W</span></div>
    <div class="kv"><span>Energy:</span><span id="e${i}">0 Wh</span></div>
    <div class="kv"><span>State:</span><span id="s${i}">OFF</span></div>
  `;
  liveDiv.appendChild(tile);
}

// -------------------------------
// Relay Switch Handlers
// -------------------------------
for (let i=1;i<=4;i++){
  const el = document.getElementById("relay"+i);
  el.addEventListener("change", e=>{
    ws.send(JSON.stringify({cmd:"relay", id:i, state:e.target.checked}));
  });
}

// -------------------------------
// Timer Controls
// -------------------------------
document.querySelectorAll(".preset").forEach(btn=>{
  btn.addEventListener("click", ()=> document.getElementById("customMin").value = btn.dataset.min);
});
document.getElementById("applyTimer").addEventListener("click", ()=>{
  const sel = parseInt(document.getElementById("loadSelect").value);
  const val = parseInt(document.getElementById("customMin").value || "0", 10);
  ws.send(JSON.stringify({cmd:"setTimer", id:sel, minutes: val>0?val:0}));
});

// -------------------------------
// Usage Limit Controls
// -------------------------------
document.getElementById("saveLimits").addEventListener("click", ()=>{
  const vals = [
    parseFloat(document.getElementById("limit1").value||"12"),
    parseFloat(document.getElementById("limit2").value||"12"),
    parseFloat(document.getElementById("limit3").value||"12"),
    parseFloat(document.getElementById("limit4").value||"12"),
  ];
  vals.forEach((h,i)=>{
    const sec = Math.max(1, Math.round(h*3600));
    ws.send(JSON.stringify({cmd:"setLimit", id:i+1, seconds:sec}));
  });
});

// -------------------------------
// Price Setting
// -------------------------------
document.getElementById("savePrice").addEventListener("click", ()=>{
  const p = parseFloat(document.getElementById("price").value||"8");
  ws.send(JSON.stringify({cmd:"setPrice", price:p}));
});

// -------------------------------
// Notifications
// -------------------------------
document.getElementById("refreshNotifs").addEventListener("click", async ()=>{
  const r = await fetch("/notifs.json");
  const j = await r.json();
  showNotifs(j.notifs || []);
});
document.getElementById("clearNotifs").addEventListener("click", ()=>{
  ws.send(JSON.stringify({cmd:"clearNotifs"}));
  document.getElementById("notifs").innerHTML = "";
});

// -------------------------------
// Charts & PDF Export
// -------------------------------
const chartCtx = document.getElementById("chart").getContext("2d");
const chart = new Chart(chartCtx, {
  type: "line",
  data: { labels: [], datasets: [
    { label: "Load1", data: [] },
    { label: "Load2", data: [] },
    { label: "Load3", data: [] },
    { label: "Load4", data: [] }
  ]},
  options: { responsive:true, plugins:{legend:{display:true}} }
});
document.getElementById("downloadPdf").addEventListener("click", async ()=>{
  const r = await fetch("/logs.json");
  const j = await r.json();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("ESP32 Power Tracker - Logs snapshot", 10, 10);
  doc.text(JSON.stringify(j).slice(0, 1500), 10, 20);
  doc.save("logs.pdf");
});

// -------------------------------
// WebSocket Message Handler
// -------------------------------
ws.onopen = ()=> console.log("WS open");
ws.onclose = ()=> console.log("WS closed");
ws.onerror = e=> console.error("WS err", e);

ws.onmessage = (evt)=>{
  try {
    const data = JSON.parse(evt.data);

    if(data.type === "state" && data.loads){
      let totalV = 0, totalC = 0, totalP = 0, totalE = 0;

      data.loads.forEach((L)=>{
        const i = L.id;
        document.getElementById("v"+i).innerText = Number(L.voltage||0).toFixed(2)+" V";
        document.getElementById("c"+i).innerText = Number(L.current||0).toFixed(3)+" A";
        document.getElementById("p"+i).innerText = Number(L.power||0).toFixed(2)+" W";
        document.getElementById("e"+i).innerText = Number(L.energy||0).toFixed(2)+" Wh";
        document.getElementById("s"+i).innerText = L.relay ? "ON" : "OFF";
        document.getElementById("relay"+i).checked = !!L.relay;

        totalV += Number(L.voltage||0);
        totalC += Number(L.current||0);
        totalP += Number(L.power||0);
        totalE += Number(L.energy||0);
      });

      // ✅
        document.getElementById("totalV").innerText = totalV.toFixed(2)+" V";       
        document.getElementById("totalC").innerText = totalC.toFixed(3)+" A";       
        document.getElementById("totalP").innerText = totalP.toFixed(2)+" W";       
        document.getElementById("totalE").innerText = totalE.toFixed(2)+" Wh";
        document.getElementById("cost").innerText = "₹ "+(data.cost||0).toFixed(2);
        document.getElementById("uptime").innerText = formatUptime(data.uptime||0);
        document.getElementById("lastReset").innerText = data.lastReset ? (new Date(data.lastReset)).toLocaleString() : "N/A";
        document.getElementById("fwVersion").innerText = data.fwVersion || "N/A";
        document.getElementById("ip").innerText = data.ip || location.hostname;
        document.getElementById("price").value = Number(data.price||8).toFixed(2);

      // Update usage limits
      data.loads.forEach((L)=>{
        const i = L.id;
        document.getElementById("limit"+i).value = L.limitHours ? Number(L.limitHours).toFixed(2) : "12";
      });
        // Update chart
        const now = new Date();
        chart.data.labels.push(now.getHours()+":"+String(now.getMinutes()).padStart(2,"0"));
        if(chart.data.labels.length > 20) chart.data.labels.shift();
        chart.data.datasets.forEach((ds, idx)=>{
          const L = data.loads.find(x=>x.id === idx+1);
          ds.data.push(L ? Number(L.power||0).toFixed(2) : 0);
          if(ds.data.length > 20) ds.data.shift();
        });                                                                                       
        chart.update();
    }
    else if(data.type === "notifs" && data.notifs){
      showNotifs(data.notifs);
    }
    else if(data.type === "cleared"){
      document.getElementById("notifs").innerHTML = "";
    }
    } catch(err){
        console.error("WS msg err", err);
    }
};
// -------------------------------
// Helper Functions
// -------------------------------  

function formatUptime(seconds){
  const d = Math.floor(seconds / 86400);
  seconds %= 86400;
  const h = Math.floor(seconds / 3600);
  seconds %= 3600;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}
function showNotifs(notifs){

    const container = document.getElementById("notifs");        
    container.innerHTML = "";
    notifs.slice().reverse().forEach(n=>{
        const div = document.createElement("div");      
        div.className = "notif";      
        const time = n.time ? (new Date(n.time)).toLocaleString() : "N/A";      
        div.innerHTML = `<strong>[${time}]</strong> ${n.message || ""}`;      
        container.appendChild(div);    
    });
}       
// Initial fetch of notifications
document.getElementById("refreshNotifs").click();


// Initial fetch of state after short delay to allow WS to connect

setTimeout(()=> ws.send(JSON.stringify({cmd:"getState"})), 500);

// ===============================

// End of File
// ===============================      
// End of File