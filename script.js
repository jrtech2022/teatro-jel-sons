const config = {
  tracks: [
    {
      id: "track-1",
      name: "Trilha Sonora + Narração",
      fileName: "Trilha Sonora.mp3",
      path: "audio/Trilha Sonora.mp3",
      color: "#3b82f6"
    },
    {
      id: "track-2",
      name: "Fundo Musical (Declamação)",
      fileName: "Fundo Musical.mp3",
      path: "audio/Fundo Musical.mp3",
      color: "#ef4444"
    },
    {
      id: "track-3",
      name: "Playback (Apocalipse - Damares)",
      fileName: "Playback.mp3",
      path: "audio/Playback.mp3",
      color: "#10b981"
    }
  ]
};

// --- Audio Engine Logic (HTML5 Audio) ---
class AudioTrack {
  constructor(onEnded) {
    this.audioEl = new Audio();
    this.onEndedCallback = onEnded;

    this.audioEl.addEventListener('ended', () => {
      this.isPlaying = false;
      this.audioEl.currentTime = 0;
      if (typeof this.onEndedCallback === 'function') {
        this.onEndedCallback();
      }
    });

    this.isPlaying = false;
    this.volume = 0.8;
    this.fadeInterval = null;
  }

  loadFromUrl(url) {
    this.audioEl.src = url;
    this.audioEl.load();
  }

  play() {
    if (!this.audioEl.src || this.isPlaying) return;
    clearInterval(this.fadeInterval);

    // Repassa o volume atual caso estivesse num fadeout cancelado
    this.setVolume(this.volume, masterVolume);

    this.audioEl.play().catch(e => console.error("Erro ao tocar áudio", e));
    this.isPlaying = true;
  }

  pause() {
    if (!this.isPlaying) return;
    this.audioEl.pause();
    this.isPlaying = false;
  }

  stop(fadeDuration = 0) {
    clearInterval(this.fadeInterval);

    if (fadeDuration > 0 && this.isPlaying) {
      const steps = 20;
      const stepDuration = (fadeDuration * 1000) / steps;
      let currentStep = 0;
      const initialVol = this.audioEl.volume;

      this.fadeInterval = setInterval(() => {
        currentStep++;
        const factor = 1 - (currentStep / steps);
        this.audioEl.volume = Math.max(0, initialVol * factor);

        if (currentStep >= steps) {
          clearInterval(this.fadeInterval);
          this.audioEl.pause();
          this.audioEl.currentTime = 0;
          this.isPlaying = false;
        }
      }, stepDuration);
    } else {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
      this.isPlaying = false;
    }
  }

  setVolume(trackVol, masterVol) {
    this.volume = trackVol;
    this.audioEl.volume = Math.max(0, Math.min(1, trackVol * masterVol));
  }

  getDuration() {
    return isNaN(this.audioEl.duration) ? 0 : this.audioEl.duration;
  }

  getCurrentTime() {
    return this.audioEl.currentTime;
  }

  getIsPlaying() {
    return this.isPlaying;
  }
}

// --- App State & Logic ---
let masterVolume = 1;

const tracks = {
  'track-1': new AudioTrack(() => updateTrackUI('track-1')),
  'track-2': new AudioTrack(() => updateTrackUI('track-2')),
  'track-3': new AudioTrack(() => updateTrackUI('track-3'))
};

const trackStates = {
  'track-1': { volume: 0.8, status: 'stopped', fileName: null },
  'track-2': { volume: 0.8, status: 'stopped', fileName: null },
  'track-3': { volume: 0.8, status: 'stopped', fileName: null },
};

// Elements
const systemStatus = document.getElementById('system-status');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnPauseAll = document.getElementById('btn-pause-all');
const btnStopAll = document.getElementById('btn-stop-all');
const masterVolumeInput = document.getElementById('master-volume');
const masterVolumeLabel = document.getElementById('master-volume-label');
const tracksContainer = document.getElementById('tracks-container');

// Start up without delay
function initApp() {
  document.getElementById('init-overlay')?.remove();
  systemStatus.textContent = 'MOTOR PRONTO';
  systemStatus.className = 'status-value text-emerald';

  config.tracks.forEach(trackDef => {
    const trackObj = tracks[trackDef.id];
    if (trackObj && trackDef.path) {
      trackStates[trackDef.id].fileName = trackDef.fileName;
      trackObj.loadFromUrl(trackDef.path);
    }
  });

  renderTracks();
}

// Render Tracks HTML
function renderTracks() {
  tracksContainer.innerHTML = '';
  config.tracks.forEach(tDef => {

    const div = document.createElement('div');
    div.className = 'glass-panel group';
    div.id = `panel-${tDef.id}`;

    div.innerHTML = `
      <div class="track-bg-accent" id="bg-${tDef.id}" style="background-color: ${tDef.color}; opacity: 0.3"></div>
      <div class="track-pulse" id="pulse-${tDef.id}" style="background-color: ${tDef.color}"></div>

      <div class="track-header">
        <div>
          <h3 class="track-id">${tDef.id.replace('track', 'TRILHA')}</h3>
          <h2 class="track-name">${tDef.name}</h2>
        </div>
        <div class="track-status-box">
          <div class="led-indicator led-off" id="led-${tDef.id}"></div>
          <span class="track-status-text" id="status-text-${tDef.id}">PARADO</span>
        </div>
      </div>

      <div class="track-progress-container">
        <div class="track-progress-fill" id="progress-${tDef.id}" style="background-color: ${tDef.color}"></div>
        <div class="track-progress-overlay">
          <span class="track-time" id="time-current-${tDef.id}">0:00</span>
          <span class="track-time" id="time-total-${tDef.id}">0:00</span>
        </div>
      </div>

      <div class="track-controls">
        <button class="btn-action btn-play" id="btn-play-${tDef.id}">
          <i data-lucide="play"></i>
          <span>PLAY</span>
        </button>
        <button class="btn-action btn-pause" id="btn-pause-${tDef.id}" disabled>
          <i data-lucide="pause"></i>
        </button>
        <button class="btn-action btn-stop" id="btn-stop-${tDef.id}" disabled>
          <i data-lucide="square"></i>
        </button>

        <div class="track-volume">
          <i data-lucide="volume-2"></i>
          <input type="range" id="vol-${tDef.id}" min="0" max="1" step="0.01" value="0.8">
        </div>
      </div>
    `;

    tracksContainer.appendChild(div);

    // Event Listeners for Track
    document.getElementById(`vol-${tDef.id}`).addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      trackStates[tDef.id].volume = vol;
      if (tracks[tDef.id]) {
        tracks[tDef.id].setVolume(vol, masterVolume);
      }
    });

    document.getElementById(`btn-play-${tDef.id}`).addEventListener('click', () => handlePlay(tDef.id));
    document.getElementById(`btn-pause-${tDef.id}`).addEventListener('click', () => handlePause(tDef.id));
    document.getElementById(`btn-stop-${tDef.id}`).addEventListener('click', () => handleStop(tDef.id));
  });

  lucide.createIcons();
}

// Format Time
function formatTime(time) {
  if (isNaN(time) || time < 0) return "0:00";
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update UI Loop
setInterval(() => {
  let anyPlaying = false;
  Object.keys(tracks).forEach(id => {
    const track = tracks[id];
    if (!track) return;

    const currentTime = track.getCurrentTime();
    const duration = track.getDuration();
    const isPlaying = track.getIsPlaying();
    const state = trackStates[id];

    if (isPlaying && state.status !== 'playing') {
      state.status = 'playing';
      updateTrackUI(id);
    } else if (!isPlaying && state.status === 'playing') {
      if (track.getCurrentTime() === 0) {
        state.status = 'stopped';
      } else {
        state.status = 'paused';
      }
      updateTrackUI(id);
    }

    if (isPlaying) anyPlaying = true;

    // View Updates
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const progressEl = document.getElementById(`progress-${id}`);
    if (progressEl) progressEl.style.width = `${progress}%`;

    const timeCurrentEl = document.getElementById(`time-current-${id}`);
    if (timeCurrentEl) timeCurrentEl.textContent = formatTime(currentTime);

    const timeTotalEl = document.getElementById(`time-total-${id}`);
    if (timeTotalEl && duration > 0 && timeTotalEl.textContent === '0:00') {
      timeTotalEl.textContent = formatTime(duration);
    }
  });

  if (anyPlaying) {
    systemStatus.textContent = 'TOCANDO AGORA';
    systemStatus.className = 'status-value text-emerald pulse';
  } else {
    systemStatus.textContent = 'MOTOR PRONTO';
    systemStatus.className = 'status-value text-emerald';
  }
}, 100);

function updateTrackUI(id) {
  const state = trackStates[id];
  const hasFile = !!state.fileName;

  const btnPlay = document.getElementById(`btn-play-${id}`);
  const btnPause = document.getElementById(`btn-pause-${id}`);
  const btnStop = document.getElementById(`btn-stop-${id}`);
  const led = document.getElementById(`led-${id}`);
  const statusText = document.getElementById(`status-text-${id}`);
  const pulse = document.getElementById(`pulse-${id}`);
  const bgAccent = document.getElementById(`bg-${id}`);
  const progressFill = document.getElementById(`progress-${id}`);
  const tDef = config.tracks.find(t => t.id === id);
  const color = tDef ? tDef.color : 'white';

  if (!btnPlay) return;

  btnPlay.disabled = !hasFile || state.status === 'playing';
  btnPause.disabled = state.status !== 'playing';
  btnStop.disabled = state.status === 'stopped';

  if (state.status === 'playing') {
    led.className = 'led-indicator led-on';
    statusText.textContent = 'TOCANDO';
    pulse.classList.add('active');
    bgAccent.style.opacity = '1';
    progressFill.style.boxShadow = `0 0 15px ${color}80`;
  } else if (state.status === 'paused') {
    led.className = 'led-indicator led-off';
    statusText.textContent = 'PAUSADO';
    pulse.classList.remove('active');
    bgAccent.style.opacity = '0.3';
    progressFill.style.boxShadow = 'none';
  } else {
    led.className = 'led-indicator led-off';
    statusText.textContent = 'PARADO';
    pulse.classList.remove('active');
    bgAccent.style.opacity = '0.3';
    progressFill.style.boxShadow = 'none';
  }
}

// Audio Controls
function handlePlay(id) {
  const track = tracks[id];
  if (!track || !trackStates[id].fileName) return;

  if (id === 'track-2' || id === 'track-3') {
    handleTransition(id);
  } else {
    track.setVolume(trackStates[id].volume, masterVolume);
    track.play();
    trackStates[id].status = 'playing';
    updateTrackUI(id);
  }
}

function handlePause(id) {
  const track = tracks[id];
  if (!track) return;
  track.pause();
  trackStates[id].status = 'paused';
  updateTrackUI(id);
}

function handleStop(id) {
  const track = tracks[id];
  if (!track) return;
  track.stop();
  trackStates[id].status = 'stopped';
  updateTrackUI(id);
}

function handleTransition(targetTrackId) {
  const fadeTime = 3; // fades in 3 seconds
  if (targetTrackId === 'track-2') {
    if (tracks['track-1']?.getIsPlaying()) tracks['track-1'].stop(fadeTime);
    if (tracks['track-2']) {
      tracks['track-2'].setVolume(trackStates['track-2'].volume, masterVolume);
      tracks['track-2'].play();
    }
  } else if (targetTrackId === 'track-3') {
    if (tracks['track-2']?.getIsPlaying()) tracks['track-2'].stop(fadeTime);
    if (tracks['track-3']) {
      tracks['track-3'].setVolume(trackStates['track-3'].volume, masterVolume);
      tracks['track-3'].play();
    }
  }
}

// Global Actions
masterVolumeInput.addEventListener('input', (e) => {
  masterVolume = parseFloat(e.target.value);
  masterVolumeLabel.textContent = `${Math.round(masterVolume * 100)}%`;

  Object.keys(tracks).forEach(id => {
    if (tracks[id]) {
      tracks[id].setVolume(trackStates[id].volume, masterVolume);
    }
  });
});

btnPauseAll.addEventListener('click', () => {
  Object.keys(tracks).forEach(id => {
    if (tracks[id]) handlePause(id);
  });
});

btnStopAll.addEventListener('click', () => {
  Object.keys(tracks).forEach(id => {
    if (tracks[id]) handleStop(id);
  });
});

btnFullscreen.addEventListener('click', () => {
  const iconMax = document.getElementById('icon-maximize');
  const iconMin = document.getElementById('icon-minimize');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    iconMax.style.display = 'none';
    iconMin.style.display = 'block';
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
      iconMax.style.display = 'block';
      iconMin.style.display = 'none';
    }
  }
});

// Boot
initApp();
