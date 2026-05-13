import { create } from "zustand";

interface JobUpdate {
  splat_url: string | null;
  stills_zip_url: string | null;
  mp4_url: string | null;
  error_message: string | null;
}

interface AppState {
  // Realtime job status updates
  jobStatuses: Record<string, { status: string; data?: JobUpdate }>;
  tourStatuses: Record<string, string>;

  updateJobStatus: (jobId: string, status: string, data?: JobUpdate) => void;
  updateTourStatus: (tourId: string, status: string) => void;

  // Upload progress
  uploadProgress: number;
  setUploadProgress: (progress: number) => void;

  // Capture state
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  recordingDuration: number;
  setRecordingDuration: (duration: number) => void;
}

export const useStore = create<AppState>((set) => ({
  jobStatuses: {},
  tourStatuses: {},

  updateJobStatus: (jobId, status, data) =>
    set((state) => ({
      jobStatuses: {
        ...state.jobStatuses,
        [jobId]: { status, data },
      },
    })),

  updateTourStatus: (tourId, status) =>
    set((state) => ({
      tourStatuses: {
        ...state.tourStatuses,
        [tourId]: status,
      },
    })),

  uploadProgress: 0,
  setUploadProgress: (progress) => set({ uploadProgress: progress }),

  isRecording: false,
  setIsRecording: (recording) => set({ isRecording: recording }),
  recordingDuration: 0,
  setRecordingDuration: (duration) => set({ recordingDuration: duration }),
}));
