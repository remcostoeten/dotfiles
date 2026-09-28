import { UserInputError } from "./user-input-error";

export type UnknownTokenKind = "command" | "option" | "setting" | "value";

/** A user-input error whose offending token has a known set of valid alternatives, so it can be autocorrected. */
export class UnknownTokenError extends UserInputError {
  constructor(
    message: string,
    readonly token: string,
    readonly candidates: ReadonlyArray<string>,
    readonly kind: UnknownTokenKind,
  ) {
    super(message);
    this.name = "UnknownTokenError";
  }
}
