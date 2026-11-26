const repetitionsInput = document.querySelector("#repetitions");
const workDurationInput = document.querySelector("#work-duration");
const restDurationInput = document.querySelector("#rest-duration");
const phaseLabel = document.querySelector("#phase-label");
const countdown = document.querySelector("#countdown");
const repCounter = document.querySelector("#rep-counter");
const progressTrack = document.querySelector("#progress-track");
const progressFill = document.querySelector("#progress-fill");
const playPauseButton = document.querySelector("#play-pause");
const playPauseIcon = document.querySelector("#play-pause-icon");
const playPauseText = document.querySelector("#play-pause-text");
const stopButton = document.querySelector("#stop");
const connectionStatus = document.querySelector("#connection-status");
const settingsInputs = [repetitionsInput, workDurationInput, restDurationInput];

let state = "idle";
let phase = "work";
let totalRepetitions = Number(repetitionsInput.value);
let completedRepetitions = 0;
let phaseStartedAt = 0;
let phaseDurationMs = Number(workDurationInput.value) * 1000;
let remainingMs = phaseDurationMs;
let intervalId = null;

function formatTime(milliseconds) {
  const tenths = Math.ceil(Math.max(0, milliseconds) / 100) / 10;
  const minutes = Math.floor(tenths / 60);
  const seconds = (tenths - minutes * 60).toFixed(1).padStart(4, "0");
  return `${String(minutes).padStart(2, "0")}:${seconds}`;
}

function updateDisplay(milliseconds) {
  const isRest = phase === "rest";
  phaseLabel.textContent = state === "finished"
    ? "FERTIG"
    : state === "paused"
      ? "PAUSIERT"
      : isRest
        ? "PAUSE"
        : state === "idle"
          ? "BEREIT"
          : "ÜBUNG";
  phaseLabel.classList.toggle("is-rest", isRest && state !== "finished");
  phaseLabel.classList.toggle("is-finished", state === "finished");
  countdown.textContent = formatTime(milliseconds);
  countdown.setAttribute("aria-label", `Verbleibende Zeit ${countdown.textContent}`);
  repCounter.textContent = state === "finished"
    ? `${totalRepetitions} Wiederholungen abgeschlossen`
    : `Wiederholung ${Math.min(completedRepetitions + 1, totalRepetitions)} von ${totalRepetitions}`;

  const progress = (completedRepetitions / totalRepetitions) * 100;
  progressFill.style.width = `${progress}%`;
  progressTrack.setAttribute("aria-valuemax", String(totalRepetitions));
  progressTrack.setAttribute("aria-valuenow", String(completedRepetitions));

  playPauseIcon.textContent = state === "running" ? "Ⅱ" : "▶";
  playPauseText.textContent = state === "running"
    ? "Pause"
    : state === "paused"
      ? "Fortsetzen"
      : state === "finished"
        ? "Nochmal"
        : "Start";
}

function setSettingsDisabled(disabled) {
  for (const input of settingsInputs) {
    input.disabled = disabled;
  }
}

function readSettings() {
  for (const input of settingsInputs) {
    if (!input.reportValidity()) {
      return false;
    }
  }

  totalRepetitions = Number(repetitionsInput.value);
  return true;
}

function finish() {
  state = "finished";
  phase = "work";
  remainingMs = 0;
  window.clearInterval(intervalId);
  intervalId = null;
  setSettingsDisabled(false);
  updateDisplay(0);
}

function startPhase(nextPhase, startsAt) {
  phase = nextPhase;
  phaseDurationMs = Number(
    nextPhase === "work" ? workDurationInput.value : restDurationInput.value
  ) * 1000;
  phaseStartedAt = startsAt;
  remainingMs = phaseDurationMs;
}

function advanceTo(now) {
  let deadline = phaseStartedAt + phaseDurationMs;

  while (now >= deadline) {
    if (phase === "work") {
      completedRepetitions += 1;
      if (completedRepetitions >= totalRepetitions) {
        finish();
        return;
      }

      startPhase("rest", deadline);
    } else {
      startPhase("work", deadline);
    }
    deadline = phaseStartedAt + phaseDurationMs;
  }

  remainingMs = deadline - now;
  updateDisplay(remainingMs);
}

function tick() {
  if (state === "running") {
    advanceTo(Date.now());
  }
}

function startTimer() {
  if (state === "idle" || state === "finished") {
    if (!readSettings()) {
      return;
    }
    completedRepetitions = 0;
    phase = "work";
    phaseDurationMs = Number(workDurationInput.value) * 1000;
    remainingMs = phaseDurationMs;
  }

  if (state === "paused") {
    phaseDurationMs = remainingMs;
  }

  phaseStartedAt = Date.now();
  state = "running";
  setSettingsDisabled(true);
  updateDisplay(remainingMs);
  window.clearInterval(intervalId);
  intervalId = window.setInterval(tick, 50);
  tick();
}

function pauseTimer() {
  tick();
  if (state !== "running") {
    return;
  }

  remainingMs = Math.max(0, phaseStartedAt + phaseDurationMs - Date.now());
  state = "paused";
  window.clearInterval(intervalId);
  intervalId = null;
  updateDisplay(remainingMs);
}

function stopTimer() {
  window.clearInterval(intervalId);
  intervalId = null;
  state = "idle";
  phase = "work";
  completedRepetitions = 0;
  phaseDurationMs = (Number(workDurationInput.value) || 0.1) * 1000;
  remainingMs = phaseDurationMs;
  setSettingsDisabled(false);
  updateDisplay(remainingMs);
}

playPauseButton.addEventListener("click", () => {
  if (state === "running") {
    pauseTimer();
  } else {
    startTimer();
  }
});

stopButton.addEventListener("click", stopTimer);

for (const input of settingsInputs) {
  input.addEventListener("input", () => {
    if (state === "idle") {
      totalRepetitions = Number(repetitionsInput.value) || 1;
      phaseDurationMs = (Number(workDurationInput.value) || 0.1) * 1000;
      remainingMs = phaseDurationMs;
      updateDisplay(remainingMs);
    }
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    tick();
  }
});

window.addEventListener("online", () => {
  connectionStatus.textContent = "Online – Offline-Version wird beim nächsten Laden aktualisiert.";
});
window.addEventListener("offline", () => {
  connectionStatus.textContent = "Offline – der Timer läuft lokal weiter.";
});

updateDisplay(remainingMs);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      connectionStatus.textContent = navigator.onLine
        ? "Offline bereit – diese App wurde lokal gespeichert."
        : "Offline – der Timer läuft lokal weiter.";
    })
    .catch((error) => {
      console.error("Offline-Speicherung konnte nicht aktiviert werden.", error);
      connectionStatus.textContent = "Offline-Speicherung nicht verfügbar. Bitte über HTTPS öffnen.";
    });
} else {
  connectionStatus.textContent = "Dieser Browser unterstützt keine Offline-Speicherung.";
}
