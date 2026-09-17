import importlib.machinery
import importlib.util
import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path


def load_tree_module():
    path = Path(__file__).parents[1] / "tree"
    loader = importlib.machinery.SourceFileLoader("dotfiles_tree", str(path))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    module = importlib.util.module_from_spec(spec)
    sys.modules[loader.name] = module
    loader.exec_module(module)
    return module


tree = load_tree_module()


class FreeModeTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        for name in (".config", ".secrets", "app", "lib"):
            (self.root / name).mkdir()
        (self.root / "app" / "components").mkdir()
        options = tree.Options(
            path=self.root,
            mode="ui",
            free_mode=True,
            depth=3,
            hidden=True,
            git_ignore=False,
            default_ignore=False,
        )
        self.ui = tree.TreeUI(options)

    def tearDown(self):
        self.temporary_directory.cleanup()

    def test_numbering_ignores_dot_folders(self):
        self.assertEqual(["app", "lib"], [path.name for path in self.ui.numbered_folders()])

    def test_number_space_toggles_folder_and_strips_number(self):
        self.ui.type_free_character("1", 1.0)
        handled = self.ui.type_free_character(" ", 1.1)

        self.assertTrue(handled)
        self.assertEqual("", self.ui.query)
        self.assertNotIn(self.root / "app", self.ui.expanded)

    def test_slow_number_space_remains_search_text(self):
        self.ui.type_free_character("1", 1.0)
        handled = self.ui.type_free_character(" ", 1.0 + tree.FREE_CHORD_SECONDS + 0.01)

        self.assertFalse(handled)
        self.assertEqual("1 ", self.ui.query)

    def test_double_space_toggles_all_and_strips_spaces(self):
        self.ui.type_free_character(" ", 1.0)
        handled = self.ui.type_free_character(" ", 1.1)

        self.assertTrue(handled)
        self.assertEqual("", self.ui.query)
        self.assertEqual({self.root}, self.ui.expanded)

    def test_slow_double_space_remains_search_text(self):
        self.ui.type_free_character(" ", 1.0)
        handled = self.ui.type_free_character(" ", 1.0 + tree.FREE_CHORD_SECONDS + 0.01)

        self.assertFalse(handled)
        self.assertEqual("  ", self.ui.query)

    def test_backspace_cancels_pending_double_space(self):
        self.ui.type_free_character(" ", 1.0)
        self.ui.handle_free_key(127)
        handled = self.ui.type_free_character(" ", 1.1)

        self.assertFalse(handled)
        self.assertEqual(" ", self.ui.query)

    def test_free_subcommand_has_dedicated_help(self):
        options, _ = tree.load_base_options(["free", "--help"])
        options, action, action_value = tree.parse_args(["free", "--help"], options)
        output = io.StringIO()

        with redirect_stdout(output):
            tree.run_action(action, action_value, options)

        self.assertIn("free — type-to-search", output.getvalue())
        self.assertIn("<number> Space", output.getvalue())
        self.assertIn("350 ms", output.getvalue())


if __name__ == "__main__":
    unittest.main()
