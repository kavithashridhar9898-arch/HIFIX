import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, SafeAreaView, Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import api from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINRExact } from '../utils/currency';
import { getPolygonExplorerUrl } from '../utils/qrcode';

export default function PublicVerificationScreen({ route, navigation }) {
  const { type = 'certificate', id } = route.params || {};
  const { colors, isDarkMode } = useTheme();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchVerification();
  }, [type, id]);

  const fetchVerification = async () => {
    try {
      const res = await api.get(`/blockchain/verify/${type}/${id}`);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (e) {
      console.warn('Fetch verification error:', e?.message);
    } finally {
      setLoading(false);
    }
  };

  const openExplorer = () => {
    if (data?.txHash) {
      const url = getPolygonExplorerUrl(data.txHash, data.network);
      Linking.openURL(url).catch(() => { });
    }
  };

  const handleShare = async () => {
    try {
      const message = `HiFix Polygon Blockchain Verification\n` +
        `Status: ${data?.status}\n` +
        `SHA-256 Hash: ${data?.hash}\n` +
        `Network: ${data?.network}\n` +
        `Explorer: ${data?.explorerUrl || ''}`;
      await Share.share({ message });
    } catch (_) { }
  };

  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
    borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'VERIFIED':
        return { color: '#10B981', label: 'BLOCKCHAIN VERIFIED', icon: 'verified' };
      case 'TAMPERED':
        return { color: '#EF4444', label: 'TAMPER DETECTED', icon: 'warning' };
      case 'PENDING':
        return { color: '#F59E0B', label: 'REGISTRATION PENDING', icon: 'hourglass-top' };
      default:
        return { color: '#6B7280', label: 'INVALID / NOT FOUND', icon: 'gpp-bad' };
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#101415' : '#FFF' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Verifying on Polygon Network...</Text>
      </View>
    );
  }

  const statusCfg = getStatusConfig(data?.status);
  const cert = data?.certificate;
  const invoice = data?.invoice;
  const receipt = data?.receipt;
  const item = cert || invoice || receipt;

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Public Verification</Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Icon name="share" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {/* Main Status Badge */}
          <View style={[styles.statusCard, { backgroundColor: `${statusCfg.color}15`, borderColor: statusCfg.color }]}>
            <Icon name={statusCfg.icon} size={48} color={statusCfg.color} />
            <Text style={[styles.statusTitle, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
              {data?.status === 'VERIFIED'
                ? 'Immutable record cryptographic hash verified on Polygon Blockchain.'
                : data?.status === 'TAMPERED'
                  ? 'CRITICAL: Record hash does not match the on-chain payload. Potential tampering detected.'
                  : 'Registration in progress on Polygon node.'}
            </Text>
          </View>

          {/* Badges Bar */}
          <View style={styles.badgesRow}>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Icon name="verified" size={14} color="#10B981" />
              <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '800' }}>VERIFIED</Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
              <Icon name="link" size={14} color="#2563EB" />
              <Text style={{ color: '#2563EB', fontSize: 11, fontWeight: '800' }}>POLYGON AMOY</Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Icon name="lock" size={14} color="#8B5CF6" />
              <Text style={{ color: '#8B5CF6', fontSize: 11, fontWeight: '800' }}>SHA-256</Text>
            </View>
          </View>

          {/* Entity Summary Card */}
          {item && (
            <View style={[styles.card, glassStyle]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {cert ? '📜 Work Certificate Summary' : receipt ? '🧾 Receipt Summary' : '📄 Invoice Summary'}
              </Text>

              {cert && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Cert Number</Text>
                    <Text style={[styles.infoVal, { color: colors.text }]}>{cert.certificate_number}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Booking ID</Text>
                    <Text style={[styles.infoVal, { color: colors.text }]}>#{cert.booking_id}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Customer</Text>
                    <Text style={[styles.infoVal, { color: colors.text }]}>{cert.customer_name}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Worker</Text>
                    <Text style={[styles.infoVal, { color: colors.text }]}>{cert.worker_name} ({cert.service_type})</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Issued At</Text>
                    <Text style={[styles.infoVal, { color: colors.text }]}>{new Date(cert.issued_at).toLocaleString()}</Text>
                  </View>
                </>
              )}

              {receipt && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Receipt Number</Text>
                    <Text style={[styles.infoVal, { color: colors.text }]}>{receipt.receipt_number}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Amount</Text>
                    <Text style={[styles.infoVal, { color: colors.primary, fontWeight: '900' }]}>{formatINRExact(receipt.amount)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Payment ID</Text>
                    <Text style={[styles.infoVal, { color: colors.text }]}>{receipt.razorpay_payment_id}</Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Cryptographic Details Card */}
          <View style={[styles.card, glassStyle]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>🔐 On-Chain Proof Details</Text>

            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.hashLabel, { color: colors.textSecondary }]}>SHA-256 HASH</Text>
              <Text style={[styles.hashVal, { color: colors.primary }]} selectTextOnPress>
                {data?.hash || '—'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Network</Text>
              <Text style={[styles.infoVal, { color: colors.text }]}>{data?.network || 'Polygon Amoy'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Block Number</Text>
              <Text style={[styles.infoVal, { color: colors.text }]}>{data?.blockNumber || '—'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Transaction Hash</Text>
              <Text style={[styles.infoVal, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                {data?.txHash || '—'}
              </Text>
            </View>
        </View>

        {/* Polygon Explorer CTA */}
        {data?.txHash && (
          <TouchableOpacity style={styles.explorerBtn} onPress={openExplorer}>
            <Icon name="open-in-new" size={20} color="#fff" />
            <Text style={styles.explorerBtnText}>View on Polygon Explorer</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
    </View >
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800', flex: 1, marginLeft: 8 },
  shareBtn: { padding: 6 },
  statusCard: { padding: 24, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', textAlign: 'center', marginBottom: 16 },
  statusTitle: { fontSize: 20, fontWeight: '900', marginTop: 12, letterSpacing: 0.5 },
  statusSub: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  badgesRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  badgePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  card: { padding: 18, borderRadius: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  infoLabel: { fontSize: 13, fontWeight: '600' },
  infoVal: { fontSize: 13, fontWeight: '700' },
  hashLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  hashVal: { fontSize: 12, fontWeight: '800', fontFamily: 'monospace', marginTop: 4 },
  explorerBtn: { height: 54, backgroundColor: '#8247E5', borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, elevation: 4 },
  explorerBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
