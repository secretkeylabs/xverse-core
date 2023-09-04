# Xverse Core

- Folders are separated according to functionaility e.g. wallet works with getting assets and balances, transaction works with creating transaction objects.
- Files under `/api` contains functions that are making external API calls, the file name should indicate which service it is calling.
- All types are under the `types` directory, some are interfaces that maps to API responses, some are data types for business logic.
- All export should be group and exported using `index.ts`.
