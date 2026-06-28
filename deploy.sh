#!/bin/bash
# ==============================================================================
# Salesforce Data Migration Platform - Automated Production Deployment Script
# ==============================================================================
# This script automates system updates, swap space configuration, dependency
# installation, Prisma DB sync, Next.js build compilation, PM2 process management,
# and Nginx reverse proxy configuration.
# ==============================================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0;35m' # No Color
CLEAR='\033[0m'

# Default configurations
DOMAIN="datamigration.analytx4t.com"
PROJECT_DIR="/home/ubuntu/salesforce-migration"

# (Credentials and environment configurations are managed manually in backend/.env and frontend/.env)

echo -e "${BLUE}>>> starting Automated Salesforce Data Migration deployment...${CLEAR}"

# 1. Setup 4GB Swap Space to prevent Next.js build OOM crashes
echo -e "${YELLOW}>>> [1/7] Configuring 4GB Swap Space...${CLEAR}"
sudo swapoff /swapfile || true
sudo rm -f /swapfile

sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

if ! grep -q "/swapfile" /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
echo -e "${GREEN}4GB Swap space successfully enabled and activated.${CLEAR}"


# 2. Update System and Install Core Packages
echo -e "${YELLOW}>>> [2/7] Installing System Dependencies (Node.js 20, Python, Nginx, Certbot)...${CLEAR}"
sudo apt update -y

# Install NodeSource repository for Node.js 20 LTS
if ! command -v node &> /dev/null; then
    echo -e "${BLUE}Installing Node.js 20 LTS...${CLEAR}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo -e "${GREEN}Node.js is already installed ($(node -v)).${CLEAR}"
fi

# Install general dependencies
sudo apt install -y python3-pip python3-venv nginx certbot python3-certbot-nginx git build-essential

# Install PM2 globally if missing
if ! command -v pm2 &> /dev/null; then
    echo -e "${BLUE}Installing PM2 process manager...${CLEAR}"
    sudo npm install -g pm2
else
    echo -e "${GREEN}PM2 is already installed ($(pm2 -v)).${CLEAR}"
fi

# 3. Clean and Pull Latest Repository Code
echo -e "${YELLOW}>>> [3/7] Syncing Repository Code...${CLEAR}"
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${BLUE}Cloning repository to $PROJECT_DIR...${CLEAR}"
    git clone https://github.com/priyanshu442004/SalesForce.git "$PROJECT_DIR"
    cd "$PROJECT_DIR"
else
    echo -e "${BLUE}Repository folder found. Fetching latest main branch...${CLEAR}"
    cd "$PROJECT_DIR"
    git fetch --all
    git reset --hard origin/main
fi

# 4. Configure & Setup Backend (FastAPI)
echo -e "${YELLOW}>>> [4/7] Setting up Python Backend...${CLEAR}"
cd "$PROJECT_DIR/backend"

# Setup virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Ensure backend/.env exists and is configured before running PM2
if [ ! -f .env ]; then
    echo -e "${RED}>>> Warning: backend/.env file not found! Please create and configure it manually.${CLEAR}"
fi

# Create Startup Script for Backend
cat <<EOT > "$PROJECT_DIR/run-backend.sh"
#!/bin/bash
cd $PROJECT_DIR/backend
source venv/bin/activate
exec uvicorn main:app --host 127.0.0.1 --port 8000
EOT
chmod +x "$PROJECT_DIR/run-backend.sh"
deactivate

# 5. Configure & Setup Frontend (Next.js)
echo -e "${YELLOW}>>> [5/7] Setting up Frontend & Prisma...${CLEAR}"

# Remove root lockfile/node_modules so Next.js doesn't incorrectly infer a monorepo workspace root
rm -f "$PROJECT_DIR/package-lock.json"
rm -rf "$PROJECT_DIR/node_modules"

cd "$PROJECT_DIR/frontend"


# Ensure frontend/.env exists and is configured before building Next.js
if [ ! -f .env ]; then
    echo -e "${RED}>>> Warning: frontend/.env file not found! Please create and configure it manually.${CLEAR}"
fi

# Clean any corrupted node_modules or locks to prevent ENOTEMPTY rename errors
rm -rf node_modules package-lock.json

# Install packages with low-memory footprint
npm install --no-audit --no-fund --loglevel error



# Prisma database sync
echo -e "${BLUE}Running Prisma generate & db push...${CLEAR}"
npx prisma generate --schema=../db/schema.prisma
npx prisma db push --schema=../db/schema.prisma

# Build the production Next.js app
echo -e "${BLUE}Compiling optimized production Next.js build...${CLEAR}"
npm run build

# Create Startup Script for Frontend
cat <<EOT > "$PROJECT_DIR/run-frontend.sh"
#!/bin/bash
cd $PROJECT_DIR/frontend
exec npm run start
EOT
chmod +x "$PROJECT_DIR/run-frontend.sh"

# 6. PM2 Process Registration
echo -e "${YELLOW}>>> [6/7] Configuring PM2 Services...${CLEAR}"
cd "$PROJECT_DIR"

# Stop existing processes to avoid duplicate entries
pm2 delete salesforce-backend || true
pm2 delete salesforce-frontend || true

# Start backend and frontend
pm2 start ./run-backend.sh --name "salesforce-backend"
pm2 start ./run-frontend.sh --name "salesforce-frontend"

# Save state & generate startup script
pm2 save
echo -e "${GREEN}PM2 processes registered and saved successfully.${CLEAR}"

# 7. Configure Nginx Reverse Proxy
echo -e "${YELLOW}>>> [7/7] Configuring Nginx Reverse Proxy...${CLEAR}"

NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"

if [ -f "$NGINX_CONF" ] && grep -q "managed by Certbot" "$NGINX_CONF"; then
    echo -e "${GREEN}Nginx config already has SSL/Certbot configuration. Skipping overwrite to preserve SSL certificates.${CLEAR}"
else
    echo -e "${BLUE}Writing new Nginx configuration (HTTP only)...${CLEAR}"
    sudo tee "$NGINX_CONF" > /dev/null <<EOT
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Increase file upload limits globally to 300MB
    client_max_body_size 300M;

    # Frontend Proxy (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend Proxy (FastAPI)
    location /pyapi/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOT
fi

# Enable config and restart nginx
sudo ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo -e "
${GREEN}======================================================================
Deployment Configuration Completed Successfully!
======================================================================${CLEAR}

${YELLOW}Next Steps to finalize SSL:${CLEAR}
1. Configure your DNS A Record for ${BLUE}$DOMAIN${CLEAR} to point to your EC2 public IP.
2. Run this command on your EC2 instance to fetch and install the SSL certificate:
   ${GREEN}sudo certbot --nginx -d $DOMAIN${CLEAR}
3. Run the PM2 startup generator to ensure server restarts keep the app alive:
   ${GREEN}pm2 startup${CLEAR}
   *(Copy and paste the command it prints in your terminal)*
"
