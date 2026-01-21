#!/bin/bash

# Quick verification script for OneChat setup

echo "🔍 OneChat Setup Verification"
echo "=================================="
echo ""

# Check DNS
echo "1️⃣  Checking DNS settings..."
DNS_SERVERS=$(networksetup -getdnsservers Wi-Fi 2>/dev/null | head -2)
if echo "$DNS_SERVERS" | grep -q "8.8.8.8"; then
    echo "   ✅ Google DNS configured (8.8.8.8)"
else
    echo "   ⚠️  Google DNS not configured. Run: sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4"
fi

# Check DNS resolution
echo ""
echo "2️⃣  Testing DNS resolution..."
if nslookup ai-agent-api.crypto.com >/dev/null 2>&1; then
    echo "   ✅ ai-agent-api.crypto.com resolves"
else
    echo "   ❌ ai-agent-api.crypto.com does not resolve"
fi

# Check backend .env
echo ""
echo "3️⃣  Checking backend configuration..."
if [ -f "backend/.env" ]; then
    if grep -q "CRYPTO_COM_DEVELOPER_PLATFORM_API_KEY" backend/.env; then
        echo "   ✅ Developer Platform API key found"
    else
        echo "   ⚠️  Developer Platform API key not found"
    fi
    
    if grep -q "GEMINI_API_KEY" backend/.env; then
        echo "   ✅ Gemini API key found"
    else
        echo "   ⚠️  Gemini API key not found"
    fi
else
    echo "   ❌ backend/.env file not found"
fi

# Check SDK packages
echo ""
echo "4️⃣  Checking SDK packages..."
if [ -d "backend/node_modules/@crypto.com/developer-platform-client" ]; then
    echo "   ✅ Developer Platform Client SDK installed"
else
    echo "   ❌ Developer Platform Platform Client SDK not installed"
fi

if [ -d "backend/node_modules/@crypto.com/ai-agent-client" ]; then
    echo "   ✅ AI Agent Client SDK installed"
else
    echo "   ⚠️  AI Agent Client SDK not installed (optional)"
fi

# Summary
echo ""
echo "=================================="
echo "✅ Verification complete!"
echo ""
echo "Next steps:"
echo "1. Start backend: cd backend && npm run dev"
echo "2. Start frontend: cd frontend && npm run dev"
echo "3. Test in chat interface"
echo ""
