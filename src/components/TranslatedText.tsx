import {
  Text as NativeText,
  type TextProps,
} from "react-native";
import type { ReactNode } from "react";

import { t } from "../i18n";

function translateNode(node: ReactNode): ReactNode {
  if (typeof node === "string") return t(node);
  if (Array.isArray(node)) return node.map(translateNode);
  return node;
}

export function TranslatedText({
  children,
  ...props
}: TextProps & { children?: ReactNode }) {
  return <NativeText {...props}>{translateNode(children)}</NativeText>;
}
