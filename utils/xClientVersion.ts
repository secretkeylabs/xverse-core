/**
 * global variable to set the x-client-version default header within api providers
 */
let X_CLIENT_VERSION: string;

export const getXClientVersion = (): string | undefined => X_CLIENT_VERSION;

export const setXClientVersion = (version: string): void => {
  X_CLIENT_VERSION = version;
};
