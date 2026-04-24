# Contributing to Ngineer 🤝

First off, thank you for considering contributing to Ngineer! It's people like you that make this tool great.

## How to Contribute

1. Fork the repo and create your branch from `main`.
2. Make your changes and test them by opening `index.html` locally.
3. Ensure your code matches the existing style (Vanilla HTML/CSS and Vue CDN).
4. Issue that pull request!

## 📝 Example: Adding Nginx Presets

If you want to add quick "Presets" for popular frameworks (e.g., Laravel, Node.js, WordPress), you can hook into the central State Object in `js/app.js`.

Here is a short example of how to implement a Preset loader:

1. Add a `loadPreset(type)` method to the Vue instance:
```javascript
methods: {
    loadPreset(type) {
        if (type === 'node') {
            this.proxy_enabled = true;
            this.proxy_pass_url = 'http://127.0.0.1:3000';
            this.websocket_support = true;
            this.routing = false;
        } else if (type === 'spa') {
            this.proxy_enabled = false;
            this.routing = true;
            this.index_files = 'index.html';
        }
    },
    // ... existing methods
}
```

2. Add the buttons to `index.html`:
```html
<div class="preset-buttons">
    <button @click="loadPreset('node')" class="btn glass-btn">Node.js App</button>
    <button @click="loadPreset('spa')" class="btn glass-btn">Vue/React SPA</button>
</div>
```

We welcome PRs that add powerful, community-driven presets!