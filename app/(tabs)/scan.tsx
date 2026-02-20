import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/colors';

export default function ScanScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan Receipt</Text>
      </View>

      <View style={styles.cameraPlaceholder}>
        <View style={styles.cameraFrame}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />

          <View style={styles.cameraContent}>
            <Text style={styles.cameraIcon}>&#128247;</Text>
            <Text style={styles.cameraText}>
              Camera preview will appear here
            </Text>
            <Text style={styles.cameraSubtext}>
              Point your camera at a receipt to scan it
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.captureButton,
            pressed && styles.captureButtonPressed,
          ]}
        >
          <View style={styles.captureButtonInner} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.galleryButton,
            pressed && styles.galleryButtonPressed,
          ]}
        >
          <Text style={styles.galleryButtonText}>Choose from gallery</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = Colors.accent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  cameraPlaceholder: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  cameraFrame: {
    aspectRatio: 3 / 4,
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  cameraContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  cameraIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cameraText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  cameraSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Corner decorations
  cornerTopLeft: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderTopLeftRadius: 4,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderTopRightRadius: 4,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderBottomLeftRadius: 4,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderBottomRightRadius: 4,
  },
  actions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 24,
    alignItems: 'center',
    gap: 16,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: Colors.textInverse,
  },
  galleryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  galleryButtonPressed: {
    opacity: 0.7,
  },
  galleryButtonText: {
    fontSize: 15,
    color: Colors.accent,
    fontWeight: '600',
  },
});
