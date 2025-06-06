# Currency Formatting

This module contains helpers to format currencies in various formats.

The formatters are a work in progress, and used to illustrate what a techincal implementation for the various currency formatting requirements at Xverse may look like. Their output may not be up to spec.

Some documents related to currency formatting:

- [Formatting Currencies](https://www.notion.so/xverseapp/Formatting-Currencies-16d5520b9dee80b39514c19d0876c91b?pvs=4)
- [Formatting Numbers (Large & Decimals)](https://www.notion.so/xverseapp/Formatting-Numbers-Large-Decimals-16d5520b9dee801bb80bd32683dd5d69?pvs=4)
- [Number Formatting](https://www.notion.so/xverseapp/WIP-Number-formatting-1bc5520b9dee80518955c803f9053307)
- [Currency Conversion](https://www.notion.so/xverseapp/draft-wip-Currency-conversion-endpoint-1b55520b9dee806bb7f1f73f4680bc17)

## Implementation

- Each currency, identified by its `CurrencyId`, has its own formatter.
- Formatters have an `amount` parameter denominated in the currency's base unit (e.g., cents for USD, sats for BTC, fri for Starknet). Decimals are allowed.
- Formatters have a `unit` parameter to express the unit of measurment the formatted result should use. Each formatter can define its own units. For convenience, a "default" unit is provided.
- Other options, such as `locale` or `currencyDisplay`, are intended as hints to the formatter. Due to the complexities involved, they are applied on a "best effort" basis and may be ignored.
- A formatter may define additional options it requries.
