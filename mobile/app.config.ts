import type { ConfigContext, ExpoConfig } from "expo/config";
import { withAndroidManifest } from "@expo/config-plugins";

const withAndroidCleartextTraffic = (config: ExpoConfig, enabled: boolean): ExpoConfig =>
  withAndroidManifest(config, config => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      if (enabled) application.$["android:usesCleartextTraffic"] = "true";
      else delete application.$["android:usesCleartextTraffic"];
    }
    return config;
  });

export default ({ config }: ConfigContext): ExpoConfig => {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const plugins = [
    ...(config.plugins ?? []),
    [withAndroidCleartextTraffic, isDevelopment],
  ] as ExpoConfig["plugins"];

  return { ...config, name: config.name ?? "Agri-One", slug: config.slug ?? "agri-one", plugins };
};
