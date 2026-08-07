import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import api from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINRExact } from '../utils/currency';

export default function ReceiptScreen({ route, navigation }) {
  const { invoiceId } = route.params || {};
  const { colors, isDarkMode } = useTheme();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReceipt();
  }, []);

  const fetchReceipt = async () => {
    try {
      const res = await api.get(`/payment/receipt/${invoiceId}`);
      if (res.data.success) {
        setReceipt(res.data.data.receipt);
      }
    } catch (e) {
      console.warn('Fetch receipt error:', e?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!receipt) return;
    try {
      const text = `HiFix Official Digital Receipt\n` +
        `Receipt #: ${receipt.receipt_number}\n` +
        `Razorpay Payment ID: ${receipt.razorpay_payment_id}\n` +
        `Amount Paid: ${formatINRExact(receipt.amount)}\n` +
        `Customer: ${receipt.customer_name}\n` +
        `Worker: ${receipt.worker_name}\n` +
        `Service: ${receipt.service_type || 'General Service'}\n` +
        `Date: ${new Date(receipt.paid_at).toLocaleString()}`;
      await Share.share({ message: text });
    } catch (e) {
      console.warn('Share error', e);
    }
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

  if (!receipt) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFF' }}>
        <View style={styles.center}>
          <Icon name="receipt" size={64} color={colors.textSecondary} />
          <Text style={{ color: colors.text, fontSize: 18, marginTop: 12 }}>Receipt Not Found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Digital Receipt</Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareIconBtn}>
            <Icon name="share" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {/* Main Receipt Document Card */}
          <View style={[styles.receiptCard, glassStyle]}>

            {/* Branding Header */}
            <View style={styles.brandRow}>
              <View style={[styles.brandBadge, { backgroundColor: colors.primary }]}>
                <Icon name="home-repair-service" size={22} color="#fff" />
              </View>
              <View>
                <Text style={[styles.brandName, { color: colors.text }]}>HiFix</Text>
                <Text style={[styles.brandSub, { color: colors.textSecondary }]}>Official Payment Receipt</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Text style={styles.statusText}>PAID ✅</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Receipt Number Badge */}
            <View style={styles.receiptNumBox}>
              <Text style={[styles.receiptNumLabel, { color: colors.textSecondary }]}>RECEIPT NUMBER</Text>
              <Text style={[styles.receiptNumValue, { color: colors.primary }]}>{receipt.receipt_number}</Text>
            </View>

            {/* Total Paid */}
            <View style={styles.totalBox}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total Paid</Text>
              <Text style={[styles.totalAmount, { color: colors.text }]}>{formatINRExact(receipt.amount)}</Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Details Table */}
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Transaction ID</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{receipt.razorpay_payment_id}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Order ID</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{receipt.razorpay_order_id}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date & Time</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{new Date(receipt.paid_at).toLocaleString()}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Payment Method</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{(receipt.payment_method || 'Online').toUpperCase()}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Customer</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{receipt.customer_name}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Worker Provider</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{receipt.worker_name}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Service</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{(receipt.service_type || 'Service').toUpperCase()}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Footer stamp */}
            <View style={styles.footerStamp}>
              <Icon name="verified" size={24} color="#10B981" />
              <Text style={[styles.stampText, { color: colors.textSecondary }]}>
                Verified by HiFix Escrow & Polygon Blockchain
              </Text>
            </View>
          </View>

          {/* Blockchain Verification CTA */}
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: '#8247E5', marginBottom: 12 }]}
            onPress={() => navigation.navigate('PublicVerification', { type: 'receipt', id: receipt.invoice_id })}
          >
            <Icon name="link" size={20} color="#fff" />
            <Text style={styles.shareBtnText}>Verify on Polygon Blockchain</Text>
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.primary }]} onPress={handleShare}>
            <Icon name="file-download" size={20} color="#fff" />
            <Text style={styles.shareBtnText}>Download / Share Receipt</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 22, fontWeight: '800', flex: 1, marginLeft: 8 },
  shareIconBtn: { padding: 6 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  receiptCard: { borderRadius: 24, padding: 20, marginBottom: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandBadge: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  brandName: { fontSize: 20, fontWeight: '900' },
  brandSub: { fontSize: 11 },
  statusBadge: { marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { color: '#10B981', fontWeight: '900', fontSize: 12 },
  divider: { height: 1, marginVertical: 16 },
  receiptNumBox: { alignItems: 'center', marginBottom: 12 },
  receiptNumLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  receiptNumValue: { fontSize: 22, fontWeight: '900', marginTop: 2 },
  totalBox: { alignItems: 'center', marginVertical: 8 },
  totalLabel: { fontSize: 12, fontWeight: '600' },
  totalAmount: { fontSize: 34, fontWeight: '900', marginTop: 2 },
  detailsContainer: { gap: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 13, fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  footerStamp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  stampText: { fontSize: 12, fontWeight: '600' },
  shareBtn: { height: 52, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
