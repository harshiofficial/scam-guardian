# Implementation Plan: ScamGuardian

## Overview

Implement ScamGuardian as a React Native mobile app with a Node.js/Express backend. Tasks are sequenced to build core detection and alerting infrastructure first, then layer in UI, onboarding, safe mode, and audit log. Each task builds on the previous and ends with all code wired together.

## Tasks

- [x] 1. Project scaffolding and core data types
  - Initialise React Native project (TypeScript template) with folder structure: `src/components`, `src/services`, `src/screens`, `src/models`, `src/utils`
  - Initialise Node.js/Express backend project in `backend/` with TypeScript
  - Define all shared TypeScript interfaces: `MessageEvent`, `Attachment`, `ThreatAnalysis`, `ThreatIndicator`, `AlertPayload`, `GuardianAction`, `UserProfile`, `AuditLogEntry`, `GuardianNotification`
  - Configure Firebase project, add `google-services.json` / `GoogleService-Info.plist`, install `@react-native-firebase/app` and `@react-native-firebase/messaging`
  - Install and configure `react-native-sqlite-storage`; create `AuditLogRepository` with `createTable()` migration
  - _Requirements: 1.1, 1.2, 7.1_

- [x] 2. Message Listener
  - [x] 2.1 Implement Android Accessibility Service
    - Create `ScamGuardianAccessibilityService.kt` that listens for notification events from WhatsApp, SMS, and email apps
    - Parse notification content into `MessageEvent` and emit to the React Native bridge via a NativeEventEmitter
    - _Requirements: 1.1_

  - [x] 2.2 Implement iOS Share Extension
    - Create Share Extension target that accepts text and URLs
    - Forward shared content to the main app via App Groups, emitting a `MessageEvent`
    - _Requirements: 1.1_

  - [x] 2.3 Wire Message Listener to Threat_Analyzer
    - Subscribe to `MessageEvent` emissions in `MessageListenerService.ts`; call `ThreatAnalyzerService.analyze()` on each event
    - Enforce the 5-second scan deadline using a `Promise.race` timeout guard
    - _Requirements: 1.1, 1.2_

- [x] 3. Threat Analyzer — URL checking
  - [x] 3.1 Implement URLChecker with local blocklist cache
    - Create `URLChecker.ts`; extract all URLs from message body using regex
    - Store blocklist as a SQLite table `url_blocklist`; seed with a sample list on first run
    - Return a `ThreatIndicator` of type `phishing_url` with confidence score for any match
    - _Requirements: 2.1_

  - [x] 3.2 Integrate Google Safe Browsing API fallback
    - On cache miss, call Safe Browsing Lookup API v4 (`POST /v4/threatMatches:find`)
    - Cache positive results locally; respect API rate limits with exponential back-off
    - _Requirements: 2.1_

  - [x] 3.3 Write unit tests for URLChecker
    - Test: known blocklisted URL returns `phishing_url` indicator
    - Test: clean URL returns no indicator
    - Test: cache miss triggers Safe Browsing call; cache hit skips it
    - _Requirements: 2.1_

- [x] 4. Threat Analyzer — text classification
  - [x] 4.1 Implement local regex TextClassifier
    - Create `TextClassifier.ts` with rule sets for urgency language, impersonation patterns, and investment/prize offers
    - Return an array of `ThreatIndicator` objects with `type`, `confidence`, and `evidence` snippet
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 4.2 Integrate remote NLP classifier fallback
    - When local rules return low-confidence results (confidence < 0.5), POST message body to NLP Scam Classifier API
    - Merge remote results with local indicators, deduplicating by type
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 4.3 Write unit tests for TextClassifier
    - Test: urgency phrases trigger `urgency_language` indicator
    - Test: bank/government impersonation triggers `impersonation` indicator
    - Test: investment offer triggers `investment_scam` indicator
    - Test: clean message returns empty indicator array
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 5. Threat Analyzer — attachment scanning and Risk_Score engine
  - [x] 5.1 Implement AttachmentScanner
    - Create `AttachmentScanner.ts`; check `Attachment.extension` against a hardcoded list of malicious extensions (`.exe`, `.apk`, `.zip`)
    - Return a `ThreatIndicator` of type `malicious_attachment` when matched
    - _Requirements: 2.5_

  - [x] 5.2 Implement Risk_Score Engine
    - Create `RiskScoreEngine.ts`; aggregate `urlScore`, `textScore`, `attachmentScore` using the weighted formula: `clamp(urlScore * 0.45 + textScore * 0.35 + attachmentScore * 0.20, 0, 100)`
    - Expose `computeScore(indicators: ThreatIndicator[]): number`
    - _Requirements: 1.2_

  - [x] 5.3 Write property tests for Risk_Score Engine
    - **Property 1: Score is always in [0, 100]** — for any combination of sub-scores the output is clamped to [0, 100]
    - **Property 2: Weight monotonicity** — increasing any sub-score never decreases the total Risk_Score
    - **Validates: Requirements 1.2**

  - [x] 5.4 Wire all sub-modules into ThreatAnalyzerService
    - Implement `ThreatAnalyzerService.analyze()`: run URLChecker, TextClassifier, AttachmentScanner in parallel; pass results to RiskScoreEngine; return `ThreatAnalysis`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Checkpoint — core detection pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Warning UI components
  - [x] 7.1 Implement FullScreenWarning component
    - Create `FullScreenWarning.tsx`; render primary heading "This looks dangerous — don't tap anything" at ≥ 20sp
    - Render two action buttons: "I'm not sure — ask my family" and "I know this person — it's safe"
    - Accept `ThreatAnalysis` prop; render plain-language threat summary (≤ Grade 6 reading level)
    - Apply high-contrast colour scheme; support `largeFontEnabled` prop
    - _Requirements: 1.3, 4.1, 4.2, 4.3, 4.5_

  - [x] 7.2 Implement CautionBanner component
    - Create `CautionBanner.tsx`; render inline overlay with plain-language caution text and a dismiss action
    - Accept `ThreatAnalysis` prop; display when riskScore is 40–69
    - _Requirements: 1.4, 4.1_

  - [x] 7.3 Wire Warning UI to Risk_Score output in MessageListenerService
    - After `ThreatAnalyzerService.analyze()` resolves, dispatch to global state (Context or Redux)
    - Render `FullScreenWarning` when riskScore ≥ 70; render `CautionBanner` when 40 ≤ riskScore < 70; pass through otherwise
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 7.4 Wire "ask my family" button to Alert_Service
    - When User taps "I'm not sure — ask my family" in `FullScreenWarning`, set `AlertPayload.userRequestedHelp = true` and call `AlertServiceClient.sendAlert()`
    - _Requirements: 4.4_

  - [x] 7.5 Write unit tests for Warning UI routing
    - Test: riskScore 70 → FullScreenWarning rendered
    - Test: riskScore 55 → CautionBanner rendered
    - Test: riskScore 30 → no warning rendered
    - _Requirements: 1.3, 1.4, 1.5_

- [x] 8. Alert_Service client and backend
  - [x] 8.1 Implement Alert_Service client (mobile)
    - Create `AlertServiceClient.ts`; implement `sendAlert(payload: AlertPayload): Promise<void>` that POSTs to `/alert`
    - Implement `onGuardianAction(callback)` that listens for FCM data messages and invokes callback with `GuardianAction`
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 8.2 Implement backend Alert API
    - Create Express routes `POST /alert`, `POST /guardian/action`, and `POST /alert/register` in `backend/src/routes/`
    - `POST /alert`: validate payload, look up Guardian FCM token from Firestore, dispatch FCM push via Firebase Admin SDK
    - `POST /guardian/action`: validate action, push FCM data message back to User device
    - `POST /alert/register`: store or update the User's FCM token in Firestore, keyed by `userId`
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 8.3 Implement Guardian reminder job
    - In the backend, schedule a check every 5 minutes for unresponded alerts older than 30 minutes
    - Re-dispatch FCM reminder notification to Guardian for each unresponded alert
    - _Requirements: 3.5_

  - [x] 8.4 Handle Guardian "mark safe" response on mobile
    - When `GuardianAction.action === 'mark_safe'` is received, dismiss `FullScreenWarning` within 5 seconds
    - Update the corresponding audit log entry outcome to `guardian_safe`
    - _Requirements: 3.4_

  - [x] 8.5 Write integration tests for Alert API
    - Test: `POST /alert` with valid payload dispatches FCM and returns 200
    - Test: `POST /guardian/action` with `mark_safe` pushes update to user device
    - Test: reminder job fires for alerts unanswered after 30 minutes
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 9. Checkpoint — alerting pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Guardian-facing interface
  - [x] 10.1 Implement Guardian notification action screen
    - Create `GuardianActionScreen.tsx` that deep-links from the FCM notification
    - Display sender identity, plain-language threat summary, Risk_Score, and timestamp from `GuardianNotification`
    - Render three action buttons: "Mark as safe", "Confirm scam", and "Call [User name]"
    - On button tap, POST `GuardianAction` to `POST /guardian/action`
    - _Requirements: 3.2, 3.3_

  - [x] 10.2 Implement Guardian settings screen with Safe Mode toggle
    - Create `GuardianSettingsScreen.tsx` with a toggle control for Safe_Mode
    - On toggle, POST a `toggle_safe_mode` action to `POST /guardian/action`; backend updates `UserProfile.safeModeEnabled` in Firestore and pushes the new value to the User device
    - _Requirements: 6.5_

  - [x] 10.3 Write unit tests for Guardian action screen
    - Test: tapping "Mark as safe" dispatches `mark_safe` action
    - Test: tapping "Confirm scam" dispatches `confirm_scam` action
    - Test: Safe Mode toggle dispatches `toggle_safe_mode` action
    - _Requirements: 3.3, 6.5_

- [x] 11. Local Audit Log
  - [x] 11.1 Implement AuditLogRepository
    - Create `AuditLogRepository.ts` with methods: `insert(entry: AuditLogEntry)`, `findAll()`, `deleteOldestUntilBelow(targetBytes: number)`, `getTotalSizeBytes()`
    - Write audit log entries for all messages with riskScore ≥ 40 after `ThreatAnalyzerService.analyze()` resolves
    - _Requirements: 7.1_

  - [x] 11.2 Implement retention and storage cap enforcement
    - On app foreground, query entries older than 90 days and delete them
    - On app foreground, call `getTotalSizeBytes()`; if > 500 MB, call `deleteOldestUntilBelow(400 MB)`
    - After storage cap deletion, send a local notification to the Guardian informing them of the cleanup
    - _Requirements: 7.2, 7.5_

  - [x] 11.3 Implement Audit Log screen
    - Create `AuditLogScreen.tsx`; fetch entries from `AuditLogRepository.findAll()` and render a list
    - Each row displays: date/time, sender, Risk_Score, detected threat type, outcome
    - _Requirements: 7.3_

  - [x] 11.4 Implement audit log export (PDF and CSV)
    - Add export button to `AuditLogScreen`; generate CSV using string serialisation and PDF using `react-native-pdf-lib` or equivalent
    - Share file via the native share sheet
    - _Requirements: 7.4_

  - [x] 11.5 Write unit tests for AuditLogRepository
    - Test: insert and findAll round-trip preserves all fields
    - Test: deleteOldestUntilBelow removes correct entries and stops when target is reached
    - Test: entries with riskScore < 40 are not inserted
    - _Requirements: 7.1, 7.2, 7.5_

- [x] 12. Onboarding Flow
  - [x] 12.1 Implement OnboardingWizard screen
    - Create `OnboardingWizard.tsx` with 5 steps: Welcome, Guardian Contact, Permissions, Test Alert, Done
    - Persist progress in `UserProfile.onboardingComplete` via SQLite
    - _Requirements: 5.1_

  - [x] 12.2 Implement Permissions step with plain-language prompts
    - Request Accessibility Service permission (Android) and Notification Access with plain-language explanation for each
    - If a permission is denied, display explanation and a deep-link button to device Settings
    - _Requirements: 5.2, 5.5_

  - [x] 12.3 Implement Guardian Contact step
    - Allow Guardian to enter phone number or email; validate format; store in `UserProfile.guardianContact`
    - This step must be completable without the User present (Guardian-driven)
    - _Requirements: 5.3_

  - [x] 12.4 Implement Test Alert step
    - On completion of Guardian Contact step, call `AlertServiceClient.sendAlert()` with a synthetic test payload
    - Display success confirmation when the backend acknowledges the test alert
    - _Requirements: 5.4_

- [x] 13. Firebase Auth integration
  - Implement phone-number sign-in flow using `@react-native-firebase/auth`
  - On sign-in, store `userId` and `fcmToken` in `UserProfile`; register FCM token with backend via `POST /alert/register`
  - _Requirements: 5.1, 5.3_

- [x] 14. Safe Mode
  - [x] 14.1 Implement link interception in Safe Mode
    - Create `SafeModeInterceptor.ts`; override the default link-open handler when `UserProfile.safeModeEnabled === true`
    - Display "Waiting for your family to approve this link" message and call `AlertServiceClient.sendAlert()` with link details
    - _Requirements: 6.1, 6.2_

  - [x] 14.2 Handle Guardian link approval and rejection
    - When `GuardianAction.action === 'mark_safe'` is received for a Safe Mode link, open the link in the device browser within 5 seconds
    - When `GuardianAction.action === 'confirm_scam'`, dismiss the waiting screen and display a plain-language blocked message
    - _Requirements: 6.3, 6.4_

  - [x] 14.3 Write unit tests for SafeModeInterceptor
    - Test: link open with safeModeEnabled=true is intercepted and alert is sent
    - Test: link open with safeModeEnabled=false passes through unmodified
    - Test: approval action opens link; rejection action shows blocked message
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 15. Final checkpoint — full integration
  - Wire all services together: MessageListener → ThreatAnalyzer → RiskScoreEngine → WarningUI + AlertServiceClient + AuditLog
  - Verify Safe Mode interceptor, Onboarding wizard, Guardian action callbacks, and Guardian settings screen are all connected
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints at tasks 6, 9, and 15 ensure incremental validation
- Property tests (task 5.3) validate universal correctness properties of the Risk_Score Engine
- Unit tests validate specific examples and edge cases for each component
