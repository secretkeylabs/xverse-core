import { makeAccountId, accountIdBrandName, accountIdSchema } from './accountId';
export const account = {
  makeAccountId,
  accountIdBrandName,
  accountIdSchema,
};
export type * as Account from './accountId';

import {
  addClient,
  addResource,
  getClient,
  getClients,
  getClientMetadata,
  getClientPermission,
  getClientPermissions,
  getResource,
  hasPermission,
  makeClientId,
  makePermissionsStore,
  removeAllClientPermissions,
  removeAllClients,
  removeClient,
  removeClientMetadata,
  removePermission,
  removeResource,
  setClientMetadata,
  setPermission,
} from './store';
export type * as Store from './store';

export const store = {
  addClient,
  addResource,
  getClient,
  getClients,
  getClientMetadata,
  getClientPermission,
  getClientPermissions,
  getResource,
  hasPermission,
  makeClientId,
  makePermissionsStore,
  removeAllClientPermissions,
  removeAllClients,
  removeClient,
  removeClientMetadata,
  removePermission,
  removeResource,
  setClientMetadata,
  setPermission,
};

import { nameFromOrigin } from './originName';
export const originName = {
  nameFromOrigin,
};
