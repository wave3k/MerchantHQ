import type { SQLiteDatabase } from "expo-sqlite";
import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Icon from "../components/Icon";
import { useEffect, useMemo, useState } from "react";

import { ModalSheet } from "../components/ModalSheet";
import { Badge, EmptyState, Page, SearchField } from "../components/Page";
import { listLogs } from "../data/database";
import { formatDateTime } from "../domain/format";
import { roleLabel } from "../domain/permissions";
import { colors, fonts, radius, space } from "../theme";
import { TranslatedText as Text } from "../components/TranslatedText";
import type { ActivityLog } from "../types";

interface LogsScreenProps {
  db: SQLiteDatabase;
}

const actionLabels: Record<string, string> = {
  create: "Création",
  update: "Modification",
  delete: "Suppression",
  archive: "Archivage",
  deactivate: "Désactivation",
  sale: "Encaissement",
  stock_adjust: "Stock",
  login: "Connexion",
  seed: "Démonstration",
};

function prettyJson(value: string | null): string {
  if (!value) return "—";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function LogsScreen({ db }: LogsScreenProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ActivityLog | null>(null);

  useEffect(() => {
    void listLogs(db).then(setLogs);
  }, [db]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    if (!query) return logs;
    return logs.filter((log) =>
      [
        log.user_name,
        log.description,
        log.action,
        log.entity_type,
        log.created_at,
      ]
        .join(" ")
        .toLocaleLowerCase("fr")
        .includes(query),
    );
  }, [logs, search]);

  return (
    <Page
      description="Retrouvez qui a vendu, ajouté ou modifié quelque chose."
      title="Activité"
    >
      <View style={styles.notice}>
        <Icon
          name="ShieldCheck"
          size={22}
          color={colors.accent}
        />
        <Text style={styles.noticeText}>
          Cet historique ne peut pas être modifié.
        </Text>
      </View>
      <SearchField
        onChangeText={setSearch}
        placeholder="Rechercher un utilisateur, une action ou une date"
        value={search}
      />
      {filtered.length === 0 ? (
        <EmptyState
          icon="List"
          message={
            logs.length
              ? "Aucune entrée ne correspond à la recherche."
              : "Les actions importantes apparaîtront ici."
          }
          title={logs.length ? "Aucun résultat" : "Journal vide"}
        />
      ) : (
        <View style={styles.timeline}>
          {filtered.map((log) => (
            <Pressable
              key={log.id}
              onPress={() => setSelected(log)}
              style={({ pressed }) => [
                styles.logRow,
                pressed && styles.logPressed,
              ]}
            >
              <View style={styles.dotColumn}>
                <View style={styles.dot} />
                <View style={styles.line} />
              </View>
              <View style={styles.logContent}>
                <View style={styles.logTop}>
                  <Text style={styles.description}>{log.description}</Text>
                  <Badge
                    label={actionLabels[log.action] ?? log.action}
                    tone={
                      log.action === "sale"
                        ? "success"
                        : log.action === "delete" ||
                            log.action === "deactivate"
                          ? "danger"
                          : log.action === "stock_adjust"
                            ? "warning"
                            : "neutral"
                    }
                  />
                </View>
                <Text style={styles.meta}>
                  {formatDateTime(log.created_at)} · {log.user_name} ·{" "}
                  {log.user_role === "system"
                    ? "Système"
                    : roleLabel[log.user_role]}
                </Text>
              </View>
              <Icon
                name="ChevronRight"
                size={18}
                color={colors.faint}
              />
            </Pressable>
          ))}
        </View>
      )}

      <ModalSheet
        onClose={() => setSelected(null)}
        subtitle={selected ? formatDateTime(selected.created_at) : undefined}
        title="Détail de l’action"
        visible={selected !== null}
        width={680}
      >
        {selected ? (
          <>
            <View style={styles.detailHeader}>
              <Badge
                label={actionLabels[selected.action] ?? selected.action}
                tone="accent"
              />
              <Text style={styles.detailActor}>
                {selected.user_name} ·{" "}
                {selected.user_role === "system"
                  ? "Système"
                  : roleLabel[selected.user_role]}
              </Text>
            </View>
            <Text style={styles.detailDescription}>{selected.description}</Text>
            <View style={styles.detailGrid}>
              <View style={styles.detailPanel}>
                <Text style={styles.detailLabel}>Avant</Text>
                <Text selectable style={styles.json}>
                  {prettyJson(selected.old_value)}
                </Text>
              </View>
              <View style={styles.detailPanel}>
                <Text style={styles.detailLabel}>Après</Text>
                <Text selectable style={styles.json}>
                  {prettyJson(selected.new_value)}
                </Text>
              </View>
            </View>
            <Text style={styles.logId}>
              Entrée #{selected.id} · {selected.entity_type} #
              {selected.entity_id ?? "—"}
            </Text>
          </>
        ) : null}
      </ModalSheet>
    </Page>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.md,
  },
  noticeText: {
    color: colors.ink2,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  timeline: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  logRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
    minHeight: 72,
    paddingHorizontal: space.md,
  },
  logPressed: {
    backgroundColor: colors.accentSoft,
  },
  dotColumn: {
    alignItems: "center",
    alignSelf: "stretch",
    width: 12,
  },
  dot: {
    backgroundColor: colors.accent,
    borderRadius: radius.round,
    height: 8,
    marginTop: space.lg,
    width: 8,
  },
  line: {
    backgroundColor: colors.rule,
    flex: 1,
    marginTop: space.xxs,
    width: 1,
  },
  logContent: {
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: space.xxs,
    minWidth: 0,
    paddingVertical: space.sm,
  },
  logTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "space-between",
  },
  description: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  detailHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailActor: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  detailDescription: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 18,
    lineHeight: 25,
  },
  detailGrid: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: space.sm,
  },
  detailPanel: {
    backgroundColor: colors.paper2,
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    gap: space.xs,
    minHeight: 160,
    padding: space.sm,
  },
  detailLabel: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 11,
    textTransform: "uppercase",
  },
  json: {
    color: colors.ink2,
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 17,
  },
  logId: {
    color: colors.faint,
    fontFamily: fonts.mono,
    fontSize: 10,
  },
});
