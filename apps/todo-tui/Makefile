.PHONY: help build run test golden lint vet tidy
.DEFAULT_GOAL := help

help: ## List the available targets
	@awk 'BEGIN {FS = ":.*## "} /^[a-z-]+:.*## / {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the TUI into ./bin/todo-tui
	go build -trimpath -o bin/todo-tui ./cmd/todo-tui

run: ## Run the TUI from source
	go run ./cmd/todo-tui

test: ## Run the Go tests
	go test ./...

golden: ## Rewrite the frame golden file
	go test ./internal/app/ -run TestFrameGolden -update

lint: ## Lint with golangci-lint
	golangci-lint run ./...

vet: ## Run go vet
	go vet ./...

tidy: ## Tidy go.mod and go.sum
	go mod tidy
