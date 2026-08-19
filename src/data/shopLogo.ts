import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { Platform } from "react-native";

const MAX_WIDTH = 400;

export async function pickShopLogo(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Accès aux photos refusé.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ["images"],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const source = result.assets[0]?.uri;
  if (!source) return null;
  const resized = await ImageManipulator.manipulateAsync(
    source,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.PNG },
  );
  return uriToDataUri(resized.uri);
}

async function uriToDataUri(uri: string): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error("Le logo n’a pas pu être lu."));
      reader.readAsDataURL(blob);
    });
  }
  const file = new File(uri);
  const base64 = file.base64();
  const mime = uri.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/jpeg";
  return `data:${mime};base64,${base64}`;
}