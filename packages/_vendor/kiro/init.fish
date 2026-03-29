# DOCSTRING: Load Kiro shell integration when running inside Kiro

if string match -q "$TERM_PROGRAM" "kiro"
    . (kiro --locate-shell-integration-path fish)
end
