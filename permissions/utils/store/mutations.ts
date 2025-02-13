import { ClientMetadata, type Client, type Permission, type PermissionsStore, type Resource } from '../../store';

// A simple deep object cloning helper, good enough for what is needed in this
// file, and avoids having to add lodash cloneDeep to the project deps.
function cloneDeep(obj: unknown) {
  return JSON.parse(JSON.stringify(obj));
}

export function addClient(store: PermissionsStore, client: Client): PermissionsStore {
  if (store.clients.some((c) => c.id === client.id)) {
    // Return the store if the client already exists.
    return store;
  }

  const nextClients = [...store.clients, cloneDeep(client)];
  return { ...store, clients: nextClients };
}

export function removeAllClientPermissions(store: PermissionsStore, clientId: Client['id']): PermissionsStore {
  const nextPermissions = store.permissions.filter((p) => p.clientId !== clientId);
  return { ...store, permissions: nextPermissions };
}

export function removeClientMetadata(store: PermissionsStore, clientId: Client['id']): PermissionsStore {
  const nextClientMetadata = store.clientMetadata.filter((m) => m.clientId !== clientId);
  return { ...store, clientMetadata: nextClientMetadata };
}

export function setClientMetadata(store: PermissionsStore, metadata: ClientMetadata): PermissionsStore {
  const nextClientMetadata = store.clientMetadata.filter((m) => m.clientId !== metadata.clientId);
  nextClientMetadata.push(cloneDeep(metadata));
  return { ...store, clientMetadata: nextClientMetadata };
}

export function removeClient(store: PermissionsStore, clientId: Client['id']): PermissionsStore {
  let nextStore = removeAllClientPermissions(store, clientId);
  nextStore = removeClientMetadata(nextStore, clientId);
  nextStore.clients = store.clients.filter((c) => c.id !== clientId);

  return nextStore;
}

export function removeAllClients(store: PermissionsStore): PermissionsStore {
  return { ...store, clients: [], clientMetadata: [], permissions: [] };
}

export function addResource(store: PermissionsStore, resource: Resource): PermissionsStore {
  if (store.resources.some((r) => r.id === resource.id)) {
    // Return the store if the resource already exists.
    return store;
  }

  const nextResources = [...store.resources, cloneDeep(resource)];
  return { ...store, resources: nextResources };
}

export function removeResource(store: PermissionsStore, resourceId: Resource['id']): PermissionsStore {
  const nextPermissions = store.permissions.filter((p) => p.resourceId !== resourceId);
  const nextResources = store.resources.filter((r) => r.id !== resourceId);
  return { ...store, permissions: nextPermissions, resources: nextResources };
}

export function setPermission(store: PermissionsStore, permission: Permission): PermissionsStore {
  // Ensure both the client and resource exist
  const clientExists = store.clients.some((c) => c.id === permission.clientId);
  const resourceExists = store.resources.some((r) => r.id === permission.resourceId);
  if (!clientExists || !resourceExists) {
    throw new Error('Attempted to set permission with non-existent client or resource.');
  }

  const existingPermission = store.permissions.find(
    (p) => p.type === permission.type && p.clientId === permission.clientId && p.resourceId === permission.resourceId,
  );

  if (existingPermission) {
    // First remove the existing permission...
    const nextPermissions = store.permissions.filter((p) => p !== existingPermission);

    // ...then add the updated permission.
    nextPermissions.push(cloneDeep(permission));
    return { ...store, permissions: nextPermissions };
  }

  const nextPermissions = [...store.permissions, cloneDeep(permission)];
  return { ...store, permissions: nextPermissions };
}

export function removePermission(
  store: PermissionsStore,
  type: Permission['type'],
  clientId: Permission['clientId'],
  resourceId: Permission['resourceId'],
): PermissionsStore {
  const nextPermissions = store.permissions.filter(
    (p) => p.type !== type || p.clientId !== clientId || p.resourceId !== resourceId,
  );
  return { ...store, permissions: nextPermissions };
}
