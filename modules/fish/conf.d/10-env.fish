set -gx DOTFILES_HOME "$HOME/.config/agnostic-dotfiles"
if test -d "$HOME/.local/bin"
  if not contains "$HOME/.local/bin" $PATH
    set -gx PATH "$HOME/.local/bin" $PATH
  end
end
