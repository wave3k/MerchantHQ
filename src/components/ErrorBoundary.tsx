import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import Icon from "./Icon";
import { TranslatedText as Text } from "./TranslatedText";
import { useThemedStyles, colors, fonts, radius, space } from "../theme";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Journalisation locale : aucune donnée sensible n'est envoyée.
    console.error(
      "MerchantHQ a rencontré une erreur de rendu",
      error,
      info.componentStack,
    );
  }

  private reset = () => {
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Icon color={colors.error} name="TriangleAlert" size={30} />
        </View>
        <Text style={styles.title}>Une erreur est survenue</Text>
        <Text style={styles.message}>
          L’application a rencontré un problème inattendu. Vos données locales
          restent intactes.
        </Text>
        {error.message ? (
          <Text
            accessibilityRole="text"
            numberOfLines={4}
            style={styles.detail}
          >
            {error.message}
          </Text>
        ) : null}
        <Pressable
          accessibilityLabel="Réessayer"
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Icon color={colors.accentInk} name="RefreshCw" size={18} />
          <Text style={styles.buttonLabel}>Réessayer</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    container: {
      alignItems: "center",
      backgroundColor: colors.paper,
      flex: 1,
      justifyContent: "center",
      padding: space.lg,
    },
    card: {
      alignItems: "center",
      backgroundColor: colors.surfaceStrong,
      borderColor: colors.rule,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: space.sm,
      maxWidth: 460,
      padding: space.xl,
      width: "100%",
    },
    iconWrap: {
      alignItems: "center",
      backgroundColor: colors.errorSoft,
      borderRadius: radius.round,
      height: 64,
      justifyContent: "center",
      marginBottom: space.xs,
      width: 64,
    },
    title: {
      color: colors.ink,
      fontFamily: fonts.displayMedium,
      fontSize: 22,
      textAlign: "center",
    },
    message: {
      color: colors.muted,
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
    },
    detail: {
      color: colors.ink2,
      fontFamily: fonts.mono,
      fontSize: 12,
      lineHeight: 17,
      textAlign: "center",
    },
    button: {
      alignItems: "center",
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: space.xs,
      marginTop: space.sm,
      minHeight: 48,
      paddingHorizontal: space.lg,
    },
    buttonPressed: {
      backgroundColor: colors.accentDark,
    },
    buttonLabel: {
      color: colors.accentInk,
      fontFamily: fonts.bodySemibold,
      fontSize: 15,
    },
  });
}
