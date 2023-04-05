import AppClient from "ledger-bitcoin";

export type Transport = ConstructorParameters<typeof AppClient>[0];