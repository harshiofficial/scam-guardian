/**
 * Unit tests for WarningContext
 *
 * Verifies that:
 * - warningLevel is correctly derived from riskScore
 * - setAnalysis updates state and warningLevel
 * - dismissWarning clears state
 * - MessageListenerService subscription is wired up
 *
 * Requirements: 1.3, 1.4, 1.5
 */

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import {
  WarningProvider,
  useWarning,
  deriveWarningLevel,
} from '../../contexts/WarningContext';
import type { ThreatAnalysis } from '../../models/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeThreatAnalysis(riskScore: number): ThreatAnalysis {
  return {
    messageId: `msg-${riskScore}`,
    riskScore,
    indicators: [],
    analyzedAt: new Date('2024-06-01T12:00:00Z'),
  };
}

/** Renders the useWarning hook inside a WarningProvider. */
function renderWarningHook(
  subscribeToAnalysis?: (cb: (a: ThreatAnalysis) => void) => () => void,
) {
  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <WarningProvider subscribeToAnalysis={subscribeToAnalysis}>
      {children}
    </WarningProvider>
  );
  return renderHook(() => useWarning(), { wrapper });
}

// ---------------------------------------------------------------------------
// deriveWarningLevel — pure function
// ---------------------------------------------------------------------------

describe('deriveWarningLevel()', () => {
  it('returns "danger" for riskScore 70 (boundary)', () => {
    expect(deriveWarningLevel(70)).toBe('danger');
  });

  it('returns "danger" for riskScore 85', () => {
    expect(deriveWarningLevel(85)).toBe('danger');
  });

  it('returns "danger" for riskScore 100', () => {
    expect(deriveWarningLevel(100)).toBe('danger');
  });

  it('returns "caution" for riskScore 40 (lower boundary)', () => {
    expect(deriveWarningLevel(40)).toBe('caution');
  });

  it('returns "caution" for riskScore 55', () => {
    expect(deriveWarningLevel(55)).toBe('caution');
  });

  it('returns "caution" for riskScore 69 (upper boundary)', () => {
    expect(deriveWarningLevel(69)).toBe('caution');
  });

  it('returns "none" for riskScore 39 (just below caution)', () => {
    expect(deriveWarningLevel(39)).toBe('none');
  });

  it('returns "none" for riskScore 0', () => {
    expect(deriveWarningLevel(0)).toBe('none');
  });

  it('returns "none" for riskScore 30', () => {
    expect(deriveWarningLevel(30)).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// WarningContext — initial state
// ---------------------------------------------------------------------------

describe('WarningContext initial state', () => {
  it('starts with currentAnalysis null and warningLevel "none"', () => {
    const { result } = renderWarningHook(() => () => {});

    expect(result.current.currentAnalysis).toBeNull();
    expect(result.current.warningLevel).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// setAnalysis
// ---------------------------------------------------------------------------

describe('setAnalysis()', () => {
  it('sets currentAnalysis and derives warningLevel "danger" for riskScore 70', () => {
    const { result } = renderWarningHook(() => () => {});
    const analysis = makeThreatAnalysis(70);

    act(() => {
      result.current.setAnalysis(analysis);
    });

    expect(result.current.currentAnalysis).toBe(analysis);
    expect(result.current.warningLevel).toBe('danger');
  });

  it('sets warningLevel "caution" for riskScore 55', () => {
    const { result } = renderWarningHook(() => () => {});

    act(() => {
      result.current.setAnalysis(makeThreatAnalysis(55));
    });

    expect(result.current.warningLevel).toBe('caution');
  });

  it('sets warningLevel "none" for riskScore 30', () => {
    const { result } = renderWarningHook(() => () => {});

    act(() => {
      result.current.setAnalysis(makeThreatAnalysis(30));
    });

    expect(result.current.warningLevel).toBe('none');
  });

  it('updates warningLevel when called with a new analysis', () => {
    const { result } = renderWarningHook(() => () => {});

    act(() => {
      result.current.setAnalysis(makeThreatAnalysis(80));
    });
    expect(result.current.warningLevel).toBe('danger');

    act(() => {
      result.current.setAnalysis(makeThreatAnalysis(50));
    });
    expect(result.current.warningLevel).toBe('caution');
  });
});

// ---------------------------------------------------------------------------
// dismissWarning
// ---------------------------------------------------------------------------

describe('dismissWarning()', () => {
  it('clears currentAnalysis and resets warningLevel to "none"', () => {
    const { result } = renderWarningHook(() => () => {});

    act(() => {
      result.current.setAnalysis(makeThreatAnalysis(85));
    });
    expect(result.current.warningLevel).toBe('danger');

    act(() => {
      result.current.dismissWarning();
    });

    expect(result.current.currentAnalysis).toBeNull();
    expect(result.current.warningLevel).toBe('none');
  });

  it('is safe to call when no analysis is set', () => {
    const { result } = renderWarningHook(() => () => {});

    expect(() => {
      act(() => {
        result.current.dismissWarning();
      });
    }).not.toThrow();

    expect(result.current.currentAnalysis).toBeNull();
    expect(result.current.warningLevel).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// MessageListenerService subscription wiring
// ---------------------------------------------------------------------------

describe('MessageListenerService subscription', () => {
  it('calls setAnalysis when MessageListenerService dispatches an analysis', () => {
    let capturedCallback: ((a: ThreatAnalysis) => void) | null = null;

    const subscribeToAnalysis = (cb: (a: ThreatAnalysis) => void) => {
      capturedCallback = cb;
      return () => {};
    };

    const { result } = renderWarningHook(subscribeToAnalysis);

    expect(capturedCallback).not.toBeNull();

    const analysis = makeThreatAnalysis(75);
    act(() => {
      capturedCallback!(analysis);
    });

    expect(result.current.currentAnalysis).toBe(analysis);
    expect(result.current.warningLevel).toBe('danger');
  });

  it('calls the unsubscribe function on unmount', () => {
    const unsubscribe = jest.fn();
    const subscribeToAnalysis = (_cb: (a: ThreatAnalysis) => void) => unsubscribe;

    const { unmount } = renderWarningHook(subscribeToAnalysis);
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('updates warningLevel to "caution" when analysis with riskScore 55 is dispatched', () => {
    let capturedCallback: ((a: ThreatAnalysis) => void) | null = null;

    const subscribeToAnalysis = (cb: (a: ThreatAnalysis) => void) => {
      capturedCallback = cb;
      return () => {};
    };

    const { result } = renderWarningHook(subscribeToAnalysis);

    act(() => {
      capturedCallback!(makeThreatAnalysis(55));
    });

    expect(result.current.warningLevel).toBe('caution');
  });

  it('updates warningLevel to "none" when analysis with riskScore 30 is dispatched', () => {
    let capturedCallback: ((a: ThreatAnalysis) => void) | null = null;

    const subscribeToAnalysis = (cb: (a: ThreatAnalysis) => void) => {
      capturedCallback = cb;
      return () => {};
    };

    const { result } = renderWarningHook(subscribeToAnalysis);

    act(() => {
      capturedCallback!(makeThreatAnalysis(30));
    });

    expect(result.current.warningLevel).toBe('none');
  });
});
