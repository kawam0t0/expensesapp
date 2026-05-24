"use client";

import { useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type RealtimeEvent = "expenses" | "drafts" | "all";

/**
 * Supabase Realtime を使って expenses / drafts テーブルの変更を購読し、
 * 変更があったときに onRefresh コールバックを呼び出す。
 */
export function useExpensesRealtime(
  onRefresh: (event: RealtimeEvent) => void,
  enabled = true
) {
  const refresh = useCallback(onRefresh, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const channel = supabase
      .channel("expenses-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        () => {
          refresh("expenses");
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drafts" },
        () => {
          refresh("drafts");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, refresh]);
}
