function show_bgr_startup -d "Display running bgr background processes on shell startup"
    set -l bgr_bin "$HOME/.config/dotfiles/bin/bgr"

    if test -x "$bgr_bin"
        "$bgr_bin" shell-display 2>/dev/null </dev/null
    end
end
