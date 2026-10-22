/** A command's arguments after the spec parser bound and validated them. */
export class ParsedInput {
  constructor(
    readonly path: ReadonlyArray<string>,
    private readonly argValues: ReadonlyMap<string, string[]>,
    private readonly flagValues: ReadonlyMap<string, string | true>,
    readonly positionals: ReadonlyArray<string>,
  ) {}

  arg(name: string): string {
    const value = this.argValues.get(name)?.[0];
    if (value === undefined) throw new Error(`Argument ${name} was not bound`);
    return value;
  }

  optionalArg(name: string): string | undefined {
    return this.argValues.get(name)?.[0];
  }

  args(name: string): string[] {
    return [...(this.argValues.get(name) ?? [])];
  }

  flag(name: string): boolean {
    return this.flagValues.has(name);
  }

  value(name: string): string | undefined {
    const value = this.flagValues.get(name);
    return typeof value === "string" ? value : undefined;
  }
}
