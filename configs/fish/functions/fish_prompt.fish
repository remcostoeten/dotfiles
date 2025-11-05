function fish_prompt -d "Modern minimal prompt with git context and status"
    set -l last_status $status
    set -l cyan (set_color cyan)
    set -l blue (set_color blue)
    set -l green (set_color green)
    set -l yellow (set_color yellow)
    set -l magenta (set_color magenta)
    set -l red (set_color red)
    set -l dim (set_color --dim 666)
    set -l normal (set_color normal)
    function detect_language
        if test -f package.json
            echo "󰎙"
        else if test -f Cargo.toml
            echo "🦀"
        else if test -f go.mod
            echo "🐹"
        else if test -f pyproject.toml; or test -f requirements.txt; or test -f setup.py
            echo "🐍"
        else if test -f composer.json
            echo "🐘"
        else if test -f Gemfile
            echo "💎"
        else if test -f pom.xml; or test -f build.gradle
            echo "☕"
        else if count *.csproj >/dev/null 2>&1
            echo "󰌛"
        else if test -f mix.exs
            echo "🔮"
        else if test -f pubspec.yaml
            echo "🎯"
        else
            echo ""
        end
    end

    set -l lang_icon (detect_language)
    set -l short_pwd (prompt_pwd)

    # Start with icon and path
    echo -n ""

    # Language icon if available
    if test -n "$lang_icon"
        echo -n "$magenta$lang_icon $normal"
    end

    # Current directory
    echo -n "$blue$short_pwd$normal"

    # Git status
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1
        set -l branch (git symbolic-ref --short HEAD 2>/dev/null; or git describe --tags --exact-match 2>/dev/null; or git rev-parse --short HEAD 2>/dev/null)
        set -l is_dirty (git status --porcelain 2>/dev/null | head -n1)

        if test -n "$branch"
            if test -n "$is_dirty"
                echo -n " $dim•$yellow $branch$normal"
            else
                echo -n " $dim•$green $branch$normal"
            end
        end
    end

    # Prompt character
    echo -n ""
    if test $last_status -ne 0
        echo -n " $red❯$normal "
    else
        echo -n " $green❯$normal "
    end
end
