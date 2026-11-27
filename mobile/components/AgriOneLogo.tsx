import { Image } from "react-native";

const agriOneLogo = require("../assets/images/agri-one-logo.png.jpeg");

/** Displays the supplied Agri-One master logo without cropping or distortion. */
export function AgriOneLogo({ size = 104 }: { size?: number }) {
  return <Image
    accessible
    accessibilityLabel="Agri-One logo"
    source={agriOneLogo}
    resizeMode="contain"
    style={{ width: size, height: size }}
  />;
}
