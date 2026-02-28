/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX, 
  Upload, 
  Music, 
  Zap, 
  Settings2,
  Maximize2,
  Minimize2,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// --- Audio Engine Logic ---

class AudioTrack {
  private context: AudioContext;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private masterGain: GainNode;
  private startTime: number = 0;
  private pausedAt: number = 0;
  private isPlaying: boolean = false;
  private onEndedCallback: () => void;

  constructor(context: AudioContext, masterGain: GainNode, onEnded: () => void) {
    this.context = context;
    this.masterGain = masterGain;
    this.gainNode = context.createGain();
    this.gainNode.connect(this.masterGain);
    this.onEndedCallback = onEnded;
  }

  async loadFromUrl(url: string, fileName: string) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.buffer = await this.context.decodeAudioData(arrayBuffer);
      this.stop();
      return true;
    } catch (error) {
      console.error(`Erro ao carregar áudio de ${url}:`, error);
      return false;
    }
  }

  async loadFile(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    this.buffer = await this.context.decodeAudioData(arrayBuffer);
    this.stop();
  }

  play(volume: number) {
    if (!this.buffer || this.isPlaying) return;

    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.gainNode);
    
    const offset = this.pausedAt;
    this.source.start(0, offset);
    this.startTime = this.context.currentTime - offset;
    this.isPlaying = true;

    // Set volume immediately (no fade-in as requested)
    this.gainNode.gain.setValueAtTime(volume, this.context.currentTime);

    this.source.onended = () => {
      // Check if it ended naturally or was stopped
      if (this.isPlaying && this.context.currentTime - this.startTime >= (this.buffer?.duration || 0)) {
        this.isPlaying = false;
        this.pausedAt = 0;
        this.onEndedCallback();
      }
    };
  }

  pause() {
    if (!this.isPlaying || !this.source) return;
    this.source.stop();
    this.pausedAt = this.context.currentTime - this.startTime;
    this.isPlaying = false;
  }

  stop(fadeDuration: number = 0) {
    if (fadeDuration > 0 && this.isPlaying && this.source) {
      this.gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + fadeDuration);
      setTimeout(() => {
        if (this.source) {
          try { this.source.stop(); } catch(e) {}
          this.source = null;
        }
        this.isPlaying = false;
        this.pausedAt = 0;
      }, fadeDuration * 1000);
    } else {
      if (this.source) {
        try { this.source.stop(); } catch(e) {}
        this.source = null;
      }
      this.isPlaying = false;
      this.pausedAt = 0;
      this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
    }
  }

  setVolume(volume: number, instant: boolean = false) {
    if (instant) {
      this.gainNode.gain.setValueAtTime(volume, this.context.currentTime);
    } else {
      this.gainNode.gain.linearRampToValueAtTime(volume, this.context.currentTime + 0.1);
    }
  }

  getDuration() {
    return this.buffer?.duration || 0;
  }

  getCurrentTime() {
    if (!this.isPlaying) return this.pausedAt;
    return this.context.currentTime - this.startTime;
  }

  getIsPlaying() {
    return this.isPlaying;
  }
}

// --- Components ---

interface TrackControlProps {
  key?: React.Key;
  id: string;
  name: string;
  color: string;
  audioTrack: AudioTrack | null;
  initialFileName?: string | null;
  onStatusChange: (status: 'playing' | 'paused' | 'stopped') => void;
  onTransitionTrigger?: () => void;
}

const TrackControl = ({ 
  id, 
  name, 
  color, 
  audioTrack, 
  initialFileName,
  onStatusChange,
  onTransitionTrigger
}: TrackControlProps) => {
  const [volume, setVolume] = useState(0.8);
  const [status, setStatus] = useState<'playing' | 'paused' | 'stopped'>('stopped');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fileName, setFileName] = useState<string | null>(initialFileName || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialFileName) {
      setFileName(initialFileName);
    }
  }, [initialFileName]);

  useEffect(() => {
    if (audioTrack) {
      audioTrack.setVolume(volume, true);
    }
  }, [volume, audioTrack]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (audioTrack) {
        setCurrentTime(audioTrack.getCurrentTime());
        setDuration(audioTrack.getDuration());
        const isPlaying = audioTrack.getIsPlaying();
        if (isPlaying && status !== 'playing') {
          setStatus('playing');
          onStatusChange('playing');
        } else if (!isPlaying && status === 'playing') {
          // This handles natural end
          if (audioTrack.getCurrentTime() === 0) {
            setStatus('stopped');
            onStatusChange('stopped');
          } else {
            setStatus('paused');
            onStatusChange('paused');
          }
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [audioTrack, status, onStatusChange]);

  const handlePlay = () => {
    if (!audioTrack || !fileName) return;
    
    if (id === 'track-2' && onTransitionTrigger) {
      onTransitionTrigger();
    } else {
      audioTrack.play(volume);
      setStatus('playing');
      onStatusChange('playing');
    }
  };

  const handlePause = () => {
    if (!audioTrack) return;
    audioTrack.pause();
    setStatus('paused');
    onStatusChange('paused');
  };

  const handleStop = () => {
    if (!audioTrack) return;
    audioTrack.stop();
    setStatus('stopped');
    onStatusChange('stopped');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && audioTrack) {
      setFileName(file.name);
      await audioTrack.loadFile(file);
      setDuration(audioTrack.getDuration());
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="glass-panel p-6 flex flex-col gap-4 relative overflow-hidden group">
      {/* Background Accent */}
      <div 
        className="absolute top-0 left-0 w-1 h-full transition-all duration-500" 
        style={{ backgroundColor: color, opacity: status === 'playing' ? 1 : 0.3 }}
      />
      
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-1">{id.replace('track', 'TRILHA')}</h3>
          <h2 className="text-xl font-bold text-zinc-100">{name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className={`led-indicator ${status === 'playing' ? 'led-on' : 'led-off'}`} />
          <span className="text-[10px] font-mono uppercase text-zinc-500">
            {status === 'playing' ? 'TOCANDO' : status === 'paused' ? 'PAUSADO' : 'PARADO'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 my-2">
        <div className="relative h-4 w-full bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
          {/* Progress Bar Fill */}
          <motion.div 
            className="absolute top-0 left-0 h-full" 
            style={{ 
              backgroundColor: color,
              boxShadow: status === 'playing' ? `0 0 15px ${color}80` : 'none'
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
          />
          
          {/* Time Overlay inside the bar */}
          <div className="absolute inset-0 flex justify-between items-center px-3 mix-blend-difference">
            <span className="text-[10px] font-mono font-bold text-white uppercase">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] font-mono font-bold text-white uppercase">
              {formatTime(duration)}
            </span>
          </div>
        </div>
        
        {/* Subtle background pulse when playing */}
        {status === 'playing' && (
          <motion.div 
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{ backgroundColor: color }}
            animate={{ opacity: [0.05, 0.15, 0.05] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 sm:flex sm:items-center gap-3">
        <button 
          onClick={handlePlay}
          disabled={!fileName || status === 'playing'}
          className="btn-action col-span-2 sm:w-14 h-20 sm:h-14 rounded-2xl bg-zinc-100 text-zinc-900 hover:bg-white shadow-lg shadow-white/5"
        >
          <Play size={32} fill="currentColor" />
          <span className="ml-2 font-bold sm:hidden">PLAY</span>
        </button>
        <button 
          onClick={handlePause}
          disabled={status !== 'playing'}
          className="btn-action h-16 sm:w-12 sm:h-12 rounded-xl bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
        >
          <Pause size={24} fill="currentColor" />
        </button>
        <button 
          onClick={handleStop}
          disabled={status === 'stopped'}
          className="btn-action h-16 sm:w-12 sm:h-12 rounded-xl bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
        >
          <Square size={24} fill="currentColor" />
        </button>
        
        <div className="col-span-2 flex items-center gap-3 mt-2 sm:mt-0 sm:flex-1 sm:ml-2 bg-black/20 p-3 rounded-xl sm:bg-transparent sm:p-0">
          <Volume2 size={20} className="text-zinc-500" />
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volume} 
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-3 sm:h-1.5"
          />
        </div>
      </div>

        <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2 overflow-hidden">
          <Music size={14} className="text-zinc-500 shrink-0" />
          <span className="text-xs text-zinc-400 truncate max-w-[150px]">
            {fileName || 'Nenhum arquivo'}
          </span>
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="text-[10px] font-mono uppercase text-zinc-500 hover:text-zinc-100 transition-colors flex items-center gap-1"
        >
          <Upload size={12} />
          CARREGAR
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept="audio/*"
        />
      </div>
    </div>
  );
};

export default function App() {
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [masterGain, setMasterGain] = useState<GainNode | null>(null);
  const [masterVolume, setMasterVolume] = useState(1);
  const [config, setConfig] = useState<any>(null);
  const [tracks, setTracks] = useState<{ [key: string]: AudioTrack | null }>({
    'track-1': null,
    'track-2': null,
    'track-3': null
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Load config on mount
  useEffect(() => {
    fetch('/config.json')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error('Erro ao carregar config.json:', err));
  }, []);

  // Initialize Audio Context on first interaction
  const initAudio = useCallback(async () => {
    if (audioCtx) return;
    setIsLoadingConfig(true);
    
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    
    const t1 = new AudioTrack(ctx, master, () => {});
    const t2 = new AudioTrack(ctx, master, () => {});
    const t3 = new AudioTrack(ctx, master, () => {});

    const newTracks = {
      'track-1': t1,
      'track-2': t2,
      'track-3': t3
    };

    // Try to auto-load files from config
    if (config?.tracks) {
      for (const trackDef of config.tracks) {
        const trackObj = newTracks[trackDef.id as keyof typeof newTracks];
        if (trackObj && trackDef.path) {
          await trackObj.loadFromUrl(trackDef.path, trackDef.fileName);
        }
      }
    }

    setAudioCtx(ctx);
    setMasterGain(master);
    setTracks(newTracks);
    setIsLoadingConfig(false);
  }, [audioCtx, config]);

  useEffect(() => {
    if (masterGain) {
      masterGain.gain.setTargetAtTime(masterVolume, audioCtx!.currentTime, 0.05);
    }
  }, [masterVolume, masterGain, audioCtx]);

  const handleGlobalPause = () => {
    (Object.values(tracks) as (AudioTrack | null)[]).forEach(t => t?.pause());
  };

  const handleGlobalStop = () => {
    (Object.values(tracks) as (AudioTrack | null)[]).forEach(t => t?.stop());
  };

  const handleTransition = (targetTrackId: string) => {
    const fadeTime = 3; // 3 seconds fade-out
    
    if (targetTrackId === 'track-2') {
      const t1 = tracks['track-1'];
      const t2 = tracks['track-2'];
      if (t1 && t1.getIsPlaying()) t1.stop(fadeTime);
      if (t2) {
        t2.play(0.8);
      }
    } else if (targetTrackId === 'track-3') {
      const t2 = tracks['track-2'];
      const t3 = tracks['track-3'];
      if (t2 && t2.getIsPlaying()) t2.stop(fadeTime);
      if (t3) {
        t3.play(0.8);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const downloadProject = async () => {
    const zip = new JSZip();
    
    // List of files to include in the zip
    const files = [
      'package.json',
      'vite.config.ts',
      'tsconfig.json',
      'index.html',
      'src/App.tsx',
      'src/main.tsx',
      'src/index.css',
      'src/types.ts',
      'public/config.json',
      'metadata.json',
      'README.md',
      '.gitignore'
    ];

    for (const file of files) {
      try {
        const response = await fetch(`/${file}`);
        if (response.ok) {
          const content = await response.text();
          zip.file(file, content);
        }
      } catch (e) {
        console.error(`Erro ao incluir arquivo ${file} no zip:`, e);
      }
    }

    // Add empty audio folder placeholder
    zip.folder('public/audio')?.file('LEIA-ME.txt', 'Coloque seus arquivos de áudio aqui.');

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'projeto-audio-teatral.zip');
  };

  return (
    <div className="min-h-screen p-6 md:p-12 flex flex-col max-w-5xl mx-auto gap-8" onClick={initAudio}>
      {/* Header */}
      <header className="flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={18} className="text-yellow-500 fill-yellow-500" />
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Peça: O Juízo Final</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tighter">ÁUDIO TEATRAL <span className="text-zinc-500 font-light italic">v1.0</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={downloadProject}
            className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-100 transition-colors flex items-center gap-2"
            title="Baixar Projeto Completo"
          >
            <Download size={20} />
            <span className="hidden sm:inline text-xs font-mono uppercase">Baixar Projeto</span>
          </button>
          <button 
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-100 transition-colors"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <div className="text-right">
            <p className="text-[10px] font-mono text-zinc-500 uppercase">Status do Sistema</p>
            <p className={`text-xs font-bold ${audioCtx ? 'text-emerald-500' : 'text-amber-500'}`}>
              {audioCtx ? 'MOTOR PRONTO' : 'CLIQUE PARA INICIAR'}
            </p>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {config?.tracks ? config.tracks.map((tDef: any) => (
          <TrackControl 
            key={tDef.id}
            id={tDef.id} 
            name={tDef.name} 
            color={tDef.color} 
            audioTrack={tracks[tDef.id as keyof typeof tracks]}
            initialFileName={tDef.fileName}
            onStatusChange={() => {}}
            onTransitionTrigger={tDef.id === 'track-2' || tDef.id === 'track-3' ? () => handleTransition(tDef.id) : undefined}
          />
        )) : (
          <div className="col-span-3 text-center p-12 glass-panel">
            <p className="text-zinc-500">Carregando configurações...</p>
          </div>
        )}
      </main>

      {/* Global Controls */}
      <footer className="mt-auto glass-panel p-6 sm:p-8 flex flex-col items-center gap-6 sm:gap-8">
        <div className="w-full bg-black/20 p-4 rounded-2xl sm:bg-transparent sm:p-0">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Settings2 size={16} className="text-zinc-500" />
              <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">Console Master</span>
            </div>
            <span className="text-xs font-mono text-zinc-500">{Math.round(masterVolume * 100)}%</span>
          </div>
          <div className="flex items-center gap-4">
            <VolumeX size={20} className="text-zinc-500" />
            <input 
              type="range" 
              min="0" 
              max="1.5" 
              step="0.01" 
              value={masterVolume} 
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="flex-1 h-4 sm:h-2"
            />
            <Volume2 size={20} className="text-zinc-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 w-full gap-4 sm:flex sm:items-center sm:w-auto">
          <button 
            onClick={handleGlobalPause}
            className="btn-action h-20 sm:h-auto sm:px-8 sm:py-4 rounded-2xl bg-zinc-800 text-zinc-100 hover:bg-zinc-700 font-bold flex flex-col sm:flex-row items-center justify-center gap-2"
          >
            <Pause size={24} fill="currentColor" />
            <span className="text-xs sm:text-base">PAUSAR TUDO</span>
          </button>
          <button 
            onClick={handleGlobalStop}
            className="btn-action h-20 sm:h-auto sm:px-8 sm:py-4 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white font-bold flex flex-col sm:flex-row items-center justify-center gap-2"
          >
            <Square size={24} fill="currentColor" />
            <span className="text-xs sm:text-base">PARAR TUDO</span>
          </button>
        </div>
      </footer>

      {/* Safety Warning Overlay if not initialized */}
      <AnimatePresence>
        {!audioCtx && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center"
          >
            <div className="max-w-md">
              <Zap size={48} className="text-yellow-500 mx-auto mb-6 animate-pulse" />
              <h2 className="text-3xl font-bold mb-4">Sistema em Espera</h2>
              <p className="text-zinc-400 mb-8">
                {isLoadingConfig 
                  ? "Carregando arquivos de áudio configurados..." 
                  : "A segurança do navegador exige uma interação do usuário para ativar o processamento de áudio de alta performance."}
              </p>
              {!isLoadingConfig && (
                <button 
                  onClick={initAudio}
                  className="w-full py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-bold text-lg hover:bg-white transition-all active:scale-95"
                >
                  INICIALIZAR MOTOR DE ÁUDIO
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
