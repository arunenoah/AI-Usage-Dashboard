package claudecode

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetect(t *testing.T) {
	home, _ := os.UserHomeDir()
	a := &Adapter{}
	paths := a.Detect(home)
	t.Logf("detected %d sessions", len(paths))
}

func TestParseRealSession(t *testing.T) {
	home, _ := os.UserHomeDir()
	a := &Adapter{}
	paths := a.Detect(home)
	if len(paths) == 0 {
		t.Skip("no Claude Code sessions found")
	}
	session, err := a.Parse(paths[0])
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if session.ID == "" {
		t.Error("session ID is empty")
	}
	t.Logf("session %s: %d user turns, %d input tokens, first prompt: %q",
		session.ID, session.UserTurns, session.TotalUsage.InputTokens, session.FirstPrompt)
	_ = filepath.Base(session.FilePath)
}

func TestDecodeProjectDir(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"-Users-arunkumar-Documents-Application", "/Users/arunkumar/Documents/Application"},
		{"-home-dev-myproject", "/home/dev/myproject"},
	}
	for _, tt := range tests {
		got := decodeProjectDir(tt.input)
		if got != tt.want {
			t.Errorf("decodeProjectDir(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
