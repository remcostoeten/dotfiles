.PHONY: build dev clean

PKG_CONFIG_PATH := $(shell pwd)/build/pkgconfig:/usr/lib/pkgconfig

build:
	PKG_CONFIG_PATH=$(PKG_CONFIG_PATH) wails build

dev:
	PKG_CONFIG_PATH=$(PKG_CONFIG_PATH) wails dev

clean:
	rm -rf build/bin
