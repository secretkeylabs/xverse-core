import {
  accountResourceIdBrandName,
  accountResourceIdSchema,
  accountResourceSchema,
  accountActionsSchema,
  accountActionsDescriptionSchema,
  accountPermissionSchema,
  makeAccountResourceId,
  makeAccountResource,
} from './account';
export const account = {
  accountResourceIdBrandName,
  accountResourceIdSchema,
  accountResourceSchema,
  accountActionsSchema,
  accountActionsDescriptionSchema,
  accountPermissionSchema,
  makeAccountResourceId,
  makeAccountResource,
};
export type * as Account from './account';

import { actionDescriptionSchema } from './common';
export const common = {
  actionDescriptionSchema,
};
export type * as Common from './common';

import {
  walletResourceSchema,
  walletActionsSchema,
  walletIdSchema,
  walletPermissionSchema,
  walletActionsDescriptionSchema,
} from './wallet';
export const wallet = {
  walletResourceSchema,
  walletActionsSchema,
  walletIdSchema,
  walletPermissionSchema,
  walletActionsDescriptionSchema,
};
export type * as Wallet from './wallet';
