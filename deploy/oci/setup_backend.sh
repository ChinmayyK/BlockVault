#!/bin/bash

# BlockVault OCI Backend Deployment Helper
# This script automates the setup of the backend infrastructure on an OCI VM.

set -e

echo "🚀 Starting BlockVault Backend Deployment..."

# 1. Update and Install Dependencies
echo "📦 Updating system and installing Docker..."
sudo apt-get update
sudo apt-get install -y docker.io docker-compose git

# 2. Add current user to docker group
echo "👤 Adding user to docker group..."
sudo usermod -aG docker $USER

# 3. Setup Project Directory
if [ ! -d "BlockVault" ]; then
    echo "📂 Cloning repository..."
    # Replace with your actual repo URL if different
    git clone https://github.com/CHINMAYKUDALKAR/BlockVault.git
    cd BlockVault/deploy/oci
else
    echo "🔄 Repository already exists. Pulling latest changes..."
    cd BlockVault
    git pull
    cd deploy/oci
fi

# 4. Environment Configuration
if [ ! -f ".env" ]; then
    echo "📝 Creating .env from template..."
    cp .env.oci.example .env
    echo "⚠️  Please edit deploy/oci/.env with your production secrets (JWT_SECRET, S3_KEYS, etc.)"
    echo "⚠️  Ensure CORS_ALLOWED_ORIGINS includes your Vercel URL."
fi

# 5. Firewall Setup
echo "🔥 Configuring local firewall (UFW)..."
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw --force enable

echo "✅ Local setup complete!"
echo "--------------------------------------------------------"
echo "NEXT STEPS:"
echo "1. Run: nano .env (Update your secrets and Vercel URL)"
echo "2. Run: docker-compose -f docker-compose.oci.yml up -d"
echo "3. Update Vercel Env Vars (VITE_API_URL, VITE_WS_URL)"
echo "--------------------------------------------------------"
