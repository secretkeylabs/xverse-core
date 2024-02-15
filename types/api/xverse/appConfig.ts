export type FeaturedDapp = {
  name: string;
  url: string;
  icon: string;
  description: string;
  order: number;
  banner?: string;
}

export type DappSectionData = {
    section: string;
    view: string;
    apps: FeaturedDapp[];
}

export type AppConfig = {
  btcApiURL: string;
}
