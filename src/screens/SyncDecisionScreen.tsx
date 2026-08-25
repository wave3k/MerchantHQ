import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";

import { AppButton } from "../components/AppButton";
import { CashRegisterIcon } from "../components/CashRegisterIcon";
import { TranslatedText as Text } from "../components/TranslatedText";
import { formatDateTime } from "../domain/format";
import { recommendedSyncAction, type SyncSituation } from "../domain/syncDecision";
import {useThemedStyles,  colors, fonts, radius, space } from "../theme";

interface SyncDecisionScreenProps {
  situation: SyncSituation;
  onKeepLocal: () => void;
  onLoadRemote: () => void;
  onFreshStart: () => void;
}

export function SyncDecisionScreen({
  situation,
  onKeepLocal,
  onLoadRemote,
  onFreshStart,
}: SyncDecisionScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const stacked = width < 860;
  const recommendation = recommendedSyncAction(situation);

  return (
    <View style={styles.root}>
      <View style={[styles.split, stacked && styles.splitStacked]}>
        <View style={[styles.brandPane, stacked && styles.brandPaneStacked]}>
          <View style={styles.brandCopy}>
            <CashRegisterIcon
              color={colors.accentInk}
              detail={colors.inkSurfaceText}
              size={84}
            />
            <Text style={styles.brand}>MerchantHQ</Text>
            <Text style={styles.promise}>
              Des données existent des deux côtés. Choisissez ce que vous voulez garder : vos
              données sont sur la tablette, votre sauvegarde est dans votre compte.
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.rightContent}
          style={[styles.rightScroll, stacked && styles.rightScrollStacked]}
        >
          <View style={[styles.card, stacked && styles.cardStacked]}>
            <Text style={styles.title}>Que voulez-vous faire ?</Text>

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Cette tablette</Text>
              <Text style={styles.statusValue}>
                {situation.localHasData
                  ? situation.localDataAt
                    ? `Des données (activité du ${formatDateTime(situation.localDataAt)})`
                    : "Des données présentes"
                  : "Aucune donnée"}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Votre compte</Text>
              <Text style={styles.statusValue}>
                {situation.remoteHasData
                  ? situation.remoteSnapshotAt
                    ? `Une sauvegarde du ${formatDateTime(situation.remoteSnapshotAt)}`
                    : "Une sauvegarde existante"
                  : "Aucune sauvegarde"}
              </Text>
            </View>

            <View style={styles.form}>
              <AppButton
                fullWidth
                icon="Upload"
                label="Garder mes données de la tablette"
                onPress={onKeepLocal}
                tone={recommendation === "keep_local" ? "primary" : "secondary"}
              />
              <Text style={styles.optionHint}>
                Elles seront enregistrées dans mon compte, sur toutes mes tablettes.
              </Text>

              <AppButton
                disabled={!situation.remoteHasData}
                fullWidth
                icon="Download"
                label="Charger les données de mon compte"
                onPress={onLoadRemote}
                tone={recommendation === "load_remote" ? "primary" : "secondary"}
              />
              <Text style={styles.optionHint}>
                {situation.remoteHasData
                  ? "Remplacer la tablette par la sauvegarde de mon compte."
                  : "Aucune sauvegarde n’existe encore dans votre compte pour l’instant."}
              </Text>

              <AppButton
                fullWidth
                icon="Trash2"
                label="Commencer une nouvelle boutique"
                onPress={onFreshStart}
                tone="danger"
              />
              <Text style={styles.optionHint}>
                Effacer les données de cette tablette et repartir de zéro.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
  root: { backgroundColor: colors.paper, flex: 1 },
  split: { flex: 1, flexDirection: "row" },
  splitStacked: { flexDirection: "column" },
  brandPane: {
    alignSelf: "stretch",
    backgroundColor: colors.ink,
    flex: 1,
    justifyContent: "center",
    padding: space.xxl,
  },
  brandPaneStacked: {
    alignSelf: "auto",
    flex: 0,
    gap: space.xl,
    minHeight: 250,
    padding: space.lg,
  },
  rightScroll: { alignSelf: "stretch", flex: 1.2 },
  rightScrollStacked: { alignSelf: "auto", flex: 1 },
  rightContent: { flexGrow: 1 },
  brandCopy: { alignItems: "center", flex: 1, gap: space.md, justifyContent: "center" },
  brand: {
    color: colors.accentInk,
    fontFamily: fonts.display,
    fontSize: 38,
    letterSpacing: -1,
  },
  promise: {
    color: colors.inkSurfaceText,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 380,
    textAlign: "center",
  },
  card: {
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space.md,
    margin: space.xxl,
    marginVertical: "auto",
    maxWidth: 580,
    padding: space.xl,
    width: "100%",
  },
  cardStacked: { alignSelf: "center", margin: space.md, width: "92%" },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 27, letterSpacing: -0.5 },
  statusRow: {
    alignItems: "flex-start",
    backgroundColor: colors.paper2,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: space.sm,
    padding: space.sm,
  },
  statusLabel: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    width: 110,
  },
  statusValue: {
    color: colors.ink2,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  form: { gap: space.xs, marginTop: space.sm },
  optionHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: space.xs,
  },
});
}