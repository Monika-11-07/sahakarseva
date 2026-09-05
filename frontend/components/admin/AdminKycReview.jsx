import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { adminApi } from '../../services/api';

export default function AdminKycReview() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState({
    total_workers: 0,
    verified_workers: 0,
    pending_workers: 0,
    rejected_workers: 0,
  });
  const [workers, setWorkers] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'all'

  // Rejection modal state
  const [selectedWorkerForReject, setSelectedWorkerForReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, workersRes] = await Promise.all([
        adminApi.getDashboard().catch(() => ({ dashboard: {} })),
        activeTab === 'pending'
          ? adminApi.getPendingWorkers().catch(() => ({ workers: [] }))
          : adminApi.getAllWorkers().catch(() => ({ workers: [] })),
      ]);

      if (dashRes.dashboard || dashRes.data) {
        setDashboard(dashRes.dashboard || dashRes.data);
      }
      const list = workersRes.workers || workersRes.data?.workers || [];
      setWorkers(list);
    } catch (err) {
      console.error('Admin data load error:', err);
      Alert.alert('Error', err.message || 'Failed to load admin verification list');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleApproveWorker = async (worker) => {
    Alert.alert(
      'Approve Worker',
      `Are you sure you want to verify KYC for ${worker.full_name || 'this worker'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Verify',
          onPress: async () => {
            setActionLoading(true);
            try {
              await adminApi.verifyWorker(worker.worker_id || worker.id);
              Alert.alert('Verified', `${worker.full_name} has been verified successfully.`);
              loadAdminData();
            } catch (err) {
              Alert.alert('Error', err.message || 'Approval failed');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Required', 'Please enter a reason for rejecting this worker KYC.');
      return;
    }
    setActionLoading(true);
    try {
      await adminApi.rejectWorker(
        selectedWorkerForReject.worker_id || selectedWorkerForReject.id,
        rejectionReason.trim()
      );
      Alert.alert('Rejected', 'Worker KYC application was rejected.');
      setSelectedWorkerForReject(null);
      setRejectionReason('');
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="shield-checkmark-sharp" size={28} color="#0284c7" />
        <Text style={styles.headerTitle}>Co-operative Admin Dashboard</Text>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { backgroundColor: '#eff6ff' }]}>
          <Text style={[styles.metricNum, { color: '#2563eb' }]}>{dashboard.pending_workers || 0}</Text>
          <Text style={styles.metricLabel}>Pending KYC</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: '#f0fdf4' }]}>
          <Text style={[styles.metricNum, { color: '#16a34a' }]}>{dashboard.verified_workers || 0}</Text>
          <Text style={styles.metricLabel}>Verified</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: '#fef2f2' }]}>
          <Text style={[styles.metricNum, { color: '#dc2626' }]}>{dashboard.rejected_workers || 0}</Text>
          <Text style={styles.metricLabel}>Rejected</Text>
        </View>
      </View>

      {/* Tab Selectors */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pending Review ({dashboard.pending_workers || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            All Workers ({dashboard.total_workers || workers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Workers List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Loading KYC applications...</Text>
        </View>
      ) : workers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No Pending KYC Applications</Text>
          <Text style={styles.emptySubtitle}>All registered worker applications have been processed.</Text>
        </View>
      ) : (
        workers.map((item) => (
          <View key={item.id || item.worker_id} style={styles.workerCard}>
            {/* Card Top Header */}
            <View style={styles.cardHeader}>
              <View style={styles.userMeta}>
                <Text style={styles.userName}>{item.full_name || 'Worker Profile'}</Text>
                <Text style={styles.userPhone}>{item.phone || item.email || 'No contact info'}</Text>
              </View>
              <View
                style={[
                  styles.badge,
                  item.verification_status?.toUpperCase() === 'VERIFIED'
                    ? styles.badgeVerified
                    : item.verification_status?.toUpperCase() === 'REJECTED'
                    ? styles.badgeRejected
                    : styles.badgePending,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    item.verification_status?.toUpperCase() === 'VERIFIED'
                      ? styles.badgeTextVerified
                      : item.verification_status?.toUpperCase() === 'REJECTED'
                      ? styles.badgeTextRejected
                      : styles.badgeTextPending,
                  ]}
                >
                  {item.verification_status || 'PENDING'}
                </Text>
              </View>
            </View>

            {/* Details Grid */}
            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Trade/Skill:</Text>
                <Text style={styles.detailValue}>{item.skill || 'Unspecified'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Experience:</Text>
                <Text style={styles.detailValue}>{item.experience ? `${item.experience} Years` : 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Co-operative:</Text>
                <Text style={styles.detailValue}>{item.cooperative_name || 'Independent'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>District/State:</Text>
                <Text style={styles.detailValue}>
                  {[item.district, item.state].filter(Boolean).join(', ') || 'N/A'}
                </Text>
              </View>
            </View>

            {/* Document Previews */}
            <Text style={styles.docsHeader}>Uploaded KYC Documents:</Text>
            <View style={styles.docsRow}>
              <View style={styles.docItem}>
                <Text style={styles.docLabel}>Aadhaar Card</Text>
                {item.aadhaar_url ? (
                  <Image source={{ uri: item.aadhaar_url }} style={styles.docThumb} />
                ) : (
                  <View style={styles.noDocBox}>
                    <Text style={styles.noDocText}>Missing</Text>
                  </View>
                )}
              </View>
              <View style={styles.docItem}>
                <Text style={styles.docLabel}>Trade Certificate</Text>
                {item.certificate_url ? (
                  <Image source={{ uri: item.certificate_url }} style={styles.docThumb} />
                ) : (
                  <View style={styles.noDocBox}>
                    <Text style={styles.noDocText}>Missing</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Action Buttons for Pending / Rejected Profiles */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleApproveWorker(item)}
                disabled={actionLoading}
              >
                <Ionicons name="checkmark-sharp" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Approve & Verify</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => setSelectedWorkerForReject(item)}
                disabled={actionLoading}
              >
                <Ionicons name="close-sharp" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Modal for Rejection Reason */}
      <Modal visible={Boolean(selectedWorkerForReject)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject KYC Application</Text>
            <Text style={styles.modalSubtitle}>
              Please state why the application for {selectedWorkerForReject?.full_name} is being rejected:
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Aadhaar image blurry, invalid trade certificate..."
              multiline
              numberOfLines={3}
              value={rejectionReason}
              onChangeText={setRejectionReason}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setSelectedWorkerForReject(null);
                  setRejectionReason('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmReject}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm Rejection</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    width: '31%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricNum: {
    fontSize: 22,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0f172a',
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  workerCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    marginBottom: 10,
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  userPhone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeVerified: { backgroundColor: '#dcfce7' },
  badgeRejected: { backgroundColor: '#fee2e2' },
  badgePending: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextVerified: { color: '#16a34a' },
  badgeTextRejected: { color: '#dc2626' },
  badgeTextPending: { color: '#d97706' },
  detailsGrid: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    width: 100,
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  detailValue: {
    flex: 1,
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '600',
  },
  docsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  docsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  docItem: {
    width: '48%',
  },
  docLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  docThumb: {
    width: '100%',
    height: 90,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  noDocBox: {
    width: '100%',
    height: 90,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDocText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    width: '48%',
  },
  approveBtn: { backgroundColor: '#16a34a' },
  rejectBtn: { backgroundColor: '#dc2626' },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    height: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  modalCancelText: {
    color: '#64748b',
    fontWeight: '600',
  },
  modalConfirmBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '700',
  },
});
