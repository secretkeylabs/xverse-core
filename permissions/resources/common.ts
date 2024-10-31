import * as v from 'valibot';

export const actionDescriptionSchema = v.object({
  name: v.string(),
  description: v.variant('type', [
    v.object({ type: v.literal('single'), value: v.string() }),
    v.object({ type: v.literal('multiple'), values: v.array(v.string()) }),
  ]),
});

export type ActionDescription = v.InferOutput<typeof actionDescriptionSchema>;
