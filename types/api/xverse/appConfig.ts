export interface FeaturedDappOld {
  name: string;
  url: string;
  image: string;
  description: string;
  order: number;
  banner?: string;
}

export interface FeaturedDapp {
  name: string;
  url: string;
  icon: string;
  description: string;
  order: number;
  banner?: string;
}

export interface AppConfig {
  btcApiURL: string;
}
