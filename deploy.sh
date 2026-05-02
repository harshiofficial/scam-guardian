#!/bin/bash

# ScamGuardian Deployment Script
# Supports: Google Cloud Run, AWS Lambda, Heroku, Docker

set -e

echo "🚀 ScamGuardian Deployment Script"
echo "=================================="
echo ""

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found. Please install Node.js 18+"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "❌ npm not found. Please install npm"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        echo "❌ Git not found. Please install Git"
        exit 1
    fi
    
    echo "✅ Prerequisites met"
    echo ""
}

# Build backend
build_backend() {
    echo "🔨 Building backend..."
    cd backend
    npm ci
    npm run build
    cd ..
    echo "✅ Backend built successfully"
    echo ""
}

# Build mobile
build_mobile() {
    echo "🔨 Building mobile app..."
    npm ci
    npm run test -- --run
    echo "✅ Mobile app built successfully"
    echo ""
}

# Deploy to Google Cloud Run
deploy_gcloud() {
    echo "☁️  Deploying to Google Cloud Run..."
    
    if ! command -v gcloud &> /dev/null; then
        echo "❌ Google Cloud CLI not found"
        echo "Install: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    read -p "Enter Google Cloud Project ID: " PROJECT_ID
    read -p "Enter region (default: us-central1): " REGION
    REGION=${REGION:-us-central1}
    
    gcloud config set project $PROJECT_ID
    
    echo "Building Docker image..."
    gcloud builds submit --tag gcr.io/$PROJECT_ID/scam-guardian-backend
    
    echo "Deploying to Cloud Run..."
    gcloud run deploy scam-guardian-backend \
        --image gcr.io/$PROJECT_ID/scam-guardian-backend \
        --region $REGION \
        --allow-unauthenticated \
        --memory 512Mi \
        --timeout 60s \
        --set-env-vars FIREBASE_PROJECT_ID=$PROJECT_ID
    
    echo "✅ Deployed to Google Cloud Run"
    gcloud run services describe scam-guardian-backend --region $REGION
    echo ""
}

# Deploy to AWS Lambda
deploy_aws() {
    echo "☁️  Deploying to AWS Lambda..."
    
    if ! command -v aws &> /dev/null; then
        echo "❌ AWS CLI not found"
        echo "Install: https://aws.amazon.com/cli/"
        exit 1
    fi
    
    read -p "Enter AWS function name (default: scam-guardian-backend): " FUNCTION_NAME
    FUNCTION_NAME=${FUNCTION_NAME:-scam-guardian-backend}
    
    read -p "Enter AWS region (default: us-east-1): " REGION
    REGION=${REGION:-us-east-1}
    
    echo "Creating deployment package..."
    cd backend
    zip -r ../lambda-deployment.zip dist/ node_modules/ package.json
    cd ..
    
    echo "Uploading to Lambda..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://lambda-deployment.zip \
        --region $REGION
    
    echo "✅ Deployed to AWS Lambda"
    aws lambda get-function --function-name $FUNCTION_NAME --region $REGION
    echo ""
}

# Deploy to Heroku
deploy_heroku() {
    echo "☁️  Deploying to Heroku..."
    
    if ! command -v heroku &> /dev/null; then
        echo "❌ Heroku CLI not found"
        echo "Install: https://devcenter.heroku.com/articles/heroku-cli"
        exit 1
    fi
    
    read -p "Enter Heroku app name: " APP_NAME
    
    echo "Creating Heroku app..."
    heroku create $APP_NAME || true
    
    echo "Deploying..."
    git push heroku main
    
    echo "✅ Deployed to Heroku"
    heroku logs --tail --app $APP_NAME
    echo ""
}

# Deploy Docker
deploy_docker() {
    echo "🐳 Building Docker image..."
    
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker not found"
        echo "Install: https://www.docker.com/products/docker-desktop"
        exit 1
    fi
    
    read -p "Enter Docker image name (default: scam-guardian-backend): " IMAGE_NAME
    IMAGE_NAME=${IMAGE_NAME:-scam-guardian-backend}
    
    read -p "Enter Docker image tag (default: latest): " TAG
    TAG=${TAG:-latest}
    
    docker build -f Dockerfile -t $IMAGE_NAME:$TAG .
    
    echo "✅ Docker image built: $IMAGE_NAME:$TAG"
    echo ""
    echo "To run locally:"
    echo "  docker run -p 3000:3000 $IMAGE_NAME:$TAG"
    echo ""
    echo "To push to Docker Hub:"
    echo "  docker tag $IMAGE_NAME:$TAG YOUR_USERNAME/$IMAGE_NAME:$TAG"
    echo "  docker push YOUR_USERNAME/$IMAGE_NAME:$TAG"
    echo ""
}

# Main menu
show_menu() {
    echo "Select deployment target:"
    echo "1) Google Cloud Run (Recommended)"
    echo "2) AWS Lambda"
    echo "3) Heroku"
    echo "4) Docker Container"
    echo "5) Exit"
    echo ""
    read -p "Enter choice (1-5): " choice
    
    case $choice in
        1)
            check_prerequisites
            build_backend
            deploy_gcloud
            ;;
        2)
            check_prerequisites
            build_backend
            deploy_aws
            ;;
        3)
            check_prerequisites
            build_backend
            deploy_heroku
            ;;
        4)
            check_prerequisites
            build_backend
            deploy_docker
            ;;
        5)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo "Invalid choice"
            show_menu
            ;;
    esac
}

# Run main menu
show_menu

echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure Firebase credentials"
echo "2. Deploy mobile apps to App Store/Play Store"
echo "3. Monitor logs and metrics"
echo "4. Set up alerts for errors"
echo ""
