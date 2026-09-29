import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChessPiece } from './chessPieces';
import { useTheme } from '../contexts/ThemeContext';
import { PLAYER_PIECE_OPTIONS, type PlayerPieceType } from '../lib/playerPiece';
import type { AppTheme } from '../theme';

const PIECE_NAMES: Record<PlayerPieceType, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

type PlayerPieceModalProps = {
  visible: boolean;
  selected: PlayerPieceType;
  onSelect: (piece: PlayerPieceType) => void;
  onClose: () => void;
};

export default function PlayerPieceModal({
  visible,
  selected,
  onSelect,
  onClose,
}: PlayerPieceModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createPlayerPieceModalStyles(theme), [theme]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Choose your piece</Text>
          <View style={styles.grid}>
            {PLAYER_PIECE_OPTIONS.map((piece) => {
              const isSelected = piece === selected;
              return (
                <Pressable
                  key={piece}
                  style={({ pressed }) => [
                    styles.option,
                    isSelected && styles.optionSelected,
                    pressed && styles.optionPressed,
                  ]}
                  onPress={() => onSelect(piece)}
                  accessibilityRole="button"
                  accessibilityLabel={PIECE_NAMES[piece]}
                  accessibilityState={{ selected: isSelected }}
                >
                  <ChessPiece color="w" type={piece} size={36} />
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {PIECE_NAMES[piece]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createPlayerPieceModalStyles(theme: AppTheme) {
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
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 10,
    },
    option: {
      width: 92,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      backgroundColor: theme.surfaceBackground,
      alignItems: 'center',
      gap: 6,
    },
    optionSelected: {
      borderColor: theme.accentBorderStrong,
      backgroundColor: theme.accentSurface,
    },
    optionPressed: {
      opacity: 0.85,
    },
    optionLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    optionLabelSelected: {
      color: theme.accentSoftText,
    },
    closeButton: {
      minHeight: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentSurface,
      borderWidth: 1,
      borderColor: theme.accentBorder,
    },
    closeButtonPressed: {
      backgroundColor: theme.accentSurfacePressed,
    },
    closeButtonText: {
      color: theme.accentText,
      fontSize: 15,
      fontWeight: '800',
    },
  });
}
