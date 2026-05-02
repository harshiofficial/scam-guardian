# Requirements Document

## Introduction

ScamGuardian is a real-time scam detection and family alert application designed to protect elderly and non-tech-savvy users from phishing and social engineering attacks. When a user receives a suspicious message or link (e.g., via WhatsApp, SMS, or email), the app analyzes the content, warns the user in plain language, and immediately notifies a designated family member or caregiver — all before the user takes any harmful action.

---

## Glossary

- **ScamGuardian**: The mobile application that provides real-time scam detection and family alerting.
- **User**: The primary, protected end-user — typically elderly or non-tech-savvy.
- **Guardian**: A designated family member or caregiver who receives alerts on behalf of the User.
- **Message**: Any text, link, or media content shared with the User via a supported channel (WhatsApp, SMS, email).
- **Threat_Analyzer**: The ScamGuardian component responsible for evaluating messages for scam indicators.
- **Alert_Service**: The ScamGuardian component responsible for sending notifications to the Guardian.
- **Risk_Score**: A numeric value from 0 to 100 representing the likelihood that a Message is a scam.
- **Safe_Mode**: An optional operating mode that blocks all outbound links until the Guardian approves them.
- **Onboarding_Flow**: The guided setup process that configures the User's Guardian contact and preferences.

---

## Requirements

### Requirement 1: Message Scanning

**User Story:** As an elderly user, I want the app to automatically scan messages I receive, so that I am warned before I interact with a scam.

#### Acceptance Criteria

1. WHEN a new Message arrives in a monitored channel, THE Threat_Analyzer SHALL scan the Message content within 5 seconds of receipt.
2. WHEN the Threat_Analyzer completes a scan, THE ScamGuardian SHALL assign a Risk_Score to the Message.
3. WHEN a Risk_Score is 70 or above, THE ScamGuardian SHALL display a full-screen warning to the User in plain, non-technical language before the User can interact with any link or attachment in the Message.
4. WHEN a Risk_Score is between 40 and 69, THE ScamGuardian SHALL display an inline caution banner on the Message.
5. WHEN a Risk_Score is below 40, THE ScamGuardian SHALL allow the Message to be displayed without interruption.

---

### Requirement 2: Scam Indicator Detection

**User Story:** As an elderly user, I want the app to recognize common scam patterns, so that known attack types are reliably caught.

#### Acceptance Criteria

1. THE Threat_Analyzer SHALL detect phishing URLs by comparing links against a continuously updated blocklist.
2. THE Threat_Analyzer SHALL detect urgency-language patterns (e.g., "act now", "your account will be closed", "limited time") in Message text.
3. THE Threat_Analyzer SHALL detect impersonation patterns where a sender claims to be a bank, government agency, or family member requesting money.
4. THE Threat_Analyzer SHALL detect unsolicited investment or prize-winning offers in Message text.
5. WHEN a Message contains an attachment, THE Threat_Analyzer SHALL flag the attachment type if it matches known malicious file extensions (.exe, .apk, .zip containing executables).

---

### Requirement 3: Family Guardian Alerts

**User Story:** As a family member, I want to be notified immediately when my elderly relative receives a high-risk message, so that I can intervene before any harm is done.

#### Acceptance Criteria

1. WHEN a Risk_Score is 70 or above, THE Alert_Service SHALL send a push notification to the Guardian within 10 seconds of the Risk_Score being assigned.
2. THE Alert_Service SHALL include in the notification: the sender identity, a plain-language summary of the detected threat, the Risk_Score, and a timestamp.
3. WHEN the Guardian receives a notification, THE ScamGuardian SHALL provide the Guardian with options to mark the Message as safe, confirm it as a scam, or call the User directly from within the app.
4. WHEN the Guardian marks a Message as safe, THE ScamGuardian SHALL remove the warning from the User's screen within 5 seconds.
5. IF the Guardian does not respond to a notification within 30 minutes, THEN THE Alert_Service SHALL send a follow-up reminder notification to the Guardian.

---

### Requirement 4: Plain-Language User Warnings

**User Story:** As an elderly user, I want warnings to be simple and clear, so that I understand the danger without needing technical knowledge.

#### Acceptance Criteria

1. THE ScamGuardian SHALL display all User-facing warnings using a reading level no higher than Grade 6 (Flesch-Kincaid).
2. WHEN a high-risk warning is displayed, THE ScamGuardian SHALL include a large, clearly labeled "This looks dangerous — don't tap anything" message as the primary heading.
3. WHEN a high-risk warning is displayed, THE ScamGuardian SHALL provide two clearly labeled action buttons: "I'm not sure — ask my family" and "I know this person — it's safe".
4. WHEN the User selects "I'm not sure — ask my family", THE Alert_Service SHALL immediately send an alert to the Guardian with the User's explicit request for help.
5. THE ScamGuardian SHALL support a large-text display mode where all warning text is rendered at a minimum font size of 20sp.

---

### Requirement 5: Guardian Onboarding and Setup

**User Story:** As a family member, I want to set up the app for my elderly relative easily, so that protection is active without requiring the User to configure anything technical.

#### Acceptance Criteria

1. THE Onboarding_Flow SHALL complete Guardian setup in 5 steps or fewer.
2. WHEN the Onboarding_Flow is initiated, THE ScamGuardian SHALL guide the User through granting the necessary permissions (notification access, accessibility service) with plain-language explanations for each permission.
3. THE Onboarding_Flow SHALL allow the Guardian to configure their contact details (phone number or email) without requiring the User to be present.
4. WHEN the Onboarding_Flow is complete, THE ScamGuardian SHALL send a test alert to the Guardian to confirm the connection is working.
5. IF a required permission is denied during Onboarding_Flow, THEN THE ScamGuardian SHALL explain in plain language why the permission is needed and provide a direct link to the device settings screen to grant it.

---

### Requirement 6: Safe Mode (Optional Feature)

**User Story:** As a family member, I want to enable a stricter protection mode, so that my relative cannot open any link without my approval.

#### Acceptance Criteria

1. WHERE Safe_Mode is enabled, THE ScamGuardian SHALL intercept all outbound link-open requests before the link is opened in a browser.
2. WHERE Safe_Mode is enabled, WHEN the User attempts to open a link, THE ScamGuardian SHALL display a "Waiting for your family to approve this link" message and notify the Guardian.
3. WHERE Safe_Mode is enabled, WHEN the Guardian approves a link, THE ScamGuardian SHALL open the link in the device browser within 5 seconds of approval.
4. WHERE Safe_Mode is enabled, WHEN the Guardian rejects a link, THE ScamGuardian SHALL display a plain-language explanation to the User that the link was blocked for their safety.
5. WHERE Safe_Mode is enabled, THE ScamGuardian SHALL allow the Guardian to toggle Safe_Mode off at any time from the Guardian's app interface.

---

### Requirement 7: Audit Log

**User Story:** As a family member, I want to review a history of flagged messages, so that I can identify patterns and report incidents if needed.

#### Acceptance Criteria

1. THE ScamGuardian SHALL maintain a local audit log of all Messages that received a Risk_Score of 40 or above.
2. THE audit log SHALL retain entries for a minimum of 90 days.
3. WHEN the Guardian views the audit log, THE ScamGuardian SHALL display for each entry: the date and time, the sender, the Risk_Score, the detected threat type, and the outcome (User action or Guardian action taken).
4. THE ScamGuardian SHALL allow the Guardian to export the audit log as a PDF or CSV file.
5. IF the audit log storage exceeds 500 MB on the device, THEN THE ScamGuardian SHALL automatically delete the oldest entries to bring storage below 400 MB and notify the Guardian of the deletion.
