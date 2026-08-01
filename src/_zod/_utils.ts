import { z, zDocumentId as _zDocumentId } from "foundry-helpers";

const zDocumentId = _zDocumentId();

function zForceSafeParse<T extends z.ZodType>(zod: Maybe<T>, data: z.input<T>): z.output<T> {
    return zod?.safeParse(data)?.data ?? zod?.safeParse({})?.data ?? ({} as z.output<T>);
}

export { zDocumentId, zForceSafeParse };
