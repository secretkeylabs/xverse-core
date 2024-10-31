import * as v from 'valibot';
import {
  clientId as clientIdSchema,
  ClientMetadata,
  ClientMetadataTable,
  type Client,
  type ClientsTable,
  type Permission,
  type PermissionsStore,
  type PermissionsTable,
  type Resource,
  type ResourcesTable,
} from '../store';
import { error, success, type Result } from '../../utils/safe';

// Queries

export function getResource(resources: ResourcesTable, resourceId: Resource['id']): Resource | undefined {
  return resources.find((r) => r.id === resourceId);
}
export function getClientPermissions(permissions: PermissionsTable, clientId: Client['id']): Permission[] {
  return permissions.filter((p) => p.clientId === clientId);
}
export function getClientPermission(
  permissions: PermissionsTable,
  type: Permission['type'],
  clientId: Client['id'],
  resourceId: Resource['id'],
) {
  return permissions.find((p) => p.type === type && p.clientId === clientId && p.resourceId === resourceId);
}

export function getClient(permissionStore: PermissionsStore, clientId: Client['id']): Client | undefined {
  return permissionStore.clients.find((c) => c.id === clientId);
}

/**
 * Get a client Metadata by its ID.
 */
export function getClientMetadata(
  permissionStore: PermissionsStore,
  clientId: Client['id'],
): ClientMetadata | undefined {
  return permissionStore.clientMetadata.find((c) => c.clientId === clientId);
}

export function hasPermission(
  permissions: PermissionsTable,
  { clientId, type, resourceId, actions }: Permission,
): boolean {
  const permission = permissions.find((p) => p.clientId === clientId && p.type === type && p.resourceId === resourceId);
  if (!permission) {
    return false;
  }

  for (const [key, value] of Object.entries(actions)) {
    // @ts-expect-error - Object.entries returns keys with a string type,
    // which doesn't match the index signature. However, the check above
    // ensures the types of the permissions objects match.
    if (permission.actions[key] !== value) {
      return false;
    }
  }

  return true;
}

// Mutations

export function addClient(clients: ClientsTable, client: Client) {
  if (clients.some((c) => c.id === client.id)) {
    console.warn('Attempted to add a client that already exists. Skipping.');
    return;
  }
  clients.push(client);
}
export function removeAllClientPermissions(permissions: PermissionsTable, clientId: Client['id']) {
  for (let i = permissions.length - 1; i >= 0; i--) {
    if (permissions[i].clientId === clientId) {
      permissions.splice(i, 1);
    }
  }
}

export function removeClientMetadata(clientMetadata: ClientMetadataTable, clientId: Client['id']) {
  for (let i = clientMetadata.length - 1; i >= 0; i--) {
    if (clientMetadata[i].clientId === clientId) {
      clientMetadata.splice(i, 1);
    }
  }
}

export function setClientMetadata(clientMetadata: ClientMetadataTable, metadata: ClientMetadata) {
  // Remove existing metadata for the client
  removeClientMetadata(clientMetadata, metadata.clientId);

  // Push new metadata
  clientMetadata.push(metadata);
}

export function removeClient({ permissions, clients, clientMetadata }: PermissionsStore, clientId: Client['id']) {
  removeAllClientPermissions(permissions, clientId);
  removeClientMetadata(clientMetadata, clientId);

  for (let i = clients.length - 1; i >= 0; i--) {
    if (clients[i].id === clientId) {
      clients.splice(i, 1);
    }
  }
}

export function removeAllClients(permissionStore: PermissionsStore) {
  permissionStore.clients = [];
  permissionStore.clientMetadata = [];
  permissionStore.permissions = [];
}

export function addResource(resources: ResourcesTable, resource: Resource) {
  if (resources.some((r) => r.id === resource.id)) {
    console.warn('Attempted to add a resource that already exists. Skipping.');
    return;
  }
  resources.push(resource);
}
export function removeResource(resources: ResourcesTable, resourceId: Resource['id']) {
  for (let i = resources.length - 1; i >= 0; i--) {
    if (resources[i].id === resourceId) {
      resources.splice(i, 1);
    }
  }
}
export function setPermission(
  clients: ClientsTable,
  resources: ResourcesTable,
  permissions: PermissionsTable,
  permission: Permission,
) {
  // Ensure both the client and resource exist
  const clientExists = clients.some((c) => c.id === permission.clientId);
  const resourceExists = resources.some((r) => r.id === permission.resourceId);
  if (!clientExists || !resourceExists) {
    console.warn('Attempted to set permission with non-existent client or resource.');
    return;
  }

  const existingPermission = permissions.find(
    (p) => p.type === permission.type && p.clientId === permission.clientId && p.resourceId === permission.resourceId,
  );

  if (existingPermission) {
    for (const [key, value] of Object.entries(permission.actions)) {
      // @ts-expect-error - Object.entries returns keys with a string type,
      // which doesn't match the index signature. However, the check above
      // ensures the types of the permissions objects match.
      existingPermission.actions[key] = value;
    }
    return;
  }

  permissions.push(permission);
}
export function removePermission(
  permissions: PermissionsTable,
  type: Permission['type'],
  clientId: Permission['clientId'],
  resourceId: Permission['resourceId'],
) {
  for (let i = permissions.length - 1; i >= 0; i--) {
    if (
      permissions[i].type === type &&
      permissions[i].clientId === clientId &&
      permissions[i].resourceId === resourceId
    ) {
      permissions.splice(i, 1);
      break; // There should only be one matching permission.
    }
  }
}

// Helpers

/**
 * Utility function to create a client ID.
 */
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
