.PHONY: build dev clean install test

PKG_CONFIG_PATH := $(shell pwd)/build/pkgconfig:/usr/lib/pkgconfig
DOTFILES_BIN := $(abspath $(CURDIR)/../../bin)

build:
	PKG_CONFIG_PATH=$(PKG_CONFIG_PATH) wails build

dev:
	PKG_CONFIG_PATH=$(PKG_CONFIG_PATH) wails dev

test:
	go test ./...

# Symlinked rather than copied so a rebuild is live without reinstalling.
install: build
	ln -sf ../apps/dotfiles-studio/build/bin/dotfiles-studio $(DOTFILES_BIN)/dotfiles-studio

clean:
	rm -rf build/bin
