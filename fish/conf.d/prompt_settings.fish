# Prompt settings
# Set to true for two-line prompt, false for single-line
set -g prompt_two_line true

# Function to toggle prompt style
function toggle_prompt_style
    if test "$prompt_two_line" = true
        set -g prompt_two_line false
    else
        set -g prompt_two_line true
    end
end