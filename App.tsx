import { IBMPlexSans_400Regular } from "@expo-google-fonts/ibm-plex-sans/400Regular";
import { IBMPlexSans_500Medium } from "@expo-google-fonts/ibm-plex-sans/500Medium";
import { IBMPlexSans_600SemiBold } from "@expo-google-fonts/ibm-plex-sans/600SemiBold";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { SpaceGrotesk_500Medium } from "@expo-google-fonts/space-grotesk/500Medium";
import { SpaceGrotesk_600SemiBold } from "@expo-google-fonts/space-grotesk/600SemiBold";
import Icon from "./src/components/Icon";
import type { IconName } from "./src/components/Icon";
import { useFonts } from "expo-font";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  initializeDatabase,
  getSetting,
  recordLogout,
  verifyBossPassword,
} from "./src/data/database";
import {
  prepareDeviceNotifications,
  subscribeToNotificationNavigation,
} from "./src/data/notifications";
import {
  ensureBundledCloudBackupConfig,
  getCloudBackupUpdate,
  restoreCloudBackup,
  syncCloudBackup,
  type CloudBackupUpdate,
} from "./src/data/cloudBackup";
import { registerCloudBackupTask } from "./src/data/backgroundSync";
import { syncOwnerAccount } from "./src/data/accountSync";
import { roleLabel, userCanAccessScreen } from "./src/domain/permissions";
import {
  configureFormatting,
  formatDateTime,
  type AppLanguage,
  type CurrencyCode,
} from "./src/domain/format";
import { APP_VERSION, BACKUP_FORMAT_VERSION } from "./src/appInfo";
import { activeTheme, colors, fonts, radius, space } from "./src/theme";
import type { AppModule, ScreenKey, User } from "./src/types";
import { AuthScreen } from "./src/screens/AuthScreen";
import { ClientsScreen } from "./src/screens/ClientsScreen";
import { DashboardHomeScreen } from "./src/screens/DashboardHomeScreen";
import { CaisseHomeScreen } from "./src/screens/CaisseHomeScreen";
import { BoutiqueHomeScreen } from "./src/screens/BoutiqueHomeScreen";
import { AppointmentsScreen } from "./src/screens/AppointmentsScreen";
import { AttendanceScreen } from "./src/screens/AttendanceScreen";
import { LogsScreen } from "./src/screens/LogsScreen";
import { OrdersScreen } from "./src/screens/OrdersScreen";
import { ProductsScreen } from "./src/screens/ProductsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { StatisticsScreen } from "./src/screens/StatisticsScreen";
import { TeamScreen } from "./src/screens/TeamScreen";
import { AccountPermissionsScreen } from "./src/screens/AccountPermissionsScreen";
import { TicketDesignerScreen } from "./src/screens/TicketDesignerScreen";
import { Screensaver } from "./src/components/Screensaver";
import { AppButton } from "./src/components/AppButton";
import { CashRegisterIcon } from "./src/components/CashRegisterIcon";
import { ModalSheet } from "./src/components/ModalSheet";
import { TextField } from "./src/components/TextField";
import { t } from "./src/i18n";
import { TranslatedText as Text } from "./src/components/TranslatedText";

const AUTO_LOCK_MS = 5 * 60 * 1000;

const modules: Array<{
  key: AppModule;
  label: string;
  icon: IconName;
}> = [
  { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { key: "caisse", label: "Caisse", icon: "ShoppingCart" },
  { key: "boutique", label: "Boutique", icon: "Store" },
];

const navigation: Record<
  AppModule,
  Array<{
    key: ScreenKey;
    label: string;
    icon: IconName;
  }>
> = {
  dashboard: [
    { key: "home_dashboard", label: "Accueil", icon: "House" },
    { key: "statistics", label: "Statistiques", icon: "ChartColumn" },
  ],
  caisse: [
    { key: "home_caisse", label: "Accueil", icon: "House" },
    { key: "orders", label: "Caisse", icon: "Coins" },
    { key: "clients", label: "Clients", icon: "Users" },
    { key: "appointments", label: "Rendez-vous", icon: "CalendarDays" },
    { key: "tickets", label: "Tickets", icon: "Receipt" },
  ],
  boutique: [
    { key: "home_boutique", label: "Accueil", icon: "House" },
    { key: "products", label: "Produits", icon: "Package" },
    { key: "attendance", label: "Présences", icon: "ClipboardCheck" },
    { key: "team", label: "Employés", icon: "UserCog" },
    { key: "logs", label: "Activité", icon: "Activity" },
    { key: "settings", label: "Réglages", icon: "Settings" },
  ],
};

function LoadingScreen({ label }: { label: string }) {
  return (
    <View style={styles.loading}>
      <CashRegisterIcon size={64} />
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.loadingText}>{t(label)}</Text>
    </View>
  );
}

function Application() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [user, setUser] = useState<User | null>(null);
  const [activeModule, setActiveModule] = useState<AppModule>("caisse");
  const [screen, setScreen] = useState<ScreenKey>("home_caisse");
  const [screenParams, setScreenParams] = useState<{
    userId?: number;
    employeeId?: number;
  }>({});
  const [saleFullscreen, setSaleFullscreen] = useState(false);
  const [screensaver, setScreensaver] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [dashboardAccessOpen, setDashboardAccessOpen] = useState(false);
  const [dashboardCode, setDashboardCode] = useState("");
  const [dashboardCodeError, setDashboardCodeError] = useState("");
  const [checkingDashboardCode, setCheckingDashboardCode] = useState(false);
  const [shopName, setShopName] = useState("Ma boutique");
  const [, setPreferencesRevision] = useState(0);
  const lastActivity = useRef(Date.now());
  const backgroundAt = useRef<number | null>(null);
  const compact = width < 1100;

  async function refreshPreferences() {
    const [name, primary, secondary, rate, language] = await Promise.all([
      getSetting(db, "shop_name"),
      getSetting(db, "currency_primary"),
      getSetting(db, "currency_secondary"),
      getSetting(db, "currency_rate"),
      getSetting(db, "language"),
    ]);
    if (name) setShopName(name);
    configureFormatting({
      primary: (primary as CurrencyCode) ?? "CDF",
      secondary:
        secondary && secondary !== "none"
          ? (secondary as CurrencyCode)
          : null,
      rate: Number(rate) || 2800,
      language: (language as AppLanguage) ?? "fr",
    });
    setPreferencesRevision((value) => value + 1);
  }

  useEffect(() => {
    void refreshPreferences();
  }, [db]);

  useEffect(() => {
    void (async () => {
      await ensureBundledCloudBackupConfig();
      const update = await getCloudBackupUpdate(db).catch(() => null);
      if (update) {
        offerRemoteBackup(update);
        return;
      }
      await syncOwnerAccount(db, { attempts: 2, timeoutMs: 5_000 }).catch(
        () => undefined,
      );
      await registerCloudBackupTask();
      await syncCloudBackup(db);
    })().catch(() => {
      // Une erreur réseau reste dans la file d’attente locale.
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncOwnerAccount(db, { attempts: 1, timeoutMs: 3_000 }).catch(
          () => undefined,
        );
        void syncCloudBackup(db).catch(() => {
          // Nouvelle tentative silencieuse à la prochaine reprise.
        });
      }
    });
    return () => subscription.remove();
  }, [db]);

  function offerRemoteBackup(update: CloudBackupUpdate) {
    const compatible = update.schemaVersion <= BACKUP_FORMAT_VERSION;
    const versionLine =
      update.appVersion && update.appVersion !== "inconnue"
        ? `\nVersion de la copie : ${update.appVersion}. Version installée : ${APP_VERSION}.`
        : "";
    Alert.alert(
      compatible
        ? "Sauvegarde plus récente trouvée"
        : "Mise à jour de l’application requise",
      compatible
        ? `Une autre tablette a enregistré une copie le ${formatDateTime(update.snapshotAt)}.${versionLine}\n\nLa restaurer remplacera les données actuellement présentes sur cette tablette.`
        : `La dernière copie vient de Commerce Manager ${update.appVersion}. Mettez cette tablette à jour avant de restaurer ses données.`,
      compatible
        ? [
            { text: "Plus tard", style: "cancel" },
            {
              text: "Restaurer",
              onPress: () => void restoreRemoteBackup(update),
            },
          ]
        : [{ text: "Fermer", style: "cancel" }],
    );
  }

  async function restoreRemoteBackup(update: CloudBackupUpdate) {
    setRestoringBackup(true);
    try {
      await restoreCloudBackup(db, update);
      await initializeDatabase(db);
      await refreshPreferences();
      setUser(null);
      setActiveModule("caisse");
      setScreen("home_caisse");
      setSaleFullscreen(false);
      Alert.alert(
        "Sauvegarde restaurée",
        "Les dernières données de la boutique sont maintenant disponibles sur cette tablette.",
      );
    } catch (caught) {
      Alert.alert(
        "Restauration impossible",
        caught instanceof Error
          ? caught.message
          : "La copie Turso n’a pas pu être restaurée.",
      );
    } finally {
      setRestoringBackup(false);
    }
  }

  async function lock(reason: "manual" | "inactivity" = "manual") {
    if (!user) return;
    try {
      await recordLogout(db, user, reason);
    } finally {
      setScreensaver(reason === "inactivity");
      setUser(null);
      setActiveModule("caisse");
      setScreen("home_caisse");
      setSaleFullscreen(false);
    }
  }

  function navigateTo(
    target: ScreenKey,
    params?: { userId?: number; employeeId?: number },
  ) {
    if (!user || !userCanAccessScreen(user, target)) return;
    if (target === "statistics" && screen !== "statistics") {
      setDashboardCode("");
      setDashboardCodeError("");
      setDashboardAccessOpen(true);
      return;
    }
    if (params) setScreenParams(params);
    setScreen(target);
  }

  function switchModule(mod: AppModule) {
    if (!user) return;
    setActiveModule(mod);
    // Jump to the first accessible screen in that module
    const firstScreen = navigation[mod].find((item) =>
      userCanAccessScreen(user, item.key),
    );
    if (firstScreen) setScreen(firstScreen.key);
  }

  function closeDashboardAccess() {
    if (checkingDashboardCode) return;
    setDashboardAccessOpen(false);
    setDashboardCode("");
    setDashboardCodeError("");
  }

  async function openDashboard() {
    if (!dashboardCode) {
      setDashboardCodeError("Entrez le code du compte Propriétaire.");
      return;
    }
    setCheckingDashboardCode(true);
    setDashboardCodeError("");
    try {
      if (!(await verifyBossPassword(db, dashboardCode))) {
        setDashboardCodeError("Code incorrect. Vérifiez puis réessayez.");
        return;
      }
      setDashboardAccessOpen(false);
      setDashboardCode("");
      setScreen("statistics");
    } catch (caught) {
      setDashboardCodeError(
        caught instanceof Error
          ? caught.message
          : "Le code n’a pas pu être vérifié.",
      );
    } finally {
      setCheckingDashboardCode(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    lastActivity.current = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current >= AUTO_LOCK_MS) {
        void lock("inactivity");
      }
    }, 15_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        backgroundAt.current = Date.now();
      } else if (
        state === "active" &&
        backgroundAt.current &&
        Date.now() - backgroundAt.current >= AUTO_LOCK_MS
      ) {
        void lock("inactivity");
      }
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [user]);

  const availableNavigation = useMemo(
    () =>
      user
        ? navigation[activeModule].filter((item) =>
            userCanAccessScreen(user, item.key),
          )
        : [],
    [user, activeModule],
  );

  useEffect(() => {
    if (user && !userCanAccessScreen(user, screen)) {
      setScreen(availableNavigation[0]?.key ?? "home_caisse");
    }
  }, [availableNavigation, screen, user]);

  useEffect(() => {
    if (!user) return;
    void prepareDeviceNotifications(db).catch(() => {
      // Les fonctions métier restent disponibles si Android refuse les notifications.
    });
    const subscription = subscribeToNotificationNavigation((target) => {
      navigateTo(target);
    });
    return () => subscription.remove();
  }, [db, user]);

  if (restoringBackup) {
    return <LoadingScreen label="Restauration de la boutique…" />;
  }

  if (!user) {
    if (screensaver) {
      return (
        <Screensaver
          onWake={() => setScreensaver(false)}
          shopName={shopName}
        />
      );
    }
    return <AuthScreen db={db} onAuthenticated={setUser} />;
  }

  let content: React.ReactNode;
  switch (screen) {
    case "home_dashboard":
      content = <DashboardHomeScreen db={db} onNavigate={navigateTo} user={user} />;
      break;
    case "home_caisse":
      content = <CaisseHomeScreen db={db} onNavigate={navigateTo} user={user} />;
      break;
    case "home_boutique":
      content = <BoutiqueHomeScreen db={db} onNavigate={navigateTo} user={user} />;
      break;
    case "orders":
      content = (
        <OrdersScreen
          db={db}
          onSaleModeChange={setSaleFullscreen}
          user={user}
        />
      );
      break;
    case "statistics":
      content = <StatisticsScreen db={db} onNavigate={navigateTo} />;
      break;
    case "products":
      content = <ProductsScreen db={db} user={user} />;
      break;
    case "clients":
      content = <ClientsScreen db={db} user={user} />;
      break;
    case "appointments":
      content = <AppointmentsScreen db={db} user={user} />;
      break;
    case "attendance":
      content = <AttendanceScreen db={db} user={user} />;
      break;
    case "team":
      content = <TeamScreen db={db} onNavigate={navigateTo} user={user} />;
      break;
    case "permissions":
      content = (
        <AccountPermissionsScreen
          db={db}
          initialEmployeeId={screenParams.employeeId}
          initialUserId={screenParams.userId}
          onDone={() => setScreen("team")}
          user={user}
        />
      );
      break;
    case "logs":
      content = <LogsScreen db={db} />;
      break;
    case "tickets":
      content = <TicketDesignerScreen db={db} user={user} />;
      break;
    case "settings":
      content = (
        <SettingsScreen
          db={db}
          onImported={() => setUser(null)}
          onPreferencesChange={() =>
            setPreferencesRevision((value) => value + 1)
          }
          onShopNameChange={setShopName}
          user={user}
        />
      );
      break;
    default:
      content = null;
  }

  return (
    <View
      onStartShouldSetResponderCapture={() => {
        lastActivity.current = Date.now();
        return false;
      }}
      style={styles.app}
    >
      {!saleFullscreen && compact && (
        <View style={styles.compactHeader}>
          <View style={styles.compactTopRow}>
<View style={styles.compactBrand}>
                <Text numberOfLines={1} style={styles.compactShop}>
                {shopName}
              </Text>
            </View>
            <View style={styles.compactModules}>
              {modules.map((mod) => {
                const active = mod.key === activeModule;
                return (
                  <Pressable
                    key={mod.key}
                    onPress={() => switchModule(mod.key)}
                    style={[styles.compactModuleItem, active && styles.compactModuleItemActive]}
                  >
                    <Icon
                      name={mod.icon}
                      size={15}
                      color={active ? colors.accentDark : colors.muted}
                    />
                    <Text
                      numberOfLines={1}
                      style={[styles.compactModuleLabel, active && styles.compactModuleLabelActive]}
                    >
                      {t(mod.label)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Verrouiller la session"
              onPress={() => void lock()}
              style={styles.compactLock}
            >
              <Icon name="Lock" size={20} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            contentContainerStyle={styles.compactNav}
            showsHorizontalScrollIndicator={false}
            style={styles.compactNavRow}
          >
            {availableNavigation.map((item) => {
              const active = item.key === screen;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => navigateTo(item.key)}
                  style={[styles.compactItem, active && styles.compactItemActive]}
                >
                  <Icon
                    name={item.icon}
                    size={17}
                    color={active ? colors.accent : colors.muted}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.compactLabel,
                      active && styles.compactLabelActive,
                    ]}
                  >
                    {t(item.label)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.body}>
        {!saleFullscreen && !compact && (
          <View style={styles.sidebar}>
<View style={styles.brandRow}>
                <View style={styles.brandCopy}>
                <Text numberOfLines={1} style={styles.shopName}>
                  {shopName}
                </Text>
                <View style={styles.offlineRow}>
                  <View style={styles.offlineDot} />
                  <Text style={styles.offlineText}>Prêt à vendre</Text>
                </View>
              </View>
            </View>

            <View style={styles.nav}>
              {availableNavigation.map((item) => {
                const active = item.key === screen;
                return (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    key={item.key}
                    onPress={() => navigateTo(item.key)}
                    style={({ pressed }) => [
                      styles.navItem,
                      active && styles.navItemActive,
                      pressed && styles.navItemPressed,
                    ]}
                  >
                    <Icon
                      name={item.icon}
                      size={21}
                      color={active ? colors.accent : colors.muted}
                    />
                    <Text
                      numberOfLines={1}
                      style={[styles.navText, active && styles.navTextActive]}
                    >
                      {t(item.label)}
                    </Text>
                    {active ? <View style={styles.activeMark} /> : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.moduleTabs}>
              {modules.map((mod) => {
                const active = mod.key === activeModule;
                return (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={mod.label}
                    key={mod.key}
                    onPress={() => switchModule(mod.key)}
                    style={({ pressed }) => [
                      styles.moduleTab,
                      active && styles.moduleTabActive,
                      pressed && styles.moduleTabPressed,
                    ]}
                  >
                    <Icon
                      name={mod.icon}
                      size={20}
                      color={active ? colors.accentDark : colors.muted}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.session}>
              <View style={styles.sessionAvatar}>
                <Text style={styles.sessionInitial}>
                  {user.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.sessionCopy}>
                <Text numberOfLines={1} style={styles.sessionName}>
                  {user.name}
                </Text>
                <Text style={styles.sessionRole}>{roleLabel[user.role]}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Verrouiller la session"
                hitSlop={10}
                onPress={() => void lock()}
                style={({ pressed }) => [
                  styles.lockButton,
                  pressed && styles.lockPressed,
                ]}
              >
                <Icon name="Lock" size={19} color={colors.muted} />
              </Pressable>
            </View>
          </View>
        )}

        <View
          style={[
            styles.main,
            compact && !saleFullscreen && styles.mainCompact,
            saleFullscreen && styles.mainFullscreen,
          ]}
        >
          {content}
        </View>
      </View>

      <ModalSheet
        onClose={closeDashboardAccess}
        subtitle="Entrez le mot de passe défini lors de la création du compte Propriétaire."
        title="Accès au Dashboard"
        visible={dashboardAccessOpen}
        width={440}
      >
        <TextField
          error={dashboardCodeError || undefined}
          label="Code du compte Propriétaire"
          onChangeText={(value) => {
            setDashboardCode(value);
            if (dashboardCodeError) setDashboardCodeError("");
          }}
          onSubmitEditing={() => void openDashboard()}
          placeholder="Saisissez le code"
          secureTextEntry
          value={dashboardCode}
        />
        <View style={styles.dashboardAccessActions}>
          <AppButton
            label="Annuler"
            onPress={closeDashboardAccess}
            tone="ghost"
          />
          <AppButton
            icon="LockOpen"
            label="Ouvrir le Dashboard"
            loading={checkingDashboardCode}
            onPress={() => void openDashboard()}
          />
        </View>
      </ModalSheet>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    JetBrainsMono_500Medium,
  });
  const [databaseError, setDatabaseError] = useState("");

  if (!fontsLoaded) {
    return <LoadingScreen label="Préparation de l’interface…" />;
  }

  if (databaseError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.databaseError}>
          <Icon name="TriangleAlert" size={30} color={colors.error} />
          <Text style={styles.databaseErrorTitle}>
            Base de données indisponible
          </Text>
          <Text style={styles.databaseErrorMessage}>{databaseError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={activeTheme === "night" ? "light" : "dark"} />
      <SQLiteProvider
        databaseName="commerce-manager-public.db"
        onError={(error) => {
          console.error("SQLite initialization failed", error);
          setDatabaseError(error.message);
          Alert.alert(
            "Base de données indisponible",
            error.message,
          );
        }}
        onInit={initializeDatabase}
      >
        <Application />
      </SQLiteProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.paper,
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  app: {
    backgroundColor: colors.paper,
    flex: 1,
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.xs,
    paddingVertical: space.sm,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  shopName: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 17,
  },
  offlineRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xxs,
    marginTop: space.xxs,
  },
  offlineDot: {
    backgroundColor: colors.success,
    borderRadius: radius.round,
    height: 6,
    width: 6,
  },
  offlineText: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 9,
    textTransform: "uppercase",
  },
  body: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0,
    overflow: "hidden",
  },
  sidebar: {
    backgroundColor: colors.surfaceStrong,
    borderRightColor: colors.rule,
    borderRightWidth: 1,
    justifyContent: "space-between",
    padding: space.md,
    width: 244,
  },
  moduleTabs: {
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "center",
    paddingTop: space.lg,
    paddingBottom: space.xs,
  },
  moduleTab: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 44,
    justifyContent: "center",
    width: 52,
  },
  moduleTabActive: {
    backgroundColor: colors.accentSoft,
  },
  moduleTabPressed: {
    opacity: 0.72,
  },
  nav: {
    flex: 1,
    gap: space.xxs,
    justifyContent: "center",
    paddingVertical: space.lg,
  },
  navItem: {
    alignItems: "center",
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 48,
    overflow: "hidden",
    paddingHorizontal: space.sm,
  },
  navItemActive: {
    backgroundColor: colors.accentSoft,
  },
  navItemPressed: {
    opacity: 0.72,
  },
  navText: {
    color: colors.muted,
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  navTextActive: {
    color: colors.accentDark,
    fontFamily: fonts.bodySemibold,
  },
  activeMark: {
    backgroundColor: colors.accent,
    borderRadius: radius.round,
    height: 22,
    width: 3,
  },
  session: {
    alignItems: "center",
    borderTopColor: colors.rule,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: space.xs,
    paddingTop: space.md,
  },
  sessionAvatar: {
    alignItems: "center",
    backgroundColor: colors.paper2,
    borderRadius: radius.sm,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  sessionInitial: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 18,
  },
  sessionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sessionName: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
  },
  sessionRole: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  lockButton: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  lockPressed: {
    backgroundColor: colors.paper2,
  },
  compactHeader: {
    backgroundColor: colors.surfaceStrong,
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    flexDirection: "column",
    position: "absolute",
    top: 0,
    width: "100%",
    zIndex: 10,
  },
  compactTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.sm,
  },
  compactBrand: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
    maxWidth: 140,
  },
  compactShop: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 14,
  },
  compactModules: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: space.xxs,
    justifyContent: "center",
  },
  compactModuleItem: {
    alignItems: "center",
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: 4,
    height: 36,
    paddingHorizontal: space.xs,
  },
  compactModuleItemActive: {
    backgroundColor: colors.accentSoft,
  },
  compactModuleLabel: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  compactModuleLabelActive: {
    color: colors.accentDark,
    fontFamily: fonts.bodySemibold,
  },
  compactNavRow: {
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  compactNav: {
    alignItems: "center",
    gap: space.xxs,
    paddingHorizontal: space.sm,
  },
  compactItem: {
    alignItems: "center",
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: space.xxs,
    height: 44,
    paddingHorizontal: space.xs,
  },
  compactItemActive: {
    backgroundColor: colors.accentSoft,
  },
  compactLabel: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  compactLabelActive: {
    color: colors.accentDark,
  },
  compactLock: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  main: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
    paddingTop: 0,
  },
  mainCompact: {
    paddingTop: 100,
  },
  mainFullscreen: {
    backgroundColor: colors.paper,
    paddingTop: 0,
  },
  dashboardAccessActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    justifyContent: "flex-end",
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.paper,
    flex: 1,
    gap: space.md,
    justifyContent: "center",
  },
  loadingText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  databaseError: {
    alignItems: "center",
    flex: 1,
    gap: space.sm,
    justifyContent: "center",
    padding: space.lg,
  },
  databaseErrorTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 22,
    textAlign: "center",
  },
  databaseErrorMessage: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 520,
    textAlign: "center",
  },
});
