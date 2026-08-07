import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Animated, ActivityIndicator, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINR, formatINRExact } from '../utils/currency';

const STATUS_COLOR = {
  requested: '#2563EB', viewed: '#8B5CF6', accepted: '#10B981',
  rejected: '#EF4444', expired: '#6B7280', paid: '#059669',
  completed: '#059669', cancelled: '#F59E0B', refunded: '#6366F1',
};

const ROW = ({ label, value, bold, accent, colors }) => (
  <View style={[styles.detailRow, { borderBottomColor: `${colors.text}10` }]}>
    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
    <Text style={[styles.detailValue, { color: accent || colors.text }, bold && { fontWeight: '800' }]}>
      {value}
    </Text>
  </View>
);

export default function InvoiceViewScreen({ route, navigation }) {
  const { invoiceId } = route.params || {};
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    fetchInvoice();
  }, []);

  const fetchInvoice = async () => {
    try {
      const res = await api.get(`/invoice/${invoiceId}`);
      if (res.data.success) setInvoice(res.data.data.invoice);
    } catch (e) {
      console.warn('InvoiceView fetch error', e?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveInvoice = async () => {
    setActionLoading(true);
    try {
      const res = await api.patch(`/invoice/${invoiceId}/accept`);
      if (res.data.success) {
        Alert.alert('✅ Invoice Approved', 'You can now proceed with payment.');
        setInvoice(res.data.data.invoice);
      }
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to approve invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const glass = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
    borderColor:     isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#101415' : '#fff' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#101415' : '#fff' }}>
        <Icon name="receipt-long" size={64} color={`${colors.textSecondary}40`} />
        <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 16 }}>Invoice not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = STATUS_COLOR[invoice.status] || colors.textSecondary;
  const materials = invoice.material_items || [];
  const isHomeowner = user?.user_type === 'homeowner';

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Invoice #{invoiceId}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{invoice.status?.toUpperCase()}</Text>
          </View>
        </Animated.View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* Certificate Header Banner if Accepted */}
            {invoice.status === 'accepted' && (
              <View style={[styles.certBanner, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }]}>
                <Icon name="verified-user" size={24} color="#10B981" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 14 }}>Invoice Approved & Certified</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Ready for secure checkout payment</Text>
                </View>
              </View>
            )}

            {/* Header Card */}
            <View style={[styles.card, glass]}>
              <View style={styles.brandRow}>
                <View style={[styles.brandBadge, { backgroundColor: colors.primary }]}>
                  <Icon name="home-repair-service" size={20} color="#fff" />
                </View>
                <View>
                  <Text style={[styles.brandName, { color: colors.text }]}>HiFix</Text>
                  <Text style={[styles.brandSub, { color: colors.textSecondary }]}>Payment Request</Text>
                </View>
                <View style={[styles.invoiceNumBadge, { backgroundColor: `${colors.primary}20` }]}>
                  <Text style={[styles.invoiceNum, { color: colors.primary }]}>Booking #{invoice.booking_id}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  From: {invoice.worker_name || '—'}
                </Text>
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  To: {invoice.customer_name || 'Homeowner'}
                </Text>
              </View>
              <Text style={[styles.metaText, { color: colors.textSecondary, marginTop: 4 }]}>
                Issued: {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </Text>
            </View>

            {/* Work Summary */}
            <View style={[styles.card, glass]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>⏱ Work Summary</Text>
              <ROW label="Labour Cost" value={formatINRExact(invoice.labour_cost || 0)} bold accent={colors.primary} colors={colors} />
              {invoice.min_charge_applied && (
                <ROW label="Min. Charge Applied" value={formatINR(invoice.min_charge || 0)} colors={colors} />
              )}
            </View>

            {/* Materials */}
            {materials.length > 0 && (
              <View style={[styles.card, glass]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>📦 Materials Used</Text>
                <View style={[styles.matHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.matCol, { color: colors.textSecondary, flex: 3 }]}>Item</Text>
                  <Text style={[styles.matCol, { color: colors.textSecondary, flex: 1, textAlign: 'center' }]}>Qty</Text>
                  <Text style={[styles.matCol, { color: colors.textSecondary, flex: 1.5, textAlign: 'right' }]}>Unit</Text>
                  <Text style={[styles.matCol, { color: colors.textSecondary, flex: 1.5, textAlign: 'right' }]}>Total</Text>
                </View>
                {materials.map((item, idx) => (
                  <View key={idx} style={[styles.matRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.matCell, { color: colors.text, flex: 3 }]}>{item.name}</Text>
                    <Text style={[styles.matCell, { color: colors.textSecondary, flex: 1, textAlign: 'center' }]}>{item.qty}</Text>
                    <Text style={[styles.matCell, { color: colors.textSecondary, flex: 1.5, textAlign: 'right' }]}>{formatINR(item.unit_cost)}</Text>
                    <Text style={[styles.matCell, { color: colors.text, flex: 1.5, textAlign: 'right', fontWeight: '700' }]}>
                      {formatINR(item.qty * item.unit_cost)}
                    </Text>
                  </View>
                ))}
                <View style={[styles.matFooter, { borderTopColor: colors.border }]}>
                  <Text style={[styles.matFooterLabel, { color: colors.text }]}>Material Total</Text>
                  <Text style={[styles.matFooterVal, { color: colors.primary }]}>{formatINRExact(invoice.material_cost || 0)}</Text>
                </View>
              </View>
            )}

            {/* Charges Breakdown */}
            <View style={[styles.card, glass]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>💰 Charges Breakdown</Text>
              <ROW label="Labour Cost"   value={formatINRExact(invoice.labour_cost || 0)}   colors={colors} />
              <ROW label="Material Cost" value={formatINRExact(invoice.material_cost || 0)} colors={colors} />
              {(invoice.travel_cost    > 0) && <ROW label="Travel"    value={formatINRExact(invoice.travel_cost)}    colors={colors} />}
              {(invoice.emergency_cost > 0) && <ROW label="Emergency" value={formatINRExact(invoice.emergency_cost)} colors={colors} />}
              {(invoice.other_cost     > 0) && <ROW label="Other"     value={formatINRExact(invoice.other_cost)}     colors={colors} />}
              {invoice.discount        > 0  && <ROW label="Discount"  value={`-${formatINRExact(invoice.discount)}`} colors={colors} />}
            </View>

            {/* Grand Total */}
            <View style={[styles.grandTotalCard, { backgroundColor: colors.primary }]}>
              <Text style={styles.grandLabel}>GRAND TOTAL</Text>
              <Text style={styles.grandValue}>{formatINRExact(invoice.grand_total || 0)}</Text>
              <Text style={styles.grandCurrency}>Indian Rupees (INR)</Text>
            </View>

            {/* Service Description */}
            {!!invoice.service_description && (
              <View style={[styles.card, glass]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>📝 Service Description</Text>
                <Text style={[styles.descText, { color: colors.textSecondary }]}>{invoice.service_description}</Text>
              </View>
            )}

            {!!invoice.notes && (
              <View style={[styles.card, glass]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>🗒 Notes</Text>
                <Text style={[styles.descText, { color: colors.textSecondary }]}>{invoice.notes}</Text>
              </View>
            )}

            {/* Phase 3 Action Buttons */}
            <View style={{ gap: 12, marginTop: 12 }}>
              {isHomeowner && (invoice.status === 'requested' || invoice.status === 'viewed') && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                  onPress={handleApproveInvoice}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Icon name="check-circle" size={22} color="#fff" />
                      <Text style={styles.actionBtnText}>Approve & Issue Certificate</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {isHomeowner && invoice.status === 'accepted' && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => navigation.navigate('Payment', { invoiceId: invoice.id, amount: invoice.grand_total })}
                >
                  <Icon name="payment" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>Pay Now ₹{invoice.grand_total}</Text>
                </TouchableOpacity>
              )}

              {invoice.status === 'paid' && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                  onPress={() => navigation.navigate('Receipt', { invoiceId: invoice.id })}
                >
                  <Icon name="receipt" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>View Digital Receipt</Text>
                </TouchableOpacity>
              )}

              {/* Polygon Blockchain Verification CTA */}
              {['accepted', 'paid'].includes(invoice.status) && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#8247E5' }]}
                  onPress={() => navigation.navigate('PublicVerification', { type: 'invoice', id: invoice.id })}
                >
                  <Icon name="link" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>Verify on Polygon Blockchain</Text>
                </TouchableOpacity>
              )}

              {!isHomeowner && invoice.status === 'requested' && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => navigation.navigate('InvoiceEdit', { invoiceId: invoice.id })}
                >
                  <Icon name="edit" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>Edit Invoice</Text>
                </TouchableOpacity>
              )}
            </View>

          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, marginLeft: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  certBanner: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 14, gap: 10 },
  card: { borderRadius: 18, padding: 16, marginBottom: 14, elevation: 3 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandBadge: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  brandName: { fontSize: 16, fontWeight: '900' },
  brandSub: { fontSize: 11 },
  invoiceNumBadge: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  invoiceNum: { fontWeight: '700', fontSize: 12 },
  metaText: { fontSize: 13 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600' },
  matHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, marginBottom: 4 },
  matRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  matCol: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  matCell: { fontSize: 13 },
  matFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, marginTop: 4 },
  matFooterLabel: { fontSize: 14, fontWeight: '700' },
  matFooterVal: { fontSize: 15, fontWeight: '900' },
  grandTotalCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 14, elevation: 8 },
  grandLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  grandValue: { color: '#fff', fontSize: 38, fontWeight: '900', marginVertical: 4 },
  grandCurrency: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  descText: { fontSize: 14, lineHeight: 22 },
  actionBtn: { height: 54, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, elevation: 4 },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
