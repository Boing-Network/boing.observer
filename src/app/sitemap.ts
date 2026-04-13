import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/tools`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${SITE_URL}/faucet`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/tools/qa-check`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/tools/rpc-catalog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.65,
    },
    {
      url: `${SITE_URL}/tools/node-health`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.65,
    },
    {
      url: `${SITE_URL}/qa`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/tokens`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.82,
    },
    {
      url: `${SITE_URL}/dex/tokens`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.66,
    },
    {
      url: `${SITE_URL}/dex/pools`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.65,
    },
    {
      url: `${SITE_URL}/dex/quote`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.65,
    },
  ];
}
