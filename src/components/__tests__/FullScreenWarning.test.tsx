/**
 * Unit tests for FullScreenWarning component
 *
 * Requirements: 1.3, 4.1, 4.2, 4.3, 4.5
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FullScreenWarning from '../FullScreenWarning';
import type { ThreatAnalysis } from '../../models/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makeThreatAnalysis = (
  overrides: Partial<ThreatAnalysis> = {},
): ThreatAnalysis => ({
  messageId: 'msg-001',
  riskScore: 85,
  indicators: [],
  analyzedAt: new Date('2024-01-01T12:00:00Z'),
  ...overrides,
});

const defaultProps = {
  threatAnalysis: makeThreatAnalysis(),
  onAskFamily: jest.fn(),
  onMarkSafe: jest.fn(),
};

// ---------------------------------------------------------------------------
// Heading (Requirement 4.2)
// ---------------------------------------------------------------------------

describe('FullScreenWarning — heading', () => {
  it('renders the primary heading text', () => {
    const { getByText } = render(<FullScreenWarning {...defaultProps} />);
    expect(
      getByText("This looks dangerous — don't tap anything"),
    ).toBeTruthy();
  });

  it('renders heading at ≥ 20sp in normal mode', () => {
    const { getByText } = render(<FullScreenWarning {...defaultProps} />);
    const heading = getByText("This looks dangerous — don't tap anything");
    const style = heading.props.style;
    // style is an array: [baseStyle, { fontSize }]
    const fontSize = Array.isArray(style)
      ? style.find((s: Record<string, unknown>) => s && s.fontSize !== undefined)?.fontSize
      : style?.fontSize;
    expect(fontSize).toBeGreaterThanOrEqual(20);
  });

  it('renders heading at 28sp when largeFontEnabled is true', () => {
    const { getByText } = render(
      <FullScreenWarning {...defaultProps} largeFontEnabled />,
    );
    const heading = getByText("This looks dangerous — don't tap anything");
    const style = heading.props.style;
    const fontSize = Array.isArray(style)
      ? style.find((s: Record<string, unknown>) => s && s.fontSize !== undefined)?.fontSize
      : style?.fontSize;
    expect(fontSize).toBe(28);
  });

  it('renders heading at 22sp in normal mode (no largeFontEnabled)', () => {
    const { getByText } = render(<FullScreenWarning {...defaultProps} />);
    const heading = getByText("This looks dangerous — don't tap anything");
    const style = heading.props.style;
    const fontSize = Array.isArray(style)
      ? style.find((s: Record<string, unknown>) => s && s.fontSize !== undefined)?.fontSize
      : style?.fontSize;
    expect(fontSize).toBe(22);
  });
});

// ---------------------------------------------------------------------------
// Action buttons (Requirement 4.3)
// ---------------------------------------------------------------------------

describe('FullScreenWarning — action buttons', () => {
  it('renders the "ask family" button', () => {
    const { getByText } = render(<FullScreenWarning {...defaultProps} />);
    expect(getByText("I'm not sure — ask my family")).toBeTruthy();
  });

  it('renders the "mark safe" button', () => {
    const { getByText } = render(<FullScreenWarning {...defaultProps} />);
    expect(getByText("I know this person — it's safe")).toBeTruthy();
  });

  it('calls onAskFamily when "ask family" button is pressed', () => {
    const onAskFamily = jest.fn();
    const { getByText } = render(
      <FullScreenWarning {...defaultProps} onAskFamily={onAskFamily} />,
    );
    fireEvent.press(getByText("I'm not sure — ask my family"));
    expect(onAskFamily).toHaveBeenCalledTimes(1);
  });

  it('calls onMarkSafe when "mark safe" button is pressed', () => {
    const onMarkSafe = jest.fn();
    const { getByText } = render(
      <FullScreenWarning {...defaultProps} onMarkSafe={onMarkSafe} />,
    );
    fireEvent.press(getByText("I know this person — it's safe"));
    expect(onMarkSafe).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Threat summary (Requirement 4.1)
// ---------------------------------------------------------------------------

describe('FullScreenWarning — plain-language threat summary', () => {
  it('shows default message when there are no indicators', () => {
    const { getByText } = render(
      <FullScreenWarning
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({ indicators: [] })}
      />,
    );
    expect(getByText('This message looks suspicious. Be careful.')).toBeTruthy();
  });

  it('shows phishing_url message for phishing_url indicator', () => {
    const { getByText } = render(
      <FullScreenWarning
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            { type: 'phishing_url', confidence: 0.9, evidence: 'http://evil.com' },
          ],
        })}
      />,
    );
    expect(
      getByText(
        'This message contains a dangerous link that could steal your information.',
      ),
    ).toBeTruthy();
  });

  it('shows urgency_language message for urgency_language indicator', () => {
    const { getByText } = render(
      <FullScreenWarning
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            { type: 'urgency_language', confidence: 0.8, evidence: 'act now' },
          ],
        })}
      />,
    );
    expect(
      getByText('This message is trying to rush you into doing something.'),
    ).toBeTruthy();
  });

  it('shows impersonation message for impersonation indicator', () => {
    const { getByText } = render(
      <FullScreenWarning
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            {
              type: 'impersonation',
              confidence: 0.85,
              evidence: 'your bank',
            },
          ],
        })}
      />,
    );
    expect(
      getByText(
        'Someone may be pretending to be your bank, the government, or a family member.',
      ),
    ).toBeTruthy();
  });

  it('shows investment_scam message for investment_scam indicator', () => {
    const { getByText } = render(
      <FullScreenWarning
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            {
              type: 'investment_scam',
              confidence: 0.75,
              evidence: 'guaranteed returns',
            },
          ],
        })}
      />,
    );
    expect(
      getByText(
        'This message is offering something that sounds too good to be true.',
      ),
    ).toBeTruthy();
  });

  it('shows malicious_attachment message for malicious_attachment indicator', () => {
    const { getByText } = render(
      <FullScreenWarning
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            {
              type: 'malicious_attachment',
              confidence: 0.95,
              evidence: 'file.exe',
            },
          ],
        })}
      />,
    );
    expect(
      getByText('This message has a dangerous file attached.'),
    ).toBeTruthy();
  });

  it('shows phishing_url message when multiple indicators present (highest severity wins)', () => {
    const { getByText } = render(
      <FullScreenWarning
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            { type: 'urgency_language', confidence: 0.8, evidence: 'act now' },
            {
              type: 'phishing_url',
              confidence: 0.9,
              evidence: 'http://evil.com',
            },
            {
              type: 'investment_scam',
              confidence: 0.7,
              evidence: 'guaranteed returns',
            },
          ],
        })}
      />,
    );
    expect(
      getByText(
        'This message contains a dangerous link that could steal your information.',
      ),
    ).toBeTruthy();
  });

  it('shows malicious_attachment over impersonation when both present', () => {
    const { getByText } = render(
      <FullScreenWarning
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({
          indicators: [
            {
              type: 'impersonation',
              confidence: 0.85,
              evidence: 'your bank',
            },
            {
              type: 'malicious_attachment',
              confidence: 0.9,
              evidence: 'file.apk',
            },
          ],
        })}
      />,
    );
    expect(
      getByText('This message has a dangerous file attached.'),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Large font mode (Requirement 4.5)
// ---------------------------------------------------------------------------

describe('FullScreenWarning — largeFontEnabled prop', () => {
  it('uses 16sp body text in normal mode', () => {
    const { getByText } = render(
      <FullScreenWarning
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({ indicators: [] })}
      />,
    );
    const summary = getByText('This message looks suspicious. Be careful.');
    const style = summary.props.style;
    const fontSize = Array.isArray(style)
      ? style.find((s: Record<string, unknown>) => s && s.fontSize !== undefined)?.fontSize
      : style?.fontSize;
    expect(fontSize).toBe(16);
  });

  it('uses 20sp body text when largeFontEnabled is true', () => {
    const { getByText } = render(
      <FullScreenWarning
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({ indicators: [] })}
        largeFontEnabled
      />,
    );
    const summary = getByText('This message looks suspicious. Be careful.');
    const style = summary.props.style;
    const fontSize = Array.isArray(style)
      ? style.find((s: Record<string, unknown>) => s && s.fontSize !== undefined)?.fontSize
      : style?.fontSize;
    expect(fontSize).toBe(20);
  });

  it('uses 18sp button text in normal mode', () => {
    const { getByText } = render(<FullScreenWarning {...defaultProps} />);
    const button = getByText("I'm not sure — ask my family");
    const style = button.props.style;
    const fontSize = Array.isArray(style)
      ? style.find((s: Record<string, unknown>) => s && s.fontSize !== undefined)?.fontSize
      : style?.fontSize;
    expect(fontSize).toBe(18);
  });

  it('uses 22sp button text when largeFontEnabled is true', () => {
    const { getByText } = render(
      <FullScreenWarning {...defaultProps} largeFontEnabled />,
    );
    const button = getByText("I'm not sure — ask my family");
    const style = button.props.style;
    const fontSize = Array.isArray(style)
      ? style.find((s: Record<string, unknown>) => s && s.fontSize !== undefined)?.fontSize
      : style?.fontSize;
    expect(fontSize).toBe(22);
  });
});

// ---------------------------------------------------------------------------
// High-contrast colour scheme
// ---------------------------------------------------------------------------

describe('FullScreenWarning — high-contrast colour scheme', () => {
  it('renders heading text in white (#FFFFFF)', () => {
    const { getByText } = render(<FullScreenWarning {...defaultProps} />);
    const heading = getByText("This looks dangerous — don't tap anything");
    // Base style (first element in array) contains color
    const style = heading.props.style;
    const baseStyle = Array.isArray(style) ? style[0] : style;
    expect(baseStyle?.color).toBe('#FFFFFF');
  });

  it('renders threat summary text in white (#FFFFFF)', () => {
    const { getByText } = render(
      <FullScreenWarning
        {...defaultProps}
        threatAnalysis={makeThreatAnalysis({ indicators: [] })}
      />,
    );
    const summary = getByText('This message looks suspicious. Be careful.');
    const style = summary.props.style;
    const baseStyle = Array.isArray(style) ? style[0] : style;
    expect(baseStyle?.color).toBe('#FFFFFF');
  });
});
