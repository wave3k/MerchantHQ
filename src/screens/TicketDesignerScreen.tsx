/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
/* Hallmark · macrostructure: Component Playground · tone: utilitaire · anchor hue: framboise */
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppButton } from "../components/AppButton";
import { Page } from "../components/Page";
import { TextField } from "../components/TextField";
import { TranslatedText as Text } from "../components/TranslatedText";
import {
  createDefaultTicketLayout,
  createTicketBlock,
  moveTicketBlock,
  ticketBlockDefinitions,
  type TicketAlignment,
  type TicketBlock,
  type TicketBlockType,
  type TicketFontSize,
  type TicketLayout,
  type TicketSeparatorStyle,
  type TicketSpacing,
} from "../domain/ticketLayout";
import { formatDateTime, formatMoney, locale } from "../domain/format";
import {
  loadTicketDesigner,
  saveTicketDesigner,
  type TicketDesignerData,
  type TicketEstablishment,
} from "../data/ticketDesigner";
import { printSampleTicket } from "../data/tickets";
import {useThemedStyles,  colors, fonts, radius, shadow, space } from "../theme";
import type { User } from "../types";

const DRAG_ROW_HEIGHT = 68;

function ChoiceRow<T extends string | number>({
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
            style={({ pressed }) => [
              styles.choice,
              active && styles.choiceActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.choiceText, active && styles.choiceTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.toggleRow,
        pressed && styles.toggleRowPressed,
      ]}
    >
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? (
          <Text style={styles.toggleDescription}>{description}</Text>
        ) : null}
      </View>
      <View style={[styles.toggle, value && styles.toggleActive]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobActive]} />
      </View>
    </Pressable>
  );
}

function spacingValue(value: TicketSpacing): number {
  if (value === "small") return 4;
  if (value === "normal") return 8;
  if (value === "large") return 12;
  return 0;
}

function fontSizeValue(value: TicketFontSize): number {
  if (value === "small") return 10;
  if (value === "large") return 16;
  if (value === "xlarge") return 21;
  return 12;
}

function textAlignValue(value: TicketAlignment): "left" | "center" | "right" {
  return value;
}

function alignItemsValue(
  value: TicketAlignment,
): "flex-start" | "center" | "flex-end" {
  if (value === "left") return "flex-start";
  if (value === "right") return "flex-end";
  return "center";
}

function labelValue(label: string, value: string): string {
  return label ? `${label} : ${value}` : value;
}

function TicketBlockPreview({
  block,
  establishment,
  itemDetails,
  logoDataUri,
}: {
  block: TicketBlock;
  establishment: TicketEstablishment;
  itemDetails: boolean;
  logoDataUri: string | null;
}) {
  const styles = useThemedStyles(createStyles);
  const baseText = {
    color: colors.ticketInk,
    fontFamily: block.bold ? fonts.bodySemibold : fonts.body,
    fontSize: fontSizeValue(block.fontSize),
    textAlign: textAlignValue(block.alignment),
    textTransform: block.uppercase ? ("uppercase" as const) : undefined,
  };
  const sampleValues: Partial<Record<TicketBlockType, string>> = {
    shop_name: establishment.shopName,
    custom_text: block.text,
    address: establishment.address || "12 avenue de la Boutique",
    phone: establishment.phone || "+243 812 345 678",
    email: establishment.email || "contact@boutique.cd",
    website: establishment.website || "boutique.cd",
    legal_info: establishment.legalInfo || "RCCM CD/KIN/00000",
    tax_info: `${establishment.taxRate} %`,
    opening_hours: establishment.openingHours || "08:00 – 18:00",
    order_number: "APERÇU-001",
    date: formatDateTime(new Date().toISOString()),
    client: "Client de passage",
    employee: "Employé",
    cashier: "Propriétaire",
    payment: "Carte",
    item_count: "2",
    tax_total: formatMoney(
      establishment.taxRate > 0
        ? Math.round(5600 - 5600 / (1 + establishment.taxRate / 100))
        : 0,
    ),
    total: formatMoney(5600),
    footer: block.text,
  };

  if (block.type === "separator") {
    return (
      <View
        style={[
          styles.previewSeparator,
          block.separatorStyle === "dashed" && styles.previewSeparatorDashed,
          block.separatorStyle === "double" && styles.previewSeparatorDouble,
        ]}
      />
    );
  }
  if (block.type === "logo") {
    return (
      <View
        style={[
          styles.previewLogoLine,
          { alignItems: alignItemsValue(block.alignment) },
        ]}
      >
        {logoDataUri ? (
          <Image
            accessibilityLabel="Logo de l’établissement"
            source={{ uri: logoDataUri }}
            style={styles.previewLogoImage}
          />
        ) : (
          <View style={styles.previewLogoMonogram}>
            <Text style={styles.previewLogoMonogramText}>CM</Text>
          </View>
        )}
      </View>
    );
  }
  if (block.type === "items") {
    return (
      <View style={styles.previewItems}>
        {block.label ? (
          <Text style={[baseText, styles.previewItemsTitle]}>{block.label}</Text>
        ) : null}
        {[
          ["Produit exemple", "2", "2 800 FC", "5 600 FC"],
        ].map(([name, quantity, unit, subtotal]) => (
          <View key={name} style={styles.previewItemRow}>
            <View style={styles.previewItemCopy}>
              <Text style={[baseText, styles.previewItemName]}>{name}</Text>
              {itemDetails ? (
                <Text style={styles.previewMuted}>
                  {quantity} × {unit}
                </Text>
              ) : null}
            </View>
            <Text style={[baseText, styles.previewItemTotal]}>{subtotal}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (block.type === "tax_total" || block.type === "total") {
    return (
      <View style={styles.previewTotalRow}>
        <Text style={baseText}>{block.label}</Text>
        <Text style={baseText}>{sampleValues[block.type]}</Text>
      </View>
    );
  }
  const value = sampleValues[block.type] ?? "";
  return <Text style={baseText}>{labelValue(block.label, value)}</Text>;
}

function DraggableTicketRow({
  block,
  index,
  total,
  selected,
  dropTarget,
  establishment,
  itemDetails,
  logoDataUri,
  onSelect,
  onMove,
  onDragTarget,
}: {
  block: TicketBlock;
  index: number;
  total: number;
  selected: boolean;
  dropTarget: boolean;
  establishment: TicketEstablishment;
  itemDetails: boolean;
  logoDataUri: string | null;
  onSelect: () => void;
  onMove: (from: number, to: number) => void;
  onDragTarget: (index: number | null) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const translateY = useRef(new Animated.Value(0)).current;
  const targetRef = useRef(index);
  const [dragging, setDragging] = useState(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 3,
        onPanResponderGrant: () => {
          targetRef.current = index;
          setDragging(true);
          onSelect();
        },
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(gesture.dy);
          const target = Math.max(
            0,
            Math.min(total - 1, index + Math.round(gesture.dy / DRAG_ROW_HEIGHT)),
          );
          if (target !== targetRef.current) {
            targetRef.current = target;
            onDragTarget(target);
          }
        },
        onPanResponderRelease: () => {
          const target = targetRef.current;
          Animated.spring(translateY, {
            toValue: 0,
            stiffness: 280,
            damping: 26,
            mass: 1,
            useNativeDriver: true,
          }).start();
          setDragging(false);
          onDragTarget(null);
          if (target !== index) onMove(index, target);
        },
        onPanResponderTerminate: () => {
          translateY.setValue(0);
          setDragging(false);
          onDragTarget(null);
        },
      }),
    [index, onDragTarget, onMove, onSelect, total, translateY],
  );

  return (
    <Animated.View
      style={[
        styles.ticketRow,
        selected && styles.ticketRowSelected,
        dropTarget && styles.ticketRowDrop,
        !block.enabled && styles.ticketRowDisabled,
        dragging && styles.ticketRowDragging,
        {
          marginTop: spacingValue(block.spacingBefore),
          marginBottom: spacingValue(block.spacingAfter),
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        accessibilityActions={[
          { name: "increment", label: "Descendre" },
          { name: "decrement", label: "Monter" },
        ]}
        accessibilityLabel={`Déplacer ${block.label || block.type}`}
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: 1,
          max: total,
          now: index + 1,
          text: `${index + 1} sur ${total}`,
        }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment" && index < total - 1) {
            onMove(index, index + 1);
          }
          if (event.nativeEvent.actionName === "decrement" && index > 0) {
            onMove(index, index - 1);
          }
        }}
        style={styles.dragHandle}
        {...panResponder.panHandlers}
      >
        <Icon name="GripVertical" size={25} color={colors.muted} />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onSelect}
        style={({ pressed }) => [
          styles.ticketRowContent,
          pressed && styles.ticketRowPressed,
        ]}
      >
        <TicketBlockPreview
          block={block}
          establishment={establishment}
          itemDetails={itemDetails}
          logoDataUri={logoDataUri}
        />
        {!block.enabled ? (
          <View style={styles.hiddenBadge}>
            <Icon name="EyeOff" size={13} color={colors.muted} />
            <Text style={styles.hiddenText}>Masqué</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function PanelTitle({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.panelTitleRow}>
      <Icon name={icon} size={20} color={colors.accent} />
      <View style={styles.panelTitleCopy}>
        <Text style={styles.panelTitle}>{title}</Text>
        <Text style={styles.panelDescription}>{description}</Text>
      </View>
    </View>
  );
}

export function TicketDesignerScreen({
  db,
  user,
}: {
  db: SQLiteDatabase;
  user: User;
}) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const [designer, setDesigner] = useState<TicketDesignerData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "print" | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    void loadTicketDesigner(db)
      .then((data) => {
        setDesigner(data);
        setSelectedId(data.layout.blocks[0]?.id ?? null);
      })
      .catch((caught) =>
        Alert.alert(
          "Ticket indisponible",
          caught instanceof Error
            ? caught.message
            : "Le créateur de tickets n’a pas pu être chargé.",
        ),
      );
  }, [db]);

  const selected =
    designer?.layout.blocks.find((block) => block.id === selectedId) ?? null;
  const selectedDefinition = ticketBlockDefinitions.find(
    (definition) => definition.type === selected?.type,
  );

  function updateLayout(
    updater: (layout: TicketLayout) => TicketLayout,
  ): void {
    setDesigner((current) =>
      current ? { ...current, layout: updater(current.layout) } : current,
    );
    setDirty(true);
    setSavedAt(null);
  }

  function updateSelected(values: Partial<TicketBlock>) {
    if (!selectedId) return;
    updateLayout((layout) => ({
      ...layout,
      blocks: layout.blocks.map((block) =>
        block.id === selectedId ? { ...block, ...values } : block,
      ),
    }));
  }

  function addBlock(type: TicketBlockType) {
    const block = createTicketBlock(type);
    updateLayout((layout) => ({ ...layout, blocks: [...layout.blocks, block] }));
    setSelectedId(block.id);
  }

  function removeSelected() {
    if (!selectedId) return;
    updateLayout((layout) => ({
      ...layout,
      blocks: layout.blocks.filter((block) => block.id !== selectedId),
    }));
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!selected || !designer) return;
    const index = designer.layout.blocks.findIndex(
      (block) => block.id === selected.id,
    );
    const { id: _selectedId, ...copyValues } = selected;
    const duplicate = createTicketBlock(selected.type, copyValues);
    updateLayout((layout) => {
      const blocks = [...layout.blocks];
      blocks.splice(index + 1, 0, duplicate);
      return { ...layout, blocks };
    });
    setSelectedId(duplicate.id);
  }

  async function save() {
    if (!designer) return;
    setBusy("save");
    try {
      await saveTicketDesigner(
        db,
        designer.layout,
        designer.autoPrint,
        user,
      );
      setDirty(false);
      setSavedAt(
        new Intl.DateTimeFormat(locale(), {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      );
    } catch (caught) {
      Alert.alert(
        "Enregistrement impossible",
        caught instanceof Error
          ? caught.message
          : "La mise en page du ticket n’a pas été enregistrée.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function testPrint() {
    if (!designer) return;
    setBusy("print");
    try {
      await printSampleTicket(db, designer);
    } catch (caught) {
      Alert.alert(
        "Impression impossible",
        caught instanceof Error
          ? caught.message
          : "Android Print Manager n’a pas pu être ouvert.",
      );
    } finally {
      setBusy(null);
    }
  }

  function confirmReset() {
    Alert.alert(
      "Réinitialiser le ticket ?",
      "La mise en page actuelle sera remplacée. Le changement ne sera définitif qu’après enregistrement.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Réinitialiser",
          style: "destructive",
          onPress: () => {
            const layout = createDefaultTicketLayout();
            setDesigner((current) =>
              current ? { ...current, layout } : current,
            );
            setSelectedId(layout.blocks[0]?.id ?? null);
            setDirty(true);
            setSavedAt(null);
          },
        },
      ],
    );
  }

  if (!designer) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const usableWidth = width >= 1100 ? width - 244 : width;
  const wide = usableWidth >= 970;
  const medium = usableWidth >= 700;
  const paperWidth = designer.layout.paperWidth === 58 ? 290 : 370;

  return (
    <Page
      action={
        <View style={styles.headerActions}>
          <View style={styles.saveState}>
            <View
              style={[
                styles.saveDot,
                dirty ? styles.saveDotDirty : styles.saveDotSaved,
              ]}
            />
            <Text style={styles.saveText}>
              {dirty
                ? "Modifications non enregistrées"
                : savedAt
                  ? `Enregistré à ${savedAt}`
                  : "Ticket à jour"}
            </Text>
          </View>
          <AppButton
            compact
            icon="Printer"
            label="Tester"
            loading={busy === "print"}
            onPress={() => void testPrint()}
            tone="secondary"
          />
          <AppButton
            compact
            icon="Save"
            label="Enregistrer"
            loading={busy === "save"}
            onPress={() => void save()}
          />
        </View>
      }
      description="Ajoutez, déplacez et personnalisez chaque information imprimée."
      title="Créateur de tickets"
    >
      <View style={styles.printSettings}>
        <View style={styles.printSetting}>
          <Text style={styles.settingLabel}>Largeur du papier</Text>
          <ChoiceRow
            onChange={(value) =>
              updateLayout((layout) => ({ ...layout, paperWidth: value }))
            }
            options={[
              { value: 58 as const, label: "58 mm" },
              { value: 80 as const, label: "80 mm" },
            ]}
            value={designer.layout.paperWidth}
          />
        </View>
        <View style={styles.printSetting}>
          <Text style={styles.settingLabel}>Marge</Text>
          <ChoiceRow
            onChange={(value) =>
              updateLayout((layout) => ({ ...layout, marginMm: value }))
            }
            options={[
              { value: 3 as const, label: "Petite" },
              { value: 5 as const, label: "Normale" },
              { value: 7 as const, label: "Large" },
            ]}
            value={designer.layout.marginMm}
          />
        </View>
        <View style={styles.printSetting}>
          <Text style={styles.settingLabel}>Espacement</Text>
          <ChoiceRow
            onChange={(value) =>
              updateLayout((layout) => ({ ...layout, density: value }))
            }
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Aéré" },
            ]}
            value={designer.layout.density}
          />
        </View>
        <View style={styles.autoPrint}>
          <ToggleRow
            description="Android demandera l’imprimante au moment de la vente."
            label="Imprimer après l’encaissement"
            onChange={(value) => {
              setDesigner((current) =>
                current ? { ...current, autoPrint: value } : current,
              );
              setDirty(true);
              setSavedAt(null);
            }}
            value={designer.autoPrint}
          />
        </View>
      </View>

      <View
        style={[
          styles.workspace,
          !wide && styles.workspaceWrapped,
          !medium && styles.workspaceStacked,
        ]}
      >
        <View
          style={[
            styles.libraryPanel,
            !wide && medium && styles.libraryPanelWide,
          ]}
        >
          <PanelTitle
            description="Touchez pour ajouter au ticket."
            icon="CirclePlus"
            title="Informations"
          />
          <View style={styles.library}>
            {ticketBlockDefinitions.map((definition) => {
              const alreadyUsed = designer.layout.blocks.some(
                (block) => block.type === definition.type,
              );
              const disabled = alreadyUsed && !definition.allowMultiple;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  key={definition.type}
                  onPress={() => addBlock(definition.type)}
                  style={({ pressed }) => [
                    styles.libraryItem,
                    disabled && styles.libraryItemDisabled,
                    pressed && styles.libraryItemPressed,
                  ]}
                >
                  <Icon
                    name={definition.icon}
                    size={20}
                    color={disabled ? colors.faint : colors.accent}
                  />
                  <View style={styles.libraryCopy}>
                    <Text numberOfLines={1} style={styles.libraryTitle}>
                      {definition.title}
                    </Text>
                    <Text numberOfLines={2} style={styles.libraryDescription}>
                      {disabled ? "Déjà ajouté" : definition.description}
                    </Text>
                  </View>
                  <Icon
                    name={disabled ? "Check" : "Plus"}
                    size={20}
                    color={disabled ? colors.success : colors.ink2}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.canvasPanel}>
          <PanelTitle
            description="Glissez la poignée pour changer l’ordre."
            icon="Receipt"
            title="Votre ticket"
          />
          <View style={styles.canvas}>
            <View
              style={[
                styles.paper,
                {
                  maxWidth: paperWidth,
                  padding: designer.layout.marginMm * 3,
                },
              ]}
            >
              {designer.layout.blocks.length ? (
                designer.layout.blocks.map((block, index) => (
                  <DraggableTicketRow
                    block={block}
                    dropTarget={dropTarget === index}
                    establishment={designer.establishment}
                    index={index}
                    itemDetails={designer.layout.itemDetails}
                    key={block.id}
                    logoDataUri={designer.logoDataUri}
                    onDragTarget={setDropTarget}
                    onMove={(from, to) =>
                      updateLayout((layout) => ({
                        ...layout,
                        blocks: moveTicketBlock(layout.blocks, from, to),
                      }))
                    }
                    onSelect={() => setSelectedId(block.id)}
                    selected={selectedId === block.id}
                    total={designer.layout.blocks.length}
                  />
                ))
              ) : (
                <View style={styles.emptyTicket}>
                  <Icon
                    name="Receipt"
                    size={30}
                    color={colors.faint}
                  />
                  <Text style={styles.emptyTitle}>Ticket vide</Text>
                  <Text style={styles.emptyDescription}>
                    Ajoutez une information depuis la bibliothèque.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.inspectorPanel}>
          <PanelTitle
            description={
              selectedDefinition
                ? selectedDefinition.description
                : "Sélectionnez une information dans le ticket."
            }
            icon="Settings2"
            title={selectedDefinition?.title ?? "Personnalisation"}
          />
          {selected ? (
            <View style={styles.inspectorBody}>
              <ToggleRow
                description="L’élément reste dans le modèle mais ne sera pas imprimé."
                label="Afficher sur le ticket"
                onChange={(enabled) => updateSelected({ enabled })}
                value={selected.enabled}
              />

              {selected.type === "custom_text" || selected.type === "footer" ? (
                <TextField
                  label="Contenu"
                  multiline
                  onChangeText={(text) => updateSelected({ text })}
                  placeholder="Écrivez votre message"
                  style={styles.multiline}
                  value={selected.text}
                />
              ) : selected.type !== "logo" &&
                selected.type !== "shop_name" &&
                selected.type !== "separator" ? (
                <TextField
                  helper="Laissez vide pour afficher uniquement la valeur."
                  label="Libellé"
                  onChangeText={(label) => updateSelected({ label })}
                  placeholder="Ex. Client"
                  value={selected.label}
                />
              ) : null}

              <View style={styles.propertyGroup}>
                <Text style={styles.settingLabel}>Alignement</Text>
                <ChoiceRow
                  onChange={(alignment) => updateSelected({ alignment })}
                  options={[
                    { value: "left", label: "Gauche" },
                    { value: "center", label: "Centre" },
                    { value: "right", label: "Droite" },
                  ]}
                  value={selected.alignment}
                />
              </View>

              {selected.type !== "separator" && selected.type !== "logo" ? (
                <>
                  <View style={styles.propertyGroup}>
                    <Text style={styles.settingLabel}>Taille du texte</Text>
                    <ChoiceRow
                      onChange={(fontSize) => updateSelected({ fontSize })}
                      options={[
                        { value: "small", label: "Petit" },
                        { value: "normal", label: "Normal" },
                        { value: "large", label: "Grand" },
                        { value: "xlarge", label: "Très grand" },
                      ]}
                      value={selected.fontSize}
                    />
                  </View>
                  <ToggleRow
                    label="Texte en gras"
                    onChange={(bold) => updateSelected({ bold })}
                    value={selected.bold}
                  />
                  <ToggleRow
                    label="Texte en majuscules"
                    onChange={(uppercase) => updateSelected({ uppercase })}
                    value={selected.uppercase}
                  />
                </>
              ) : null}

              {selected.type === "separator" ? (
                <View style={styles.propertyGroup}>
                  <Text style={styles.settingLabel}>Style de ligne</Text>
                  <ChoiceRow
                    onChange={(separatorStyle) =>
                      updateSelected({ separatorStyle })
                    }
                    options={[
                      { value: "dashed", label: "Pointillée" },
                      { value: "solid", label: "Continue" },
                      { value: "double", label: "Double" },
                    ]}
                    value={selected.separatorStyle}
                  />
                </View>
              ) : null}

              <View style={styles.propertyGroup}>
                <Text style={styles.settingLabel}>Espace avant</Text>
                <ChoiceRow
                  onChange={(spacingBefore) =>
                    updateSelected({ spacingBefore })
                  }
                  options={[
                    { value: "none", label: "Aucun" },
                    { value: "small", label: "Petit" },
                    { value: "normal", label: "Normal" },
                    { value: "large", label: "Grand" },
                  ]}
                  value={selected.spacingBefore}
                />
              </View>
              <View style={styles.propertyGroup}>
                <Text style={styles.settingLabel}>Espace après</Text>
                <ChoiceRow
                  onChange={(spacingAfter) => updateSelected({ spacingAfter })}
                  options={[
                    { value: "none", label: "Aucun" },
                    { value: "small", label: "Petit" },
                    { value: "normal", label: "Normal" },
                    { value: "large", label: "Grand" },
                  ]}
                  value={selected.spacingAfter}
                />
              </View>

              <View style={styles.orderActions}>
                <AppButton
                  compact
                  disabled={
                    designer.layout.blocks.findIndex(
                      (block) => block.id === selected.id,
                    ) === 0
                  }
                  icon="ArrowUp"
                  label="Monter"
                  onPress={() => {
                    const index = designer.layout.blocks.findIndex(
                      (block) => block.id === selected.id,
                    );
                    updateLayout((layout) => ({
                      ...layout,
                      blocks: moveTicketBlock(layout.blocks, index, index - 1),
                    }));
                  }}
                  tone="secondary"
                />
                <AppButton
                  compact
                  disabled={
                    designer.layout.blocks.findIndex(
                      (block) => block.id === selected.id,
                    ) ===
                    designer.layout.blocks.length - 1
                  }
                  icon="ArrowDown"
                  label="Descendre"
                  onPress={() => {
                    const index = designer.layout.blocks.findIndex(
                      (block) => block.id === selected.id,
                    );
                    updateLayout((layout) => ({
                      ...layout,
                      blocks: moveTicketBlock(layout.blocks, index, index + 1),
                    }));
                  }}
                  tone="secondary"
                />
              </View>
              <View style={styles.destructiveActions}>
                <AppButton
                  compact
                  icon="Copy"
                  label="Dupliquer"
                  onPress={duplicateSelected}
                  tone="secondary"
                />
                <AppButton
                  compact
                  icon="Trash2"
                  label="Retirer"
                  onPress={removeSelected}
                  tone="danger"
                />
              </View>
            </View>
          ) : (
            <View style={styles.inspectorEmpty}>
              <Icon name="Hand" size={28} color={colors.faint} />
              <Text style={styles.emptyTitle}>Aucun élément sélectionné</Text>
              <Text style={styles.emptyDescription}>
                Touchez une ligne du ticket pour modifier son apparence.
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.advancedOptions}>
        <ToggleRow
          description="Affiche quantité × prix sous chaque article."
          label="Détail des articles"
          onChange={(itemDetails) =>
            updateLayout((layout) => ({ ...layout, itemDetails }))
          }
          value={designer.layout.itemDetails}
        />
        <ToggleRow
          description="Affiche une ligne de taxe même lorsque le taux vaut 0 %."
          label="Afficher la taxe à zéro"
          onChange={(showTaxWhenZero) =>
            updateLayout((layout) => ({ ...layout, showTaxWhenZero }))
          }
          value={designer.layout.showTaxWhenZero}
        />
        <AppButton
          compact
          icon="RefreshCw"
          label="Réinitialiser le ticket"
          onPress={confirmReset}
          tone="secondary"
        />
      </View>
    </Page>
  );
}

function createStyles() {
  return StyleSheet.create({
  loading: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  saveState: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
    minHeight: 44,
    paddingHorizontal: space.xs,
  },
  saveDot: {
    borderRadius: radius.round,
    height: 8,
    width: 8,
  },
  saveDotDirty: {
    backgroundColor: colors.warning,
  },
  saveDotSaved: {
    backgroundColor: colors.success,
  },
  saveText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  printSettings: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.lg,
    padding: space.md,
  },
  printSetting: {
    gap: space.xs,
    minWidth: 180,
  },
  autoPrint: {
    flex: 1,
    minWidth: 280,
  },
  settingLabel: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
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
    minHeight: 44,
    minWidth: 62,
    paddingHorizontal: space.sm,
  },
  choiceActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  choiceText: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  choiceTextActive: {
    color: colors.accentDark,
  },
  pressed: {
    opacity: 0.72,
  },
  toggleRow: {
    alignItems: "center",
    alignSelf: "stretch",
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 54,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  toggleRowPressed: {
    backgroundColor: colors.paper2,
  },
  toggleCopy: {
    flex: 1,
    gap: space.xxs,
    minWidth: 0,
    paddingRight: space.sm,
  },
  toggleLabel: {
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  toggleDescription: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
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
  workspace: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.md,
  },
  workspaceWrapped: {
    flexWrap: "wrap",
  },
  workspaceStacked: {
    flexDirection: "column",
  },
  libraryPanel: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 250,
    overflow: "hidden",
    width: 270,
  },
  libraryPanelWide: {
    width: "100%",
  },
  canvasPanel: {
    backgroundColor: colors.paper2,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1.25,
    minWidth: 330,
    overflow: "hidden",
  },
  inspectorPanel: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 0.9,
    minWidth: 300,
    overflow: "hidden",
  },
  panelTitleRow: {
    alignItems: "flex-start",
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 76,
    padding: space.md,
  },
  panelTitleCopy: {
    flex: 1,
    gap: space.xxs,
    minWidth: 0,
  },
  panelTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 17,
  },
  panelDescription: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  library: {
    gap: StyleSheet.hairlineWidth,
  },
  libraryItem: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 68,
    paddingHorizontal: space.sm,
  },
  libraryItemPressed: {
    backgroundColor: colors.accentSoft,
  },
  libraryItemDisabled: {
    backgroundColor: colors.paper2,
    opacity: 0.66,
  },
  libraryCopy: {
    flex: 1,
    gap: space.xxs,
    minWidth: 0,
  },
  libraryTitle: {
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  libraryDescription: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 15,
  },
  canvas: {
    alignItems: "center",
    minHeight: 560,
    padding: space.lg,
  },
  paper: {
    ...shadow,
    alignSelf: "center",
    backgroundColor: colors.ticketPaper,
    borderColor: colors.ticketBorder,
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: 500,
    width: "100%",
  },
  ticketRow: {
    alignItems: "stretch",
    borderColor: "transparent",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 48,
    position: "relative",
  },
  ticketRowSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  ticketRowDrop: {
    borderTopColor: colors.accent,
    borderTopWidth: 3,
  },
  ticketRowDisabled: {
    opacity: 0.54,
  },
  ticketRowDragging: {
    elevation: 8,
    opacity: 0.82,
    zIndex: 10,
  },
  dragHandle: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    width: 48,
  },
  ticketRowContent: {
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 0,
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
  },
  ticketRowPressed: {
    opacity: 0.68,
  },
  hiddenBadge: {
    alignItems: "center",
    alignSelf: "flex-end",
    flexDirection: "row",
    gap: space.xxs,
    marginTop: space.xxs,
  },
  hiddenText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  previewLogoLine: {
    width: "100%",
  },
  previewLogoImage: {
    height: 44,
    resizeMode: "contain",
    width: 44,
  },
  previewLogoMonogram: {
    alignItems: "center",
    backgroundColor: colors.ticketPaper,
    borderColor: colors.ticketRule,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  previewLogoMonogramText: {
    color: colors.ticketInk,
    fontFamily: fonts.display,
    fontSize: 18,
  },
  previewSeparator: {
    borderTopColor: colors.ticketRule,
    borderTopWidth: 1,
    width: "100%",
  },
  previewSeparatorDashed: {
    borderStyle: "dashed",
  },
  previewSeparatorDouble: {
    borderBottomColor: colors.ticketRule,
    borderBottomWidth: 1,
    height: 4,
  },
  previewItems: {
    gap: space.xs,
  },
  previewItemsTitle: {
    color: colors.ticketInk,
  },
  previewItemRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.xs,
    justifyContent: "space-between",
  },
  previewItemCopy: {
    flex: 1,
    minWidth: 0,
  },
  previewItemName: {
    color: colors.ticketInk,
  },
  previewItemTotal: {
    color: colors.ticketInk,
  },
  previewMuted: {
    color: colors.ticketMuted,
    fontFamily: fonts.body,
    fontSize: 9,
  },
  previewTotalRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "space-between",
  },
  emptyTicket: {
    alignItems: "center",
    flex: 1,
    gap: space.xs,
    justifyContent: "center",
    minHeight: 420,
    padding: space.lg,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    textAlign: "center",
  },
  emptyDescription: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  inspectorBody: {
    gap: space.md,
    padding: space.md,
  },
  inspectorEmpty: {
    alignItems: "center",
    gap: space.sm,
    minHeight: 260,
    padding: space.xl,
  },
  propertyGroup: {
    gap: space.xs,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  orderActions: {
    flexDirection: "row",
    gap: space.xs,
  },
  destructiveActions: {
    borderTopColor: colors.rule,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    paddingTop: space.md,
  },
  advancedOptions: {
    alignItems: "stretch",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
    padding: space.md,
  },
});
}
