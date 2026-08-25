import type { SQLiteDatabase } from "expo-sqlite";
import { Pressable, StyleSheet, View } from "react-native";
import { useState } from "react";

import { AppButton } from "./AppButton";
import { ModalSheet } from "./ModalSheet";
import { TranslatedText as Text } from "./TranslatedText";
import { setSetting } from "../data/database";
import {useThemedStyles,  colors, fonts, radius, space } from "../theme";
import {
  logoRegistry,
  logoLabels,
  logoCategories,
  type LogoName,
} from "./logos";
import type { User } from "../types";

const primaryPresets = [
  "#1D55C5",
  "#0E8A5E",
  "#B42318",
  "#7C3AED",
  "#D97706",
  "#0891B2",
  "#BE185D",
  "#374151",
];

const secondaryPresets = [
  "#E8EFFC",
  "#E8F6EF",
  "#FEECEB",
  "#EDE9FE",
  "#FFF4D8",
  "#ECFEFF",
  "#FDF2F8",
  "#F3F4F6",
];

interface LogoPickerProps {
  visible: boolean;
  onClose: () => void;
  db: SQLiteDatabase;
  user: User;
  initialLogo: LogoName;
  initialPrimary: string;
  initialSecondary: string;
  onSaved: (logo: LogoName, primary: string, secondary: string) => void;
}

export function LogoPicker({
  visible,
  onClose,
  db,
  user,
  initialLogo,
  initialPrimary,
  initialSecondary,
  onSaved,
}: LogoPickerProps) {
  const styles = useThemedStyles(createStyles);
  const [logo, setLogo] = useState<LogoName>(initialLogo);
  const [primary, setPrimary] = useState(initialPrimary);
  const [secondary, setSecondary] = useState(initialSecondary);
  const [saving, setSaving] = useState(false);

  function handleSave() {
    setSaving(true);
    void (async () => {
      try {
        await setSetting(db, "app_logo", logo, user);
        await setSetting(db, "logo_primary", primary, user);
        await setSetting(db, "logo_secondary", secondary, user);
        onSaved(logo, primary, secondary);
        onClose();
      } finally {
        setSaving(false);
      }
    })();
  }

  return (
    <ModalSheet
      onClose={onClose}
      subtitle="Choisissez le logo et les couleurs de l'application."
      title="Logo de l'application"
      visible={visible}
    >
      {logoCategories.map((category) => (
        <View key={category.title}>
          <Text style={styles.categoryTitle}>{category.title}</Text>
          <View style={styles.logoGrid}>
            {category.logos.map((name) => {
              const LogoComponent = logoRegistry[name];
              const isSelected = logo === name;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  key={name}
                  onPress={() => setLogo(name)}
                  style={({ pressed }) => [
                    styles.logoItem,
                    isSelected && styles.logoItemSelected,
                    pressed && styles.logoItemPressed,
                  ]}
                >
                  {LogoComponent ? (
                    <LogoComponent
                      accessibilityLabel={logoLabels[name]}
                      color={primary}
                      detail={secondary}
                      size={48}
                    />
                  ) : null}
                  <Text numberOfLines={1} style={styles.logoLabel}>
                    {logoLabels[name] ?? name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <View>
        <Text style={styles.categoryTitle}>Couleur principale</Text>
        <View style={styles.colorRow}>
          {primaryPresets.map((color) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: primary === color }}
              key={color}
              onPress={() => setPrimary(color)}
              style={[
                styles.colorDot,
                { backgroundColor: color },
                primary === color && styles.colorDotSelected,
              ]}
            />
          ))}
        </View>
      </View>

      <View>
        <Text style={styles.categoryTitle}>Couleur secondaire</Text>
        <View style={styles.colorRow}>
          {secondaryPresets.map((color) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: secondary === color }}
              key={color}
              onPress={() => setSecondary(color)}
              style={[
                styles.colorDot,
                { backgroundColor: color },
                secondary === color && styles.colorDotSelected,
              ]}
            />
          ))}
        </View>
      </View>

      <AppButton
        label="Restaurer les couleurs par défaut"
        onPress={() => {
          setPrimary("#1D55C5");
          setSecondary("#E8EFFC");
        }}
        tone="ghost"
      />

      <View style={styles.actions}>
        <AppButton label="Annuler" onPress={onClose} tone="ghost" />
        <AppButton
          icon="Save"
          label="Enregistrer"
          loading={saving}
          onPress={handleSave}
        />
      </View>
    </ModalSheet>
  );
}

function createStyles() {
  return StyleSheet.create({
  categoryTitle: {
    color: colors.muted,
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    marginBottom: space.xs,
    marginTop: space.sm,
  },
  logoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  logoItem: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 2,
    gap: space.xxs,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    width: 100,
  },
  logoItemSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  logoItemPressed: {
    opacity: 0.8,
  },
  logoLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    textAlign: "center",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  colorDot: {
    borderColor: colors.rule,
    borderRadius: radius.round,
    borderWidth: 2,
    height: 36,
    width: 36,
  },
  colorDotSelected: {
    borderColor: colors.ink,
    borderWidth: 3,
  },
  actions: {
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "flex-end",
  },
});
}
