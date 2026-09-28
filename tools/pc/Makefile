.PHONY: build install run test golden lint vet tidy

build:
	go build -trimpath -o bin/pc ./cmd/pc

install:
	go build -trimpath -o ../../bin/pc ./cmd/pc

run:
	go run ./cmd/pc

test:
	go test ./...

golden:
	go test ./internal/app/ -run TestFrameGolden -update

lint:
	golangci-lint run ./...

vet:
	go vet ./...

tidy:
	go mod tidy
