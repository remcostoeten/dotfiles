# Fish completions for rec

function __rec_seen_command
    __fish_seen_subcommand_from deliver master region gif clip upload edit latest open play help
end

function __rec_complete_commands
    printf '%s\t%s\n' deliver 'High quality, smaller upload-ready file'
    printf '%s\t%s\n' master 'Near-lossless capture for editing'
    printf '%s\t%s\n' region 'Select a screen region'
    printf '%s\t%s\n' gif 'Short animated GIF capture'
    printf '%s\t%s\n' clip 'General clip preset'
    printf '%s\t%s\n' upload 'Upload-ready preset'
    printf '%s\t%s\n' edit 'Near-lossless editing preset'
    printf '%s\t%s\n' latest 'Print newest recording path'
    printf '%s\t%s\n' open 'Open recordings folder'
    printf '%s\t%s\n' play 'Open newest recording'
    printf '%s\t%s\n' help 'Show help'
end

function __rec_complete_classes
    if command -q xdotool
        xdotool search --onlyvisible --class . 2>/dev/null |
            while read -l window_id
                xprop -id "$window_id" WM_CLASS 2>/dev/null |
                    string replace -r '^WM_CLASS\\(STRING\\) = ' '' |
                    string replace -a '"' '' |
                    string split ', ' |
                    string trim
            end |
            sort -u
    end
end

function __rec_register_completions
    set -l command_name $argv[1]

    complete -c $command_name -f

    complete -c $command_name -n 'not __rec_seen_command' -a '(__rec_complete_commands)' -d 'Command'

    complete -c $command_name -s h -l help -d 'Show help'
    complete -c $command_name -s i -l interactive -d 'Prompt for options interactively'
    complete -c $command_name -l audio -d 'Capture desktop audio'
    complete -c $command_name -l active -d 'Record the active window'
    complete -c $command_name -l region -d 'Select a screen region'
    complete -c $command_name -l dora -d 'Record the Dora window'
    complete -c $command_name -l copy-path -d 'Copy output path after recording'
    complete -c $command_name -l play -d 'Open recording after it finishes'
    complete -c $command_name -l notify -d 'Send desktop notifications'
    complete -c $command_name -l no-notify -d 'Disable desktop notifications'

    complete -c $command_name -l fps -r -d 'Capture frame rate' -a '30 60 120 144'
    complete -c $command_name -l countdown -r -d 'Countdown before recording' -a '0 3 5 10'
    complete -c $command_name -l name -r -d 'Window title to match'
    complete -c $command_name -l class -r -d 'WM_CLASS to match' -a '(__rec_complete_classes)'
    complete -c $command_name -l output-dir -r -F -d 'Output directory'
    complete -c $command_name -l prefix -r -d 'Output filename prefix'
end

__rec_register_completions rec
__rec_register_completions dora-rec
