if status is-interactive
  for f in ~/.config/fish/conf.d/*.fish
    source $f
  end
end
