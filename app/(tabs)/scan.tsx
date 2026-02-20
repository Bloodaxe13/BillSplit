/**
 * Scan tab -- camera capture for receipt photos.
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
  ScrollView,
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
import { fetchMyGroups, fetchMyMembership } from '../../src/services/groups';
import type { GroupPreview, GroupMember } from '../../src/types/database';

// -- Types -------------------------------------------------------------------

type ScreenState =
  | 'camera'
  | 'preview'
  | 'select-group'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error';

// -- Screen ------------------------------------------------------------------

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

  // Group selection state
  const [groups, setGroups] = useState<GroupPreview[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [membership, setMembership] = useState<GroupMember | null>(null);

  // Fetch user's groups on mount
  useEffect(() => {
    let mounted = true;
    async function loadGroups() {
      try {
        const myGroups = await fetchMyGroups();
        if (!mounted) return;
        setGroups(myGroups);
        // Auto-select if the user has exactly one group
        if (myGroups.length === 1) {
          setSelectedGroupId(myGroups[0].id);
        }
      } catch (err) {
        console.error('ScanScreen: Failed to load groups:', err);
      } finally {
        if (mounted) setGroupsLoading(false);
      }
    }
    loadGroups();
    return () => { mounted = false; };
  }, []);

  // Fetch membership when a group is selected
  useEffect(() => {
    if (!selectedGroupId) {
      setMembership(null);
      return;
    }
    let mounted = true;
    async function loadMembership() {
      try {
        const member = await fetchMyMembership(selectedGroupId!);
        if (mounted) setMembership(member);
      } catch (err) {
        console.error('ScanScreen: Failed to load membership:', err);
        if (mounted) setMembership(null);
      }
    }
    loadMembership();
    return () => { mounted = false; };
  }, [selectedGroupId]);

  useEffect(() => {
    getPendingCount().then(setQueueCount).catch((err) => {
      console.error('ScanScreen: Failed to get pending queue count:', err);
    });
  }, []);

  // -- Camera capture --------------------------------------------------------

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

  // -- Gallery pick ----------------------------------------------------------

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

  // -- Retake ----------------------------------------------------------------

  const retake = useCallback(() => {
    setPhotoUri(null);
    setState('camera');
    setUploadProgress(0);
    setErrorMessage(null);
  }, []);

  // -- Upload ----------------------------------------------------------------

  const startUpload = useCallback(async () => {
    if (!photoUri || !selectedGroupId || !membership) return;

    const groupId = selectedGroupId;
    const paidBy = membership.id;

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

      setTimeout(() => {
        unsubscribe();
      }, 60_000);
    } catch (err) {
      console.error('ScanScreen: Receipt upload failed:', err);
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
      } catch (enqueueErr) {
        console.error('ScanScreen: Failed to enqueue receipt for offline upload:', enqueueErr);
        setState('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Upload failed. Please try again.',
        );
      }
    }
  }, [photoUri, selectedGroupId, membership, retake]);

  // -- Proceed to upload (with group selection if needed) -------------------

  const handleUsePhoto = useCallback(() => {
    if (!photoUri) return;
    if (groupsLoading) return;
    if (groups.length === 0) {
      Alert.alert(
        'No groups',
        'You need to join or create a group before scanning a receipt.',
      );
      return;
    }
    // Auto-select single group and membership ready -- skip picker
    if (groups.length === 1 && selectedGroupId && membership) {
      startUpload();
      return;
    }
    // Multiple groups or membership still loading -- show selection screen
    setState('select-group');
  }, [photoUri, groups, groupsLoading, selectedGroupId, membership, startUpload]);

  // -- Permission screen -----------------------------------------------------

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
          <View style={styles.permissionIconContainer}>
            <Ionicons name="camera-outline" size={48} color={Colors.accent} />
          </View>
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
            <Ionicons name="camera" size={18} color={Colors.textInverse} />
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

  // -- Preview state ---------------------------------------------------------

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
              groupsLoading && styles.buttonDisabled,
              pressed && !groupsLoading && styles.usePhotoButtonPressed,
            ]}
            onPress={handleUsePhoto}
            disabled={groupsLoading}
          >
            {groupsLoading ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={Colors.textInverse} />
                <Text style={styles.usePhotoText}>Use Photo</Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // -- Group selection state -------------------------------------------------

  if (state === 'select-group') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors.textPrimary }]}>Select group</Text>
        </View>

        <ScrollView
          style={styles.groupList}
          contentContainerStyle={styles.groupListContent}
        >
          {groups.map((group) => {
            const isSelected = selectedGroupId === group.id;
            return (
              <Pressable
                key={group.id}
                style={({ pressed }) => [
                  styles.groupItem,
                  isSelected && styles.groupItemSelected,
                  pressed && styles.groupItemPressed,
                ]}
                onPress={() => setSelectedGroupId(group.id)}
              >
                <View style={styles.groupItemInfo}>
                  <Text style={[
                    styles.groupItemName,
                    isSelected && styles.groupItemNameSelected,
                  ]}>
                    {group.name}
                  </Text>
                  <Text style={styles.groupItemMeta}>
                    {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                    {' · '}
                    {group.default_currency}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.previewActions}>
          <Pressable
            style={({ pressed }) => [
              styles.retakeButton,
              pressed && styles.retakeButtonPressed,
            ]}
            onPress={() => setState('preview')}
          >
            <Ionicons name="arrow-back-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.retakeText}>Back</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.usePhotoButton,
              (!selectedGroupId || !membership) && styles.buttonDisabled,
              pressed && selectedGroupId && membership ? styles.usePhotoButtonPressed : undefined,
            ]}
            onPress={startUpload}
            disabled={!selectedGroupId || !membership}
          >
            {!membership && selectedGroupId ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color={Colors.textInverse} />
                <Text style={styles.usePhotoText}>Upload</Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // -- Uploading state -------------------------------------------------------

  if (state === 'uploading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <View style={styles.progressIconContainer}>
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

  // -- Processing state ------------------------------------------------------

  if (state === 'processing') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <View style={styles.progressIconContainer}>
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

  // -- Success state ---------------------------------------------------------

  if (state === 'success' && receiptId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.positive} />
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
            <Ionicons name="receipt-outline" size={18} color={Colors.textInverse} />
            <Text style={styles.viewReceiptText}>View receipt</Text>
          </Pressable>

          <Pressable style={styles.scanAnotherButton} onPress={retake}>
            <Text style={styles.scanAnotherText}>Scan another</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // -- Error state -----------------------------------------------------------

  if (state === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle" size={64} color={Colors.negative} />
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

  // -- Camera state (default) ------------------------------------------------

  return (
    <SafeAreaView style={styles.cameraScreen} edges={['top']}>
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
          {/* Green corner brackets */}
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

// -- Styles ------------------------------------------------------------------

const CORNER_SIZE = 32;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: Colors.black,
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
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textInverse,
    letterSpacing: -0.5,
  },

  // -- Queue badge -----------------------------------------------------------
  queueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  queueBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning,
  },

  // -- Camera ----------------------------------------------------------------
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
    margin: 28,
  },
  cameraHint: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cameraHintText: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: '500',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },

  // -- Corner brackets (green) -----------------------------------------------
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: Colors.accent,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: Colors.accent,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: Colors.accent,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: Colors.accent,
    borderBottomRightRadius: 8,
  },

  // -- Actions bar -----------------------------------------------------------
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 24,
    paddingTop: 24,
    gap: 40,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    // Outer glow effect
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  captureButtonPressed: {
    backgroundColor: Colors.accentMuted,
    shadowOpacity: 0.2,
  },
  captureButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    borderColor: Colors.textInverse,
  },
  galleryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  actionSpacer: {
    width: 48,
  },

  // -- Preview ---------------------------------------------------------------
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
    paddingBottom: 24,
    paddingTop: 24,
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  retakeButtonPressed: {
    backgroundColor: Colors.surfacePrimary,
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

  // -- Upload progress -------------------------------------------------------
  progressIconContainer: {
    marginBottom: 24,
  },
  uploadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  uploadingSubtext: {
    fontSize: 18,
    color: Colors.accent,
    fontWeight: '700',
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

  // -- Permission ------------------------------------------------------------
  permissionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
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

  // -- Success ---------------------------------------------------------------
  successIconContainer: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
    width: '100%',
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

  // -- Error -----------------------------------------------------------------
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
    paddingVertical: 16,
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

  // -- Group selection -------------------------------------------------------
  groupList: {
    flex: 1,
  },
  groupListContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfacePrimary,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  groupItemSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSurface,
  },
  groupItemPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  groupItemInfo: {
    flex: 1,
    gap: 4,
  },
  groupItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  groupItemNameSelected: {
    color: Colors.accentMuted,
  },
  groupItemMeta: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
