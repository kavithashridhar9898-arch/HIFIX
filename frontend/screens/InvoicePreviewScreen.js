import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, SafeAreaView, Animated, ActivityIndicator, Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api, { API_BASE_URL } from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINR, formatINRExact, formatDuration } from '../utils/currency';

const ROW = ({ label, value, bold, accent, colors }) => (
  <View style={[styles.detailRow, { borderBottomColor: `${colors.text}10` }]}>
    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
    <Text style={[
      styles.detailValue,
      { color: accent || colors.text },
      bold && { fontWeight: '800' },
    ]}>{value}</Text>
  </View>
);

export default function InvoicePreviewScreen({ route, navigation }) {
  const { bookingId, session, workerProfile, invoiceData } = route.params || {};
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [sending, setSending] = useState(false);

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL.replace('/api', '')}${url}`;
  };

  const handleSend = async () => {
    Alert.alert(
      '📤 Send Payment Request',
      `Send invoice for ${formatINRExact(invoiceData.grand_total)} to the homeowner?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSending(true);
            try {
              const payload = {
                booking_id:          bookingId,
                material_items:      invoiceData.material_items || [],
                travel_cost:         invoiceData.travel_cost    || 0,
                emergency_cost:      invoiceData.emergency_cost || 0,
                other_cost:          invoiceData.other_cost     || 0,
                other_cost_note:     invoiceData.other_cost_note || '',
                discount:            invoiceData.discount       || 0,
                service_description: invoiceData.service_description,
                notes:               invoiceData.notes || '',
              };
              const res = await api.post('/invoice/create', payload);
              if (res.data.success) {
                Alert.alert(
                  '✅ Sent!',
                  'Payment request sent to the homeowner successfully.',
                  [{
                    text: 'View My Requests',
                    onPress: () => navigation.navigate('PaymentRequests'),
                  }]
                );
              }
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.message || 'Failed to send payment request');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  const glass = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
    borderColor:     isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  const workerPhotoUrl = getImageUrl(workerProfile?.profile_image);
  const workedHours = Math.floor(invoiceData.worked_seconds / 3600);
  const workedMins  = Math.floor((invoiceData.worked_seconds % 3600) / 60);
  const duration    = `${workedHours}h ${workedMins}m`;

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Invoice Preview</Text>
          <View style={{ width: 40 }} />
        </Animated.View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* Invoice Header Card */}
            <View style={[styles.invoiceHeader, glass]}>
              {/* Branding */}
              <View style={styles.brandRow}>
                <View style={[styles.brandBadge, { backgroundColor: colors.primary }]}>
                  <Icon name="home-repair-service" size={22} color="#fff" />
                </View>
                <View>
                  <Text style={[styles.brandName, { color: colors.text }]}>HiFix</Text>
                  <Text style={[styles.invoiceSubtitle, { color: colors.textSecondary }]}>Payment Request</Text>
                </View>
                <View style={[styles.invoiceNumBadge, { backgroundColor: `${colors.primary}20` }]}>
                  <Text style={[styles.invoiceNum, { color: colors.primary }]}>#{bookingId}</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Worker Info */}
              <View style={styles.partyRow}>
                <View style={styles.partyInfo}>
                  {workerPhotoUrl ? (
                    <Image source={{ uri: workerPhotoUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: `${colors.primary}30` }]}>
                      <Icon name="person" size={22} color={colors.primary} />
                    </View>
                  )}
                  <View>
                    <Text style={[styles.partyLabel, { color: colors.textSecondary }]}>FROM</Text>
                    <Text style={[styles.partyName, { color: colors.text }]}>{workerProfile?.name || user?.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Icon name="star" size={13} color="#F59E0B" />
                      <Text style={[styles.partyMeta, { color: colors.textSecondary }]}>
                        {parseFloat(workerProfile?.average_rating || 0).toFixed(1)} · {(workerProfile?.service_type || '').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                <Icon name="arrow-forward" size={20} color={colors.textSecondary} />

                <View style={[styles.partyInfo, { alignItems: 'flex-end' }]}>
                  <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(34,197,94,0.2)' }]}>
                    <Icon name="home" size={22} color="#22C55E" />
                  </View>
                  <Text style={[styles.partyLabel, { color: colors.textSecondary }]}>TO</Text>
                  <Text style={[styles.partyName, { color: colors.text }]}>Homeowner</Text>
                </View>
              </View>
            </View>

            {/* Work Summary */}
            <View style={[styles.card, glass]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>⏱ Work Summary</Text>
              <ROW label="Duration"    value={duration}                          colors={colors} />
              <ROW label="Hourly Rate" value={`${formatINR(invoiceData.hourly_rate_snapshot)}/hr`} colors={colors} />
              <ROW label="Labour Cost" value={formatINRExact(invoiceData.labour_cost)} bold accent={colors.primary} colors={colors} />
              {invoiceData.min_charge_applied && (
                <ROW label="Min. Service Charge Applied" value={`${formatINR(invoiceData.min_charge)}`} colors={colors} />
              )}
            </View>

            {/* Materials */}
            {invoiceData.material_items?.length > 0 && (
              <View style={[styles.card, glass]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>📦 Materials Used</Text>
                {/* Table Header */}
                <View style={[styles.matHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.matCol, { color: colors.textSecondary, flex: 3 }]}>Item</Text>
                  <Text style={[styles.matCol, { color: colors.textSecondary, flex: 1, textAlign: 'center' }]}>Qty</Text>
                  <Text style={[styles.matCol, { color: colors.textSecondary, flex: 1.5, textAlign: 'right' }]}>Unit</Text>
                  <Text style={[styles.matCol, { color: colors.textSecondary, flex: 1.5, textAlign: 'right' }]}>Total</Text>
                </View>
                {invoiceData.material_items.map((item, idx) => (
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
                  <Text style={[styles.matFooterVal, { color: colors.primary }]}>{formatINRExact(invoiceData.material_cost)}</Text>
                </View>
              </View>
            )}

            {/* Charges Breakdown */}
            <View style={[styles.card, glass]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>💰 Charges Breakdown</Text>
              <ROW label="Labour Cost"   value={formatINRExact(invoiceData.labour_cost)}   colors={colors} />
              <ROW label="Material Cost" value={formatINRExact(invoiceData.material_cost)} colors={colors} />
              {invoiceData.travel_cost    > 0 && <ROW label="Travel"    value={formatINRExact(invoiceData.travel_cost)}    colors={colors} />}
              {invoiceData.emergency_cost > 0 && <ROW label="Emergency" value={formatINRExact(invoiceData.emergency_cost)} colors={colors} />}
              {invoiceData.other_cost     > 0 && <ROW label="Other"     value={formatINRExact(invoiceData.other_cost)}     colors={colors} />}
              <ROW label="Platform Fee"  value="₹0.00"  colors={colors} />
              <ROW label="Tax"           value="₹0.00"  colors={colors} />
            </View>

            {/* Grand Total */}
            <View style={[styles.grandTotalCard, { backgroundColor: colors.primary }]}>
              <Text style={styles.grandLabel}>GRAND TOTAL</Text>
              <Text style={styles.grandValue}>{formatINRExact(invoiceData.grand_total)}</Text>
              <Text style={styles.grandCurrency}>Indian Rupees (INR)</Text>
            </View>

            {/* Service Description */}
            <View style={[styles.card, glass]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>📝 Service Description</Text>
              <Text style={[styles.descText, { color: colors.textSecondary }]}>{invoiceData.service_description}</Text>
            </View>

            {invoiceData.notes ? (
              <View style={[styles.card, glass]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>🗒 Notes</Text>
                <Text style={[styles.descText, { color: colors.textSecondary }]}>{invoiceData.notes}</Text>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={{ gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.sendBtn, sending && { opacity: 0.7 }]}
                onPress={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Icon name="send" size={22} color="#fff" />
                    <Text style={styles.sendBtnText}>Send Payment Request</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.editBtn, { borderColor: colors.primary }]} onPress={() => navigation.goBack()}>
                <Icon name="edit" size={18} color={colors.primary} />
                <Text style={[styles.editBtnText, { color: colors.primary }]}>Edit Invoice</Text>
              </TouchableOpacity>
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
  headerTitle: { fontSize: 20, fontWeight: '800', flex: 1, marginLeft: 8 },
  invoiceHeader: { borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 5 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  brandBadge: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  brandName: { fontSize: 18, fontWeight: '900' },
  invoiceSubtitle: { fontSize: 12 },
  invoiceNumBadge: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  invoiceNum: { fontWeight: '800', fontSize: 13 },
  divider: { height: 1, marginVertical: 14 },
  partyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partyInfo: { alignItems: 'flex-start' },
  avatar: { width: 44, height: 44, borderRadius: 22, marginBottom: 6 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  partyLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  partyName: { fontSize: 14, fontWeight: '800' },
  partyMeta: { fontSize: 11 },
  card: { borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
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
  grandTotalCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 14, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  grandLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  grandValue: { color: '#fff', fontSize: 42, fontWeight: '900', marginVertical: 4 },
  grandCurrency: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  descText: { fontSize: 14, lineHeight: 22 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 58, borderRadius: 18, backgroundColor: '#22C55E', shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 16, borderWidth: 1.5 },
  editBtnText: { fontWeight: '700', fontSize: 15 },
});
