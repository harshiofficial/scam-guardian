# ScamGuardian Deployment Guide

## Overview

ScamGuardian consists of three components:
1. **React Native Mobile App** (Android & iOS)
2. **Node.js/Express Backend** (Alert API & FCM dispatcher)
3. **Firebase Services** (Authentication, Cloud Messaging, Firestore)

This guide covers deployment options for each component.

---

## Prerequisites

- Node.js 18+ and npm
- Git
- Firebase project with credentials
- Mobile development environment (Android SDK for Android, Xcode for iOS)

---

## Part 1: Backend Deployment

### Option A: Google Cloud Run (Recommended)

**Advantages:**
- Serverless (pay per request)
- Auto-scaling
- Native Firebase integration
- Free tier available

**Steps:**

1. **Install Google Cloud CLI:**
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Windows
   choco install google-cloud-sdk
   
   # Linux
   curl https://sdk.cloud.google.com | bash
   ```

2. **Authenticate:**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Create Dockerfile:**
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY backend/package*.json ./
   RUN npm ci --only=production
   COPY backend/dist ./dist
   EXPOSE 3000
   CMD ["node", "dist/index.js"]
   ```

4. **Build and deploy:**
   ```bash
   gcloud run deploy scam-guardian-backend \
     --source backend \
     --runtime nodejs20 \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
   ```

5. **Get the service URL:**
   ```bash
   gcloud run services describe scam-guardian-backend --region us-central1
   ```

### Option B: AWS Lambda + API Gateway

**Advantages:**
- Serverless
- Pay per invocation
- Good for variable traffic

**Steps:**

1. **Install AWS CLI:**
   ```bash
   pip install awscli
   aws configure
   ```

2. **Create Lambda function:**
   ```bash
   cd backend
   npm run build
   zip -r lambda-deployment.zip dist/ node_modules/ package.json
   
   aws lambda create-function \
     --function-name scam-guardian-backend \
     --runtime nodejs20.x \
     --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-role \
     --handler dist/index.handler \
     --zip-file fileb://lambda-deployment.zip
   ```

3. **Create API Gateway:**
   ```bash
   aws apigateway create-rest-api \
     --name scam-guardian-api \
     --description "ScamGuardian Alert API"
   ```

### Option C: Heroku

**Advantages:**
- Simple deployment
- Built-in CI/CD
- Good for small projects

**Steps:**

1. **Install Heroku CLI:**
   ```bash
   npm install -g heroku
   heroku login
   ```

2. **Create Procfile:**
   ```
   web: node dist/index.js
   ```

3. **Deploy:**
   ```bash
   heroku create scam-guardian-backend
   git push heroku main
   heroku logs --tail
   ```

### Option D: Docker Container

**Advantages:**
- Portable
- Works anywhere
- Easy local testing

**Steps:**

1. **Build Docker image:**
   ```bash
   docker build -f Dockerfile -t scam-guardian-backend:latest .
   ```

2. **Run locally:**
   ```bash
   docker run -p 3000:3000 \
     -e FIREBASE_PROJECT_ID=YOUR_PROJECT_ID \
     scam-guardian-backend:latest
   ```

3. **Push to Docker Hub:**
   ```bash
   docker tag scam-guardian-backend:latest YOUR_DOCKER_USERNAME/scam-guardian-backend:latest
   docker push YOUR_DOCKER_USERNAME/scam-guardian-backend:latest
   ```

4. **Deploy to Kubernetes, Docker Swarm, or any container platform**

---

## Part 2: Mobile App Deployment

### Android Deployment

**Prerequisites:**
- Android SDK
- Keystore file for signing
- Google Play Developer account

**Steps:**

1. **Build release APK:**
   ```bash
   npm run android -- --variant=release
   ```

2. **Sign APK:**
   ```bash
   jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
     -keystore my-release-key.keystore \
     app-release-unsigned.apk alias_name
   ```

3. **Align APK:**
   ```bash
   zipalign -v 4 app-release-unsigned.apk app-release.apk
   ```

4. **Upload to Google Play Console:**
   - Go to https://play.google.com/console
   - Create new app
   - Upload APK
   - Fill in store listing
   - Submit for review

### iOS Deployment

**Prerequisites:**
- macOS with Xcode
- Apple Developer account
- Provisioning profiles

**Steps:**

1. **Build release:**
   ```bash
   npm run ios -- --configuration Release
   ```

2. **Archive app:**
   ```bash
   xcodebuild -workspace ios/ScamGuardian.xcworkspace \
     -scheme ScamGuardian \
     -configuration Release \
     -archivePath build/ScamGuardian.xcarchive \
     archive
   ```

3. **Export IPA:**
   ```bash
   xcodebuild -exportArchive \
     -archivePath build/ScamGuardian.xcarchive \
     -exportOptionsPlist ExportOptions.plist \
     -exportPath build/
   ```

4. **Upload to App Store:**
   - Use Xcode Organizer or Transporter
   - Fill in app information
   - Submit for review

---

## Part 3: Firebase Configuration

### Setup Firebase Project

1. **Create Firebase project:**
   - Go to https://console.firebase.google.com
   - Click "Create Project"
   - Enable Google Analytics (optional)

2. **Enable required services:**
   - ✅ Authentication (Phone Number)
   - ✅ Cloud Messaging (FCM)
   - ✅ Firestore Database
   - ✅ Cloud Storage (for audit log exports)

3. **Download service account key:**
   - Go to Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save as `firebase-key.json`

4. **Configure environment variables:**
   ```bash
   export FIREBASE_PROJECT_ID=your-project-id
   export FIREBASE_PRIVATE_KEY_ID=your-key-id
   export FIREBASE_PRIVATE_KEY=your-private-key
   export FIREBASE_CLIENT_EMAIL=your-service-account@...
   export FIREBASE_CLIENT_ID=your-client-id
   export FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
   export FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
   ```

5. **Initialize Firestore:**
   ```bash
   # Create collections:
   # - users (UserProfile documents)
   # - alerts (GuardianNotification documents)
   # - audit_logs (AuditLogEntry documents)
   ```

---

## Part 4: Environment Variables

### Backend (.env)

```env
# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-key-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-service-account@...
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

# Server
PORT=3000
NODE_ENV=production

# External APIs
SAFE_BROWSING_API_KEY=your-api-key
NLP_CLASSIFIER_API_URL=https://your-nlp-api.com
NLP_CLASSIFIER_API_KEY=your-api-key
```

### Mobile (app.json)

```json
{
  "expo": {
    "name": "ScamGuardian",
    "slug": "scam-guardian",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTabletMode": true,
      "bundleIdentifier": "com.scamguardian.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.scamguardian.app"
    },
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      "@react-native-firebase/auth"
    ]
  }
}
```

---

## Part 5: CI/CD Pipeline

### GitHub Actions (Automatic)

The `.github/workflows/deploy.yml` file automatically:

1. **On every push to main:**
   - Runs all tests
   - Builds backend
   - Builds mobile app
   - Runs security scans
   - Creates deployment artifacts

2. **View workflow status:**
   ```bash
   git push origin main
   # Go to GitHub → Actions tab to see pipeline
   ```

### Manual Deployment

```bash
# 1. Build backend
cd backend
npm run build

# 2. Deploy backend (choose one)
# Google Cloud Run:
gcloud run deploy scam-guardian-backend --source backend

# AWS Lambda:
aws lambda update-function-code --function-name scam-guardian-backend --zip-file fileb://lambda-deployment.zip

# Heroku:
git push heroku main

# 3. Build mobile (requires Android SDK/Xcode)
npm run android
npm run ios
```

---

## Part 6: Monitoring & Logging

### Backend Monitoring

```bash
# Google Cloud Run logs
gcloud run services describe scam-guardian-backend --region us-central1
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scam-guardian-backend" --limit 50

# AWS Lambda logs
aws logs tail /aws/lambda/scam-guardian-backend --follow

# Heroku logs
heroku logs --tail
```

### Firebase Monitoring

- **Cloud Messaging:** https://console.firebase.google.com/project/YOUR_PROJECT/messaging
- **Firestore:** https://console.firebase.google.com/project/YOUR_PROJECT/firestore
- **Authentication:** https://console.firebase.google.com/project/YOUR_PROJECT/authentication

---

## Part 7: Rollback & Versioning

### Backend Rollback

```bash
# Google Cloud Run
gcloud run deploy scam-guardian-backend --image gcr.io/YOUR_PROJECT/scam-guardian-backend:v1.0.0

# AWS Lambda
aws lambda update-function-code --function-name scam-guardian-backend --s3-bucket my-bucket --s3-key v1.0.0/lambda.zip

# Heroku
heroku releases
heroku rollback v123
```

### Mobile Rollback

- **Android:** Upload previous APK version to Google Play Console
- **iOS:** Submit previous IPA version to App Store

---

## Part 8: Security Checklist

- ✅ Environment variables stored securely (not in code)
- ✅ Firebase service account key protected
- ✅ API keys rotated regularly
- ✅ HTTPS enforced for all endpoints
- ✅ CORS configured properly
- ✅ Input validation on all endpoints
- ✅ Rate limiting enabled
- ✅ Secrets scanned before commit
- ✅ Dependencies audited for vulnerabilities
- ✅ Logs monitored for suspicious activity

---

## Part 9: Performance Optimization

### Backend

```bash
# Enable compression
npm install compression

# Add caching headers
npm install helmet

# Monitor performance
npm install newrelic
```

### Mobile

- Use React.memo for component optimization
- Lazy load screens
- Optimize bundle size
- Enable code splitting

---

## Support & Troubleshooting

### Common Issues

**Backend won't start:**
```bash
# Check Firebase credentials
echo $FIREBASE_PROJECT_ID

# Check port availability
lsof -i :3000

# Check logs
npm run dev 2>&1 | grep -i error
```

**Mobile app crashes:**
```bash
# Clear cache
npm start -- --reset-cache

# Rebuild
npm run android -- --clean
npm run ios -- --clean
```

**Firebase connection issues:**
```bash
# Verify credentials
firebase login
firebase projects:list

# Test connection
curl -X POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=YOUR_API_KEY
```

---

## Next Steps

1. Choose deployment platform (Google Cloud Run recommended)
2. Set up Firebase project
3. Configure environment variables
4. Deploy backend
5. Build and deploy mobile apps
6. Monitor logs and metrics
7. Set up alerts for errors

---

## Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Google Cloud Run](https://cloud.google.com/run/docs)
- [AWS Lambda](https://docs.aws.amazon.com/lambda/)
- [React Native Deployment](https://reactnative.dev/docs/signed-apk-android)
- [GitHub Actions](https://docs.github.com/en/actions)

