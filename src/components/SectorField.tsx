import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ModalSheet } from "./ModalSheet";
import { TextField } from "./TextField";
import { AppButton } from "./AppButton";
import Icon from "./Icon";
import { TranslatedText as TextT } from "./TranslatedText";
import { BUSINESS_SECTORS, CUSTOM_SECTOR, sectorLabel } from "../domain/sectors";
import { useThemedStyles, colors, fonts, radius, space } from "../theme";

interface SectorFieldProps {
  value: string;
  onChange: (value: string) => void;
}

// Champ « secteur d'activité » : ouvre une modale avec la liste complète des
// secteurs plus une option personnalisée.
export function SectorField({ value, onChange }: SectorFieldProps) {
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const isCustom = value.startsWith(CUSTOM_SECTOR);

  function choose(sector: string) {
    onChange(sector);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Secteur d'activité"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          pressed && styles.fieldPressed,
        ]}
      >
        <TextT style={styles.fieldText}>
          {value ? sectorLabel(value) : "Choisir le secteur d'activité"}
        </TextT>
        <Icon name="ChevronRight" size={18} color={colors.muted} />
      </Pressable>

      <ModalSheet
        onClose={() => setOpen(false)}
        title="Secteur d'activité"
        visible={open}
        width={520}
      >
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {BUSINESS_SECTORS.map((sector) => {
            const active = value === sector;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                key={sector}
                onPress={() => choose(sector)}
                style={[styles.item, active && styles.itemActive]}
              >
                <TextT style={[styles.itemText, active && styles.itemTextActive]}>
                  {sector}
                </TextT>
                {active ? (
                  <Icon name="Check" size={18} color={colors.accentDark} />
                ) : null}
              </Pressable>
            );
          })}

          <View style={styles.customBlock}>
            <TextT style={styles.customTitle}>Autre / personnalisé</TextT>
            <TextField
              label="Précisez le secteur"
              onChangeText={setCustom}
              placeholder="Ex. Recyclage, cimenterie…"
              value={custom}
            />
            <AppButton
              icon="Plus"
              label="Utiliser ce secteur"
              onPress={() => choose(`${CUSTOM_SECTOR}:${custom.trim()}`)}
              tone="secondary"
            />
          </View>

          {isCustom ? (
            <View style={styles.customSelected}>
              <TextT style={styles.customSelectedText}>
                Secteur personnalisé actuel :{" "}
                {value.slice(CUSTOM_SECTOR.length + 1) || "Autre"}
              </TextT>
            </View>
          ) : null}
        </ScrollView>
      </ModalSheet>
    </>
  );
}

function createStyles() {
  return StyleSheet.create({
    field: {
      alignItems: "center",
      backgroundColor: colors.surfaceStrong,
      borderColor: colors.ruleStrong,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: space.sm,
      justifyContent: "space-between",
      minHeight: 48,
      paddingHorizontal: space.md,
    },
    fieldPressed: {
      borderColor: colors.accent,
    },
    fieldText: {
      color: colors.ink,
      fontFamily: fonts.body,
      fontSize: 16,
      flex: 1,
      minWidth: 0,
    },
    list: {
      gap: space.xxs,
      paddingBottom: space.sm,
    },
    item: {
      alignItems: "center",
      borderRadius: radius.sm,
      flexDirection: "row",
      gap: space.sm,
      justifyContent: "space-between",
      minHeight: 44,
      paddingHorizontal: space.sm,
    },
    itemActive: {
      backgroundColor: colors.accentSoft,
    },
    itemText: {
      color: colors.ink2,
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 14,
    },
    itemTextActive: {
      color: colors.accentDark,
      fontFamily: fonts.bodySemibold,
    },
    customBlock: {
      borderTopColor: colors.rule,
      borderTopWidth: 1,
      gap: space.sm,
      marginTop: space.md,
      paddingTop: space.md,
    },
    customTitle: {
      color: colors.ink,
      fontFamily: fonts.bodySemibold,
      fontSize: 14,
    },
    customSelected: {
      backgroundColor: colors.paper2,
      borderRadius: radius.sm,
      marginTop: space.sm,
      padding: space.sm,
    },
    customSelectedText: {
      color: colors.muted,
      fontFamily: fonts.body,
      fontSize: 12,
    },
  });
}