const { createApp } = Vue;

createApp({
    data() {
        let initialTheme = 'blue';
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlTheme = urlParams.get('mode');
            const savedTheme = localStorage.getItem('ngineer_theme');
            initialTheme = urlTheme || savedTheme || 'blue';
        } catch (e) {
            console.warn('Storage/URL access restricted', e);
        }

        return {
            // Core & Routing
            domain: '',
            listen_port: 80,
            root_dir: '/var/www/html',
            index_files: 'index.html index.htm',
            routing: false,
            
            // Reverse Proxy
            proxy_enabled: false,
            proxy_pass_url: '',
            websocket_support: false,
            
            // Security
            https_enabled: false,
            ssl_cert_path: '',
            ssl_key_path: '',
            force_https_redirect: false,
            strict_security_headers: true,
            
            // Performance
            gzip_enabled: true,
            client_max_body_size: '10M',
            static_asset_caching: false,

            // UI State
            isCopied: false,
            theme: initialTheme
        };
    },
    computed: {
        generatedConfig() {
            // Default domain fallback
            const domainName = this.domain.trim() || 'example.com';
            const port = this.listen_port || 80;
            let config = '';

            // 1. Force HTTP to HTTPS Redirect Block
            if (this.https_enabled && this.force_https_redirect && port !== 80) {
                config += `server {\n`;
                config += `    listen 80;\n`;
                config += `    listen [::]:80;\n`;
                config += `    server_name ${domainName};\n\n`;
                config += `    location / {\n`;
                config += `        return 301 https://$host$request_uri;\n`;
                config += `    }\n`;
                config += `}\n\n`;
            }

            // 2. Main Server Block
            config += `server {\n`;
            
            // Listen directives
            if (this.https_enabled) {
                config += `    listen ${port} ssl http2;\n`;
                config += `    listen [::]:${port} ssl http2;\n`;
            } else {
                config += `    listen ${port};\n`;
                config += `    listen [::]:${port};\n`;
            }
            
            config += `    server_name ${domainName};\n\n`;

            // SSL Configuration
            if (this.https_enabled) {
                const cert = this.ssl_cert_path.trim() || '/etc/ssl/certs/fullchain.pem';
                const key = this.ssl_key_path.trim() || '/etc/ssl/private/privkey.pem';
                config += `    # SSL Configuration\n`;
                config += `    ssl_certificate ${cert};\n`;
                config += `    ssl_certificate_key ${key};\n`;
                config += `    ssl_protocols TLSv1.2 TLSv1.3;\n`;
                config += `    ssl_ciphers HIGH:!aNULL:!MD5;\n`;
                config += `    ssl_prefer_server_ciphers on;\n\n`;
            }

            // Security Headers
            if (this.strict_security_headers) {
                config += `    # Security Headers\n`;
                config += `    add_header X-Frame-Options "SAMEORIGIN" always;\n`;
                config += `    add_header X-Content-Type-Options "nosniff" always;\n`;
                config += `    add_header X-XSS-Protection "1; mode=block" always;\n`;
                if (this.https_enabled) {
                    config += `    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\n`;
                }
                config += `\n`;
            }

            // Document Root & Index (Only if NOT a reverse proxy)
            if (!this.proxy_enabled) {
                const root = this.root_dir.trim() || '/var/www/html';
                const index = this.index_files.trim() || 'index.html';
                config += `    root ${root};\n`;
                config += `    index ${index};\n\n`;
            }

            // Performance & Limits
            if (this.client_max_body_size.trim()) {
                config += `    client_max_body_size ${this.client_max_body_size.trim()};\n`;
            }
            
            if (this.gzip_enabled) {
                config += `\n    # Gzip Compression\n`;
                config += `    gzip on;\n`;
                config += `    gzip_vary on;\n`;
                config += `    gzip_proxied any;\n`;
                config += `    gzip_comp_level 6;\n`;
                config += `    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;\n`;
            }
            
            config += `\n    # Main Location\n`;
            config += `    location / {\n`;

            if (this.proxy_enabled) {
                const proxyUrl = this.proxy_pass_url.trim() || 'http://127.0.0.1:3000';
                config += `        proxy_pass ${proxyUrl};\n`;
                config += `        proxy_http_version 1.1;\n`;
                config += `        proxy_set_header Host $host;\n`;
                config += `        proxy_set_header X-Real-IP $remote_addr;\n`;
                config += `        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n`;
                config += `        proxy_set_header X-Forwarded-Proto $scheme;\n`;

                if (this.websocket_support) {
                    config += `\n        # WebSocket Support\n`;
                    config += `        proxy_set_header Upgrade $http_upgrade;\n`;
                    config += `        proxy_set_header Connection "upgrade";\n`;
                }
            } else {
                if (this.routing) {
                    config += `        # SPA Fallback Routing\n`;
                    config += `        try_files $uri $uri/ /index.html;\n`;
                } else {
                    config += `        try_files $uri $uri/ =404;\n`;
                }
            }
            
            config += `    }\n`;

            // Static Asset Caching (Only if NOT a proxy)
            if (!this.proxy_enabled && this.static_asset_caching) {
                config += `\n    # Static Asset Caching\n`;
                config += `    location ~* \\.(?:css|js|jpg|jpeg|gif|png|ico|cur|gz|svg|svgz|mp4|ogg|ogv|webm|htc)$ {\n`;
                config += `        expires 1M;\n`;
                config += `        access_log off;\n`;
                config += `        add_header Cache-Control "public";\n`;
                config += `    }\n`;
            }

            // Deny access to hidden files (.git, .env, etc.)
            config += `\n    # Security: Deny hidden files\n`;
            config += `    location ~ /\\. {\n`;
            config += `        deny all;\n`;
            config += `    }\n`;

            config += `}\n`;

            return config;
        },

        deploymentCommands() {
            const domainName = this.domain.trim() || 'example.com';
            const confName = domainName === 'example.com' ? 'my-app.conf' : `${domainName}.conf`;
            
            let commands = `# 1. Save the configuration above to a file in sites-available\n`;
            commands += `sudo nano /etc/nginx/sites-available/${confName}\n\n`;
            
            commands += `# 2. Create a symlink to enable the site\n`;
            commands += `sudo ln -s /etc/nginx/sites-available/${confName} /etc/nginx/sites-enabled/\n\n`;
            
            commands += `# 3. Test the configuration for syntax errors\n`;
            commands += `sudo nginx -t\n\n`;
            
            commands += `# 4. Reload Nginx to apply changes\n`;
            commands += `sudo systemctl reload nginx`;
            
            return commands;
        }
    },
    mounted() {
        document.documentElement.setAttribute('data-theme', this.theme);
        
        // Handle page exit animation
        window.addEventListener('beforeunload', () => {
            document.body.classList.add('page-exit');
        });
    },
    watch: {
        theme(newTheme) {
            document.documentElement.setAttribute('data-theme', newTheme);
        }
    },
    methods: {
        setTheme(themeName) {
            this.theme = themeName;
            try {
                localStorage.setItem('ngineer_theme', themeName);
                
                // Update URL without reloading
                const url = new URL(window.location);
                url.searchParams.set('mode', themeName);
                window.history.replaceState({}, '', url);
            } catch (e) {
                console.warn('Could not save theme', e);
            }
        },
        async copyConfig() {
            try {
                await navigator.clipboard.writeText(this.generatedConfig);
                this.isCopied = true;
                setTimeout(() => {
                    this.isCopied = false;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
            }
        }
    }
}).mount('#app');