import { account, common, wallet } from './resources/index';
export const resources = {
  account,
  common,
  wallet,
};
export type * as Resources from './resources/index';

import { store as storeUtils, account as accountUtils, originName } from './utils/index';
export const utils = {
  store: storeUtils,
  account: accountUtils,
  originName,
};
export type * as Utils from './utils/index';

import {
  clientId,
  client,
  clientMetadata,
  clientMetadataTable,
  clientsTable,
  permission,
  permissionsStore,
  permissionsTable,
  resource,
  resourcesTable,
} from './store';
export const store = {
  clientId,
  client,
  clientMetadata,
  clientMetadataTable,
  clientsTable,
  resource,
  resourcesTable,
  permission,
  permissionsTable,
  permissionsStore,
};
export type * as Store from './store';
