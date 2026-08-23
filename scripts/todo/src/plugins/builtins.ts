import { addPlugin } from "./add";
import { configPlugin } from "./config";
import { helpPlugin } from "./help";
import { interactivePlugin } from "./interactive";
import { lifecyclePlugin } from "./lifecycle";
import { removePlugin } from "./remove";
import { tasksPlugin } from "./tasks";
import { undoPlugin } from "./undo";
import type { TodoPlugin } from "./types";

export const builtInPlugins: TodoPlugin[] = [addPlugin, configPlugin, helpPlugin, interactivePlugin, lifecyclePlugin, removePlugin, tasksPlugin, undoPlugin];
