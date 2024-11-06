import * as v from 'valibot';
import { accountPermissionSchema, accountResourceSchema } from './resources/account';
import { walletPermissionSchema, walletResourceSchema } from './resources/wallet';

// Clients

export const clientId = v.pipe(
  v.string(),
  v.url(),
  v.transform((url) => new URL(url).origin),
  v.brand('ClientId'),
);

export const client = v.object({
  id: clientId,
  origin: v.string(),
  description: v.optional(v.string()),
});

export type Client = v.InferOutput<typeof client>;

export const clientsTable = v.array(client);

export type ClientsTable = v.InferOutput<typeof clientsTable>;

/**
 * @public
 */
export const clientMetadata = v.object({
  clientId: client.entries.id,
  lastUsed: v.optional(v.number()),
});

/**
 * @public
 */
export type ClientMetadata = v.InferOutput<typeof clientMetadata>;

/**
 * @public
 */
export const clientMetadataTable = v.array(clientMetadata);

/**
 * @public
 */
export type ClientMetadataTable = v.InferOutput<typeof clientMetadataTable>;

// Resources

export const resource = v.variant('type', [accountResourceSchema, walletResourceSchema]);

export type Resource = v.InferOutput<typeof resource>;

export const resourcesTable = v.array(resource);

export type ResourcesTable = v.InferOutput<typeof resourcesTable>;

// Permissions

export const permission = v.variant('type', [accountPermissionSchema, walletPermissionSchema]);
export type Permission = v.InferOutput<typeof permission>;

export const permissionsTable = v.array(permission);

export type PermissionsTable = v.InferOutput<typeof permissionsTable>;

// Permissions Store

export const permissionsStore = v.object({
  version: v.literal(4),
  clients: clientsTable,
  clientMetadata: clientMetadataTable,
  resources: resourcesTable,
  permissions: permissionsTable,
});

export type PermissionsStore = v.InferOutput<typeof permissionsStore>;
