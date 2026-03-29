#!/usr/bin/env fish

set -l nvm_script (__dotfiles_vendor_init nvm sh)
set -l nvm_has_fish 0

if test -n "$nvm_script"
    set -g DOTFILES_NVM_PACKAGE $nvm_script
    if string match -q '*.fish' $nvm_script
        source $nvm_script
        set nvm_has_fish 1
    end
end

function __dotfiles_import_env --argument tmpfile
    if not test -f $tmpfile
        return
    end

    while read --null line
        set -l kv (string split -m 1 "=" $line)
        set -l key $kv[1]
        set -l value ""
        if test (count $kv) -gt 1
            set value $kv[2]
        end

        switch $key
            case "" _ PWD OLDPWD SHLVL
                continue
        end

        if test $key = PATH
            for p in (string split ":" $value)
                if test -d "$p"; and not contains "$p" $PATH
                    set -gx PATH $PATH "$p"
                end
            end
        else
            set -gx $key "$value"
        end
    end <$tmpfile
end

if test $nvm_has_fish -eq 0
    if not functions -q nvm
        function nvm --description "Node Version Manager (bash wrapper)"
            set -l script ""
            if set -q DOTFILES_NVM_PACKAGE
                set script $DOTFILES_NVM_PACKAGE
            end

            if not test -f "$script"
                set script (__dotfiles_vendor_init nvm sh)
            end

            if not test -f $script
                echo "nvm: initializer not found at $script" >&2
                return 1
            end

            set -l tmpfile (mktemp)
            if test -z "$tmpfile"
                echo "nvm: failed to create temp file" >&2
                return 1
            end

            set -l escaped_script (string escape -- $script)
            set -l escaped_tmp (string escape -- $tmpfile)
            set -l escaped_args (string escape -- $argv)
            set -l cmd (string join ' ' -- nvm $escaped_args)
            set -l bash_cmd "source $escaped_script; $cmd; set exit_status=\$?; env -0 > $escaped_tmp; exit \$exit_status"

            command bash -lc "$bash_cmd"
            set -l cmd_status $status

            if test $cmd_status -eq 0
                __dotfiles_import_env $tmpfile
            end

            rm -f $tmpfile
            return $cmd_status
        end
    end
end
