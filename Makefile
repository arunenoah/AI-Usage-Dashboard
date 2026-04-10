.PHONY: build dev web test clean

build: web
	go build -o ai-sessions ./cmd/ai-sessions/

web:
	cd web && npm install && npm run build

dev:
	@echo "Run 'cd web && npm run dev' in one terminal"
	@echo "Run 'go run ./cmd/ai-sessions/' in another"

test:
	go test ./...

clean:
	rm -f ai-sessions
	rm -rf web/dist
