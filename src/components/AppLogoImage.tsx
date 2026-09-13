import { Image, StyleSheet } from "react-native";

const appLogoSource = require("../../assets/app-logo.png");

export function AppLogoImage({
  size = 64,
  accessibilityLabel = "MerchantHQ",
}: {
  size?: number;
  accessibilityLabel?: string;
}) {
  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      source={appLogoSource}
      style={[styles.logo, { width: size, height: size }]}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    borderRadius: 16,
    resizeMode: "contain",
  },
});