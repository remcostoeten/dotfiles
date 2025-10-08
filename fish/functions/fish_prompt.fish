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
    
    echo -n (set_color brblack)'['(set_color brcyan)(date "+%H:%M")(set_color brblack)'] '
    
    if test -n "$lang_icon"
        echo -n (set_color brmagenta)"$lang_icon "(set_color normal)
    end
    
    echo -n (set_color bryellow --bold)"$short_pwd "(set_color normal)
    
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1
        set -l branch (git symbolic-ref --short HEAD 2>/dev/null; or git describe --tags --exact-match 2>/dev/null; or git rev-parse --short HEAD 2>/dev/null)
        
        if test -n "$branch"
            echo -n (set_color brblack)'('(set_color brgreen)" $branch"(set_color brblack)') '(set_color normal)
        end
    end
    
    if test $last_status -ne 0
        echo -n (set_color brred --bold)'✘ '(set_color normal)
    else
        echo -n (set_color brgreen --bold)'➜ '(set_color normal)
    end
end
