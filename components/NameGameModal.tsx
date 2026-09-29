import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { MAX_SAVED_GAME_NAME_LENGTH } from '../lib/savedGameName';
import type { AppTheme } from '../theme';

type NameGameModalProps = {
  visible: boolean;
  defaultName: string;
  onCancel: () => void;
  onSave: (name: string) => void;
  title?: string;
  placeholder?: string;
  saveLabel?: string;
  saveAccessibilityLabel?: string;
  inputAccessibilityLabel?: string;
  maxLength?: number;
  /** Applied to the raw TextInput value before it's stored in local state (e.g. word-count caps). */
  sanitizeInput?: (text: string) => string;
};

export default function NameGameModal({
  visible,
  defaultName,
  onCancel,
  onSave,
  title = 'Name your game',
  placeholder = 'Game name',
  saveLabel = 'Save',
  saveAccessibilityLabel = 'Save game',
  inputAccessibilityLabel = 'Game name',
  maxLength = MAX_SAVED_GAME_NAME_LENGTH,
  sanitizeInput,
}: NameGameModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createNameGameModalStyles(theme), [theme]);
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (visible) {
      setName(defaultName);
    }
  }, [defaultName, visible]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            value={name}
            onChangeText={(text) => setName(sanitizeInput ? sanitizeInput(text) : text)}
            placeholder={placeholder}
            placeholderTextColor={theme.textFaint}
            style={styles.input}
            maxLength={maxLength}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={() => {
              if (canSave) {
                onSave(trimmed);
              }
            }}
            accessibilityLabel={inputAccessibilityLabel}
          />
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                !canSave && styles.primaryButtonDisabled,
                pressed && canSave && styles.primaryButtonPressed,
              ]}
              onPress={() => {
                if (canSave) {
                  onSave(trimmed);
                }
              }}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel={saveAccessibilityLabel}
            >
              <Text style={styles.primaryButtonText}>{saveLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createNameGameModalStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.modalBackdrop,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.modalBorder,
      backgroundColor: theme.modalCard,
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 18,
      gap: 16,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      textAlign: 'center',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      backgroundColor: theme.surfaceBackground,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
    },
    primaryButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentSurface,
      borderWidth: 1,
      borderColor: theme.accentBorder,
    },
    primaryButtonPressed: {
      backgroundColor: theme.accentSurfacePressed,
    },
    primaryButtonDisabled: {
      opacity: 0.45,
    },
    primaryButtonText: {
      color: theme.accentText,
      fontSize: 15,
      fontWeight: '800',
    },
    secondaryButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceBackground,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
    },
    secondaryButtonPressed: {
      backgroundColor: theme.surfaceBackgroundPressed,
    },
    secondaryButtonText: {
      color: theme.textSecondary,
      fontSize: 15,
      fontWeight: '700',
    },
  });
}
