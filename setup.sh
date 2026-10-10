#!/bin/bash

# Cima Discord Bot - Setup Script for Google Cloud VM
# This script installs all dependencies and sets up the bot

set -e

echo "======================================"
echo "  Cima Bot - Automated Setup"
echo "======================================"
echo ""

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x LTS
echo "📦 Installing Node.js 20.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
echo "📦 Installing Git..."
sudo apt install -y git

# Install PM2 globally
echo "📦 Installing PM2 (Process Manager)..."
sudo npm install -g pm2

# Clone repository
echo "📥 Cloning Cima repository..."
if [ -d "cima" ]; then
    echo "⚠️  'cima' directory already exists. Skipping clone."
else
    git clone https://github.com/diaaney/cima.git
fi

cd cima

# Install dependencies
echo "📦 Installing bot dependencies..."
npm install

# Create data directory
echo "📁 Creating data directory..."
mkdir -p data

# Create .env file
echo "⚙️  Creating .env file..."
if [ ! -f .env ]; then
    cat > .env << EOL
DISCORD_TOKEN=your_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_uabc_server_id
VERIFIED_ROLE_ID=your_verified_role_id
INSTITUTIONAL_EMAIL_DOMAIN=uabc.edu.mx
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL="Cima <verificacion@your-domain.com>"
EOL
    echo "✅ .env file created!"
    echo ""
    echo "⚠️  IMPORTANT: Edit the .env file with your actual Discord credentials:"
    echo "   nano .env"
    echo ""
else
    echo "⚠️  .env file already exists. Skipping creation."
fi

# Setup PM2 startup script
echo "⚙️  Configuring PM2 to start on system boot..."
pm2 startup systemd -u $USER --hp $HOME

echo ""
echo "======================================"
echo "  ✅ Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Edit your .env file with Discord credentials:"
echo "   nano ~/cima/.env"
echo ""
echo "2. Deploy slash commands:"
echo "   cd ~/cima && npm run deploy"
echo ""
echo "3. Start the bot:"
echo "   pm2 start ecosystem.config.js"
echo ""
echo "4. Save PM2 configuration:"
echo "   pm2 save"
echo ""
echo "Useful PM2 commands:"
echo "  pm2 status           - Check bot status"
echo "  pm2 logs cima        - View bot logs"
echo "  pm2 restart cima     - Restart the bot"
echo "  pm2 stop cima        - Stop the bot"
echo ""
