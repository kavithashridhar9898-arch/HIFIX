import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Animated, Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import PremiumBackground from '../components/PremiumBackground';
import { formatINRExact } from '../utils/currency';

export default function PaymentSuccessScreen({ route, navigation }) {
  const { receipt } = route.params || {};
  const { colors, isDarkMode } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleShareReceipt = async () => {
    try {
      const message = `HiFix Digital Receipt\nReceipt #: ${receipt?.receipt_number}\nAmount Paid: ${formatINRExact(receipt?.amount)}\nDate: ${new Date(receipt?.paid_at).toLocaleDateString()}\nStatus: SUCCESS`;
      await Share.share({ message });
    } catch (e) {
      console.warn('Share error', e);
    }
  };

  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
    borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
        <View style={styles.contentContainer}>

          {/* Success Checkmark Badge */}
          <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
            <Icon name="check" size={54} color="#FFF" />
          </Animated.View>

          <Text style={[styles.title, { color: colors.text }]}>Payment Successful!</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your transaction was processed securely</Text>

          {/* Amount Badge */}
          <Text style={[styles.amountText, { color: colors.primary }]}>
            {formatINRExact(receipt?.amount || 0)}
          </Text>

          {/* Receipt Info Card */}
          <View style={[styles.card, glassStyle]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Receipt No.</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{receipt?.receipt_number || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Transaction ID</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{receipt?.razorpay_payment_id || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Paid To</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{receipt?.worker_name || 'Service Worker'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Date</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {receipt?.paid_at ? new Date(receipt.paid_at).toLocaleString() : new Date().toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.receiptBtn, { borderColor: colors.primary }]}
            onPress={() => navigation.navigate('Receipt', { invoiceId: receipt?.invoice_id })}
          >
            <Icon name="receipt" size={20} color={colors.primary} />
            <Text style={[styles.receiptBtnText, { color: colors.primary }]}>View Digital Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.primary }]}
            onPress={handleShareReceipt}
          >
            <Icon name="share" size={20} color="#fff" />
            <Text style={styles.shareBtnText}>Share Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => navigation.navigate('Main')}
          >
            <Text style={[styles.doneBtnText, { color: colors.textSecondary }]}>Back to Home</Text>
          </TouchableOpacity>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: { alignItems: 'center' },
  checkCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 6 },
  title: { fontSize: 26, fontWeight: '900', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 16 },
  amountText: { fontSize: 36, fontWeight: '900', marginBottom: 24 },
  card: { width: '100%', padding: 18, borderRadius: 20, marginBottom: 24 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoLabel: { fontSize: 13, fontWeight: '600' },
  infoValue: { fontSize: 13, fontWeight: '700' },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, width: '100%', justifyContent: 'center', marginBottom: 12 },
  receiptBtnText: { fontWeight: '700', fontSize: 15 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, width: '100%', justifyContent: 'center', marginBottom: 12 },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  doneBtn: { paddingVertical: 12 },
  doneBtnText: { fontSize: 15, fontWeight: '600' },
});
