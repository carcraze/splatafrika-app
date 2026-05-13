"use client";

import { useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";

/**
 * Subscribes to Supabase Realtime for job and tour status updates.
 * Propagates changes to Zustand store for instant UI updates.
 */
export function RealtimeProvider({ userId }: { userId: string }) {
  const updateJobStatus = useStore((s) => s.updateJobStatus);
  const updateTourStatus = useStore((s) => s.updateTourStatus);

  const setupSubscription = useCallback(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("realtime-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "jobs",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const { id, status, splat_url, stills_zip_url, mp4_url, error_message } =
            payload.new as Record<string, unknown>;
          updateJobStatus(
            id as string,
            status as string,
            {
              splat_url: splat_url as string | null,
              stills_zip_url: stills_zip_url as string | null,
              mp4_url: mp4_url as string | null,
              error_message: error_message as string | null,
            }
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tours",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const { id, status } = payload.new as Record<string, unknown>;
          updateTourStatus(id as string, status as string);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, updateJobStatus, updateTourStatus]);

  useEffect(() => {
    const cleanup = setupSubscription();
    return cleanup;
  }, [setupSubscription]);

  return null; // This is a headless provider — no UI
}
