"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download } from "lucide-react";

interface StillsGalleryProps {
  stills: string[]; // Array of CloudFront URLs for HD stills
  stillsZipUrl?: string;
}

export function StillsGallery({ stills, stillsZipUrl }: StillsGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (stills.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-[#00D4AA]/30 border-t-[#00D4AA] animate-spin" />
        <p className="mt-3 text-sm text-[#8FA3B1]">
          HD stills are being generated...
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1C2B36]">HD Stills</h3>
        {stillsZipUrl && (
          <a
            href={stillsZipUrl}
            download
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#00D4AA] hover:text-[#003D30] hover:bg-[#00D4AA]/10 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download All
          </a>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {stills.map((url, index) => (
          <button
            key={url}
            onClick={() => setSelectedIndex(index)}
            className="relative aspect-video rounded-xl overflow-hidden group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA]"
          >
            <img
              src={url}
              alt={`Property view ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedIndex(null)}
          >
            <button
              onClick={() => setSelectedIndex(null)}
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              aria-label="Close lightbox"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              src={stills[selectedIndex]}
              alt={`Property view ${selectedIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
