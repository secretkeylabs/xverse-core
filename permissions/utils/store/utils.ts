import * as v from 'valibot';
import { clientId as clientIdSchema, type Client, type PermissionsStore } from '../../store';
import { error, success, type Result } from '../../../utils/safe';

export function makeClientId(args: { origin: string }): Result<Client['id']> {
  const result = v.safeParse(clientIdSchema, args.origin);
  if (!result.success) {
    return error({
      name: 'ValidationError',
      message: 'Failed to create client ID.',
      data: result.issues,
    });
  }

  return success(result.output);
}

export function makePermissionsStore(): PermissionsStore {
  return {
    version: 4,
    clients: [],
    clientMetadata: [],
    resources: [],
    permissions: [],
  };
}
