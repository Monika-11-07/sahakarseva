import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { workersApi } from '../../services/api';

export default function KycSection({ user, onProfileUpdated }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workerProfile, setWorkerProfile] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Worker registration form state
  const [skill, setSkill] = useState('');
  const [experience, setExperience] = useState('');
  const [cooperativeName, setCooperativeName] = useState('');
  const [district, setDistrict] = useState('');
  const [stateName, setStateName] = useState('');
  const [bio, setBio] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Document state
  const [aadhaarDoc, setAadhaarDoc] = useState(null);
  const [certDoc, setCertDoc] = useState(null);
  const [profileImg, setProfileImg] = useState(null);

  const fetchWorkerData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await workersApi.getWorkerMe();
      if (res.data) {
        setWorkerProfile(res.data);
        setSkill(res.data.skill || '');
        setExperience(res.data.experience ? String(res.data.experience) : '');
        setCooperativeName(res.data.cooperative_name || '');
        setDistrict(res.data.district || '');
        setStateName(res.data.state || '');
        setBio(res.data.bio || '');
      }
    } catch (err) {
      if (err.message.includes('404') || err.message.toLowerCase().includes('not found')) {
        setWorkerProfile(null);
      } else {
        setErrorMsg(err.message || 'Could not load worker profile');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkerData();
  }, [fetchWorkerData]);

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        Alert.alert('Permission Denied', 'Location permission is required to detect your location.');
        setDetectingLocation(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = currentLocation.coords;
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);

      try {
        const places = await Location.reverseGeocodeAsync(coords);
        const place = places[0];
        if (place) {
          if (place.district || place.subregion || place.city) {
            setDistrict(place.district || place.subregion || place.city || '');
          }
          if (place.region) {
            setStateName(place.region || '');
          }
        }
        Alert.alert('Location Detected', `GPS location attached (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`);
      } catch (_e) {
        Alert.alert('GPS Location Set', `Coordinates saved (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`);
      }
    } catch (_err) {
      Alert.alert('Error', 'Unable to detect GPS location. You can enter District & State manually.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleRegisterProfile = async () => {
    if (!skill.trim()) {
      Alert.alert('Required', 'Please enter your primary skill or trade.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await workersApi.registerProfile({
        skill: skill.trim(),
        experience: Number(experience) || 0,
        cooperative_name: cooperativeName.trim(),
        district: district.trim(),
        state: stateName.trim(),
        bio: bio.trim(),
        latitude,
        longitude,
      });
      setWorkerProfile(res.data);
      Alert.alert('Success', 'Worker profile saved! Now please upload your KYC documents.');
      if (onProfileUpdated) onProfileUpdated();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save worker profile');
      Alert.alert('Error', err.message || 'Profile save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const pickImageOrDocument = async (type) => {
    try {
      Alert.alert(
        'Upload File',
        `Select source for ${type}`,
        [
          {
            text: 'Camera / Photo Library',
            onPress: async () => {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) {
                Alert.alert('Permission needed', 'Photo library access is required');
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
              });
              if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                const fileObj = {
                  uri: asset.uri,
                  name: asset.fileName || `${type}_${Date.now()}.jpg`,
                  mimeType: asset.mimeType || 'image/jpeg',
                };
                if (type === 'aadhaar') setAadhaarDoc(fileObj);
                if (type === 'certificate') setCertDoc(fileObj);
                if (type === 'profileImage') setProfileImg(fileObj);
              }
            },
          },
          {
            text: 'Document File (PDF / Image)',
            onPress: async () => {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf'],
                copyToCacheDirectory: true,
              });
              if (!result.canceled && result.assets && result.assets.length > 0) {
                const doc = result.assets[0];
                const fileObj = {
                  uri: doc.uri,
                  name: doc.name || `${type}_file`,
                  mimeType: doc.mimeType || 'application/octet-stream',
                };
                if (type === 'aadhaar') setAadhaarDoc(fileObj);
                if (type === 'certificate') setCertDoc(fileObj);
                if (type === 'profileImage') setProfileImg(fileObj);
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (err) {
      console.error('File pick error:', err);
    }
  };

  const handleUploadKYC = async () => {
    if (!aadhaarDoc && !certDoc && !profileImg) {
      Alert.alert('Selection Required', 'Please select at least one document (Aadhaar or Certificate) to upload.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await workersApi.uploadKYC(aadhaarDoc, certDoc, profileImg);
      setWorkerProfile(res.data);
      setAadhaarDoc(null);
      setCertDoc(null);
      setProfileImg(null);
      Alert.alert('KYC Uploaded', 'Your documents have been submitted to SahakarSeva Admin for verification.');
      if (onProfileUpdated) onProfileUpdated();
    } catch (err) {
      setErrorMsg(err.message || 'KYC Upload failed');
      Alert.alert('Upload Error', err.message || 'KYC Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading KYC Profile...</Text>
      </View>
    );
  }

  const status = workerProfile?.verification_status?.toUpperCase() || 'UNREGISTERED';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Badge */}
      <View style={styles.cardHeader}>
        <Ionicons name="shield-checkmark" size={28} color="#16a34a" />
        <Text style={styles.cardTitle}>Worker Console & KYC</Text>
      </View>

      {/* Prominent Live GPS Location Card */}
      <View style={styles.gpsBannerCard}>
        <View style={styles.gpsBannerHeader}>
          <Ionicons name="location" size={24} color="#0284c7" />
          <View style={styles.gpsBannerInfo}>
            <Text style={styles.gpsBannerTitle}>Worker Active Location</Text>
            <Text style={styles.gpsBannerCoords}>
              {latitude && longitude
                ? `GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (${district || 'Local'}, ${stateName || 'State'})`
                : 'GPS location not set yet'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.gpsBannerBtn}
          onPress={handleDetectLocation}
          disabled={detectingLocation}
        >
          {detectingLocation ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="navigate-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.gpsBannerBtnText}>Use Current GPS Location</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Status Banner */}
      <View
        style={[
          styles.statusBanner,
          status === 'VERIFIED'
            ? styles.statusVerified
            : status === 'REJECTED'
            ? styles.statusRejected
            : status === 'PENDING'
            ? styles.statusPending
            : styles.statusUnregistered,
        ]}
      >
        <Ionicons
          name={
            status === 'VERIFIED'
              ? 'checkmark-circle'
              : status === 'REJECTED'
              ? 'close-circle'
              : status === 'PENDING'
              ? 'time'
              : 'alert-circle'
          }
          size={22}
          color={
            status === 'VERIFIED'
              ? '#15803d'
              : status === 'REJECTED'
              ? '#b91c1c'
              : status === 'PENDING'
              ? '#b45309'
              : '#4b5563'
          }
        />
        <View style={styles.statusTextContainer}>
          <Text style={styles.statusLabel}>Verification Status</Text>
          <Text
            style={[
              styles.statusValue,
              {
                color:
                  status === 'VERIFIED'
                    ? '#15803d'
                    : status === 'REJECTED'
                    ? '#b91c1c'
                    : status === 'PENDING'
                    ? '#b45309'
                    : '#4b5563',
              },
            ]}
          >
            {status}
          </Text>
        </View>
      </View>

      {/* Rejection Reason Notice */}
      {status === 'REJECTED' && workerProfile?.rejection_reason ? (
        <View style={styles.rejectionBox}>
          <Text style={styles.rejectionTitle}>Reason for Rejection:</Text>
          <Text style={styles.rejectionText}>{workerProfile.rejection_reason}</Text>
          <Text style={styles.rejectionInstruction}>
            Please update your documents below and re-submit for review.
          </Text>
        </View>
      ) : null}

      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {/* Form 1: Register / Update Profile */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>1. Profile & Trade Information</Text>

        <Text style={styles.label}>Primary Skill / Trade *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Electrician, Plumber, Carpenter"
          value={skill}
          onChangeText={setSkill}
        />

        <Text style={styles.label}>Years of Experience</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 5"
          keyboardType="numeric"
          value={experience}
          onChangeText={setExperience}
        />

        <Text style={styles.label}>Co-operative Society Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Rural Electricians Sahakari Society"
          value={cooperativeName}
          onChangeText={setCooperativeName}
        />

        <View style={styles.locationButtonRow}>
          <Text style={styles.label}>Work Location</Text>
          <TouchableOpacity
            style={styles.gpsDetectBtn}
            onPress={handleDetectLocation}
            disabled={detectingLocation}
          >
            {detectingLocation ? (
              <ActivityIndicator size="small" color="#0284c7" />
            ) : (
              <>
                <Ionicons name="location-outline" size={16} color="#0284c7" style={{ marginRight: 4 }} />
                <Text style={styles.gpsDetectText}>Use Current GPS Location</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={styles.halfCol}>
            <Text style={styles.label}>District</Text>
            <TextInput
              style={styles.input}
              placeholder="District"
              value={district}
              onChangeText={setDistrict}
            />
          </View>
          <View style={styles.halfCol}>
            <Text style={styles.label}>State</Text>
            <TextInput
              style={styles.input}
              placeholder="State"
              value={stateName}
              onChangeText={setStateName}
            />
          </View>
        </View>

        <Text style={styles.label}>Bio / Work Summary</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Brief description of services provided..."
          multiline
          numberOfLines={3}
          value={bio}
          onChangeText={setBio}
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleRegisterProfile}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {workerProfile ? 'Update Worker Profile' : 'Register Worker Profile'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Form 2: KYC Document Upload */}
      {workerProfile ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2. Upload KYC Documents</Text>
          <Text style={styles.sectionSubtitle}>
            Upload clear copies of your Aadhaar Card and Trade Certificate for Admin approval.
          </Text>

          {/* Aadhaar Card Picker */}
          <View style={styles.docPickerCard}>
            <View style={styles.docInfo}>
              <Ionicons name="card-outline" size={24} color="#0284c7" />
              <View style={styles.docDetails}>
                <Text style={styles.docName}>Aadhaar Card *</Text>
                <Text style={styles.docStatus}>
                  {aadhaarDoc
                    ? `Selected: ${aadhaarDoc.name}`
                    : workerProfile.aadhaar_url
                    ? 'Uploaded on file'
                    : 'Not uploaded'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.selectBtn} onPress={() => pickImageOrDocument('aadhaar')}>
              <Text style={styles.selectBtnText}>{aadhaarDoc ? 'Change' : 'Select'}</Text>
            </TouchableOpacity>
          </View>
          {workerProfile.aadhaar_url ? (
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Current Aadhaar document:</Text>
              <Image source={{ uri: workerProfile.aadhaar_url }} style={styles.previewImage} />
            </View>
          ) : null}

          {/* Skill Certificate Picker */}
          <View style={styles.docPickerCard}>
            <View style={styles.docInfo}>
              <Ionicons name="ribbon-outline" size={24} color="#d97706" />
              <View style={styles.docDetails}>
                <Text style={styles.docName}>Skill / Trade Certificate</Text>
                <Text style={styles.docStatus}>
                  {certDoc
                    ? `Selected: ${certDoc.name}`
                    : workerProfile.certificate_url
                    ? 'Uploaded on file'
                    : 'Not uploaded'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.selectBtn} onPress={() => pickImageOrDocument('certificate')}>
              <Text style={styles.selectBtnText}>{certDoc ? 'Change' : 'Select'}</Text>
            </TouchableOpacity>
          </View>
          {workerProfile.certificate_url ? (
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Current Certificate document:</Text>
              <Image source={{ uri: workerProfile.certificate_url }} style={styles.previewImage} />
            </View>
          ) : null}

          {/* Upload Action Button */}
          <TouchableOpacity
            style={[styles.uploadButton, (!aadhaarDoc && !certDoc && !profileImg) && styles.buttonDisabled]}
            onPress={handleUploadKYC}
            disabled={submitting || (!aadhaarDoc && !certDoc && !profileImg)}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.uploadButtonText}>Submit KYC Documents for Verification</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 8,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusVerified: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
  },
  statusRejected: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
  },
  statusPending: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde047',
    borderWidth: 1,
  },
  statusUnregistered: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
  },
  statusTextContainer: {
    marginLeft: 12,
  },
  statusLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  rejectionBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#f87171',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  rejectionTitle: {
    color: '#991b1b',
    fontWeight: '700',
    fontSize: 13,
  },
  rejectionText: {
    color: '#b91c1c',
    fontSize: 14,
    marginVertical: 4,
  },
  rejectionInstruction: {
    color: '#7f1d1d',
    fontSize: 12,
    fontStyle: 'italic',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfCol: {
    width: '48%',
  },
  primaryButton: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  docPickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  docDetails: {
    marginLeft: 10,
    flex: 1,
  },
  docName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  docStatus: {
    fontSize: 12,
    color: '#64748b',
  },
  selectBtn: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  selectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  previewContainer: {
    marginTop: 6,
    marginBottom: 10,
    paddingLeft: 8,
  },
  previewLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  previewImage: {
    width: 120,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  uploadButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  locationButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  gpsDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  gpsDetectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
  },
  gpsBannerCard: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  gpsBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  gpsBannerInfo: {
    marginLeft: 10,
    flex: 1,
  },
  gpsBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0369a1',
  },
  gpsBannerCoords: {
    fontSize: 12,
    color: '#0284c7',
    marginTop: 2,
  },
  gpsBannerBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsBannerBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
