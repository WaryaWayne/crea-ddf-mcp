import { Schema } from "effect";

export class DdfMcpValidationError
  extends Schema.TaggedErrorClass<DdfMcpValidationError>()(
    "DdfMcpValidationError",
    {
      message: Schema.String,
    },
  )
{}

export class DdfMcpDecodeError
  extends Schema.TaggedErrorClass<DdfMcpDecodeError>()("DdfMcpDecodeError", {
    message: Schema.String,
    subject: Schema.String,
  })
{}
