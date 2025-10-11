function fish_prompt -d "Custom single-line prompt with time, directory, git, and language detection"
    set -l last_status $status
    
    function detect_language
        if test -f package.json
            echo "󰎙"
        else if test -f Cargo.toml
            echo ""
        else if test -f go.mod
            echo ""
        else if test -f pyproject.toml; or test -f requirements.txt; or test -f setup.py
            echo ""
        else if test -f composer.json
            echo ""
        else if test -f Gemfile
            echo ""
        else if test -f pom.xml; or test -f build.gradle
            echo ""
        else if count *.csproj >/dev/null 2>&1
            echo "󰌛"
        else if test -f mix.exs
            echo ""
        else if test -f pubspec.yaml
            echo ""
        else
            echo ""
        end
    end
    
    set -l lang_icon (detect_language)
    set -l short_pwd (prompt_pwd)
    
    printf "%s[%s%s%s] " "$fish_color_bright_black" "$fish_color_bright_cyan" (date "+%H:%M") "$fish_color_bright_black"
    
    if test -n "$lang_icon"
        printf "%s%s %s" "$fish_color_bright_magenta" "$lang_icon" "$fish_color_reset"
    end
    
    printf "%s%s%s %s" "$fish_color_bright_yellow$fish_color_bold" "$short_pwd" "$fish_color_reset"
    
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1
        set -l branch (git symbolic-ref --short HEAD 2>/dev/null; or git describe --tags --exact-match 2>/dev/null; or git rev-parse --short HEAD 2>/dev/null)
        
        if test -n "$branch"
            printf "%s(%s %s%s) %s" "$fish_color_bright_black" "$fish_color_bright_green" "$branch" "$fish_color_bright_black" "$fish_color_reset"
        end
    end
    
    if test $last_status -ne 0
        printf "%s%s✘ %s" "$fish_color_bright_red$fish_color_bold" "$fish_color_reset"
    else
        printf "%s%s➜ %s" "$fish_color_bright_green$fish_color_bold" "$fish_color_reset"
    end
end
