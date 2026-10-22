.PHONY: help build dev clean install test
.DEFAULT_GOAL := help

PKG_CONFIG_PATH := $(shell pwd)/build/pkgconfig:/usr/lib/pkgconfig
DOTFILES_BIN := $(abspath $(CURDIR)/../../bin)

help: ## Show this help menu
	@printf '\033[1mdotfiles-studio\033[0m\n\nUsage: make \033[36m<target>\033[0m\n\n'
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the Wails app into build/bin
	PKG_CONFIG_PATH=$(PKG_CONFIG_PATH) wails build

dev: ## Run the app with Wails live reload
	PKG_CONFIG_PATH=$(PKG_CONFIG_PATH) wails dev

test: ## Run Go tests
	go test ./...

# Symlinked rather than copied so a rebuild is live without reinstalling.
install: build ## Build and symlink the binary into the dotfiles bin/
	ln -sf ../apps/dotfiles-studio/build/bin/dotfiles-studio $(DOTFILES_BIN)/dotfiles-studio

clean: ## Remove build output
	rm -rf build/bin
