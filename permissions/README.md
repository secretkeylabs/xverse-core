# Permissions

Some wallet operations require client apps to have been granted permissions.

A client app is considered "connected" to the wallet when it has been registered. Apps can manually register to set their name and a short description. Apps are also automatically registered after having been granted permissions.

# Technical overview

A permission can be interpreted to have a "composite primary key" consisting of the three fields,

- `type`: resource type
- `clientId`
- `resourceId`

Together with the `actions` field, which are tied to the resource type, define what clients are allowed to do.

All clients, resources and permissions are available through a single object, the "permissions store". The store object is stored as a whole in the available device storage such as `chrome.storage.local` for browsers.

The exports available from [`utils.ts`](./utils.ts) can be used to perform all necessary permissions operations. When using them within a reactive context such as a React application, it is necessary to construct reactive helpers to ensure the app is using the latest permissions data available.

## Managing IDs

To manage permissions, IDs are assigned to entities such as clients or resources. Setting the type of the ID as `string` can be error prone, allowing any arbitrary string to be accidentally set as an ID. Therefore, the IDs are branded ([1](https://valibot.dev/api/brand/), [2](https://www.youtube.com/watch?v=Yz8ySbaeCf8)) and helpers are provided to help manage them to help ensure they are valid.

### Account IDs

- Account resource ID (hash of Account ID below)
- Account resource account ID (hash of account id + other params)
- "Account ID", which is actually the BIP44 account index

## Resources

Resource objects describe a given resource. They have an ID of their own in addition to possibly referencing the ID of the actual resource itself. This additional indirection is to allow for resources to evolve independently of the resource schema referencing them, thus decoupling permissions logic from that of resources.

## "Database" schema

It would be Shift from map/set to arrays/objects
