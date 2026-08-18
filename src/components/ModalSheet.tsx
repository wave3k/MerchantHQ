import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "./Icon";
import type { ReactNode } from "react";

import { colors, fonts, radius, shadow, space } from "../theme";
import { t } from "../i18n";

interface ModalSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

export function ModalSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  width = 560,
}: ModalSheetProps) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Pressable
          accessibilityLabel={t("Fermer la fenêtre")}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.shadowWrap, { maxWidth: width }]}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.titleGroup}>
                <Text style={styles.title}>{t(title)}</Text>
                {subtitle ? <Text style={styles.subtitle}>{t(subtitle)}</Text> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Fermer")}
                hitSlop={12}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.close,
                  pressed && styles.closePressed,
                ]}
              >
                <Icon name="X" size={22} color={colors.ink2} />
              </Pressable>
            </View>
            <ScrollView
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={styles.content}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: "center",
    padding: space.lg,
  },
  shadowWrap: {
    ...shadow,
    maxHeight: "90%",
    width: "100%",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    maxHeight: "100%",
  },
  header: {
    alignItems: "flex-start",
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: space.md,
    justifyContent: "space-between",
    padding: space.lg,
  },
  titleGroup: {
    flex: 1,
    gap: space.xxs,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  close: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  closePressed: {
    backgroundColor: colors.paper2,
  },
  content: {
    gap: space.md,
    padding: space.lg,
    paddingBottom: space.xxl,
  },
});
