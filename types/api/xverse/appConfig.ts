export interface FeaturedDapp {
  name: string;
  url: string;
  image: string;
  description: string;
  isFeatured: boolean;
  order: number;
  banner?: string;
}

export interface AppConfig {
  btcApiURL: string;
}
