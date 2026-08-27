import type { SQLiteDatabase } from "expo-sqlite";
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";
import * as SecureStore from "../data/secureStore";
import { useEffect, useState } from "react";
import { Image } from "react-native";

import { AppButton } from "../components/AppButton";
import { Page } from "../components/Page";
import { TextField } from "../components/TextField";
import { exportBackup, importBackup } from "../data/backup";
import {
  getCloudBackupStatus,
  getRemoteBackupMetadata,
  restoreCloudBackup,
  syncCloudBackup,
  type CloudBackupStatus,
} from "../data/cloudApi";
import { getSession } from "../data/cloudSession";
import {
  getSetting,
  seedDemoData,
  setSetting,
  listShops,
  createShop,
  updateShop,
} from "../data/database";
import { getCurrentShopId, setCurrentShopId } from "../data/shopContext";
import type { Shop } from "../types";
import { pickShopLogo } from "../data/shopLogo";
import { LogoPicker } from "../components/LogoPicker";
import { logoRegistry } from "../components/logos";
import type { LogoName } from "../components/logos";
import {
  prepareDeviceNotifications,
  sendTestNotification,
} from "../data/notifications";
import {
  configureFormatting,
  locale,
  type AppLanguage,
  type CurrencyCode,
} from "../domain/format";
import { useThemedStyles, applyTheme, colors, fonts, radius, space } from "../theme";
import type { User } from "../types";
import { setActiveLanguage, t, type Language } from "../i18n";
import { TranslatedText as Text } from "../components/TranslatedText";

interface SettingsScreenProps {
  db: SQLiteDatabase;
  user: User;
  onShopNameChange: (value: string) => void;
  onPreferencesChange: () => void;
  onImported: () => void;
  onAccountDisconnected: () => void;
}

function SettingCard({
  icon,
  title,
  description,
  children,
}: {
  icon: IconName;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.icon}>
          <Icon name={icon} size={22} color={colors.accent} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>{t(title)}</Text>
          <Text style={styles.cardDescription}>{t(description)}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function ChoiceRow<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.choice, active && styles.choiceActive]}
          >
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
              {t(option.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}
    >
      <Text style={styles.toggleLabel}>{t(label)}</Text>
      <View style={[styles.toggle, value && styles.toggleActive]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobActive]} />
      </View>
    </Pressable>
  );
}

export function SettingsScreen({
  db,
  user,
  onShopNameChange,
  onPreferencesChange,
  onImported,
  onAccountDisconnected,
}: SettingsScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const [shopName, setShopName] = useState("");
  const [accountStatus, setAccountStatus] = useState<CloudBackupStatus | null>(null);
  const [developerMode, setDeveloperMode] = useState(false);
  const [versionTaps, setVersionTaps] = useState(0);
  const [currencyPrimary, setCurrencyPrimary] = useState<CurrencyCode>("CDF");
  const [currencySecondary, setCurrencySecondary] = useState<
    CurrencyCode | "none"
  >("USD");
  const [currencyRate, setCurrencyRate] = useState("2800");
  const [language, setLanguage] = useState<AppLanguage>("fr");
  const [theme, setTheme] = useState<"cobalt" | "night" | "contrast">("cobalt");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [legalInfo, setLegalInfo] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [openingHours, setOpeningHours] = useState("08:00 â€“ 18:00");
  const [paymentCash, setPaymentCash] = useState(true);
  const [paymentMobile, setPaymentMobile] = useState(true);
  const [paymentCard, setPaymentCard] = useState(true);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [appLogo, setAppLogo] = useState<LogoName>("merchant-cash");
  const [logoPrimary, setLogoPrimary] = useState("#1D55C5");
  const [logoSecondary, setLogoSecondary] = useState("#E8EFFC");
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [currentShopId, setCurrentShopIdState] = useState<string | null>(null);
  const [busy, setBusy] = useState<
    | "save"
    | "preferences"
    | "establishment"
    | "export"
    | "import"
    | "seed"
    | "notifications"
    | "cloud-sync"
    | "cloud-restore"
    | "shop-create"
    | "shop-switch"
    | null
  >(null);

  useEffect(() => {
    void Promise.all([
      getSetting(db, "shop_name"),
      getSetting(db, "developer_mode_until"),
      getSetting(db, "currency_primary"),
      getSetting(db, "currency_secondary"),
      getSetting(db, "currency_rate"),
      getSetting(db, "language"),
      getSetting(db, "theme"),
      getSetting(db, "shop_address"),
      getSetting(db, "shop_phone"),
      getSetting(db, "shop_email"),
      getSetting(db, "shop_website"),
      getSetting(db, "shop_legal_info"),
      getSetting(db, "tax_rate"),
      getSetting(db, "opening_hours"),
      getSetting(db, "payment_cash"),
      getSetting(db, "payment_mobile_money"),
      getSetting(db, "payment_card"),
      getSetting(db, "shop_logo"),
      getSetting(db, "app_logo"),
      getSetting(db, "logo_primary"),
      getSetting(db, "logo_secondary"),
    ]).then(([
      name,
      developerUntil,
      primary,
      secondary,
      rate,
      savedLanguage,
      savedTheme,
      savedAddress,
      savedPhone,
      savedEmail,
      savedWebsite,
      savedLegalInfo,
      savedTax,
      savedHours,
      cash,
      mobile,
      card,
      savedLogo,
      savedAppLogo,
      savedLogoPrimary,
      savedLogoSecondary,
    ]) => {
      setShopName(name ?? "Ma boutique");
      setDeveloperMode(Number(developerUntil) > Date.now());
      setCurrencyPrimary((primary as CurrencyCode) ?? "CDF");
      setCurrencySecondary((secondary as CurrencyCode | "none") ?? "USD");
      setCurrencyRate(rate ?? "2800");
      setLanguage((savedLanguage as AppLanguage) ?? "fr");
      setTheme(
        (savedTheme as "cobalt" | "night" | "contrast") ?? "cobalt",
      );
      setAddress(savedAddress ?? "");
      setPhone(savedPhone ?? "");
      setEmail(savedEmail ?? "");
      setWebsite(savedWebsite ?? "");
      setLegalInfo(savedLegalInfo ?? "");
      setTaxRate(savedTax ?? "0");
      setOpeningHours(savedHours ?? "08:00 â€“ 18:00");
      setPaymentCash(cash !== "0");
      setPaymentMobile(mobile !== "0");
      setPaymentCard(card !== "0");
      setLogoUri(savedLogo || null);
      setAppLogo((savedAppLogo as LogoName) || "merchant-cash");
      setLogoPrimary(savedLogoPrimary || "#1D55C5");
      setLogoSecondary(savedLogoSecondary || "#E8EFFC");
    });
  }, [db]);

  async function refreshShops() {
    const [shopsList, current] = await Promise.all([
      listShops(db).catch(() => []),
      getCurrentShopId(),
    ]);
    setShops(shopsList);
    setCurrentShopIdState(current);
  }

  useEffect(() => {
    void refreshShops();
  }, [db]);

  async function handleCreateShop() {
    Alert.prompt(
      "Nouvelle boutique",
      "Nom de la boutique :",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "CrÃ©er",
          onPress: (value?: string) => {
            void (async () => {
              if (!value?.trim()) return;
              setBusy("shop-create");
              try {
                const shop = await createShop(db, value.trim());
                await setCurrentShopId(shop.id);
                await refreshShops();
                Alert.alert("Boutique crÃ©Ã©e", `Â« ${shop.name} Â» est maintenant active.`);
              } catch (err) {
                Alert.alert("Erreur", err instanceof Error ? err.message : "Impossible de crÃ©er la boutique.");
              } finally {
                setBusy(null);
              }
            })();
          },
        },
      ],
      "plain-text",
    );
  }

  async function handleSwitchShop(shopId: string) {
    setBusy("shop-switch");
    try {
      await setCurrentShopId(shopId);
      await refreshShops();
      Alert.alert("Boutique active", "Les donnÃ©es affichÃ©es sont dÃ©sormais celles de cette boutique.");
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Changement impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRenameShop(shopId: string, currentName: string) {
    Alert.prompt(
      "Renommer la boutique",
      "Nouveau nom :",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Enregistrer",
          onPress: (value?: string) => {
            void (async () => {
              if (!value?.trim()) return;
              try {
                await updateShop(db, shopId, { name: value.trim() });
                await refreshShops();
              } catch (err) {
                Alert.alert("Erreur", err instanceof Error ? err.message : "Renommage impossible.");
              }
            })();
          },
        },
      ],
      "plain-text",
      currentName,
    );
  }

  useEffect(() => {
    if (!developerMode) return;
    const interval = setInterval(() => {
      void getSetting(db, "developer_mode_until").then((value) => {
        if (Number(value) <= Date.now()) setDeveloperMode(false);
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, [db, developerMode]);

  useEffect(() => {
    void (async () => {
      const session = await getSession().catch(() => null);
      const status = session ? await getCloudBackupStatus(db, session).catch(() => null) : null;
      setAccountStatus(status);
    })();
  }, [db]);

  async function runCloudSyncNow() {
    setBusy("cloud-sync");
    try {
      const result = await syncCloudBackup(db, { force: true });
      setAccountStatus(result);
      if (result.outcome === "synced") {
        Alert.alert(
          "Sauvegarde terminÃ©e",
          `Les donnÃ©es du ${result.lastSuccessDate ?? "jour"} sont enregistrÃ©es dans votre compte.`,
        );
      } else if (result.outcome === "not_configured") {
        Alert.alert(
          "Compte requis",
          "Connectez-vous au compte marchand avant de sauvegarder.",
        );
      } else if (result.outcome === "remote_newer") {
        Alert.alert(
          "Copie plus rÃ©cente disponible",
          "Une autre tablette possÃ¨de une copie plus rÃ©cente. RedÃ©marrez lâ€™application pour la charger ou garder vos donnÃ©es.",
        );
      } else {
        Alert.alert(
          "Sauvegarde en attente",
          result.lastError ??
            "Internet est indisponible. La sauvegarde sera envoyÃ©e Ã  la prochaine connexion.",
        );
      }
    } catch (caught) {
      Alert.alert(
        "Sauvegarde impossible",
        caught instanceof Error ? caught.message : "La sauvegarde restera en attente.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function runCloudRestore() {
    setBusy("cloud-restore");
    try {
      const session = await getSession();
      if (!session) {
        Alert.alert("Compte requis", "Connectez-vous au compte marchand.");
        return;
      }
      const remote = await getRemoteBackupMetadata(session);
      if (!remote) {
        Alert.alert(
          "Aucune sauvegarde",
          "Votre compte ne contient encore aucune sauvegarde.",
        );
        return;
      }
      Alert.alert(
        "Restaurer la sauvegarde du compte ?",
        `Copie du ${new Date(remote.snapshotAt).toLocaleString(locale())} (app ${remote.appVersion}). Les donnÃ©es actuelles de la tablette seront remplacÃ©es.`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Restaurer",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await restoreCloudBackup(db, remote);
                  Alert.alert(
                    "Sauvegarde restaurÃ©e",
                    "Les donnÃ©es du compte ont Ã©tÃ© restaurÃ©es. Reconnectez-vous.",
                    [{ text: "Se reconnecter", onPress: onImported }],
                  );
                } catch (e) {
                  Alert.alert(
                    "Restauration impossible",
                    e instanceof Error ? e.message : "Impossible de restaurer.",
                  );
                } finally {
                  setBusy(null);
                }
              })();
            },
          },
        ],
      );
    } catch (caught) {
      Alert.alert(
        "Restauration impossible",
        caught instanceof Error ? caught.message : "VÃ©rifiez la connexion Internet.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveName() {
    if (shopName.trim().length < 2) {
      Alert.alert("Nom incomplet", "Indiquez le nom de la boutique.");
      return;
    }
    setBusy("save");
    try {
      const value = shopName.trim();
      await setSetting(db, "shop_name", value, user);
      onShopNameChange(value);
    } catch (caught) {
      Alert.alert(
        "Enregistrement impossible",
        caught instanceof Error ? caught.message : "Le nom nâ€™a pas Ã©tÃ© enregistrÃ©.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveValues(values: Array<[string, string]>): Promise<void> {
    for (const [key, value] of values) {
      await setSetting(db, key, value, user);
    }
  }

  async function savePreferences() {
    const rate = Number(currencyRate.replace(",", "."));
    if (currencySecondary !== "none" && (!Number.isFinite(rate) || rate <= 0)) {
      Alert.alert(
        "Taux incorrect",
        "Indiquez combien vaut une unitÃ© de la devise secondaire dans la devise principale.",
      );
      return;
    }
    setBusy("preferences");
    try {
      await saveValues([
        ["currency_primary", currencyPrimary],
        ["currency_secondary", currencySecondary],
        ["currency_rate", String(rate || 1)],
        ["language", language],
        ["theme", theme],
      ]);
      await Promise.all([
        SecureStore.setItemAsync("commerce.theme", theme),
        SecureStore.setItemAsync("commerce.language", language),
      ]);
      applyTheme(theme);
      setActiveLanguage(language);
      configureFormatting({
        primary: currencyPrimary,
        secondary: currencySecondary === "none" ? null : currencySecondary,
        rate: rate || 1,
        language,
      });
      onPreferencesChange();
      Alert.alert(
        "PrÃ©fÃ©rences enregistrÃ©es",
        "Le thÃ¨me et la langue ont Ã©tÃ© appliquÃ©s.",
      );
    } catch (caught) {
      Alert.alert(
        "Enregistrement impossible",
        caught instanceof Error ? caught.message : "Les prÃ©fÃ©rences nâ€™ont pas Ã©tÃ© enregistrÃ©es.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveEstablishment() {
    const tax = Number(taxRate.replace(",", "."));
    if (!Number.isFinite(tax) || tax < 0 || tax > 100) {
      Alert.alert("Taux incorrect", "Le taux doit Ãªtre compris entre 0 et 100 %.");
      return;
    }
    if (!paymentCash && !paymentMobile && !paymentCard) {
      Alert.alert(
        "Moyen de paiement requis",
        "Gardez au moins un moyen de paiement disponible.",
      );
      return;
    }
    setBusy("establishment");
    try {
      await saveValues([
        ["shop_address", address.trim()],
        ["shop_phone", phone.trim()],
        ["shop_email", email.trim()],
        ["shop_website", website.trim()],
        ["shop_legal_info", legalInfo.trim()],
        ["tax_rate", String(tax)],
        ["opening_hours", openingHours.trim()],
        ["payment_cash", paymentCash ? "1" : "0"],
        ["payment_mobile_money", paymentMobile ? "1" : "0"],
        ["payment_card", paymentCard ? "1" : "0"],
        ["shop_logo", logoUri ?? ""],
      ]);
      Alert.alert("Ã‰tablissement enregistrÃ©");
    } catch (caught) {
      Alert.alert(
        "Enregistrement impossible",
        caught instanceof Error ? caught.message : "Les informations nâ€™ont pas Ã©tÃ© enregistrÃ©es.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function pickLogo() {
    setBusy("establishment");
    try {
      const uri = await pickShopLogo();
      if (uri) setLogoUri(uri);
    } catch (caught) {
      Alert.alert(
        "Logo indisponible",
        caught instanceof Error
          ? caught.message
          : "Le logo nâ€™a pas pu Ãªtre chargÃ©.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function runExport() {
    setBusy("export");
    try {
      await exportBackup(db, user);
    } catch (caught) {
      Alert.alert(
        "Sauvegarde impossible",
        caught instanceof Error
          ? caught.message
          : "Le fichier nâ€™a pas pu Ãªtre crÃ©Ã©.",
      );
    } finally {
      setBusy(null);
    }
  }

  function requestImport() {
    Alert.alert(
      "Restaurer une sauvegarde ?",
      "Toutes les donnÃ©es actuelles seront remplacÃ©es par le contenu du fichier. Cette action ne peut pas Ãªtre annulÃ©e.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Choisir le fichier",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy("import");
              try {
                const imported = await importBackup(db);
                if (imported) {
                  Alert.alert(
                    "Sauvegarde restaurÃ©e",
                    "Les donnÃ©es ont Ã©tÃ© remplacÃ©es. Reconnectez-vous pour continuer.",
                    [{ text: "Se reconnecter", onPress: onImported }],
                  );
                }
              } catch (caught) {
                Alert.alert(
                  "Restauration impossible",
                  caught instanceof Error
                    ? caught.message
                    : "Le fichier nâ€™a pas pu Ãªtre restaurÃ©.",
                );
              } finally {
                setBusy(null);
              }
            })();
          },
        },
      ],
    );
  }

  async function runSeed() {
    setBusy("seed");
    try {
      await seedDemoData(db, user);
      Alert.alert(
        "DonnÃ©es ajoutÃ©es",
        "Quatre produits et un client de dÃ©monstration sont disponibles.",
      );
    } catch (caught) {
      Alert.alert(
        "Ajout impossible",
        caught instanceof Error
          ? caught.message
          : "Les donnÃ©es nâ€™ont pas Ã©tÃ© ajoutÃ©es.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function runNotifications() {
    setBusy("notifications");
    try {
      const granted = await prepareDeviceNotifications(db);
      if (!granted) {
        Alert.alert(
          "Notifications dÃ©sactivÃ©es",
          "Autorisez les notifications dans les rÃ©glages Android de MerchantHQ, puis rÃ©essayez.",
        );
        return;
      }
      await sendTestNotification();
    } catch (caught) {
      Alert.alert(
        "Activation impossible",
        caught instanceof Error
          ? caught.message
          : "Android nâ€™a pas pu activer les notifications locales.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleVersionPress() {
    if (developerMode) return;
    const next = versionTaps + 1;
    if (next >= 4) {
      await setSetting(
        db,
        "developer_mode_until",
        String(Date.now() + 5 * 60 * 1000),
        user,
      );
      setDeveloperMode(true);
      setVersionTaps(0);
      Alert.alert(
        "Mode dÃ©veloppeur activÃ©",
        "Les outils avancÃ©s sont visibles pendant 5 minutes.",
      );
      return;
    }
    setVersionTaps(next);
  }

  async function leaveDeveloperMode() {
    await setSetting(db, "developer_mode_until", "0", user);
    setDeveloperMode(false);
  }

  return (
    <Page
      description="Changez le nom affichÃ© dans lâ€™application."
      title="RÃ©glages"
    >
      <SettingCard
        description="Ce nom apparaÃ®t en haut de lâ€™Ã©cran."
        icon="Text"
        title="Nom de la boutique"
      >
        <TextField
          label="Nom affichÃ©"
          onChangeText={setShopName}
          placeholder="Ma boutique"
          value={shopName}
        />
        <AppButton
          icon="Save"
          label="Enregistrer"
          loading={busy === "save"}
          onPress={() => void saveName()}
        />
      </SettingCard>

      <SettingCard
        description="GÃ©rez vos boutiques : crÃ©ez-en de nouvelles ou basculez entre elles. Chaque boutique a ses propres produits, clients et sauvegardes."
        icon="Store"
        title="Mes boutiques"
      >
        {shops.map((shop) => {
          const active = shop.id === currentShopId;
          return (
            <Pressable
              accessibilityRole="button"
              key={shop.id}
              onPress={() => void handleSwitchShop(shop.id)}
              style={[
                styles.shopRow,
                active && styles.shopRowActive,
              ]}
            >
              <View style={styles.shopBadge}>
                <Text style={styles.shopBadgeText}>
                  {shop.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.shopRowCopy}>
                <Text style={styles.shopRowName}>{shop.name}</Text>
                <Text style={styles.shopRowMeta}>
                  {active ? "Boutique active" : "Toucher pour activer"}
                </Text>
              </View>
              {active ? (
                <Icon name="CircleCheck" size={18} color={colors.success} />
              ) : (
                <Icon name="ArrowRight" size={18} color={colors.muted} />
              )}
            </Pressable>
          );
        })}
        <View style={styles.actions}>
          <AppButton
            icon="Plus"
            label="Nouvelle boutique"
            loading={busy === "shop-create"}
            onPress={() => void handleCreateShop()}
            tone="secondary"
          />
        </View>
      </SettingCard>

      <SettingCard
        description="Votre boutique est sauvegardÃ©e chaque soir, mÃªme sans connexion au moment de fermer."
        icon="CloudUpload"
        title="Compte connectÃ©"
      >
        <View style={styles.cloudRow}>
          <View style={styles.cloudDot} />
          <Text style={styles.cloudText}>
            {accountStatus?.username
              ? `ConnectÃ© : ${accountStatus.username}`
              : "Compte non chargÃ©"}
          </Text>
        </View>
        <Text style={styles.cloudDetail}>
          {accountStatus?.pendingDate
            ? `Sauvegarde du ${accountStatus.pendingDate} en attente â€” sera envoyÃ©e Ã  la prochaine connexion.`
            : accountStatus?.lastSuccessAt
              ? `DerniÃ¨re sauvegarde : ${new Date(accountStatus.lastSuccessAt).toLocaleString(locale())}.`
              : "Aucune sauvegarde envoyÃ©e pour lâ€™instant."}
        </Text>
        {accountStatus?.lastError ? (
          <Text style={styles.cloudDetailError}>{accountStatus.lastError}</Text>
        ) : null}
        <View style={styles.actions}>
          <AppButton
            disabled={!accountStatus?.configured}
            icon="CloudUpload"
            label="Sauvegarder maintenant"
            loading={busy === "cloud-sync"}
            onPress={() => void runCloudSyncNow()}
          />
          <AppButton
            disabled={!accountStatus?.configured}
            icon="Download"
            label="Restaurer depuis le compte"
            loading={busy === "cloud-restore"}
            onPress={() => void runCloudRestore()}
            tone="secondary"
          />
          <AppButton
            icon="LogOut"
            label="Se dÃ©connecter"
            onPress={() => void onAccountDisconnected()}
            tone="secondary"
          />
        </View>
      </SettingCard>

      <View style={[styles.columns, width < 940 && styles.columnsStacked]}>
        <SettingCard
          description="Adresse, contact, taxe, horaires et paiements acceptÃ©s."
          icon="Building2"
          title="Ã‰tablissement"
        >
          <TextField
            label="Adresse"
            onChangeText={setAddress}
            placeholder="Adresse de la boutique"
            value={address}
          />
          <TextField
            keyboardType="phone-pad"
            label="TÃ©lÃ©phone"
            onChangeText={setPhone}
            placeholder="+243â€¦"
            value={phone}
          />
          <View style={styles.twoFields}>
            <View style={styles.flexField}>
              <TextField
                autoCapitalize="none"
                keyboardType="email-address"
                label="E-mail"
                onChangeText={setEmail}
                placeholder="contact@boutique.cd"
                value={email}
              />
            </View>
            <View style={styles.flexField}>
              <TextField
                autoCapitalize="none"
                keyboardType="url"
                label="Site internet"
                onChangeText={setWebsite}
                placeholder="boutique.cd"
                value={website}
              />
            </View>
          </View>
          <TextField
            label="Identifiant lÃ©gal"
            onChangeText={setLegalInfo}
            placeholder="RCCM, numÃ©ro fiscalâ€¦"
            value={legalInfo}
          />
          <View style={styles.twoFields}>
            <View style={styles.flexField}>
              <TextField
                keyboardType="decimal-pad"
                label="Taux de taxe (%)"
                onChangeText={setTaxRate}
                placeholder="0"
                value={taxRate}
              />
            </View>
            <View style={styles.flexField}>
              <TextField
                label="Horaires"
                onChangeText={setOpeningHours}
                placeholder="08:00 â€“ 18:00"
                value={openingHours}
              />
            </View>
          </View>
          <View style={styles.toggleList}>
            <ToggleRow
              label="EspÃ¨ces"
              onChange={setPaymentCash}
              value={paymentCash}
            />
            <ToggleRow
              label="Mobile Money"
              onChange={setPaymentMobile}
              value={paymentMobile}
            />
            <ToggleRow
              label="Carte"
              onChange={setPaymentCard}
              value={paymentCard}
            />
          </View>
          <View style={styles.logoRow}>
            <View style={styles.logoPreview}>
              {logoUri ? (
                <Image
                  accessibilityLabel="Logo de lâ€™Ã©tablissement"
                  source={{ uri: logoUri }}
                  style={styles.logoImage}
                />
              ) : (
                <Icon color={colors.muted} name="Store" size={30} />
              )}
            </View>
            <View style={styles.logoActions}>
              <AppButton
                icon="Image"
                label="Choisir le logo"
                loading={busy === "establishment"}
                onPress={() => void pickLogo()}
                tone="secondary"
              />
              {logoUri ? (
                <AppButton
                  label="Retirer le logo"
                  onPress={() => setLogoUri(null)}
                  tone="ghost"
                />
              ) : null}
            </View>
          </View>
<AppButton
            icon="Save"
            label="Enregistrer l'Ã©tablissement"
            loading={busy === "establishment"}
            onPress={() => void saveEstablishment()}
          />
        </SettingCard>

        <SettingCard
          description="Logo et couleurs affichÃ©s dans l'application."
          icon="Palette"
          title="Logo de l'application"
        >
          <View style={styles.logoRow}>
            <View style={styles.logoPreview}>
              {logoRegistry[appLogo] ? (
                (() => {
                  const LogoComponent = logoRegistry[appLogo];
                  return LogoComponent ? (
                    <LogoComponent
                      accessibilityLabel="Logo de l'application"
                      color={logoPrimary}
                      detail={logoSecondary}
                      size={64}
                    />
                  ) : null;
                })()
              ) : (
                <Icon color={colors.muted} name="Store" size={30} />
              )}
            </View>
            <View style={styles.logoActions}>
              <AppButton
                icon="Palette"
                label="Choisir le logo"
                onPress={() => setLogoPickerOpen(true)}
                tone="secondary"
              />
              <View style={styles.colorDots}>
                <View style={[styles.colorDot, { backgroundColor: logoPrimary }]} />
                <View style={[styles.colorDot, { backgroundColor: logoSecondary }]} />
              </View>
            </View>
          </View>
        </SettingCard>

        <SettingCard
          description="La devise principale sert aux prix. La secondaire donne un repÃ¨re."
          icon="Banknote"
          title="Devise et affichage"
        >
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t("Devise principale")}</Text>
            <ChoiceRow
              onChange={setCurrencyPrimary}
              options={[
                { value: "CDF", label: "FC" },
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" },
              ]}
              value={currencyPrimary}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t("Devise secondaire")}</Text>
            <ChoiceRow
              onChange={setCurrencySecondary}
              options={[
                { value: "none", label: "Aucune" },
                { value: "CDF", label: "FC" },
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" },
              ]}
              value={currencySecondary}
            />
          </View>
          {currencySecondary !== "none" ? (
            <TextField
              helper={`1 ${currencySecondary} = combien en ${currencyPrimary} ?`}
              keyboardType="decimal-pad"
              label="Taux de conversion"
              onChangeText={setCurrencyRate}
              value={currencyRate}
            />
          ) : null}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t("Langue")}</Text>
            <ChoiceRow
              onChange={setLanguage}
              options={[
                { value: "fr", label: "FranÃ§ais" },
                { value: "en", label: "English" },
                { value: "ln", label: "Lingala" },
                { value: "sw", label: "Kiswahili" },
              ]}
              value={language}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t("ThÃ¨me")}</Text>
            <ChoiceRow
              onChange={setTheme}
              options={[
                { value: "cobalt", label: "Cobalt" },
                { value: "night", label: "Nuit" },
                { value: "contrast", label: "Contraste" },
              ]}
              value={theme}
            />
          </View>
          <AppButton
            icon="Palette"
            label="Appliquer"
            loading={busy === "preferences"}
            onPress={() => void savePreferences()}
          />
        </SettingCard>
      </View>

      {developerMode ? (
        <View style={styles.developerSection}>
          <View style={styles.developerHeader}>
            <View style={styles.developerIcon}>
              <Icon name="Wrench" size={22} color={colors.accent} />
            </View>
            <View style={styles.developerCopy}>
              <Text style={styles.developerTitle}>Mode dÃ©veloppeur</Text>
              <Text style={styles.developerDescription}>
                Outils avancÃ©s pour prÃ©parer, sauvegarder ou vÃ©rifier la tablette.
              </Text>
            </View>
            <AppButton
              compact
              icon="X"
              label="Quitter"
              onPress={() => void leaveDeveloperMode()}
              tone="secondary"
            />
          </View>

          <View style={[styles.columns, width < 940 && styles.columnsStacked]}>
            <SettingCard
              description="CrÃ©ez une copie Ã  conserver ailleurs."
              icon="Archive"
              title="Copie sur un fichier"
            >
              <View style={styles.backupInfo}>
                <Icon
                  name="Info"
                  size={20}
                  color={colors.accent}
                />
                <Text style={styles.backupText}>
                  La copie contient toutes les donnÃ©es de la boutique.
                </Text>
              </View>
              <View style={styles.actions}>
                <AppButton
                  icon="Share"
                  label="CrÃ©er une copie"
                  loading={busy === "export"}
                  onPress={() => void runExport()}
                />
                <AppButton
                  icon="Upload"
                  label="Restaurer"
                  loading={busy === "import"}
                  onPress={requestImport}
                  tone="secondary"
                />
              </View>
            </SettingCard>

            <SettingCard
              description="Rappels de rendez-vous, stock faible et rÃ©sumÃ© du jour."
              icon="Bell"
              title="Rappels sur la tablette"
            >
              <View style={styles.demoRow}>
                <Text style={styles.demoText}>
                  Le rÃ©sumÃ© du jour est prÃ©vu Ã  19 h. Les rappels fonctionnent
                  mÃªme sans Internet.
                </Text>
                <AppButton
                  icon="Bell"
                  label="Activer et tester"
                  loading={busy === "notifications"}
                  onPress={() => void runNotifications()}
                  tone="secondary"
                />
              </View>
            </SettingCard>
          </View>

          <SettingCard
            description="Ajoute quelques exemples seulement si la liste des produits est vide."
            icon="FlaskConical"
            title="DonnÃ©es dâ€™essai"
          >
            <View style={styles.demoRow}>
              <Text style={styles.demoText}>
                Ajoute quatre produits et un client pour essayer lâ€™application.
              </Text>
              <AppButton
                icon="CirclePlus"
                label="Ajouter les exemples"
                loading={busy === "seed"}
                onPress={() => void runSeed()}
                tone="secondary"
              />
            </View>
          </SettingCard>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Version de lâ€™application"
        onPress={() => void handleVersionPress()}
        style={({ pressed }) => [
          styles.version,
          pressed && styles.versionPressed,
        ]}
      >
        <Text style={styles.versionText}>
          MerchantHQ Â· Version 0.1.0
        </Text>
      </Pressable>

      <LogoPicker
        db={db}
        initialLogo={appLogo}
        initialPrimary={logoPrimary}
        initialSecondary={logoSecondary}
        onClose={() => setLogoPickerOpen(false)}
        onSaved={(logo, primary, secondary) => {
          setAppLogo(logo);
          setLogoPrimary(primary);
          setLogoSecondary(secondary);
        }}
        user={user}
        visible={logoPickerOpen}
      />
    </Page>
  );
}

function createStyles() {
  return StyleSheet.create({
  columns: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: space.md,
  },
  columnsStacked: {
    flexDirection: "column",
  },
  twoFields: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  flexField: {
    flex: 1,
    minWidth: 220,
  },
  fieldGroup: {
    alignSelf: "stretch",
    gap: space.xs,
  },
  fieldLabel: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  choice: {
    alignItems: "center",
    backgroundColor: colors.paper2,
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    minWidth: 72,
    paddingHorizontal: space.sm,
  },
  choiceActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  choiceText: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  choiceTextActive: {
    color: colors.accentDark,
  },
  toggleList: {
    alignSelf: "stretch",
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  logoRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  logoPreview: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.ruleStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 72,
    justifyContent: "center",
    overflow: "hidden",
    width: 72,
  },
  logoImage: {
    height: "100%",
    resizeMode: "contain",
    width: "100%",
  },
  logoActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    alignItems: "center",
  },
  colorDots: {
    flexDirection: "row",
    gap: space.xs,
  },
  colorDot: {
    borderRadius: radius.round,
    height: 24,
    width: 24,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  toggleRow: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: space.sm,
  },
  toggleLabel: {
    color: colors.ink2,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  toggle: {
    backgroundColor: colors.ruleStrong,
    borderRadius: radius.round,
    height: 24,
    padding: 3,
    width: 42,
  },
  toggleActive: {
    backgroundColor: colors.accent,
  },
  toggleKnob: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.round,
    height: 18,
    width: 18,
  },
  toggleKnobActive: {
    transform: [{ translateX: 18 }],
  },
  developerSection: {
    gap: space.md,
  },
  developerHeader: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    paddingBottom: space.sm,
  },
  developerIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  developerCopy: {
    flex: 1,
    gap: space.xxs,
  },
  developerTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 20,
  },
  developerDescription: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  },
  cardHeader: {
    alignItems: "flex-start",
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    padding: space.md,
  },
  icon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  cardCopy: {
    flex: 1,
    gap: space.xxs,
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 18,
  },
  cardDescription: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  cardBody: {
    alignItems: "flex-start",
    gap: space.md,
    padding: space.md,
  },
  backupInfo: {
    alignItems: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: space.xs,
    padding: space.sm,
  },
  backupText: {
    color: colors.ink2,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  demoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.lg,
    justifyContent: "space-between",
    width: "100%",
  },
  demoText: {
    color: colors.ink2,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
  cloudRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
  },
  cloudDot: {
    backgroundColor: colors.success,
    borderRadius: radius.round,
    height: 8,
    width: 8,
  },
  cloudText: {
    color: colors.ink2,
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  cloudDetail: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  cloudDetailError: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  shopRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    padding: space.sm,
  },
  shopRowActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  shopBadge: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  shopBadgeText: {
    color: "#FFFFFF",
    fontFamily: fonts.displayMedium,
    fontSize: 16,
  },
  shopRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  shopRowName: {
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  shopRowMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  version: {
    alignItems: "center",
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: space.md,
  },
  versionPressed: {
    backgroundColor: colors.paper2,
  },
  versionText: {
    color: colors.faint,
    fontFamily: fonts.mono,
    fontSize: 10,
  },
});
}
