# Scripts 

This directory contains small, focused shell scripts that enhance or automate aspects of your development environment. Unlike tools in the `cli/` subdirectory, these scripts are generally single-file utilities with minimal or no external dependencies.

## 📁 Purpose

These scripts are meant to be:

- Lightweight and portable
- Easy to invoke from aliases or keybindings
- Composed into larger workflows via your modular shell config

They cover a range of use cases, such as system tasks, Git helpers, clipboard actions, or development shortcuts.

## 🧩 Integration

If you integrate the entirety of this dotfifiles (simply by setting your shell to `fish`,  and symlinking it. Running this:

```
# Backup existing 'fish' directory if it exists
[ -d ~/.config/fish ] && mv ~/.config/fish ~/.config/fish_backup_$(date +%Y%m%d_%H%M%S);

# Remove existing 'fish' file if it exists (less common, but for robustness)
[ -f ~/.config/fish ] && rm ~/.config/fish;

# Create the symbolic link
ln -s ~/.config/dotfiles/fish-config ~/.config/fish
```
```
```


Scripts are often loaded or referenced through:

- Aliases in `alias/`
- Injector patterns in `scripts/`
- Keybindings or launcher tools

You can run them directly or include them in larger workflows.

Example:

```sh
~/dotfiles/scripts/git-open-pr

