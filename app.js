// DOM Elements Selection
const bpmDisplay = document.getElementById("bpm-display");
const tempoName = document.getElementById("tempo-name");
const bpmRange = document.getElementById("bpm-range");
const btnSub10 = document.getElementById("btn-sub-10");
const btnSub1 = document.getElementById("btn-sub-1");
const btnAdd1 = document.getElementById("btn-add-1");
const btnAdd10 = document.getElementById("btn-add-10");
const btnPlay = document.getElementById("btn-play");
const playIcon = document.getElementById("play-icon");
const stopIcon = document.getElementById("stop-icon");
const playBtnText = document.getElementById("play-btn-text");
const btnTap = document.getElementById("btn-tap");
const tapCount = document.getElementById("tap-count");
const timeSignatureControl = document.getElementById("time-signature-control");
const subdivisionControl = document.getElementById("subdivision-control");
const presetGrid = document.getElementById("preset-grid");
const soundSelect = document.getElementById("sound-select");
const volumeSlider = document.getElementById("volume-slider");
const timerPresets = document.getElementById("timer-presets");
const timerCountdown = document.getElementById("timer-countdown");
const appStatus = document.getElementById("app-status");
const beatIndicators = document.getElementById("beat-indicators");
const sweepBar = document.getElementById("sweep-bar");
const catAscii = document.getElementById("cat-ascii");

// Metronome Application State
let isPlaying = false;
let bpm = 120;
let beatsPerBar = 4;
let subdivision = 1; // 1 = quarter, 2 = 8th, 3 = triplet, 4 = 16th
let volume = 0.7;
let soundTheme = "woodblock";

// Timer State
let timerDuration = 0; // 0 = infinite, other values in seconds
let timerRemaining = 0;
let timerIntervalId = null;

// Audio Variables
let audioContext = null;
let nextNoteTime = 0.0;     // When the next audio note (including subdivision) is due
let lastBeatTime = 0.0;     // The time the last major beat (quarter note) occurred
let currentBeat = 0;        // Which beat in the bar we are on (0 to beatsPerBar - 1)
let currentSubdivision = 0; // Which subdivision of the beat we are on (0 to subdivision - 1)
const lookahead = 25.0;     // How frequently to call scheduler (milliseconds)
const scheduleAheadTime = 0.1; // How far ahead to schedule audio (seconds)

// Visual synchronization queue
let notesQueue = [];

// Tap Tempo State
let tapTimes = [];

// Worker Timer
let metronomeWorker = null;

// Noise buffer for rimshot sound
let noiseBuffer = null;

// Tempo Names list with ranges
const tempoPresets = [
  { name: "Grave", min: 0, max: 44 },
  { name: "Largo", min: 45, max: 59 },
  { name: "Adagio", min: 60, max: 72 },
  { name: "Andante", min: 73, max: 97 },
  { name: "Moderato", min: 98, max: 109 },
  { name: "Allegro", min: 110, max: 131 },
  { name: "Vivace", min: 132, max: 167 },
  { name: "Presto", min: 168, max: 199 },
  { name: "Prestissimo", min: 200, max: 300 }
];

// Initialize Metronome
function init() {
  setupWorker();
  updateTempoText();
  renderBeatDots();
  setupEventListeners();
  
  // Start the animation loop for visual sync
  requestAnimationFrame(drawVisuals);
}

// Set up the background Web Worker
function setupWorker() {
  // We can create a inline Blob worker to keep deployment fully self-contained (single file)
  const workerCode = `
    let timerID = null;
    let interval = 25;
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
  `;
  const blob = new Blob([workerCode], { type: "application/javascript" });
  metronomeWorker = new Worker(URL.createObjectURL(blob));
  
  metronomeWorker.onmessage = function(e) {
    if (e.data === "tick") {
      scheduler();
    }
  };
  
  // Set initial interval
  metronomeWorker.postMessage({ interval: lookahead });
}

// Setup Event Listeners
function setupEventListeners() {
  // Play button
  btnPlay.addEventListener("click", togglePlay);
  
  // Tap tempo
  btnTap.addEventListener("click", handleTapTempo);
  
  // BPM Inputs
  bpmRange.addEventListener("input", (e) => {
    setBpm(parseInt(e.target.value));
  });
  
  // Quick BPM Add/Sub Buttons
  btnSub10.addEventListener("click", () => adjustBpm(-10));
  btnSub1.addEventListener("click", () => adjustBpm(-1));
  btnAdd1.addEventListener("click", () => adjustBpm(1));
  btnAdd10.addEventListener("click", () => adjustBpm(10));
  
  // Preset Pills Selection
  const presetPills = document.querySelectorAll(".preset-pill");
  presetPills.forEach(pill => {
    pill.addEventListener("click", () => {
      presetPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      setBpm(parseInt(pill.dataset.bpm));
    });
  });

  // Time Signature Options
  const tsOptions = timeSignatureControl.querySelectorAll(".segment-option");
  tsOptions.forEach(opt => {
    opt.addEventListener("click", () => {
      tsOptions.forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      beatsPerBar = parseInt(opt.dataset.beats);
      resetBeatState();
      renderBeatDots();
    });
  });

  // Subdivision Options
  const subOptions = subdivisionControl.querySelectorAll(".segment-option");
  subOptions.forEach(opt => {
    opt.addEventListener("click", () => {
      subOptions.forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      subdivision = parseInt(opt.dataset.sub);
      resetBeatState();
    });
  });

  // Sound Theme Selection
  soundSelect.addEventListener("change", (e) => {
    soundTheme = e.target.value;
  });

  // Volume control
  volumeSlider.addEventListener("input", (e) => {
    volume = parseFloat(e.target.value);
    if (volume === 0) {
      document.getElementById("volume-icon").innerText = "🔇";
    } else if (volume < 0.4) {
      document.getElementById("volume-icon").innerText = "🔈";
    } else {
      document.getElementById("volume-icon").innerText = "🔊";
    }
  });

  // Timer Presets
  const timerPills = timerPresets.querySelectorAll(".timer-pill");
  timerPills.forEach(pill => {
    pill.addEventListener("click", () => {
      timerPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      timerDuration = parseInt(pill.dataset.time);
      
      if (timerDuration > 0) {
        timerCountdown.style.display = "inline-block";
        timerCountdown.innerText = formatTime(timerDuration);
      } else {
        timerCountdown.style.display = "none";
      }
      
      if (isPlaying) {
        // Restart timer if already running
        startTimer();
      }
    });
  });

  // Direct BPM Text Edit (Click to input)
  bpmDisplay.addEventListener("click", () => {
    const currentVal = bpm;
    const input = document.createElement("input");
    input.type = "number";
    input.value = currentVal;
    input.min = 40;
    input.max = 250;
    input.style.fontFamily = "inherit";
    input.style.fontSize = "4.5rem";
    input.style.fontWeight = "900";
    input.style.width = "180px";
    input.style.textAlign = "center";
    input.style.background = "rgba(0,0,0,0.3)";
    input.style.color = "white";
    input.style.border = "1px solid var(--accent-cyan)";
    input.style.borderRadius = "12px";
    input.style.outline = "none";

    bpmDisplay.replaceWith(input);
    input.focus();
    input.select();

    const finishEdit = () => {
      let val = parseInt(input.value);
      if (isNaN(val)) val = currentVal;
      val = Math.max(40, Math.min(250, val));
      input.replaceWith(bpmDisplay);
      setBpm(val);
    };

    input.addEventListener("blur", finishEdit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        finishEdit();
      } else if (e.key === "Escape") {
        input.value = currentVal;
        finishEdit();
      }
    });
  });

  // Keyboard Shortcuts
  document.addEventListener("keydown", (e) => {
    // Ignore input text boxes
    if (document.activeElement.tagName === "INPUT" && document.activeElement.type !== "range") {
      return;
    }
    
    if (e.code === "Space") {
      e.preventDefault();
      togglePlay();
    } else if (e.code === "KeyT") {
      handleTapTempo();
    } else if (e.code === "ArrowUp") {
      e.preventDefault();
      adjustBpm(1);
    } else if (e.code === "ArrowDown") {
      e.preventDefault();
      adjustBpm(-1);
    }
  });

  // Cat Click Interaction
  if (catAscii) {
    catAscii.addEventListener("click", meowCat);
  }
}

// Reset variables relating to beat sequence
function resetBeatState() {
  currentBeat = 0;
  currentSubdivision = 0;
  if (audioContext) {
    nextNoteTime = audioContext.currentTime + 0.05;
    lastBeatTime = audioContext.currentTime;
  }
}

// Adjust BPM values
function adjustBpm(amount) {
  setBpm(bpm + amount);
}

// Main BPM setter
function setBpm(val) {
  bpm = Math.max(40, Math.min(250, val));
  bpmDisplay.innerText = bpm;
  bpmRange.value = bpm;
  updateTempoText();
  updateActivePresetPill();
}

// Updates the tempo text (Adagio, Andante, Moderato, etc.)
function updateTempoText() {
  const match = tempoPresets.find(t => bpm >= t.min && bpm <= t.max);
  if (match) {
    tempoName.innerText = match.name;
  }
}

// Highlight the correct preset pill if matching exactly
function updateActivePresetPill() {
  const presetPills = document.querySelectorAll(".preset-pill");
  presetPills.forEach(pill => {
    if (parseInt(pill.dataset.bpm) === bpm) {
      pill.classList.add("active");
    } else {
      pill.classList.remove("active");
    }
  });
}

// Toggle play state
function togglePlay() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    generateNoiseBuffer();
  }
  
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  isPlaying = !isPlaying;
  
  if (isPlaying) {
    resetBeatState();
    metronomeWorker.postMessage("start");
    
    btnPlay.classList.add("playing");
    playIcon.style.display = "none";
    stopIcon.style.display = "inline-block";
    playBtnText.innerText = "STOP";
    appStatus.innerText = "ACTIVE";
    appStatus.style.color = "var(--accent-cyan)";
    
    startTimer();
  } else {
    metronomeWorker.postMessage("stop");
    
    btnPlay.classList.remove("playing");
    playIcon.style.display = "inline-block";
    stopIcon.style.display = "none";
    playBtnText.innerText = "START";
    appStatus.innerText = "STANDBY";
    appStatus.style.color = "";
    
    stopTimer();
  }
}

// Tap Tempo logic
function handleTapTempo() {
  const now = performance.now();
  
  // Filter out taps that are too far apart (more than 2.5 seconds, which is less than 24 BPM)
  if (tapTimes.length > 0 && (now - tapTimes[tapTimes.length - 1] > 2500)) {
    tapTimes = [];
  }
  
  tapTimes.push(now);
  
  // Highlight Tap button momentarily
  btnTap.style.background = "var(--accent-cyan)";
  btnTap.style.color = "var(--bg-primary)";
  setTimeout(() => {
    btnTap.style.background = "";
    btnTap.style.color = "";
  }, 100);

  if (tapTimes.length >= 2) {
    // Keep only the last 6 taps to average the speed
    if (tapTimes.length > 6) {
      tapTimes.shift();
    }
    
    let totalDifference = 0;
    for (let i = 1; i < tapTimes.length; i++) {
      totalDifference += (tapTimes[i] - tapTimes[i - 1]);
    }
    
    const averageDifference = totalDifference / (tapTimes.length - 1);
    const calculatedBpm = Math.round(60000 / averageDifference);
    
    setBpm(calculatedBpm);
    tapCount.innerText = `${tapTimes.length - 1} TAPS`;
  } else {
    tapCount.innerText = "FIRST TAP";
  }
}

// Generate White Noise Buffer for rimshot synthesis
function generateNoiseBuffer() {
  const bufferSize = audioContext.sampleRate * 0.05; // 0.05 seconds of noise
  noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
}

// Scheduler: Look ahead and schedule notes
function scheduler() {
  // While there are notes to play before the next interval check, schedule them
  while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
    scheduleNote(currentBeat, currentSubdivision, nextNoteTime);
    advanceNote();
  }
}

// Advance nextNoteTime by tempo and subdivision duration
function advanceNote() {
  // The duration of a beat (quarter note) in seconds:
  const secondsPerBeat = 60.0 / bpm;
  
  // For 6/8, a "beat" is an eighth note, but we keep calculations standardized.
  // We advance nextNoteTime by the subdivision length.
  // In a standard 4/4 bar, a beat is a quarter note. Subdivision splits it.
  const subdivisionLength = secondsPerBeat / subdivision;
  
  nextNoteTime += subdivisionLength;
  
  // Advance subdivision counter
  currentSubdivision = (currentSubdivision + 1) % subdivision;
  
  // If we wrapped back to subdivision 0, we advanced a major beat
  if (currentSubdivision === 0) {
    lastBeatTime = nextNoteTime - subdivisionLength; // Timestamp of this major beat start
    currentBeat = (currentBeat + 1) % beatsPerBar;
  }
}

// Synthesize sounds and play them
function scheduleNote(beatNumber, subNumber, time) {
  // Push the scheduled note info into our visual synchronization queue
  notesQueue.push({
    time: time,
    beat: beatNumber,
    subdivision: subNumber,
    isAccent: (beatNumber === 0 && subNumber === 0)
  });

  // Calculate volume scaling: master volume * sub-volume scaling
  let noteVolume = volume;
  if (subNumber > 0) {
    noteVolume *= 0.5; // Subdivisions are softer
  }
  
  // Skip play if volume is 0
  if (noteVolume <= 0) return;

  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(noteVolume, time);
  gainNode.connect(audioContext.destination);

  // Play based on selected theme
  if (soundTheme === "digital") {
    playDigitalBeep(beatNumber, subNumber, gainNode, time);
  } else if (soundTheme === "woodblock") {
    playWoodblock(beatNumber, subNumber, gainNode, time);
  } else if (soundTheme === "drum") {
    playRimshot(beatNumber, subNumber, gainNode, time);
  }
}

// Sound Synthesizer 1: Digital Beep (Sine waves)
function playDigitalBeep(beatNumber, subNumber, destinationNode, time) {
  const osc = audioContext.createOscillator();
  osc.type = "sine";
  
  // Frequencies: Accent (1000Hz), Regular Beat (800Hz), Subdivisions (600Hz)
  let freq = 800;
  if (beatNumber === 0 && subNumber === 0) {
    freq = 1000;
  } else if (subNumber > 0) {
    freq = 600;
  }
  
  osc.frequency.setValueAtTime(freq, time);
  osc.connect(destinationNode);
  
  // Quick decay
  const duration = subNumber > 0 ? 0.03 : 0.05;
  destinationNode.gain.exponentialRampToValueAtTime(0.001, time + duration);
  
  osc.start(time);
  osc.stop(time + duration + 0.01);
}

// Sound Synthesizer 2: Woodblock (Two sine waves with quick harmonic blend)
function playWoodblock(beatNumber, subNumber, destinationNode, time) {
  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  osc1.type = "sine";
  osc2.type = "sine";
  
  let freq1 = 850;
  let freq2 = 1275; // Harmonic ratio 1.5
  
  if (beatNumber === 0 && subNumber === 0) {
    freq1 = 1200;
    freq2 = 1800;
  } else if (subNumber > 0) {
    freq1 = 650;
    freq2 = 975;
  }
  
  osc1.frequency.setValueAtTime(freq1, time);
  osc2.frequency.setValueAtTime(freq2, time);
  
  // Accent gets slightly stronger blend
  const blendGain = audioContext.createGain();
  blendGain.gain.setValueAtTime(1.0, time);
  
  osc1.connect(blendGain);
  osc2.connect(blendGain);
  blendGain.connect(destinationNode);
  
  const duration = subNumber > 0 ? 0.025 : 0.04;
  destinationNode.gain.exponentialRampToValueAtTime(0.001, time + duration);
  
  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + duration + 0.01);
  osc2.stop(time + duration + 0.01);
}

// Sound Synthesizer 3: Snare Rimshot (Bandpass filtered white noise burst)
function playRimshot(beatNumber, subNumber, destinationNode, time) {
  // Combine noise burst with brief high frequency body
  const noiseSource = audioContext.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  
  const filter = audioContext.createBiquadFilter();
  filter.type = "bandpass";
  
  let filterFreq = 900;
  let bodyFreq = 1000;
  
  if (beatNumber === 0 && subNumber === 0) {
    filterFreq = 1400;
    bodyFreq = 1500;
  } else if (subNumber > 0) {
    filterFreq = 650;
    bodyFreq = 700;
  }
  
  filter.frequency.setValueAtTime(filterFreq, time);
  filter.Q.setValueAtTime(10, time);
  
  noiseSource.connect(filter);
  filter.connect(destinationNode);
  
  // Body Oscillator
  const bodyOsc = audioContext.createOscillator();
  bodyOsc.type = "triangle";
  bodyOsc.frequency.setValueAtTime(bodyFreq, time);
  bodyOsc.connect(destinationNode);
  
  const duration = subNumber > 0 ? 0.03 : 0.045;
  destinationNode.gain.exponentialRampToValueAtTime(0.001, time + duration);
  
  noiseSource.start(time);
  bodyOsc.start(time);
  
  noiseSource.stop(time + duration + 0.01);
  bodyOsc.stop(time + duration + 0.01);
}

// Dynamic UI Render: Generate Beat LED Dot Elements
function renderBeatDots() {
  beatIndicators.innerHTML = "";
  for (let i = 0; i < beatsPerBar; i++) {
    const dot = document.createElement("div");
    dot.classList.add("beat-dot");
    if (i === 0) {
      // First beat is always ready for accent representation
      dot.setAttribute("aria-label", "강박 (Accent Beat)");
    } else {
      dot.setAttribute("aria-label", `약박 ${i + 1} (Beat ${i + 1})`);
    }
    beatIndicators.appendChild(dot);
  }
}

// RequestAnimationFrame Drawing Loop (Handles precise frame sync)
function drawVisuals() {
  const currentTime = audioContext ? audioContext.currentTime : 0;
  
  // 1. Process visual events in queue
  while (notesQueue.length > 0 && notesQueue[0].time <= currentTime) {
    const activeNote = notesQueue.shift();
    
    // Only pulse main beats (quarter notes) or subbeats visually if preferred
    // In this premium metronome, we trigger visual pulses on every scheduled sub-note,
    // but give different weights to visual indicators.
    if (activeNote.subdivision === 0) {
      triggerVisualBeat(activeNote.beat, activeNote.isAccent);
    }
  }
  
  // 2. Smoothly animate the sweeping bar (pendulum effect)
  if (isPlaying && audioContext) {
    const secondsPerBeat = 60.0 / bpm;
    // Calculate progress (from 0 to 1) of the current beat interval
    let timeElapsedSinceLastBeat = currentTime - lastBeatTime;
    let progress = timeElapsedSinceLastBeat / secondsPerBeat;
    progress = Math.min(Math.max(progress, 0), 1); // Clamp
    
    // We determine the direction of the sweep based on currentBeat number.
    // Even beats: Sweep left-to-right (0% to 100%)
    // Odd beats: Sweep right-to-left (100% to 0%)
    const isSweepRight = (currentBeat % 2 === 0);
    let sweepPercent = isSweepRight ? progress * 100 : (1 - progress) * 100;
    
    sweepBar.style.left = `${sweepPercent}%`;
  } else {
    // Reset sweep to center when stopped
    sweepBar.style.left = "50%";
  }
  
  requestAnimationFrame(drawVisuals);
}

// Update the LED dots and pulse text on active beat
function triggerVisualBeat(beatIndex, isAccent) {
  const dots = beatIndicators.querySelectorAll(".beat-dot");
  
  dots.forEach((dot, idx) => {
    dot.classList.remove("active", "accent-active");
    if (idx === beatIndex) {
      if (isAccent) {
        dot.classList.add("accent-active");
      } else {
        dot.classList.add("active");
      }
    }
  });

  // Pulse the large BPM number on beat 1 or all beats
  if (beatIndex === 0) {
    bpmDisplay.classList.remove("pulse");
    // Trigger reflow to restart animation
    void bpmDisplay.offsetWidth;
    bpmDisplay.classList.add("pulse");
  }
  
  // Pulse the cat art on every beat
  pulseCat(isAccent);
}

// Timer Functions
function startTimer() {
  if (timerIntervalId) clearInterval(timerIntervalId);
  
  if (timerDuration > 0) {
    timerRemaining = timerDuration;
    timerCountdown.innerText = formatTime(timerRemaining);
    timerCountdown.style.display = "inline-block";
    
    timerIntervalId = setInterval(() => {
      timerRemaining--;
      timerCountdown.innerText = formatTime(timerRemaining);
      
      if (timerRemaining <= 0) {
        // Finished timer! Stop metronome and play soft chime
        togglePlay();
        playTimerEndChime();
        timerCountdown.style.display = "none";
        // Reset pills
        const timerPills = timerPresets.querySelectorAll(".timer-pill");
        timerPills.forEach(p => p.classList.remove("active"));
        timerPresets.querySelector('[data-time="0"]').classList.add("active");
        timerDuration = 0;
      }
    }, 1000);
  }
}

function stopTimer() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
  if (timerDuration > 0) {
    timerCountdown.innerText = formatTime(timerDuration);
  }
}

// Play a nice synthesized completion chime when timer hits zero
function playTimerEndChime() {
  if (!audioContext) return;
  const time = audioContext.currentTime;
  
  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  osc1.type = "sine";
  osc2.type = "sine";
  
  // Pleasant major chord chime (C5 & E5)
  osc1.frequency.setValueAtTime(523.25, time);
  osc2.frequency.setValueAtTime(659.25, time);
  
  gainNode.gain.setValueAtTime(0.001, time);
  gainNode.gain.exponentialRampToValueAtTime(volume * 0.5, time + 0.05);
  gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
  
  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + 0.95);
  osc2.stop(time + 0.95);
}

// Timer display helper: Format seconds into MM:SS
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Interactive Cat Art helpers
let meowTimeout = null;
function meowCat() {
  if (!catAscii) return;
  if (meowTimeout) clearTimeout(meowTimeout);
  
  const meowTexts = ["MEOW!", "PURR~", "NYAN!", "♥MEOW♥", "HELLO!"];
  const randomText = meowTexts[Math.floor(Math.random() * meowTexts.length)];
  
  catAscii.textContent = `  ${randomText}  /\\_/\\\n       \\\\(=^o^=)\n        (")_(")`;
  catAscii.classList.add("cat-pulse-accent");
  
  meowTimeout = setTimeout(() => {
    catAscii.textContent = ` /\\_/\\\n(=^.^=)\n (")_(")`;
    catAscii.classList.remove("cat-pulse-accent");
  }, 800);
}

function pulseCat(isAccent) {
  if (!catAscii) return;
  
  // Ignore beat pulsing if the cat is currently meowing
  if (meowTimeout && catAscii.textContent.includes("o")) return;
  
  if (isAccent) {
    catAscii.textContent = ` /\\_/\\\n(=~.^=)\n (")_(")`;
    catAscii.classList.add("cat-pulse-accent");
  } else {
    catAscii.textContent = ` /\\_/\\\n(=^.^=)\n (")_(")`;
    catAscii.classList.add("cat-pulse");
  }
  
  setTimeout(() => {
    // Only reset text if we are not currently meowing
    if (meowTimeout && catAscii.textContent.includes("o")) return;
    
    catAscii.textContent = ` /\\_/\\\n(=^.^=)\n (")_(")`;
    catAscii.classList.remove("cat-pulse", "cat-pulse-accent");
  }, 150);
}

// Run Initialization
window.onload = init;
