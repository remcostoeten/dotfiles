#!/usr/bin/env fish

# Helper registration for helper-factory script using register_helper
source (dirname (status --current-filename))/../helper-factory.fish

# Register helper function (replaces create_helper)
function register_helper
    set -l script_name $argv[1]
    set -l help_text $argv[2]
    
    # Create the helper function dynamically
    eval "
    function _"$script_name"_help
        clear
        echo
        echo (set_color --bold cyan)\"   Help for helper-factory   \"(set_color normal)
        echo (set_color yellow)\"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\"(set_color normal)
        echo
        printf \"%s\" \$help_text
        echo
        echo (set_color yellow)\"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\"(set_color normal)
        echo
    end
    "
    
    # Register with the global helper registry
    set -g __helper_registry $__helper_registry $script_name
end

# Register this helper with extracted help text
register_helper "helper-factory" "$__helper_registry\necho\n🚀 Dotfiles Script Collection   "(set_color normal)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"(set_color normal)\necho\n📚 AVAILABLE SCRIPTS"(set_color normal)\n───────────────────────────────────────────────────"(set_color normal)\n""$helper"(set_color normal)" → $parts[1]"\n""$helper"(set_color normal)" → Custom script"\necho\n🔍 USAGE"(set_color normal)\n───────────────────────────────────────────────────"(set_color normal)\n""cfg --help"(set_color normal)" → Show this unified help"\n""[script] --help"(set_color normal)" → Show specific script help"\n""cfg [script]"(set_color normal)" → Run specific script help"\necho\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"(set_color normal)\necho\nAdvanced git commit with conventional commit support"\nCross-platform clipboard operations"\nInteractive port and process management"\nMicrophone testing and audio level monitoring"\nEnhanced directory creation with parent support"\nEnhanced file creation with executable permissions"\nWebcam testing and video device management"\nNode.js development server restart utilities"\nNode.js project cleanup and reset"\nComplete Node.js dependency reinstallation"\n"\n"
