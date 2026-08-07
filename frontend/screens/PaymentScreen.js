import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ActivityIndicator, Alert, ScrollView, Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINRExact } from '../utils/currency';
import { buildRazorpayHTML, generateDemoPaymentDetails } from '../utils/razorpay';

export default function PaymentScreen({ route, navigation }) {
  const { invoiceId } = route.params || {};
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [order, setOrder] = useState(null);
  const [showWebView, setShowWebView] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('upi'); // upi, card, netbanking

  useEffect(() => {
    initiateOrder();
  }, []);

  const initiateOrder = async () => {
    try {
      const res = await api.post('/payment/order', { invoice_id: invoiceId });
      if (res.data.success) {
        setOrder(res.data.data);
      } else {
        Alert.alert('Error', res.data.message || 'Failed to initiate payment');
      }
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to create payment order');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (paymentDetails) => {
    setProcessing(true);
    try {
      const res = await api.post('/payment/verify', paymentDetails);
      if (res.data.success) {
        setShowWebView(false);
        navigation.replace('PaymentSuccess', { receipt: res.data.data.receipt });
      } else {
        Alert.alert('Payment Failed', res.data.message || 'Verification failed');
      }
    } catch (e) {
      Alert.alert('Verification Error', e?.response?.data?.message || 'Payment verification failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleSimulateDemoPayment = () => {
    setProcessing(true);
    setTimeout(() => {
      const demoDetails = generateDemoPaymentDetails(order.orderId);
      handleVerify(demoDetails);
    }, 1200);
  };

  const onWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.status === 'success') {
        handleVerify(message.data);
      } else if (message.status === 'cancelled' || message.status === 'dismissed') {
        setShowWebView(false);
      } else if (message.status === 'failed') {
        setShowWebView(false);
        Alert.alert('Payment Failed', message.error?.description || 'Transaction failed');
      }
    } catch (e) {
      console.warn('WebView message parse error:', e);
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
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Securing Checkout...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFF' }}>
        <View style={styles.centerContainer}>
          <Icon name="error-outline" size={64} color="#EF4444" />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Order Error</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={initiateOrder}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Checkout</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {/* Digital Certificate Badge */}
          <View style={[styles.certBadge, glassStyle]}>
            <View style={styles.certIconContainer}>
              <Icon name="verified-user" size={32} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.certTitle, { color: colors.text }]}>Verified Digital Invoice</Text>
              <Text style={[styles.certSub, { color: colors.textSecondary }]}>Approved & Certified by Homeowner</Text>
            </View>
          </View>

          {/* Amount Card */}
          <View style={[styles.amountCard, { backgroundColor: colors.primary }]}>
            <Text style={styles.amountLabel}>AMOUNT PAYABLE</Text>
            <Text style={styles.amountValue}>{formatINRExact(order.grandTotal)}</Text>
            <View style={styles.orderMetaRow}>
              <Text style={styles.orderMetaText}>Invoice #{order.invoiceId}</Text>
              <Text style={styles.orderMetaText}>Order #{order.orderId.slice(-8)}</Text>
            </View>
          </View>

          {/* Payment Method Selector */}
          <View style={[styles.card, glassStyle]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Payment Mode</Text>

            {[
              { id: 'upi', name: 'Google Pay / PhonePe / UPI', icon: 'account-balance-wallet', desc: 'Instant UPI Transfer' },
              { id: 'card', name: 'Credit / Debit Card', icon: 'credit-card', desc: 'Visa, Mastercard, RuPay' },
              { id: 'netbanking', name: 'Net Banking', icon: 'account-balance', desc: 'All Major Indian Banks' },
            ].map(m => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.methodRow,
                  { borderColor: selectedMethod === m.id ? colors.primary : colors.border }
                ]}
                onPress={() => setSelectedMethod(m.id)}
              >
                <Icon name={m.icon} size={24} color={selectedMethod === m.id ? colors.primary : colors.textSecondary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.methodName, { color: colors.text }]}>{m.name}</Text>
                  <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>{m.desc}</Text>
                </View>
                {selectedMethod === m.id && (
                  <Icon name="check-circle" size={22} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Guarantee Box */}
          <View style={[styles.guaranteeBox, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5' }]}>
            <Icon name="shield" size={20} color="#10B981" />
            <Text style={[styles.guaranteeText, { color: isDarkMode ? '#34D399' : '#065F46' }]}>
              Protected by HiFix Escrow & Razorpay 256-bit Encryption
            </Text>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.payButton, processing && { opacity: 0.7 }]}
            disabled={processing}
            onPress={() => {
              if (order.demo) {
                handleSimulateDemoPayment();
              } else {
                setShowWebView(true);
              }
            }}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="lock" size={20} color="#fff" />
                <Text style={styles.payButtonText}>
                  {order.demo ? `Simulate Razorpay Pay ₹${order.grandTotal}` : `Pay ₹${order.grandTotal}`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {order.demo && (
            <Text style={{ textAlign: 'center', marginTop: 12, color: colors.textSecondary, fontSize: 12 }}>
              ℹ️ Sandbox Demo Mode active (No API Key required)
            </Text>
          )}
        </ScrollView>

        {/* Razorpay WebView Modal for Live SDK fallback */}
        <Modal visible={showWebView} animationType="slide">
          <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 12 }}>
              <TouchableOpacity onPress={() => setShowWebView(false)}>
                <Icon name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>
            <WebView
              originWhitelist={['*']}
              source={{
                html: buildRazorpayHTML({
                  orderId: order.orderId,
                  amount: order.amount,
                  key: order.key,
                  prefill: { name: user?.name, email: user?.email, phone: user?.phone }
                })
              }}
              onMessage={onWebViewMessage}
            />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 22, fontWeight: '800', flex: 1, marginLeft: 8 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorTitle: { fontSize: 20, fontWeight: '700', marginTop: 12 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 16 },
  certBadge: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, marginBottom: 16, gap: 12 },
  certIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(16, 185, 129, 0.15)', justifyContent: 'center', alignItems: 'center' },
  certTitle: { fontSize: 15, fontWeight: '800' },
  certSub: { fontSize: 12 },
  amountCard: { padding: 24, borderRadius: 22, alignItems: 'center', marginBottom: 16, elevation: 4 },
  amountLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  amountValue: { color: '#FFF', fontSize: 38, fontWeight: '900', marginVertical: 8 },
  orderMetaRow: { flexDirection: 'row', gap: 16 },
  orderMetaText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  card: { padding: 18, borderRadius: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
  methodRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 10 },
  methodName: { fontSize: 15, fontWeight: '700' },
  methodDesc: { fontSize: 12 },
  guaranteeBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, gap: 10, marginBottom: 20 },
  guaranteeText: { fontSize: 12, fontWeight: '600', flex: 1 },
  payButton: { height: 56, backgroundColor: '#2563EB', borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, elevation: 4 },
  payButtonText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
});
