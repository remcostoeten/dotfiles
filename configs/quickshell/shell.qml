//@ pragma UseQApplication

import Quickshell

ShellRoot {
    Variants {
        model: Quickshell.screens

        Scope {
            id: screenScope

            required property var modelData

            Bar {
                screen: screenScope.modelData
            }
        }
    }
}
