import { Formatter, Result, Schema } from "effect";

export const decodeUnknownOrThrow = <S extends Schema.Top>(
  schema: S,
  input: unknown,
  subject: string,
): S["Type"] => {
  const result = Schema.decodeUnknownResult(
    schema as unknown as Schema.Decoder<S["Type"], never>,
  )(input);

  if (Result.isFailure(result)) {
    throw new Error(
      `${subject} failed Effect Schema validation:\n${Formatter.format(
        result.failure,
        { space: 2 },
      )}`,
    );
  }

  return result.success;
};
