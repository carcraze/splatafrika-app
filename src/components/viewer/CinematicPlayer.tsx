"use client";

import { useRef, useState } from "react";
import { Volume2, VolumeX, Maximize, Pause, Play } from "lucide-react";

interface CinematicPlayerProps {
  mp4Url: string;
}

export function CinematicPlayer({ mp4Url }: CinematicPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const goFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  if (!mp4Url) {
    return (
      <div className="p-6 text-center">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-[#00D4AA]/30 border-t-[#00D4AA] animate-spin" />
        <p className="mt-3 text-sm text-[#8FA3B1]">
          Cinematic video is being generated...
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold text-[#1C2B36]">
        Cinematic Flythrough
      </h3>

      <div className="relative rounded-2xl overflow-hidden bg-black group">
        <video
          ref={videoRef}
          src={mp4Url}
          autoPlay
          muted
          loop
          playsInline
          className="w-full aspect-video object-cover"
        />

        {/* Controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={togglePlay}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={toggleMute}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={goFullscreen}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              aria-label="Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
