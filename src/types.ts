import { Type } from "@google/genai";

export interface AudioTrackState {
  id: string;
  name: string;
  color: string;
  status: 'stopped' | 'playing' | 'paused';
  volume: number;
  duration: number;
  currentTime: number;
  fileName: string | null;
}

export interface GlobalState {
  masterVolume: number;
  isPausedAll: boolean;
}
