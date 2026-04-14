# Installation Guide

Detailed step-by-step instructions for installing the AI Usage Dashboard on macOS, Linux, and Windows.

## Prerequisites

You need:
- **Go 1.18 or later** — Check version: `go version`
- **Node.js 16+ with npm** — Check version: `node -v && npm -v`
- **Claude Code installed and used at least once** — Sessions are stored at `~/.claude/projects/`
- **Git** — For cloning the repository

## Installation by Platform

### macOS

**1. Install Go (if needed)**

Using Homebrew:
```bash
brew install go
```

Or download from [go.dev/dl](https://go.dev/dl)

**2. Install Node.js (if needed)**

Using Homebrew:
```bash
brew install node
```

Or download from [nodejs.org](https://nodejs.org)

**3. Clone the repository**

```bash
git clone https://github.com/arunenoah/AI-Usage-Dashboard.git
cd AI-Usage-Dashboard
```

**4. Build**

```bash
make build
```

If you see `make: command not found`, install Xcode command line tools:
```bash
xcode-select --install
```

**5. Run**

```bash
./ai-sessions
```

Visit `http://localhost:8765`

### Linux

**1. Install Go (if needed)**

Using apt (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install golang-go
```

Or download from [go.dev/dl](https://go.dev/dl)

**2. Install Node.js (if needed)**

Using apt (Ubuntu/Debian):
```bash
sudo apt install nodejs npm
```

Or download from [nodejs.org](https://nodejs.org)

**3. Install make (if needed)**

```bash
sudo apt install make
```

**4. Clone the repository**

```bash
git clone https://github.com/arunenoah/AI-Usage-Dashboard.git
cd AI-Usage-Dashboard
```

**5. Build**

```bash
make build
```

**6. Run**

```bash
./ai-sessions
```

Visit `http://localhost:8765`

### Windows

**1. Install Go (if needed)**

Download from [go.dev/dl](https://go.dev/dl) and run the installer.

**2. Install Node.js (if needed)**

Download from [nodejs.org](https://nodejs.org) and run the installer.

**3. Install Git (if needed)**

Download from [git-scm.com](https://git-scm.com) and run the installer.

**4. Install make (optional but recommended)**

Open PowerShell and run:
```powershell
choco install make
```

Or download from [GnuWin32](http://gnuwin32.sourceforge.net/packages/make.htm)

**5. Clone the repository**

Open PowerShell or Command Prompt:
```bash
git clone https://github.com/arunenoah/AI-Usage-Dashboard.git
cd AI-Usage-Dashboard
```

**6. Build**

If you installed make:
```bash
make build
```

Without make, run these commands separately:
```bash
cd web && npm install && npm run build && cd ..
go build -o ai-sessions
```

**7. Run**

```bash
.\ai-sessions.exe
```

Or in PowerShell:
```powershell
.\ai-sessions
```

Visit `http://localhost:8765`

---

## Troubleshooting Installation

### "Go not found"

**macOS/Linux:**
```bash
go version  # Check if it's installed
which go    # Check your PATH
```

**Windows:** Verify the Go installation added to your PATH. Restart your terminal or computer.

### "npm not found"

```bash
npm -v  # Check if it's installed
which npm  # Check your PATH
```

Reinstall Node.js from [nodejs.org](https://nodejs.org)

### "make: command not found" (macOS)

```bash
xcode-select --install
```

### "make: command not found" (Linux)

```bash
sudo apt install make
```

### Build fails with permission errors

```bash
# Make sure you own the directory
chmod -R u+w AI-Usage-Dashboard/
```

### "ai-sessions: command not found" after build

The binary is in the current directory. Run:
```bash
./ai-sessions  # macOS/Linux
.\ai-sessions  # Windows PowerShell
```

---

## Verify Installation

After installation, verify everything works:

```bash
# Check Go
go version  # Should be 1.18+

# Check Node
node -v && npm -v  # Should be 16+

# Test the dashboard
./ai-sessions
```

You should see:
```
Server running on http://localhost:8765
Watching for session updates...
```

If you see errors, see [Troubleshooting & FAQs](User-Troubleshooting-FAQs).

---

## Next Steps

- **[Quick Start (5 min)](User-Getting-Started-Quick-Start)** — Already done! But see it for a refresher.
- **[First Run & Data Discovery](User-First-Run-Data-Discovery)** — Why aren't my sessions showing?
- **[Dashboard Overview](User-Dashboard-Overview)** — Tour of features
