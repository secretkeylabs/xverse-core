import * as v from 'valibot';
import { actionDescriptionSchema } from './common';

export const walletResourceSchema = v.object({
  type: v.literal('wallet'),
  id: v.literal('wallet'),
  name: v.literal('Wallet'),
});

export const walletActionsSchema = v.object({
  readNetwork: v.optional(v.boolean()),
});
export const walletActionsDescriptionSchema = v.record(v.keyof(walletActionsSchema), actionDescriptionSchema);
export type AccountActionsDescription = v.InferOutput<typeof walletActionsDescriptionSchema>;
export const walletIdSchema = v.literal('wallet');
export const walletPermissionSchema = v.object({
  type: v.literal('wallet'),
  resourceId: walletIdSchema,
  clientId: v.string(),
  actions: walletActionsSchema,
});
