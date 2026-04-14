# Building & Deployment

How to build releases and deploy the dashboard.

## Local Production Build

### Build the Binary

```bash
# Build everything (frontend + backend)
make build

# Output: ./ai-sessions (single binary, ~50 MB)
```

**What happens:**
1. `npm run build` in `web/` → outputs `web/dist/`
2. Go embeds `web/dist/` into binary
3. `go build` → creates `ai-sessions` executable

### Run Locally

```bash
# Start dashboard
./ai-sessions

# Optional: custom port
PORT=9000 ./ai-sessions

# Should see:
# Server running on http://localhost:8765
# Watching for session updates...
```

**Visit:** `http://localhost:8765`

## Release Process

### 1. Update Version

Edit `VERSION` file (or use git tags):

```bash
# Option A: Version file
echo "v0.2.0" > VERSION

# Option B: Git tag (recommended)
git tag -a v0.2.0 -m "Release 0.2.0: Add CARE scoring"
git push origin v0.2.0
```

### 2. Update Changelog

Edit `CHANGELOG.md`:

```markdown
## [0.2.0] - 2026-04-14

### Added
- CARE framework prompt scoring (1-10 scale)
- Beginner-friendly tooltips on metrics
- Real conversation examples in "Path to Next Tier"
- 7-day token heatmap with color-coded intensity

### Fixed
- Race condition in Store.Upsert() with concurrent reads
- Memory leak in file watcher on repeated updates

### Changed
- Token chart now shows input/output separately
- Dashboard layout reorganized (full-width conversations)

### Removed
- Misleading cost estimates (switched to token-focused)
```

### 3. Create Release on GitHub

```bash
# Option A: GitHub CLI
gh release create v0.2.0 -t "Release 0.2.0" -n "Release notes here"

# Option B: Web interface
# 1. Go to https://github.com/arunenoah/AI-Usage-Dashboard/releases
# 2. Click "Draft a new release"
# 3. Choose tag: v0.2.0
# 4. Title: "Release 0.2.0: CARE Scoring & Insights"
# 5. Description: Paste changelog excerpt
# 6. Publish
```

### 4. Build Release Artifacts

```bash
# Clean previous builds
rm -f ai-sessions

# Build
make build

# Test it works
./ai-sessions &
sleep 2
curl http://localhost:8765/api/health
pkill ai-sessions

# Rename for distribution
cp ai-sessions ai-sessions-darwin-arm64  # macOS ARM
cp ai-sessions ai-sessions-linux-amd64   # Linux x86

# Or cross-compile
GOOS=linux GOARCH=amd64 go build -o ai-sessions-linux-amd64
GOOS=darwin GOARCH=arm64 go build -o ai-sessions-darwin-arm64
GOOS=windows GOARCH=amd64 go build -o ai-sessions-windows-amd64.exe
```

### 5. Upload to Release

```bash
# Upload binaries to GitHub release
gh release upload v0.2.0 ai-sessions-darwin-arm64
gh release upload v0.2.0 ai-sessions-linux-amd64
gh release upload v0.2.0 ai-sessions-windows-amd64.exe

# Or upload via web interface (drag and drop)
```

## Installation Methods

### Method 1: Download Binary

**macOS/Linux:**
```bash
# Download from GitHub releases
wget https://github.com/arunenoah/AI-Usage-Dashboard/releases/download/v0.2.0/ai-sessions-linux-amd64
chmod +x ai-sessions-linux-amd64

# Run
./ai-sessions-linux-amd64
```

**Windows:**
```powershell
# Download ai-sessions-windows-amd64.exe from GitHub releases
# Double-click to run
# Or from PowerShell:
.\ai-sessions-windows-amd64.exe
```

### Method 2: Homebrew (macOS)

Create a formula:

```bash
# Create formula file
mkdir -p homebrew-tap/Formula
cat > homebrew-tap/Formula/ai-sessions.rb << 'EOF'
class AiSessions < Formula
  desc "AI usage analytics dashboard for Claude Code"
  homepage "https://github.com/arunenoah/AI-Usage-Dashboard"
  version "0.2.0"

  # macOS Intel
  on_macos do
    url "https://github.com/arunenoah/AI-Usage-Dashboard/releases/download/v0.2.0/ai-sessions-darwin-amd64"
    sha256 "abc123..."  # Compute with: shasum -a 256 ai-sessions-darwin-amd64
  end

  # macOS ARM
  on_arm do
    url "https://github.com/arunenoah/AI-Usage-Dashboard/releases/download/v0.2.0/ai-sessions-darwin-arm64"
    sha256 "def456..."
  end

  def install
    bin.install "ai-sessions-darwin-amd64" => "ai-sessions"
  end

  def post_install
    puts "To run: ai-sessions"
    puts "Then visit http://localhost:8765"
  end
end
EOF
```

**Install:**
```bash
# Users install via
brew tap arunenoah/tap
brew install ai-sessions

# Run
ai-sessions
```

### Method 3: Docker

Create `Dockerfile`:

```dockerfile
# Build stage
FROM golang:1.18 AS builder

WORKDIR /app
COPY . .

# Install Node dependencies
RUN apt-get update && apt-get install -y nodejs npm
RUN cd web && npm install

# Build frontend and backend
RUN make build

# Runtime stage
FROM debian:bullseye-slim

COPY --from=builder /app/ai-sessions /usr/local/bin/ai-sessions

EXPOSE 8765

CMD ["ai-sessions"]
```

**Build and run:**
```bash
# Build image
docker build -t ai-sessions:0.2.0 .

# Run container
docker run -p 8765:8765 \
  -v ~/.claude:/root/.claude \
  ai-sessions:0.2.0
```

**Push to Docker Hub:**
```bash
# Tag for Docker Hub
docker tag ai-sessions:0.2.0 yourusername/ai-sessions:0.2.0
docker tag ai-sessions:0.2.0 yourusername/ai-sessions:latest

# Push
docker push yourusername/ai-sessions:0.2.0
docker push yourusername/ai-sessions:latest
```

## CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-go@v4
        with:
          go-version: '1.18'
      
      - uses: actions/setup-node@v3
        with:
          node-version: '16'
      
      - run: npm ci --prefix web
      - run: npm run build --prefix web
      - run: go build -o ai-sessions
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: ai-sessions
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Performance Tuning

### Binary Size

Reduce binary size:

```bash
# Strip debug info
go build -ldflags="-s -w" -o ai-sessions

# Pack with UPX
upx ai-sessions  # Reduces by ~40%
```

### Startup Speed

Profile startup:

```bash
# Time startup
time ./ai-sessions

# Profile memory during load
./ai-sessions &
pid=$!
sleep 2
ps aux | grep ai-sessions | grep -v grep
kill $pid
```

**Optimize slow paths:**
- Move expensive initialization to lazy loading
- Cache frequently-used data
- Use goroutines for parallel loading

## Deployment Environments

### Local Machine (Recommended for now)

```bash
# Download binary
./ai-sessions

# Sessions read from ~/.claude/projects/
# No setup needed
# No cloud infrastructure required
```

### Home Server / NAS

```bash
# Copy binary to server
scp ai-sessions user@homeserver:/opt/ai-sessions/

# Run in background
ssh user@homeserver "nohup /opt/ai-sessions/ai-sessions > /tmp/ai-sessions.log 2>&1 &"

# Access from other machines on LAN
# http://homeserver:8765
```

(Note: Not recommended without authentication)

### Cloud (Future)

For team/cloud deployments:

**Considerations:**
- Authentication/authorization
- Persistent database (not in-memory)
- Load balancing (if multiple servers)
- HTTPS with TLS certificates
- Session data encryption at rest

**AWS example (future):**
```yaml
# CloudFormation template (sketch)
Resources:
  ECSCluster:
    Type: AWS::ECS::Cluster
  
  ECSService:
    Type: AWS::ECS::Service
    Properties:
      Cluster: !Ref ECSCluster
      Image: ai-sessions:0.2.0  # ECR image
      Port: 8765
  
  RDS:
    Type: AWS::RDS::DBInstance
    Properties:
      Engine: postgres
      # Replace in-memory store with DB
```

## Monitoring & Observability

### Health Check

```bash
# Check if running
curl http://localhost:8765/api/health

# Response
{"status": "ok"}
```

### Logs

**Docker:**
```bash
docker logs <container-id> -f
```

**Systemd (if installed as service):**
```bash
journalctl -u ai-sessions -f
```

**Manual:**
```bash
./ai-sessions 2>&1 | tee ai-sessions.log
```

### Debugging

Enable debug logging:

```bash
DEBUG=1 ./ai-sessions

# Look for:
# - Session load errors
# - File watcher events
# - Memory usage spikes
```

## Rollback Procedure

If a release has a critical bug:

```bash
# Rollback to previous version
git checkout v0.1.0
make build

# Or download from releases
wget https://github.com/.../releases/download/v0.1.0/ai-sessions
./ai-sessions

# Or with Docker
docker run -p 8765:8765 ai-sessions:0.1.0
```

## Versioning

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR.MINOR.PATCH** (e.g., `1.2.3`)
- **MAJOR:** Breaking changes
- **MINOR:** New features (backward compatible)
- **PATCH:** Bug fixes

**Examples:**
- `0.1.0` → Initial release
- `0.2.0` → Add CARE scoring (new feature)
- `0.2.1` → Fix race condition (patch)
- `1.0.0` → First stable release

## Checklist Before Release

- [ ] Tests pass: `go test ./...` and `npm test`
- [ ] No console errors or warnings
- [ ] Changelog updated with all changes
- [ ] Version number bumped
- [ ] Git tag created: `git tag -a v0.2.0 -m "Release 0.2.0"`
- [ ] Binary built and tested: `make build && ./ai-sessions`
- [ ] GitHub release created with artifacts uploaded
- [ ] Installation methods tested (download, brew, docker)
- [ ] README updated with new features (if significant)

## Next Steps

- **Contributing:** [PR Process](Dev-PR-Process)
- **Testing:** [Testing Requirements](Dev-Testing-Requirements)
- **Architecture:** [System Design Overview](Dev-System-Design-Overview)

## References

- [Semantic Versioning](https://semver.org/)
- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
