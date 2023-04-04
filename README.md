# Xverse Core

## Procedures
Check if your Node.js version is >= 14.
Clone this repository.
Make sure you're logged in to the @secretkeylabs scope on the GitHub NPM package registry. See the Guide
Create a GitHub personal access token (classic)
Run `npm login --scope=@secretkeylabs --registry=https://npm.pkg.github.com`
Username: GITHUB USERNAME Password: PERSONAL_ACCESS_TOKEN Email: PUBLIC-EMAIL-ADDRESS
Run `npm install` to install the dependencies.
Run `npm start`

### Project structure

- Folders are separated according to functionality e.g. wallet works with getting assets and balances, transaction works with creating transaction objects.
- Files under `/api` contains functions that are making external API calls, the file name should indicate which service it is calling.
- All types are under the `types` directory, some are interfaces that maps to API responses, some are data types for business logic.
- All export should be group and exported using `index.ts`.