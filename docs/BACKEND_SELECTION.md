# Backend Selection Guide

## Quick Start

### Choose Your Backend

1. **Create `backend.config.json` in the project root:**

   **For NodeJS:**
   ```json
   {
     "backend": "nodejs",
     "port": 8765
   }
   ```

   **For Go:**
   ```json
   {
     "backend": "go",
     "port": 8765
   }
   ```

2. **Install and start:**

   ```bash
   npm run setup    # Install chosen backend + web frontend
   npm start        # Start the backend
   ```

3. **Open browser:**

   Navigate to `http://localhost:8765`

## Backend Comparison

| Feature | Go | NodeJS |
|---------|----|----|
| Performance | High | Good |
| Startup Time | Fast | Moderate |
| Memory Usage | Low | Moderate |
| File Size | ~10MB binary | Node + modules |
| Development | Compiled | Interpreted |

## Switching Backends

To switch from one backend to another:

```bash
# Edit the config
echo '{ "backend": "nodejs" }' > backend.config.json

# Reinstall (if needed)
npm run setup

# Start
npm start
```

## Development

### NodeJS Backend Development

```bash
cd backends/nodejs
npm run dev   # Start with ts-node for hot reload
npm test      # Run tests
npm run build # Compile to JavaScript
```

### Go Backend Development

```bash
cd backends/go
go run main.go
# Or with hot reload using air or similar
```

## Deployment

### Deploy NodeJS Backend

```bash
npm run setup   # with backend: "nodejs" in config
npm run build   # Build frontend and backend
# Deploy backends/nodejs/dist/ and web/dist/
```

### Deploy Go Backend

```bash
npm run setup   # with backend: "go" in config
cd backends/go
go build -o ai-sessions main.go
# Deploy binary and web/dist/
```

## Troubleshooting

**Q: "backend.config.json not found"**
A: Create it in the project root with your chosen backend.

**Q: "node_modules not found"**
A: Run `npm run setup` to install dependencies.

**Q: "web/dist not found"**
A: Run `npm run setup` to build the frontend.

**Q: Port already in use**
A: Change the port in `backend.config.json`.
