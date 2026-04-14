#!/bin/bash

# BlockVault SSL Setup Helper
# This script automates the initial certificate generation using Certbot.

set -e

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null
then
    echo "❌ docker-compose could not be found. Please run ./setup_backend.sh first."
    exit 1
fi

echo "🛡️ BlockVault SSL Setup"
echo "-----------------------"

read -p "Enter your domain or subdomain (e.g., api.example.com): " domain
read -p "Enter your email address for Let's Encrypt: " email

if [ -z "$domain" ] || [ -z "$email" ]; then
    echo "❌ Domain and Email are required."
    exit 1
fi

echo "🚀 Requesting certificate for $domain..."

# Run Certbot to get the certificate
# Using the webroot plugin which uses the shared volume for the ACME challenge
docker-compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot \
    --email "$email" --agree-tos --no-eff-email \
    -d "$domain"

echo ""
echo "✅ SUCCESS: Certificate generated for $domain"
echo "--------------------------------------------------------"
echo "PRO-TIP: To enable HTTPS, follow these manual steps:"
echo "1. Edit deploy/oci/nginx.conf"
echo "2. Uncomment the 'SSL CONFIGURATION' block (lines 33+)."
echo "3. Replace ALL occurrences of 'yourdomain.com' with '$domain'."
echo "4. Reload Nginx to apply changes:"
echo "   docker-compose exec nginx nginx -s reload"
echo "--------------------------------------------------------"
echo "Once done, update your Vercel VITE_API_URL to: https://$domain"
