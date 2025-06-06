/* eslint-disable import/prefer-default-export */
const originToName: Record<string, string> = {
  'https://app.alexlab.co': 'ALEX',
  'https://app.arkadiko.finance': 'Arkadiko Protocol',
  'https://app.bitflow.finance': 'Bitflow',
  'https://app.console.xyz': 'Console',
  'https://app.liquidium.fi': 'Liquidium',
  'https://app.lisalab.io': 'LISA',
  'https://app.stackingdao.com': 'Stacking DAO',
  'https://app.velar.co': 'Velar',
  'https://app.xlink.network': 'XLink',
  'https://brc20.xverse.app': 'Xverse BRC20 Mint',
  'https://btc.fluidtokens.com': 'FluidTokens on Bitcoin',
  'https://chisel.xyz': 'Chisel',
  'https://gamma.io': 'Gamma',
  'https://geniidata.com': 'GeniiData',
  'https://idclub.io': 'IDclub',
  'https://inscribegpt.xverse.app': 'Xverse Inscribe GPT',
  'https://luminex.io': 'Luminex',
  'https://magiceden.io': 'Magic Eden',
  'https://magisat.io': 'Magisat',
  'https://mystic.com': 'Mystic',
  'https://ordbit.io': 'Ordbit',
  'https://ordinals.market': 'Ordinals.Market',
  'https://ordinalsbot.com': 'OrdinalsBot',
  'https://ordiscan.com': 'Ordiscan',
  'https://ordzaar.com': 'Ordzaar',
  'https://pool.xverse.app': 'Xverse Pool',
  'https://pro.whales.market': 'Whales Market',
  'https://runealpha.xyz': 'Rune Alpha',
  'https://runesterminal.io': 'Runes Terminal',
  'https://sating.io': 'Sating.io',
  'https://satscribe.xyz': 'Satscribe',
  'https://unisat.io': 'Unisat',
  'https://wallet.xverse.app': 'Xverse App',
  'https://www.bsquared.network': 'B2 Network',
  'https://www.dots.so': 'BNS | Bitcoin Name System',
  'https://www.dotswap.app': 'DotSwap',
  'https://www.ninjalerts.com': 'Ninjalerts',
  'https://www.okx.com': 'OKX',
  'https://www.ord.io': 'Ord.io',
  'https://www.ordz.games': 'OrdzGames',
  'https://www.runessance.io': 'Runessance',
  'https://www.saturnbtc.io': 'Saturn',
};

export function nameFromOrigin(origin: string): string {
  return originToName[origin] ?? origin;
}
