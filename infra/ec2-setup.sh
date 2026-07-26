#!/bin/bash

set -e

DOMAIN_NAME="sarlsodichn.com"
EMAIL="ymekhtoub@gmail.com"

echo "=== Setting up nginx and SSL for $DOMAIN_NAME ==="

# Install nginx and certbot
sudo dnf install -y nginx python3-certbot-nginx

# Configure nginx as reverse proxy
sudo tee /etc/nginx/conf.d/app.conf > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;

    location / {
        proxy_pass http://localhost:4200;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx

echo "✅ Nginx configured"

# Get SSL certificate (certbot auto-updates nginx config for HTTPS)
sudo certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME --non-interactive --agree-tos --email $EMAIL

echo "✅ SSL setup complete!"
echo "🌐 Your site: https://$DOMAIN_NAME"
