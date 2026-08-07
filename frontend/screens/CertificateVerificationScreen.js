import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Linking, Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import api from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINRExact } from '../utils/currency';
import { getPolygonExplorerUrl } from '../utils/qrcode';

export default function CertificateVerificationScreen({ route, navigation }) {
  const { bookingId } = route.params || {};
  const { colors, isDarkMode } = useTheme();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchCertificate();
  }, [bookingId]);

  const fetchCertificate = async () => {
    try {
      const res = await api.get(`/blockchain/verify/certificate/${bookingId}`);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (e) {
      console.warn('Fetch cert error:', e?.message);
    } finally {
      setLoading(false);
    }
  };

  const openExplorer = () => {
    if (data?.txHash) {
      const url = getPolygonExplorerUrl(data.txHash, data.network);
      Linking.openURL(url).catch(() => {});
    }
  };

  const handleShare = async () => {
    try {
      const cert = data?.certificate;
      const message = `HiFix Work Completion Certificate\n` +
        `Cert #: ${cert?.certificate_number}\n` +
        `Booking #: ${cert?.booking_id}\n` +
        `Worker: ${cert?.worker_name}\n` +
        `Customer: ${cert?.customer_name}\n` +
        `Blockchain Verified: Yes (Polygon Amoy)\n` +
        `Tx Hash: ${data?.txHash || '—'}`;
      await Share.share({ message });
    } catch (_) {}
  };

  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
    borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#101415' : '#FFF' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const cert = data?.certificate;

  const handleDownloadPdf = () => {
    const certId = cert?.id || bookingId;
    const baseURL = api.defaults.baseURL || 'http://localhost:5000/api';
    const pdfUrl = `${baseURL}/blockchain/certificate/${certId}/pdf`;
    Linking.openURL(pdfUrl).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Digital Certificate</Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Icon name="share" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {/* Main Certificate Sheet */}
          <View style={[styles.certSheet, glassStyle]}>
            {/* Header Stamp */}
            <View style={styles.sealRow}>
              <View style={[styles.sealCircle, { backgroundColor: colors.primary }]}>
                <Icon name="verified-user" size={32} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.certHeading, { color: colors.text }]}>WORK COMPLETION CERTIFICATE</Text>
                <Text style={[styles.certSubheading, { color: colors.textSecondary }]}>HiFix Certified Service Guarantee</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Badges Grid */}
            <View style={styles.badgeGrid}>
              <View style={[styles.badgePill, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Icon name="check-circle" size={14} color="#10B981" />
                <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '800' }}>VERIFIED</Text>
              </View>
              <View style={[styles.badgePill, { backgroundColor: 'rgba(130, 71, 229, 0.15)' }]}>
                <Icon name="link" size={14} color="#8247E5" />
                <Text style={{ color: '#8247E5', fontSize: 10, fontWeight: '800' }}>BLOCKCHAIN VERIFIED</Text>
              </View>
              <View style={[styles.badgePill, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
                <Icon name="payments" size={14} color="#2563EB" />
                <Text style={{ color: '#2563EB', fontSize: 10, fontWeight: '800' }}>PAYMENT VERIFIED</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Certificate Details */}
            <View style={styles.certBody}>
              <Text style={[styles.certTextLabel, { color: colors.textSecondary }]}>CERTIFICATE NUMBER</Text>
              <Text style={[styles.certNumVal, { color: colors.primary }]}>{cert?.certificate_number || `HIFIX-CERT-${bookingId}`}</Text>

              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Booking Reference</Text>
                <Text style={[styles.val, { color: colors.text }]}>#{cert?.booking_id || bookingId}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Service Provided</Text>
                <Text style={[styles.val, { color: colors.text }]}>{(cert?.service_type || 'Service').toUpperCase()}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Professional Worker</Text>
                <Text style={[styles.val, { color: colors.text }]}>{cert?.worker_name || 'Worker'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Customer</Text>
                <Text style={[styles.val, { color: colors.text }]}>{cert?.customer_name || 'Homeowner'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Total Service Amount</Text>
                <Text style={[styles.val, { color: colors.primary, fontWeight: '900' }]}>{formatINRExact(cert?.grand_total || 0)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Issued Date</Text>
                <Text style={[styles.val, { color: colors.text }]}>
                  {cert?.issued_at ? new Date(cert.issued_at).toLocaleString() : new Date().toLocaleString()}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Blockchain Details */}
            <View>
              <Text style={[styles.certTextLabel, { color: colors.textSecondary }]}>POLYGON ON-CHAIN PROOF</Text>
              <Text style={[styles.txHashText, { color: colors.textSecondary }]} numberOfLines={1}>
                Tx: {data?.txHash || 'Pending confirmation'}
              </Text>
            </View>
          </View>

          {/* Action CTAs */}
          <TouchableOpacity style={[styles.pdfBtn, { backgroundColor: colors.primary }]} onPress={handleDownloadPdf}>
            <Icon name="picture-as-pdf" size={20} color="#FFF" />
            <Text style={styles.explorerBtnText}>Download PDF Certificate</Text>
          </TouchableOpacity>

          {data?.txHash && (
            <TouchableOpacity style={styles.explorerBtn} onPress={openExplorer}>
              <Icon name="open-in-new" size={20} color="#FFF" />
              <Text style={styles.explorerBtnText}>View on Polygon Explorer</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.shareBtnFull, { backgroundColor: colors.primary }]} onPress={handleShare}>
            <Icon name="share" size={20} color="#FFF" />
            <Text style={styles.shareBtnTextFull}>Share Certificate</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800', flex: 1, marginLeft: 8 },
  shareBtn: { padding: 6 },
  certSheet: { borderRadius: 24, padding: 20, marginBottom: 16 },
  sealRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sealCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  certHeading: { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  certSubheading: { fontSize: 12 },
  divider: { height: 1, marginVertical: 14 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  badgePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  certBody: { gap: 10 },
  certTextLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  certNumVal: { fontSize: 22, fontWeight: '900', marginBottom: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  label: { fontSize: 13, fontWeight: '600' },
  val: { fontSize: 13, fontWeight: '700' },
  txHashText: { fontSize: 12, fontFamily: 'monospace', marginTop: 4 },
  explorerBtn: { height: 52, backgroundColor: '#8247E5', borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 12 },
  pdfBtn: { height: 52, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 12 },
  explorerBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  shareBtnFull: { height: 52, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  shareBtnTextFull: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
