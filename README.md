# My Dotfiles

This repository contains my personal dotfiles for various applications.

## Structure

The repository is structured as follows:

*   `cfg`: The main configuration file for `fish` shell. This file sources all other configuration files.
*   `core`: Contains the core configuration files, such as color definitions and environment variables.
*   `aliases`: Contains all the shell aliases.
*   `scripts`: Contains various utility scripts.

## Installation

To install these dotfiles, simply clone this repository and source the `cfg` file in your `~/.config/fish/config.fish`.

```fish
source /path/to/your/dotfiles/cfg
```
