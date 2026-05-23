let timerID = null;
let interval = 25; // Send a tick every 25ms

self.onmessage = function(e) {
  if (e.data === "start") {
    if (timerID) clearInterval(timerID);
    timerID = setInterval(() => postMessage("tick"), interval);
  } else if (e.data === "stop") {
    if (timerID) {
      clearInterval(timerID);
      timerID = null;
    }
  } else if (e.data.interval) {
    interval = e.data.interval;
    if (timerID) {
      clearInterval(timerID);
      timerID = setInterval(() => postMessage("tick"), interval);
    }
  }
};
