# Production Deployment Guide: datamigration.analytx4t.com

This guide provides a step-by-step walkthrough to deploy the Salesforce Data Migration application on an AWS EC2 instance running Ubuntu, secure it with an SSL certificate using Let's Encrypt, and run both the Next.js frontend and FastAPI backend in production.

---

## 1. Choose the EC2 Instance Type

Because Next.js builds (`next build`) and pandas operations on Excel spreadsheets are CPU- and memory-intensive, choosing an undersized instance will cause out-of-memory (OOM) crashes.

* **Minimum Recommended**: `t3.medium` (2 vCPUs, 4 GB RAM)
* **Production Recommended**: `t3.large` (2 vCPUs, 8 GB RAM) or `c6i.large` (if processing very large datasets / files > 10MB)
* **OS**: **Ubuntu 24.04 LTS** (or Ubuntu 22.04 LTS)
* **Storage**: At least **20 GB gp3 SSD** to allow room for system dependencies, packages, and temp files.

---

## 2. Configure AWS Security Group (Inbound Rules)

You need to attach a Security Group to your EC2 instance with the following inbound rules:

| Protocol | Port Range | Source | Purpose |
| :--- | :--- | :--- | :--- |
| **TCP (SSH)** | `22` | `My IP` (Recommended) or `0.0.0.0/0` | Secure shell access to deploy and maintain |
| **TCP (HTTP)** | `80` | `0.0.0.0/0` & `::/0` | Let's Encrypt validation and HTTP redirect |
| **TCP (HTTPS)** | `443` | `0.0.0.0/0` & `::/0` | Secure SSL traffic for the web app |

> [!IMPORTANT]
> Do NOT expose port `8000` (FastAPI) or `3000` (Next.js) directly to the internet. They will be securely proxied internally by Nginx.

---

## 3. Configure DNS (Domain Setup)

Go to your DNS provider (e.g., Cloudflare, GoDaddy, Route53) and add an **A Record** pointing to your EC2 Elastic IP address:

* **Type**: `A`
* **Name**: `datamigration`
* **Value/IP**: `YOUR_EC2_PUBLIC_IP`
* **TTL**: `Auto` or `3600`

---

## 4. Initial Server Setup & Packages

Once logged in via SSH:
```bash
ssh -i "your-key.pem" ubuntu@datamigration.analytx4t.com
```

Run the following commands to update the system and install essential packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget build-essential python3-pip python3-venv python3-dev nginx
```

---

## 5. Install Node.js & PM2 (Process Manager)

Next.js requires Node.js. We will install Node.js v20 LTS and PM2 to manage the background processes.

```bash
# Install Node.js v20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v
npm -v

# Install PM2 globally
sudo npm install -y -g pm2
```

---

## 6. Clone and Configure the Application

We will clone the project directly from your GitHub repository to the home directory:

```bash
cd /home/ubuntu
git clone https://github.com/priyanshu442004/SalesForce.git salesforce-migration
cd salesforce-migration
```

### 6.1 Backend Configuration
Create the backend `.env` file:
```bash
nano backend/.env
```
Add the following content (update S3 credentials and bucket name as needed):
```env
AWS_ACCESS_KEY_ID=AKIAREN2QKKEBE33AP7G
AWS_SECRET_ACCESS_KEY=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
AWS_REGION=ap-south-1
AWS_BUCKET_NAME=s3-bucket-analytx4t
GOOGLE_CLIENT_ID=20399312144-s8o42220q34kt2mfckvmfiuaser2450e.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

Set up python virtual environment and install backend dependencies:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..
```

### 6.2 Frontend Configuration
Create the frontend `.env` file:
```bash
nano frontend/.env
```
Add the following content. **Note that we are using your Neon serverless PostgreSQL connection string directly:**
```env
DATABASE_URL="postgresql://neondb_owner:npg_KOPGzQjTq4g8@ep-lively-union-ahqq78hg-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
NEXT_PUBLIC_API_URL="https://datamigration.analytx4t.com/pyapi"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="20399312144-s8o42220q34kt2mfckvmfiuaser2450e.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="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"
```

Initialize Prisma and build the Next.js frontend:
```bash
# Install node packages
cd frontend
npm install

# Generate and deploy Prisma Client & DB tables to your Neon Database
npx prisma generate --schema=../db/schema.prisma
npx prisma db push --schema=../db/schema.prisma

# Build the Next.js app
npm run build
cd ..
```

---

## 7. Run Services using PM2

We will use PM2 to run both the frontend and backend as system daemons.

### 7.1 Start Backend (FastAPI)
Create a startup shell script for the backend:
```bash
nano run-backend.sh
```
Add:
```bash
#!/bin/bash
cd /home/ubuntu/salesforce-migration/backend
source venv/bin/activate
exec uvicorn main:app --host 127.0.0.1 --port 8000
```
Make it executable and start it with PM2:
```bash
chmod +x run-backend.sh
pm2 start ./run-backend.sh --name "salesforce-backend"
```

### 7.2 Start Frontend (Next.js)
```bash
pm2 start npm --name "salesforce-frontend" --cwd "/home/ubuntu/salesforce-migration/frontend" -- run start
```


### 7.3 Save PM2 State & Enable Startup
```bash
pm2 save
pm2 startup
```
Copy and paste the command generated by the `pm2 startup` output to ensure services restart if the EC2 instance rebooted.

---

## 8. Nginx Reverse Proxy Setup

Nginx will serve as the entry point for your domain on port 80/443. It will route all regular traffic `/` to the Next.js frontend, and `/pyapi/` calls directly to the FastAPI python backend.

Create a new Nginx server configuration:
```bash
sudo nano /etc/nginx/sites-available/datamigration.analytx4t.com
```

Paste the following configuration:
```nginx
server {
    listen 80;
    server_name datamigration.analytx4t.com;

    # Maximum upload size for Excel files
    client_max_body_size 50M;

    # 1. Route FastAPI Backend requests (via /pyapi/)
    location /pyapi/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Keepalive/Timeout adjustments for heavy calculations
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    # 2. Route Next.js Frontend requests
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and verify configuration:
```bash
# Link config to enabled sites
sudo ln -s /etc/nginx/sites-available/datamigration.analytx4t.com /etc/nginx/sites-enabled/

# Remove default site if present
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx syntax
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## 9. Install SSL Certificate (Let's Encrypt)

We will use Certbot to automate SSL certificate acquisition and renewal for HTTPS.

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain and install SSL Certificate
sudo certbot --nginx -d datamigration.analytx4t.com
```
*Follow the on-screen prompts (enter your email address and agree to the Terms of Service).* Certbot will automatically rewrite the Nginx configuration to add SSL certs and set up automatic redirection from HTTP to HTTPS.

### Verify SSL auto-renewal is active:
```bash
sudo systemctl status certbot.timer
# Or run a dry run check
sudo certbot renew --dry-run
```

---

## 10. Testing and Verification

1. Go to `http://datamigration.analytx4t.com` in your browser. It should redirect you to `https://datamigration.analytx4t.com`.
2. Check the API health endpoint directly: `https://datamigration.analytx4t.com/pyapi/api/health`.
3. Try uploading your migration files. PM2 logs can be monitored in real-time with:
   ```bash
   pm2 logs
   ```
