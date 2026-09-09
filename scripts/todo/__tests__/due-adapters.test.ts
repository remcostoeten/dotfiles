import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommandRunner, resolveCommandCwd } from "@/src/adapters/command-runner";
import { resolveSoundChoice, toAbsolutePath } from "@/src/adapters/sound";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("default and none are stored as modes without a path", () => {
  expect(resolveSoundChoice("default")).toEqual({ soundMode: "default" });
  expect(resolveSoundChoice("none")).toEqual({ soundMode: "none" });
});

test("a valid mp3 is stored as an absolute path", async () => {
  const directory = await createTemporaryDirectory();
  const path = join(directory, "alert.mp3");
  await writeFile(path, "");

  expect(resolveSoundChoice(path)).toEqual({ soundMode: "custom", soundPath: path });
});

test("a relative sound path is resolved against the given directory", async () => {
  const directory = await createTemporaryDirectory();
  await mkdir(join(directory, "sounds"));
  const path = join(directory, "sounds", "alert.mp3");
  await writeFile(path, "");

  expect(resolveSoundChoice("./sounds/alert.mp3", directory).soundPath).toBe(path);
  expect(resolveSoundChoice("sounds/alert.mp3", directory).soundPath).toBe(path);
  expect(resolveSoundChoice("../sounds/alert.mp3", join(directory, "sounds")).soundPath).toBe(path);
});

test("a leading tilde expands to HOME", () => {
  const home = process.env.HOME ?? "";
  expect(toAbsolutePath("~/Music/reminder.mp3")).toBe(`${home}/Music/reminder.mp3`);
  expect(toAbsolutePath("~")).toBe(home);
});

test("a missing file, a directory, and an unsupported format are all refused", async () => {
  const directory = await createTemporaryDirectory();
  const fakeAudio = join(directory, "folder.mp3");
  await mkdir(fakeAudio);
  const wrongFormat = join(directory, "notes.txt");
  await writeFile(wrongFormat, "");

  expect(() => resolveSoundChoice(join(directory, "missing.mp3"))).toThrow("Sound file not found");
  expect(() => resolveSoundChoice(fakeAudio)).toThrow("Sound path is not a file");
  expect(() => resolveSoundChoice(wrongFormat)).toThrow("Unsupported sound format");
  expect(() => resolveSoundChoice(directory)).toThrow("Unsupported sound format");
});

test("cwd resolution expands, absolutizes, and validates", async () => {
  const directory = await createTemporaryDirectory();
  await mkdir(join(directory, "nested"));

  expect(resolveCommandCwd(directory)).toBe(directory);
  expect(resolveCommandCwd("./nested", directory)).toBe(join(directory, "nested"));
  expect(resolveCommandCwd("pwd", directory)).toBe(directory);
  expect(() => resolveCommandCwd(join(directory, "missing"))).toThrow("Working directory not found");
});

test("a file passed as a working directory is refused", async () => {
  const directory = await createTemporaryDirectory();
  const file = join(directory, "file.txt");
  await writeFile(file, "");

  expect(() => resolveCommandCwd(file)).toThrow("not a directory");
});

test("the command runner reports the exit code and runs in the given directory", async () => {
  const directory = await createTemporaryDirectory();
  const runner = createCommandRunner();

  expect(await runner.run("exit 0", undefined)).toEqual({ exitCode: 0 });
  expect((await runner.run("exit 7", undefined)).exitCode).toBe(7);
  expect(await runner.run(`test "$(pwd)" = "${directory}"`, directory)).toEqual({ exitCode: 0 });
});

test("the command is handed to the shell as one argument, not spliced into a command line", async () => {
  const directory = await createTemporaryDirectory();
  const runner = createCommandRunner();
  const marker = join(directory, "written.txt");

  // The whole string is one argv element, so the redirect is part of the command the user wrote.
  expect((await runner.run(`echo ok > ${marker}`, undefined)).exitCode).toBe(0);
  expect(await Bun.file(marker).text()).toBe("ok\n");
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "todo-adapters-"));
  temporaryDirectories.push(directory);
  return directory;
}
