# ScamGuardian — UI Mockup & Visual Guide

## Overview

ScamGuardian provides a clean, accessible interface designed for elderly and non-tech-savvy users. All text uses plain language (≤ Grade 6 reading level), large fonts (≥ 20sp for warnings), and high-contrast colors for visibility.

---

## 1. Full-Screen Warning (High Risk: riskScore ≥ 70)

```
┌─────────────────────────────────────────┐
│                                         │
│  ⚠️  THIS LOOKS DANGEROUS               │
│      DON'T TAP ANYTHING                 │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  We found signs this message might be   │
│  a scam:                                │
│                                         │
│  • Sender claims to be your bank        │
│  • Message asks you to act now          │
│  • Includes a suspicious link           │
│                                         │
│  Risk Score: 85/100 🔴                  │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ I'M NOT SURE — ASK MY FAMILY        ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ I KNOW THIS PERSON — IT'S SAFE      ││
│  └─────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

**Key Features:**
- Large red warning icon (⚠️)
- Primary heading in 24sp+ font
- Plain-language threat summary
- Risk score with color-coded badge (red for high risk)
- Two clear action buttons with high contrast
- Dismissible by tapping "I know this person"

---

## 2. Caution Banner (Medium Risk: 40 ≤ riskScore < 70)

```
┌─────────────────────────────────────────┐
│ ⚠️  CAUTION: This message has some      │
│    warning signs. Be careful.           │
│                                         │
│    Risk Score: 55/100 🟡  [Dismiss ✕]  │
└─────────────────────────────────────────┘

[Message content below banner]
```

**Key Features:**
- Inline overlay at top of message
- Yellow/orange warning icon (🟡)
- Concise caution text
- Dismiss button (✕)
- Non-blocking — user can still read message

---

## 3. Onboarding Wizard

### Step 1: Welcome

```
┌─────────────────────────────────────────┐
│                                         │
│         WELCOME TO SCAMGUARDIAN         │
│                                         │
│  We help protect you from scams.        │
│                                         │
│  ScamGuardian watches your messages     │
│  and alerts your family if something    │
│  looks dangerous.                       │
│                                         │
│  Your family can help you stay safe.    │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ NEXT                                ││
│  └─────────────────────────────────────┘│
│                                         │
│  Step 1 of 5                            │
│                                         │
└─────────────────────────────────────────┘
```

### Step 2: Guardian Contact

```
┌─────────────────────────────────────────┐
│                                         │
│    WHO IS YOUR FAMILY MEMBER?           │
│                                         │
│  Enter the phone number or email of     │
│  the family member who will help you.   │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ Phone or Email                      ││
│  │ ___________________________________  ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ NEXT                                ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ BACK                                ││
│  └─────────────────────────────────────┘│
│                                         │
│  Step 2 of 5                            │
│                                         │
└─────────────────────────────────────────┘
```

### Step 3: Permissions

```
┌─────────────────────────────────────────┐
│                                         │
│    GRANT PERMISSIONS                    │
│                                         │
│  ScamGuardian needs permission to:      │
│                                         │
│  ☐ Read notifications from your apps    │
│    (WhatsApp, SMS, Email)               │
│                                         │
│  ☐ Send you alerts                      │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ GRANT PERMISSIONS                  ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ BACK                                ││
│  └─────────────────────────────────────┘│
│                                         │
│  Step 3 of 5                            │
│                                         │
└─────────────────────────────────────────┘
```

### Step 4: Test Alert

```
┌─────────────────────────────────────────┐
│                                         │
│    TEST ALERT                           │
│                                         │
│  We're sending a test alert to your     │
│  family member to make sure everything  │
│  is working.                            │
│                                         │
│  ⏳ Sending test alert...               │
│                                         │
│  ✅ Test alert sent!                    │
│                                         │
│  Your family member should receive      │
│  a notification on their phone.         │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ NEXT                                ││
│  └─────────────────────────────────────┘│
│                                         │
│  Step 4 of 5                            │
│                                         │
└─────────────────────────────────────────┘
```

### Step 5: Done

```
┌─────────────────────────────────────────┐
│                                         │
│         YOU'RE ALL SET!                 │
│                                         │
│  ✅ ScamGuardian is now protecting you. │
│                                         │
│  Your family member will be notified    │
│  if we detect a suspicious message.     │
│                                         │
│  You can change settings anytime in     │
│  the Settings screen.                   │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ FINISH                              ││
│  └─────────────────────────────────────┘│
│                                         │
│  Step 5 of 5                            │
│                                         │
└─────────────────────────────────────────┘
```

---

## 4. Guardian Notification & Action Screen

### FCM Notification (on Guardian's phone)

```
┌─────────────────────────────────────────┐
│ 🔔 ScamGuardian Alert                   │
│                                         │
│ High-risk message from "Unknown"        │
│ Tap to review                           │
└─────────────────────────────────────────┘
```

### Guardian Action Screen (after tapping notification)

```
┌─────────────────────────────────────────┐
│                                         │
│    ALERT FROM SCAMGUARDIAN              │
│                                         │
│  From: Unknown Number                   │
│  Time: Today at 2:45 PM                 │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Risk Score: 85/100 🔴                  │
│                                         │
│  Threat Detected:                       │
│  • Sender claims to be your bank        │
│  • Urgent language ("act now")          │
│  • Suspicious link included             │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ✅ MARK AS SAFE                     ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ⛔ CONFIRM SCAM                     ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ 📞 CALL [User Name]                 ││
│  └─────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

**Key Features:**
- Sender identity and timestamp
- Risk score with color badge
- Plain-language threat summary
- Three action buttons:
  - ✅ Mark as Safe (removes warning from user's screen)
  - ⛔ Confirm Scam (logs incident)
  - 📞 Call User (direct phone call)

---

## 5. Guardian Settings Screen

```
┌─────────────────────────────────────────┐
│                                         │
│         GUARDIAN SETTINGS               │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  SAFE MODE                              │
│                                         │
│  When enabled, [User Name] must ask     │
│  you before opening any link.           │
│                                         │
│  ☑ Safe Mode Enabled                    │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  NOTIFICATIONS                          │
│                                         │
│  ☑ High-risk alerts (riskScore ≥ 70)   │
│  ☑ Reminder alerts (after 30 min)      │
│  ☑ Audit log cleanup notifications     │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ VIEW AUDIT LOG                      ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ SIGN OUT                            ││
│  └─────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

---

## 6. Audit Log Screen

```
┌─────────────────────────────────────────┐
│                                         │
│         AUDIT LOG                       │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ EXPORT AS PDF  |  EXPORT AS CSV     ││
│  └─────────────────────────────────────┘│
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  📅 Today at 2:45 PM                    │
│  From: Unknown Number                   │
│  Risk: 85/100 🔴                        │
│  Threat: Phishing URL, Urgency Language │
│  Outcome: Guardian marked safe ✅       │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  📅 Yesterday at 10:30 AM               │
│  From: +1 (555) 123-4567                │
│  Risk: 45/100 🟡                        │
│  Threat: Investment Scam                │
│  Outcome: User dismissed ✕              │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  📅 3 days ago at 5:15 PM               │
│  From: "Your Bank"                      │
│  Risk: 92/100 🔴                        │
│  Threat: Impersonation, Phishing URL    │
│  Outcome: Guardian confirmed scam ⛔    │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  [Scroll for more entries...]           │
│                                         │
└─────────────────────────────────────────┘
```

**Key Features:**
- Export buttons (PDF/CSV)
- Chronological list of flagged messages
- Each entry shows:
  - Date and time
  - Sender identity
  - Risk score with color badge
  - Detected threat types
  - Outcome (user action or guardian action)

---

## 7. Safe Mode Link Interception

### User attempts to open link (Safe Mode enabled)

```
┌─────────────────────────────────────────┐
│                                         │
│    WAITING FOR APPROVAL                 │
│                                         │
│  Your family member is reviewing this   │
│  link to make sure it's safe.           │
│                                         │
│  Link: https://suspicious-bank.com/... │
│                                         │
│  ⏳ Waiting...                          │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ CANCEL                              ││
│  └─────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

### Guardian approves link

```
┌─────────────────────────────────────────┐
│                                         │
│    ✅ LINK APPROVED                     │
│                                         │
│  Your family member approved this link. │
│  Opening now...                         │
│                                         │
│  [Browser opens link]                   │
│                                         │
└─────────────────────────────────────────┘
```

### Guardian rejects link

```
┌─────────────────────────────────────────┐
│                                         │
│    ⛔ LINK BLOCKED                      │
│                                         │
│  Your family member blocked this link   │
│  because it might not be safe.          │
│                                         │
│  If you think this is a mistake, ask    │
│  your family member.                    │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ OK                                  ││
│  └─────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

---

## 8. Color Scheme & Accessibility

### Risk Score Color Badges

| Risk Level | Color | Badge | Threshold |
|---|---|---|---|
| **High Risk** | 🔴 Red | 🔴 | riskScore ≥ 70 |
| **Medium Risk** | 🟡 Orange/Yellow | 🟡 | 40 ≤ riskScore < 70 |
| **Low Risk** | 🟢 Green | 🟢 | riskScore < 40 |

### Font Sizes

| Element | Size | Notes |
|---|---|---|
| Primary Heading | 24sp+ | "This looks dangerous" |
| Secondary Heading | 18sp | Section titles |
| Body Text | 16sp | Default |
| Small Text | 14sp | Timestamps, metadata |
| Large Font Mode | +4sp | Accessibility setting |

### High-Contrast Colors

- **Background:** White (#FFFFFF)
- **Text:** Dark Gray (#333333)
- **Buttons:** High-contrast (blue/red/green)
- **Warnings:** Red (#D32F2F) for danger
- **Caution:** Orange (#F57C00) for medium risk
- **Success:** Green (#388E3C) for safe/approved

---

## 9. User Journey: Message Receipt to Guardian Action

```
1. Message arrives in WhatsApp/SMS/Email
   ↓
2. Accessibility Service captures content
   ↓
3. ThreatAnalyzer scans (< 5 seconds)
   ↓
4. Risk Score computed
   ↓
5. IF riskScore ≥ 70:
   ├─ Full-Screen Warning displayed
   ├─ Audit log entry written
   └─ Alert sent to Guardian
   ↓
6. Guardian receives FCM notification
   ↓
7. Guardian taps notification
   ├─ GuardianActionScreen opens
   ├─ Shows threat summary & risk score
   └─ Displays three action buttons
   ↓
8. Guardian taps action:
   ├─ "Mark Safe" → Warning dismissed on user's phone
   ├─ "Confirm Scam" → Incident logged
   └─ "Call User" → Phone call initiated
   ↓
9. Audit log updated with outcome
```

---

## 10. Accessibility Features

✅ **Large Text Support**
- All text scales with system font size
- Minimum 20sp for warnings
- Large Font Mode toggle in settings

✅ **High Contrast**
- Dark text on light background
- Color-coded badges (red/yellow/green)
- Clear button labels

✅ **Plain Language**
- Grade 6 reading level
- No technical jargon
- Clear action labels

✅ **Touch Targets**
- Buttons minimum 48dp × 48dp
- Adequate spacing between interactive elements
- Large, easy-to-tap buttons

✅ **Screen Reader Support**
- All interactive elements labeled
- Semantic HTML structure
- Descriptive alt text for icons

---

## Summary

ScamGuardian's UI is designed for **accessibility and clarity**:

- **User-facing warnings** are large, clear, and use plain language
- **Guardian interface** provides quick decision-making with three action buttons
- **Audit log** gives a complete history of flagged messages and outcomes
- **Settings** allow customization of Safe Mode and notifications
- **Color coding** makes risk levels instantly recognizable
- **Large fonts** and high contrast support elderly users and those with vision impairments

All screens follow the principle: **Simple, clear, and safe.**
