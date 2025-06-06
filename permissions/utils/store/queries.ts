import { ClientMetadata, type Client, type Permission, type PermissionsStore, type Resource } from '../../store';

export function getResource(store: PermissionsStore, resourceId: Resource['id']): Resource | undefined {
  return store.resources.find((r) => r.id === resourceId);
}
export function getClientPermissions(store: PermissionsStore, clientId: Client['id']): Permission[] {
  return store.permissions.filter((p) => p.clientId === clientId);
}
export function getClientPermission(
  permissionStore: PermissionsStore,
  type: Permission['type'],
  clientId: Client['id'],
  resourceId: Resource['id'],
) {
  return permissionStore.permissions.find(
    (p) => p.type === type && p.clientId === clientId && p.resourceId === resourceId,
  );
}

export function getClient(store: PermissionsStore, clientId: Client['id']): Client | undefined {
  return store.clients.find((c) => c.id === clientId);
}

export function getClients(permissionStore: PermissionsStore): Client[] {
  return permissionStore.clients;
}

/**
 * Get a client Metadata by its ID.
 */
export function getClientMetadata(store: PermissionsStore, clientId: Client['id']): ClientMetadata | undefined {
  return store.clientMetadata.find((c) => c.clientId === clientId);
}

export function hasPermission(store: PermissionsStore, { clientId, type, resourceId, actions }: Permission): boolean {
  const permission = store.permissions.find(
    (p) => p.clientId === clientId && p.type === type && p.resourceId === resourceId,
  );
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
