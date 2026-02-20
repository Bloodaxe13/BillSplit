/**
 * Scan tab — camera capture for receipt photos.
 *
 * States: permission request -> camera live view -> photo preview
 *         -> upload progress -> success/error.
 *
 * Also supports picking from gallery via expo-image-picker.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../src/constants/colors';
import { uploadReceipt, subscribeToReceiptStatus } from '../../src/services/receipts';
import { enqueue, getPendingCount } from '../../src/services/offline-queue';
import { useAuth } from '../../src/contexts/AuthContext';

// ── Types ───────────────────────────────────────────────────

type ScreenState =
  | 'camera'
  | 'preview'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error';

// ── Screen ──────────────────────────────────────────────────

export default function ScanScreen() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [state, setState] = useState<ScreenState>('camera');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check queue count on mount
  useEffect(() => {
    getPendingCount().then(setQueueCount).catch(() => {});
  }, []);

  // ── Camera capture ──────────────────────────────────────

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
      });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        setState('preview');
      }
    } catch (err) {
      console.warn('Camera capture failed:', err);
    }
  }, []);

  // ── Gallery pick ────────────────────────────────────────

  const pickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setState('preview');
    }
  }, []);

  // ── Retake ──────────────────────────────────────────────

  const retake = useCallback(() => {
    setPhotoUri(null);
    setState('camera');
    setUploadProgress(0);
    setErrorMessage(null);
  }, []);

  // ── Upload ──────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (!photoUri) return;

    // TODO: In production, the user picks a group from a list.
    // For now, we need a group_id and paid_by. This will be wired up
    // when group selection is integrated.
    const groupId = 'PLACEHOLDER_GROUP_ID';
    const paidBy = 'PLACEHOLDER_MEMBER_ID';

    setState('uploading');
    setUploadProgress(0);

    try {
      const id = await uploadReceipt({
        localUri: photoUri,
        groupId,
        paidBy,
        onProgress: setUploadProgress,
      });

      setReceiptId(id);
      setState('processing');

      // Subscribe to processing status
      const unsubscribe = subscribeToReceiptStatus(id, (status) => {
        if (status === 'completed') {
          setState('success');
          unsubscribe();
        } else if (status === 'failed') {
          setState('error');
          setErrorMessage('Receipt processing failed. You can retry from the receipt detail screen.');
          unsubscribe();
        }
      });

      // Timeout fallback
      setTimeout(() => {
        unsubscribe();
      }, 60_000);
    } catch (err) {
      // If upload fails, try queueing offline
      try {
        await enqueue({
          localUri: photoUri,
          groupId,
          paidBy,
        });
        setQueueCount((c) => c + 1);
        Alert.alert(
          'Saved offline',
          'The receipt has been saved and will upload when you have a connection.',
          [{ text: 'OK', onPress: retake }],
        );
      } catch {
        setState('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Upload failed. Please try again.',
        );
      }
    }
  }, [photoUri, retake]);

  // ── Permission screen ───────────────────────────────────

  if (!permission) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionText}>
            BillSplit needs camera access to scan receipts.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.permissionButton,
              pressed && styles.permissionButtonPressed,
            ]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Allow camera</Text>
          </Pressable>
          <Pressable
            style={styles.galleryFallbackButton}
            onPress={pickFromGallery}
          >
            <Text style={styles.galleryFallbackText}>
              Or choose from gallery
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Preview state ───────────────────────────────────────

  if (state === 'preview' && photoUri) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Review photo</Text>
        </View>

        <View style={styles.previewContainer}>
          <Image
            source={{ uri: photoUri }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.previewActions}>
          <Pressable
            style={({ pressed }) => [
              styles.retakeButton,
              pressed && styles.retakeButtonPressed,
            ]}
            onPress={retake}
          >
            <Ionicons name="refresh-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.retakeText}>Retake</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.usePhotoButton,
              pressed && styles.usePhotoButtonPressed,
            ]}
            onPress={handleUpload}
          >
            <Ionicons name="checkmark" size={20} color={Colors.textInverse} />
            <Text style={styles.usePhotoText}>Use photo</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Uploading state ─────────────────────────────────────

  if (state === 'uploading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <View style={styles.progressRing}>
            <ActivityIndicator color={Colors.accent} size="large" />
          </View>
          <Text style={styles.uploadingTitle}>Uploading receipt</Text>
          <Text style={styles.uploadingSubtext}>
            {Math.round(uploadProgress * 100)}%
          </Text>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${uploadProgress * 100}%` },
              ]}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Processing state ────────────────────────────────────

  if (state === 'processing') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <View style={styles.progressRing}>
            <ActivityIndicator color={Colors.info} size="large" />
          </View>
          <Text style={styles.uploadingTitle}>Scanning receipt</Text>
          <Text style={styles.processingSubtext}>
            Running OCR and extracting line items...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Success state ───────────────────────────────────────

  if (state === 'success' && receiptId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={72} color={Colors.positive} />
          </View>
          <Text style={styles.successTitle}>Receipt scanned</Text>
          <Text style={styles.successSubtext}>
            Review the extracted data and confirm the total.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.viewReceiptButton,
              pressed && styles.viewReceiptButtonPressed,
            ]}
            onPress={() => {
              router.push(`/receipt/${receiptId}`);
              retake();
            }}
          >
            <Text style={styles.viewReceiptText}>View receipt</Text>
          </Pressable>

          <Pressable style={styles.scanAnotherButton} onPress={retake}>
            <Text style={styles.scanAnotherText}>Scan another</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ─────────────────────────────────────────

  if (state === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle" size={72} color={Colors.negative} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorSubtext}>
            {errorMessage ?? 'An unexpected error occurred.'}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={retake}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>

          {receiptId && (
            <Pressable
              style={styles.scanAnotherButton}
              onPress={() => {
                router.push(`/receipt/${receiptId}`);
                retake();
              }}
            >
              <Text style={styles.scanAnotherText}>View receipt</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Camera state (default) ──────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan Receipt</Text>
        {queueCount > 0 && (
          <View style={styles.queueBadge}>
            <Ionicons name="cloud-upload-outline" size={14} color={Colors.warning} />
            <Text style={styles.queueBadgeText}>{queueCount} pending</Text>
          </View>
        )}
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        >
          {/* Corner frame overlay */}
          <View style={styles.frameOverlay}>
            <View style={styles.cornerTopLeft} />
            <View style={styles.cornerTopRight} />
            <View style={styles.cornerBottomLeft} />
            <View style={styles.cornerBottomRight} />
          </View>

          <View style={styles.cameraHint}>
            <Text style={styles.cameraHintText}>
              Position the receipt within the frame
            </Text>
          </View>
        </CameraView>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.galleryButton,
            pressed && styles.galleryButtonPressed,
          ]}
          onPress={pickFromGallery}
        >
          <Ionicons name="images-outline" size={24} color={Colors.textPrimary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.captureButton,
            pressed && styles.captureButtonPressed,
          ]}
          onPress={takePhoto}
        >
          <View style={styles.captureButtonInner} />
        </Pressable>

        {/* Spacer to balance the layout */}
        <View style={styles.actionSpacer} />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = Colors.accent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

  // ── Queue badge ────────────────────────────────────────
  queueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  queueBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning,
  },

  // ── Camera ─────────────────────────────────────────────
  cameraContainer: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    margin: 24,
  },
  cameraHint: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cameraHintText: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },

  // ── Corner decorations ─────────────────────────────────
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderTopLeftRadius: 6,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderTopRightRadius: 6,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderBottomLeftRadius: 6,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderBottomRightRadius: 6,
  },

  // ── Actions bar ────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 20,
    paddingTop: 24,
    gap: 40,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  galleryButtonPressed: {
    backgroundColor: Colors.surfaceTertiary,
  },
  actionSpacer: {
    width: 48,
  },

  // ── Preview ────────────────────────────────────────────
  previewContainer: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.surfacePrimary,
  },
  previewImage: {
    flex: 1,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 24,
    gap: 16,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retakeButtonPressed: {
    backgroundColor: Colors.surfaceTertiary,
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  usePhotoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
  },
  usePhotoButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  usePhotoText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
  },

  // ── Upload progress ────────────────────────────────────
  progressRing: {
    marginBottom: 24,
  },
  uploadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  uploadingSubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
    marginBottom: 24,
  },
  processingSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.surfaceTertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },

  // ── Permission ─────────────────────────────────────────
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  permissionButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  permissionButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  galleryFallbackButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  galleryFallbackText: {
    fontSize: 15,
    color: Colors.accent,
    fontWeight: '600',
  },

  // ── Success ────────────────────────────────────────────
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  viewReceiptButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  viewReceiptButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  viewReceiptText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  scanAnotherButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  scanAnotherText: {
    fontSize: 15,
    color: Colors.accent,
    fontWeight: '600',
  },

  // ── Error ──────────────────────────────────────────────
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
  },
});
