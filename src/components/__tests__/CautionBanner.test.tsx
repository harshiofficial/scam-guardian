/**
 * Unit tests for CautionBanner component
 *
 * Requirements: 1.4, 4.1
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CautionBanner from '../CautionBanner';
import type { ThreatAnalysis } from '../../models/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makeThreatAnalysis = (
  overrides: Partial<ThreatAnalysis> = {},
): ThreatAnalysis => ({
  messageId: 'msg-001',
  riskScore: 55,
  indicators: [],
  analyzedAt: new Date('2024-01-01T12:00:00Z'),
  ...overrides,
});

const defaultProps = {
  threatAnalysis: makeThreatAnalysis(),
  onDismiss: jest.fn(),
};

// ---------------------------------------------------------------------------
// Rendering (Requirement 1.4)
// ---------------------------------------------------------------------------

describe('CautionBanner — rendering', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<CautionBanner {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders the caution icon', () => {
    const { getByText } = render(<CautionBanner {...defaultProps} />);
    expect(getByText('⚠️')).toBeTruthy();
  });

  it('renders the dismiss button', () => {
    const { getByText } = render(<CautionBanner {...defaultProps} />);
    expect(getByText('✕')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Dismiss action
// ---------------------------------------------------------------------------

describe('CautionBanner — dismiss action', () => {
  it('calls onDismiss when dismiss button is pressed', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <CautionBanner {...defaultProps} onDismiss={onDismiss} />,
    );
    fireEvent.press(getByText('✕'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not call onDismiss before the button is pressed', () => {
    const onDismiss = jest.fn();
    render(<CautionBanner {...defaultProps} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Plain-language caution text (Requirement 4.1)
// ---------------------------------------------------------------------------

describe('CautionBanner — plain-language caution text', () => {
  it('shows default message when there are no indicators', () => {
    const { getByText } = render(
      <CautionBanner
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({ indicators: [] })}
      />,
    );
    expect(
      getByText('This message looks a little suspicious. Be careful.'),
    ).toBeTruthy();
  });

  it('shows phishing_url caution text for phishing_url indicator', () => {
    const { getByText } = render(
      <CautionBanner
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            { type: 'phishing_url', confidence: 0.6, evidence: 'http://suspicious.com' },
          ],
        })}
      />,
    );
    expect(
      getByText('Be careful — this message has a link that may not be safe.'),
    ).toBeTruthy();
  });

  it('shows urgency_language caution text for urgency_language indicator', () => {
    const { getByText } = render(
      <CautionBanner
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            { type: 'urgency_language', confidence: 0.55, evidence: 'act now' },
          ],
        })}
      />,
    );
    expect(
      getByText('This message seems to be in a hurry. Take your time.'),
    ).toBeTruthy();
  });

  it('shows impersonation caution text for impersonation indicator', () => {
    const { getByText } = render(
      <CautionBanner
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            { type: 'impersonation', confidence: 0.6, evidence: 'your bank' },
          ],
        })}
      />,
    );
    expect(
      getByText('Check who sent this — it may not be who you think.'),
    ).toBeTruthy();
  });

  it('shows investment_scam caution text for investment_scam indicator', () => {
    const { getByText } = render(
      <CautionBanner
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            {
              type: 'investment_scam',
              confidence: 0.5,
              evidence: 'guaranteed returns',
            },
          ],
        })}
      />,
    );
    expect(
      getByText('This offer may be too good to be true. Be careful.'),
    ).toBeTruthy();
  });

  it('shows malicious_attachment caution text for malicious_attachment indicator', () => {
    const { getByText } = render(
      <CautionBanner
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            {
              type: 'malicious_attachment',
              confidence: 0.65,
              evidence: 'file.apk',
            },
          ],
        })}
      />,
    );
    expect(
      getByText('The file in this message may not be safe to open.'),
    ).toBeTruthy();
  });

  it('shows phishing_url caution text when multiple indicators present (highest severity wins)', () => {
    const { getByText } = render(
      <CautionBanner
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            { type: 'urgency_language', confidence: 0.5, evidence: 'act now' },
            {
              type: 'phishing_url',
              confidence: 0.6,
              evidence: 'http://suspicious.com',
            },
            {
              type: 'investment_scam',
              confidence: 0.45,
              evidence: 'guaranteed returns',
            },
          ],
        })}
      />,
    );
    expect(
      getByText('Be careful — this message has a link that may not be safe.'),
    ).toBeTruthy();
  });

  it('shows malicious_attachment over impersonation when both present', () => {
    const { getByText } = render(
      <CautionBanner
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            { type: 'impersonation', confidence: 0.6, evidence: 'your bank' },
            {
              type: 'malicious_attachment',
              confidence: 0.65,
              evidence: 'file.apk',
            },
          ],
        })}
      />,
    );
    expect(
      getByText('The file in this message may not be safe to open.'),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Accessibility — font size (Requirement 4.1)
// ---------------------------------------------------------------------------

describe('CautionBanner — accessibility', () => {
  it('renders caution text at minimum 16sp', () => {
    const { getByText } = render(
      <CautionBanner
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({ indicators: [] })}
      />,
    );
    const text = getByText(
      'This message looks a little suspicious. Be careful.',
    );
    const style = text.props.style;
    const fontSize = Array.isArray(style)
      ? style.find(
          (s: Record<string, unknown>) => s && s.fontSize !== undefined,
        )?.fontSize
      : style?.fontSize;
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });
});

// ---------------------------------------------------------------------------
// Visual style — amber background, dark text
// ---------------------------------------------------------------------------

describe('CautionBanner — visual style', () => {
  it('renders caution text in dark colour for contrast', () => {
    const { getByText } = render(
      <CautionBanner
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({ indicators: [] })}
      />,
    );
    const text = getByText(
      'This message looks a little suspicious. Be careful.',
    );
    const style = text.props.style;
    const baseStyle = Array.isArray(style) ? style[0] : style;
    // Dark text (#1A1A1A) for contrast against amber background
    expect(baseStyle?.color).toBe('#1A1A1A');
  });
});
