.PHONY: build dev web test clean run

build: web
	go build -o ai-sessions .

web:
	cd web && npm install && npm run build

dev:
	@echo "Run 'cd web && npm run dev' in one terminal"
	@echo "Run 'go run .' in another"

run: build
	./ai-sessions

test:
	go test ./...

clean:
	rm -f ai-sessions
	rm -rf web/dist
