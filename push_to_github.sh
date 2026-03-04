#!/bin/bash

set -e

cd /Users/chinmaykudalkar/blockvault_final

echo "Initializing git repository..."
git init

echo "Adding remote repository..."
git remote add origin https://github.com/CHINMAYKUDALKAR/BlockVault.git || git remote set-url origin https://github.com/CHINMAYKUDALKAR/BlockVault.git

echo "Adding all files..."
git add .

echo "Committing files..."
git commit -m "Initial commit: Push blockvault_final to repository"

echo "Pushing to GitHub..."
git branch -M main
git push -u origin main --force

echo "✅ Successfully pushed to GitHub!"

