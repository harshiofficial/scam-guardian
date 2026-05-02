/**
 * WarningContext
 *
 * React Context that holds the current ThreatAnalysis and derived warning
 * state. Subscribes to MessageListenerService so that any analysis result
 * automatically flows into the UI layer.
 *
 * warningLevel derivation (Requirements 1.3, 1.4, 1.5):
 *   riskScore ≥ 70   → 'danger'
 *   40 ≤ score < 70  → 'caution'
 *   score < 40       → 'none'
 *
 * Requirements: 1.3, 1.4, 1.5
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import type { ThreatAnalysis } from '../models/types';
import { MessageListenerService } from '../services/MessageListenerService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WarningLevel = 'none' | 'caution' | 'danger';

export interface WarningState {
  currentAnalysis: ThreatAnalysis | null;
  warningLevel: WarningLevel;
}

export interface WarningContextValue extends WarningState {
  /** Update the current analysis (and re-derive warningLevel). */
  setAnalysis: (analysis: ThreatAnalysis) => void;
  /** Clear the current analysis and reset warningLevel to 'none'. */
  dismissWarning: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives the WarningLevel from a numeric riskScore.
 *
 * Requirements: 1.3, 1.4, 1.5
 */
export function deriveWarningLevel(riskScore: number): WarningLevel {
  if (riskScore >= 70) {
    return 'danger';
  }
  if (riskScore >= 40) {
    return 'caution';
  }
  return 'none';
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type WarningAction =
  | { type: 'SET_ANALYSIS'; analysis: ThreatAnalysis }
  | { type: 'DISMISS' };

function warningReducer(state: WarningState, action: WarningAction): WarningState {
  switch (action.type) {
    case 'SET_ANALYSIS':
      return {
        currentAnalysis: action.analysis,
        warningLevel: deriveWarningLevel(action.analysis.riskScore),
      };
    case 'DISMISS':
      return {
        currentAnalysis: null,
        warningLevel: 'none',
      };
    default:
      return state;
  }
}

const initialState: WarningState = {
  currentAnalysis: null,
  warningLevel: 'none',
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WarningContext = createContext<WarningContextValue>({
  ...initialState,
  setAnalysis: () => {},
  dismissWarning: () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface WarningProviderProps {
  children: React.ReactNode;
  /**
   * Optional override for the MessageListenerService subscription function.
   * Useful in tests to inject a controlled subscription without a live bridge.
   */
  subscribeToAnalysis?: (
    cb: (analysis: ThreatAnalysis) => void,
  ) => () => void;
}

export const WarningProvider: React.FC<WarningProviderProps> = ({
  children,
  subscribeToAnalysis,
}) => {
  const [state, dispatch] = useReducer(warningReducer, initialState);

  const setAnalysis = useCallback((analysis: ThreatAnalysis) => {
    dispatch({ type: 'SET_ANALYSIS', analysis });
  }, []);

  const dismissWarning = useCallback(() => {
    dispatch({ type: 'DISMISS' });
  }, []);

  // Subscribe to MessageListenerService (or the injected override) so that
  // every completed ThreatAnalysis is automatically pushed into context.
  useEffect(() => {
    const subscribe = subscribeToAnalysis ?? MessageListenerService.subscribe.bind(MessageListenerService);
    const unsubscribe = subscribe(setAnalysis);
    return unsubscribe;
  }, [subscribeToAnalysis, setAnalysis]);

  const value = useMemo<WarningContextValue>(
    () => ({
      ...state,
      setAnalysis,
      dismissWarning,
    }),
    [state, setAnalysis, dismissWarning],
  );

  return (
    <WarningContext.Provider value={value}>{children}</WarningContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Convenience hook for consuming WarningContext.
 *
 * Must be used inside a <WarningProvider>.
 */
export function useWarning(): WarningContextValue {
  return useContext(WarningContext);
}

export default WarningContext;
