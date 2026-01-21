#!/bin/bash

# Script to update GEMINI_API_KEY in .env file

NEW_KEY="AIzaSyC_Xm3TNCSDPQ6FawlG5Sz040sg_e8t128"
ENV_FILE=".env"

echo "🔑 Updating GEMINI_API_KEY in .env file..."

if [ ! -f "$ENV_FILE" ]; then
    echo "Creating .env file..."
    touch "$ENV_FILE"
fi

# Check if GEMINI_API_KEY already exists
if grep -q "^GEMINI_API_KEY=" "$ENV_FILE"; then
    # Update existing key
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=$NEW_KEY|" "$ENV_FILE"
    else
        # Linux
        sed -i "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=$NEW_KEY|" "$ENV_FILE"
    fi
    echo "✅ Updated existing GEMINI_API_KEY"
else
    # Add new key
    echo "" >> "$ENV_FILE"
    echo "GEMINI_API_KEY=$NEW_KEY" >> "$ENV_FILE"
    echo "✅ Added new GEMINI_API_KEY"
fi

echo "✅ Done! GEMINI_API_KEY is now set to: ${NEW_KEY:0:15}..."
echo ""
echo "⚠️  Don't forget to restart your backend server for changes to take effect!"
echo "   Run: npm run dev"
