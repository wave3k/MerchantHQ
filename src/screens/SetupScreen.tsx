import type { SQLiteDatabase } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppButton } from "../components/AppButton";
import { Page } from "../components/Page";
import { TextField } from "../components/TextField";
import { TranslatedText as Text } from "../components/TranslatedText";
import { setAppSetupComplete } from "../data/cloudApi";
import { getSetting } from "../data/database";
import * as SecureStore from "../data/secureStore";
import { configureFormatting, type AppLanguage, type CurrencyCode } from "../domain/format";
import {useThemedStyles,  colors, fonts, radius, space } from "../theme";
import { t } from "../i18n";

interface SetupScreenProps {
  db: SQLiteDatabase;
  existingAccount: boolean;
  onDone: () => void;
}

function saveSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  return db
    .runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      value,
    )
    .then(() => undefined);
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

export function SetupScreen({ db, existingAccount, onDone }: SetupScreenProps) {
  const styles = useThemedStyles(createStyles);
  const [shopName, setShopName] = useState("");
  const [currencyPrimary, setCurrencyPrimary] = useState<CurrencyCode>("CDF");
  const [currencySecondary, setCurrencySecondary] = useState<CurrencyCode | "none">("USD");
  const [currencyRate, setCurrencyRate] = useState("2800");
  const [language, setLanguage] = useState<AppLanguage>("fr");
  const [theme, setTheme] = useState<"cobalt" | "night" | "contrast">("cobalt");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [legalInfo, setLegalInfo] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [openingHours, setOpeningHours] = useState("08:00 – 18:00");
  const [paymentCash, setPaymentCash] = useState(true);
  const [paymentMobile, setPaymentMobile] = useState(true);
  const [paymentCard, setPaymentCard] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const [name, primary, secondary, rate, savedLanguage, savedTheme, a, p, e, w, l, tax, hours, cash, mobile, card] =
        await Promise.all([
          getSetting(db, "shop_name"),
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
        ]);
      if (name) setShopName(name);
      if (primary) setCurrencyPrimary(primary as CurrencyCode);
      if (secondary) setCurrencySecondary(secondary as CurrencyCode | "none");
      if (rate) setCurrencyRate(rate);
      if (savedLanguage) setLanguage(savedLanguage as AppLanguage);
      if (savedTheme) setTheme(savedTheme as "cobalt" | "night" | "contrast");
      if (a) setAddress(a);
      if (p) setPhone(p);
      if (e) setEmail(e);
      if (w) setWebsite(w);
      if (l) setLegalInfo(l);
      if (tax) setTaxRate(tax);
      if (hours) setOpeningHours(hours);
      if (cash) setPaymentCash(cash !== "0");
      if (mobile) setPaymentMobile(mobile !== "0");
      if (card) setPaymentCard(card !== "0");
    })();
  }, [db]);

  async function save() {
    if (!existingAccount && shopName.trim().length < 2) {
      setError("Indiquez le nom de la boutique.");
      return;
    }
    const rate = Number(currencyRate.replace(",", "."));
    if (
      !existingAccount &&
      currencySecondary !== "none" &&
      (!Number.isFinite(rate) || rate <= 0)
    ) {
      setError("Indiquez le taux de conversion de la devise secondaire.");
      return;
    }
    if (!existingAccount && !paymentCash && !paymentMobile && !paymentCard) {
      setError("Gardez au moins un moyen de paiement disponible.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!existingAccount) {
        await Promise.all([
          saveSetting(db, "shop_name", shopName.trim()),
          saveSetting(db, "shop_address", address.trim()),
          saveSetting(db, "shop_phone", phone.trim()),
          saveSetting(db, "shop_email", email.trim()),
          saveSetting(db, "shop_website", website.trim()),
          saveSetting(db, "shop_legal_info", legalInfo.trim()),
          saveSetting(db, "tax_rate", String(taxRate)),
          saveSetting(db, "opening_hours", openingHours.trim()),
          saveSetting(db, "currency_primary", currencyPrimary),
          saveSetting(db, "currency_secondary", currencySecondary),
          saveSetting(db, "currency_rate", String(rate || 1)),
          saveSetting(db, "payment_cash", paymentCash ? "1" : "0"),
          saveSetting(db, "payment_mobile_money", paymentMobile ? "1" : "0"),
          saveSetting(db, "payment_card", paymentCard ? "1" : "0"),
        ]);
      }
      await Promise.all([
        saveSetting(db, "language", language),
        saveSetting(db, "theme", theme),
        SecureStore.setItemAsync("commerce.theme", theme),
        SecureStore.setItemAsync("commerce.language", language),
      ]);
      configureFormatting({
        primary: currencyPrimary,
        secondary: currencySecondary === "none" ? null : currencySecondary,
        rate: rate || 1,
        language,
      });
      await setAppSetupComplete(db, true);
      onDone();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "La configuration n’a pas pu être enregistrée.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      description={
        existingAccount
          ? "Votre boutique a été restaurée. Choisissez simplement le thème et la langue."
          : "Configurez votre boutique : établissement, devise, thème et langue."
      }
      title="Bienvenue sur MerchantHQ"
    >
      {!existingAccount ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Établissement</Text>
          <TextField
            label="Nom de la boutique"
            onChangeText={setShopName}
            placeholder="Ex. Boutique de Kinshasa"
            value={shopName}
          />
          <View style={styles.twoFields}>
            <View style={styles.flexField}>
              <TextField label="Adresse" onChangeText={setAddress} value={address} />
            </View>
            <View style={styles.flexField}>
              <TextField
                keyboardType="phone-pad"
                label="Téléphone"
                onChangeText={setPhone}
                placeholder="+243…"
                value={phone}
              />
            </View>
          </View>
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
                label="Site internet"
                onChangeText={setWebsite}
                placeholder="boutique.cd"
                value={website}
              />
            </View>
          </View>
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
                placeholder="08:00 – 18:00"
                value={openingHours}
              />
            </View>
          </View>
          <TextField
            label="Identifiant légal"
            onChangeText={setLegalInfo}
            placeholder="RCCM, numéro fiscal…"
            value={legalInfo}
          />
          <Text style={styles.fieldLabel}>{t("Moyens de paiement")}</Text>
          <View style={styles.toggleList}>
            <ToggleRow label="Espèces" onChange={setPaymentCash} value={paymentCash} />
            <ToggleRow label="Mobile Money" onChange={setPaymentMobile} value={paymentMobile} />
            <ToggleRow label="Carte" onChange={setPaymentCard} value={paymentCard} />
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Devise</Text>
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
        {currencySecondary !== "none" ? (
          <TextField
            helper={`1 ${currencySecondary} = combien en ${currencyPrimary} ?`}
            keyboardType="decimal-pad"
            label="Taux de conversion"
            onChangeText={setCurrencyRate}
            value={currencyRate}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Affichage</Text>
        <Text style={styles.fieldLabel}>{t("Langue")}</Text>
        <ChoiceRow
          onChange={setLanguage}
          options={[
            { value: "fr", label: "Français" },
            { value: "en", label: "English" },
            { value: "ln", label: "Lingala" },
            { value: "sw", label: "Kiswahili" },
          ]}
          value={language}
        />
        <Text style={styles.fieldLabel}>{t("Thème")}</Text>
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <AppButton
          icon="Check"
          label={existingAccount ? "Continuer" : "Terminer la configuration"}
          loading={busy}
          onPress={() => void save()}
        />
      </View>
    </Page>
  );
}

function createStyles() {
  return StyleSheet.create({
  section: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
    padding: space.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 18,
  },
  fieldLabel: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
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
  error: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  actions: {
    alignItems: "flex-end",
  },
});
}