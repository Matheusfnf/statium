'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AnovaResult, TukeyResult, ScottKnottResult, DesignType } from '@/lib/statistics';
import { createClient } from '@/utils/supabase/client';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  label: string;
  variableName: string;
  design: DesignType;
  numTreatments: number;
  numReps: number;
  treatmentNames: string[];
  data: (number | null)[][];
  anovaResult: AnovaResult;
  tukeyResult: TukeyResult | null;
  scottKnottResult: ScottKnottResult | null;
  comparisonMethod: 'tukey' | 'scott-knott' | 'none';
  alpha: number;
}

const MAX_ENTRIES = 20;

function generateLabel(design: DesignType, treatmentNames: string[]): string {
  const shortNames = treatmentNames.slice(0, 3).join(', ');
  const suffix = treatmentNames.length > 3 ? ` +${treatmentNames.length - 3}` : '';
  return `${design} — ${shortNames}${suffix}`;
}

export function useAnalysisHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  // Handle Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Load entries when user changes
  useEffect(() => {
    async function fetchEntries() {
      if (user) {
        const { data, error } = await supabase
          .from('analysis_history')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          const mapped = data.map((row) => ({
            id: row.id,
            timestamp: new Date(row.created_at).getTime(),
            label: row.label,
            variableName: row.variable_name || '',
            design: row.design as DesignType,
            numTreatments: row.num_treatments,
            numReps: row.num_reps,
            treatmentNames: row.treatment_names,
            data: row.data,
            anovaResult: row.anova_result as AnovaResult,
            tukeyResult: row.tukey_result as TukeyResult | null,
            scottKnottResult: row.scott_knott_result as ScottKnottResult | null,
            comparisonMethod: row.comparison_method as any,
            alpha: row.alpha,
          }));
          setEntries(mapped);
        }
      } else {
        setEntries([]);
      }
    }
    fetchEntries();
  }, [user, supabase]);

  const save = useCallback(
    async (params: {
      design: DesignType;
      variableName: string;
      numTreatments: number;
      numReps: number;
      treatmentNames: string[];
      data: (number | null)[][];
      anovaResult: AnovaResult;
      tukeyResult: TukeyResult | null;
      scottKnottResult: ScottKnottResult | null;
      comparisonMethod: 'tukey' | 'scott-knott' | 'none';
      alpha: number;
    }) => {
      if (!user) {
        alert("Por favor, faça login para salvar seus favoritos.");
        return null;
      }

      const label = generateLabel(params.design, params.treatmentNames);

      const { data, error } = await supabase
        .from('analysis_history')
        .insert({
          user_id: user.id,
          label,
          variable_name: params.variableName,
          design: params.design,
          num_treatments: params.numTreatments,
          num_reps: params.numReps,
          treatment_names: params.treatmentNames,
          data: params.data,
          anova_result: params.anovaResult,
          tukey_result: params.tukeyResult,
          scott_knott_result: params.scottKnottResult,
          comparison_method: params.comparisonMethod,
          alpha: params.alpha,
        })
        .select()
        .single();

      if (error) {
        console.error("Error saving to Supabase:", {
          message: error.message,
          details: error.details,
          code: error.code
        });
        alert(`Erro ao salvar aos favoritos na nuvem: ${error.message} (Code: ${error.code})`);
        return null;
      }

      const newEntry: HistoryEntry = {
        id: data.id,
        timestamp: new Date(data.created_at).getTime(),
        label,
        ...params,
      };

      setEntries((prev) => [newEntry, ...prev]);
      return newEntry.id;
    },
    [user, supabase]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!user) return;
      
      const { error } = await supabase.from('analysis_history').delete().eq('id', id);
      if (error) {
        console.error("Error deleting from Supabase:", error);
        alert("Erro ao excluir favorito.");
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
    },
    [user, supabase]
  );

  const get = useCallback(
    (id: string): HistoryEntry | undefined => {
      return entries.find((e) => e.id === id);
    },
    [entries]
  );

  return { entries, save, remove, get };
}
