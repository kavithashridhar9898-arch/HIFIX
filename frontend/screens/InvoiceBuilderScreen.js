import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, SafeAreaView, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import PremiumBackground from '../components/PremiumBackground';
import { formatINR, formatINRExact, msToHHMMSS } from '../utils/currency';

let _itemId = 0;
const newItem = () => ({ id: ++_itemId, name: '', qty: '1', unit_cost: '' });

const Section = ({ icon, title, children, colors, glass }) => (
  <View style={[styles.card, glass, { marginBottom: 14 }]}>
    <View style={styles.sectionHeader}>
      <Icon name={icon} size={20} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
    {children}
  </View>
);

export default function InvoiceBuilderScreen({ route, navigation }) {
  const { bookingId, session, workerProfile } = route.params || {};
  const { colors, isDarkMode } = useTheme();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const hourlyRate    = parseFloat(workerProfile?.hourly_rate || 0);
  const minCharge     = parseFloat(workerProfile?.min_charge  || 0);
  const travelDefault = parseFloat(workerProfile?.travel_charge_per_km || 0);
  const emerDefault   = parseFloat(workerProfile?.emergency_charge     || 0);

  const workedSeconds  = Math.floor(Number(session?.total_duration_ms || 0) / 1000);
  const labourCost     = Math.round((hourlyRate * (workedSeconds / 3600)) * 100) / 100;

  // Form state
  const [materials, setMaterials]   = useState([newItem()]);
  const [travelCost, setTravelCost] = useState('');
  const [emergencyCost, setEmergency] = useState('');
  const [otherCost, setOtherCost]   = useState('');
  const [otherNote, setOtherNote]   = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes]           = useState('');
  const [descError, setDescError]   = useState('');

  // ── Material operations ──────────────────────────────────────────────────────
  const addMaterial = () => {
    if (materials.length >= 50) { Alert.alert('Limit', 'Maximum 50 material items'); return; }
    setMaterials(m => [...m, newItem()]);
  };

  const removeMaterial = (id) => setMaterials(m => m.filter(i => i.id !== id));

  const updateMaterial = (id, field, val) =>
    setMaterials(m => m.map(i => i.id === id ? { ...i, [field]: val } : i));

  // ── Calculations ─────────────────────────────────────────────────────────────
  const materialCost = materials.reduce((sum, item) => {
    const q = parseFloat(item.qty)       || 0;
    const c = parseFloat(item.unit_cost) || 0;
    return sum + (q * c);
  }, 0);

  const travel    = parseFloat(travelCost)    || 0;
  const emergency = parseFloat(emergencyCost) || 0;
  const other     = parseFloat(otherCost)     || 0;

  const subtotal  = labourCost + materialCost;
  const effectiveSubtotal = (minCharge > 0 && subtotal < minCharge) ? minCharge : subtotal;
  const grandTotal = Math.max(0, effectiveSubtotal + travel + emergency + other);

  // ── Navigate to preview ───────────────────────────────────────────────────────
  const handlePreview = () => {
    if (description.trim().length < 20) {
      setDescError('Service description must be at least 20 characters');
      return;
    }
    setDescError('');

    const validMaterials = materials
      .filter(i => i.name.trim() && parseFloat(i.unit_cost) >= 0)
      .map(i => ({
        name:      i.name.trim(),
        qty:       parseFloat(i.qty)       || 1,
        unit_cost: parseFloat(i.unit_cost) || 0,
      }));

    navigation.navigate('InvoicePreview', {
      bookingId,
      session,
      workerProfile,
      invoiceData: {
        hourly_rate_snapshot: hourlyRate,
        worked_seconds: workedSeconds,
        labour_cost: labourCost,
        material_items: validMaterials,
        material_cost: materialCost,
        travel_cost: travel,
        emergency_cost: emergency,
        other_cost: other,
        other_cost_note: otherNote,
        discount: 0,
        grand_total: grandTotal,
        service_description: description.trim(),
        notes: notes.trim(),
        min_charge: minCharge,
        min_charge_applied: minCharge > 0 && subtotal < minCharge,
      },
    });
  };

  const glass = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)',
    borderColor:     isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  const inputStyle = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F5F7FA',
    borderColor:     isDarkMode ? 'rgba(255,255,255,0.10)' : '#E5E7EB',
    color:           colors.text,
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Build Invoice</Text>
          <Text style={[styles.bookingTag, { backgroundColor: `${colors.primary}20`, color: colors.primary }]}>#{bookingId}</Text>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 160 }}>

            {/* Labour — READ ONLY */}
            <Section icon="schedule" title="Labour Cost (Auto-calculated)" colors={colors} glass={glass}>
              <View style={[styles.lockedRow, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}>
                <Icon name="lock" size={16} color={colors.primary} />
                <Text style={[styles.lockedText, { color: colors.primary }]}>
                  {msToHHMMSS(Number(session?.total_duration_ms || 0))} × {formatINR(hourlyRate)}/hr
                </Text>
                <Text style={[styles.lockedAmount, { color: colors.text }]}>{formatINR(labourCost)}</Text>
              </View>
              {minCharge > 0 && labourCost + materialCost < minCharge && (
                <View style={[styles.minChargeNote, { backgroundColor: '#F59E0B20' }]}>
                  <Icon name="info-outline" size={14} color="#F59E0B" />
                  <Text style={{ color: '#F59E0B', fontSize: 12, marginLeft: 6 }}>
                    Minimum charge {formatINR(minCharge)} will apply
                  </Text>
                </View>
              )}
            </Section>

            {/* Materials */}
            <Section icon="inventory-2" title="Materials" colors={colors} glass={glass}>
              {/* Header row */}
              <View style={styles.matHeader}>
                <Text style={[styles.matHeaderText, { color: colors.textSecondary, flex: 3 }]}>Item</Text>
                <Text style={[styles.matHeaderText, { color: colors.textSecondary, flex: 1.2, textAlign: 'center' }]}>Qty</Text>
                <Text style={[styles.matHeaderText, { color: colors.textSecondary, flex: 1.5, textAlign: 'right' }]}>Unit ₹</Text>
                <Text style={[styles.matHeaderText, { color: colors.textSecondary, flex: 1.5, textAlign: 'right' }]}>Total</Text>
                <View style={{ width: 28 }} />
              </View>

              {materials.map((item, idx) => {
                const rowTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unit_cost) || 0);
                return (
                  <View key={item.id} style={[styles.matRow, { borderBottomColor: colors.border }]}>
                    <TextInput
                      style={[styles.matInput, inputStyle, { flex: 3, borderRadius: 8, marginRight: 4 }]}
                      value={item.name}
                      onChangeText={v => updateMaterial(item.id, 'name', v)}
                      placeholder="Item name"
                      placeholderTextColor={colors.placeholder}
                    />
                    <TextInput
                      style={[styles.matInput, inputStyle, { flex: 1.2, borderRadius: 8, textAlign: 'center', marginRight: 4 }]}
                      value={item.qty}
                      onChangeText={v => updateMaterial(item.id, 'qty', v)}
                      keyboardType="decimal-pad"
                      placeholder="1"
                      placeholderTextColor={colors.placeholder}
                    />
                    <TextInput
                      style={[styles.matInput, inputStyle, { flex: 1.5, borderRadius: 8, textAlign: 'right', marginRight: 4 }]}
                      value={item.unit_cost}
                      onChangeText={v => updateMaterial(item.id, 'unit_cost', v)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.placeholder}
                    />
                    <Text style={[styles.matTotal, { color: colors.text, flex: 1.5 }]}>
                      {formatINR(rowTotal)}
                    </Text>
                    <TouchableOpacity onPress={() => removeMaterial(item.id)} style={styles.matRemove}>
                      <Icon name="remove-circle" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                );
              })}

              <TouchableOpacity style={[styles.addMaterialBtn, { borderColor: colors.primary }]} onPress={addMaterial}>
                <Icon name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.addMaterialText, { color: colors.primary }]}>Add Material</Text>
              </TouchableOpacity>
            </Section>

            {/* Optional Charges */}
            <Section icon="tune" title="Optional Charges" colors={colors} glass={glass}>
              {[
                { label: 'Travel Charge', val: travelCost, set: setTravelCost, placeholder: '0' },
                { label: 'Emergency Charge', val: emergencyCost, set: setEmergency, placeholder: '0' },
                { label: 'Other Charge', val: otherCost, set: setOtherCost, placeholder: '0' },
              ].map(f => (
                <View key={f.label} style={styles.chargeRow}>
                  <Text style={[styles.chargeLabel, { color: colors.textSecondary }]}>{f.label}</Text>
                  <View style={[styles.chargeInput, inputStyle, { borderWidth: 1, borderRadius: 10 }]}>
                    <Text style={[styles.prefix, { color: colors.textSecondary }]}>₹</Text>
                    <TextInput
                      style={[{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: 8 }]}
                      value={f.val}
                      onChangeText={f.set}
                      keyboardType="decimal-pad"
                      placeholder={f.placeholder}
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                </View>
              ))}
              {parseFloat(otherCost) > 0 && (
                <TextInput
                  style={[styles.notesInput, inputStyle, { borderWidth: 1, borderRadius: 10, color: colors.text, marginTop: 8 }]}
                  value={otherNote}
                  onChangeText={setOtherNote}
                  placeholder="Note for other charge..."
                  placeholderTextColor={colors.placeholder}
                  maxLength={300}
                />
              )}
            </Section>

            {/* Service Description */}
            <Section icon="description" title="Service Description *" colors={colors} glass={glass}>
              <TextInput
                style={[styles.descInput, inputStyle, { borderWidth: 1, borderRadius: 12, color: colors.text }]}
                value={description}
                onChangeText={v => { setDescription(v); if (descError) setDescError(''); }}
                placeholder="Describe the work completed in detail..."
                placeholderTextColor={colors.placeholder}
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                {descError ? <Text style={{ color: colors.error, fontSize: 12 }}>{descError}</Text> : <Text />}
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{description.length}/1000</Text>
              </View>
            </Section>

            {/* Notes */}
            <Section icon="notes" title="Notes (Optional)" colors={colors} glass={glass}>
              <TextInput
                style={[styles.notesInput, inputStyle, { borderWidth: 1, borderRadius: 12, color: colors.text }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional notes for the homeowner..."
                placeholderTextColor={colors.placeholder}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
            </Section>

            {/* Live Invoice Summary */}
            <View style={[styles.summaryCard, glass]}>
              <Text style={[styles.summaryTitle, { color: colors.text }]}>📊 Live Invoice Summary</Text>
              {[
                { label: 'Labour Cost',    val: labourCost },
                { label: 'Material Cost',  val: materialCost },
                ...(travel    > 0 ? [{ label: 'Travel',    val: travel }]    : []),
                ...(emergency > 0 ? [{ label: 'Emergency', val: emergency }] : []),
                ...(other     > 0 ? [{ label: 'Other',     val: other }]     : []),
              ].map(r => (
                <View key={r.label} style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{r.label}</Text>
                  <Text style={[styles.summaryVal, { color: colors.text }]}>{formatINR(r.val)}</Text>
                </View>
              ))}
              {minCharge > 0 && subtotal < minCharge && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: '#F59E0B' }]}>Min. Service Charge</Text>
                  <Text style={[styles.summaryVal, { color: '#F59E0B' }]}>Applied</Text>
                </View>
              )}
              <View style={[styles.totalDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <Text style={[styles.grandLabel, { color: colors.text }]}>GRAND TOTAL</Text>
                <Text style={[styles.grandVal, { color: colors.primary }]}>{formatINRExact(grandTotal)}</Text>
              </View>
            </View>

            {/* Preview Button */}
            <TouchableOpacity style={[styles.previewBtn, { backgroundColor: colors.primary }]} onPress={handlePreview}>
              <Icon name="visibility" size={22} color="#fff" />
              <Text style={styles.previewBtnText}>Preview Invoice</Text>
              <Icon name="chevron-right" size={22} color="#fff" />
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800', flex: 1, marginLeft: 8 },
  bookingTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, fontWeight: '700', fontSize: 13 },
  card: { borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  lockedRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, gap: 8 },
  lockedText: { flex: 1, fontWeight: '600', fontSize: 13 },
  lockedAmount: { fontWeight: '900', fontSize: 18 },
  minChargeNote: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8, marginTop: 8 },
  matHeader: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)', marginBottom: 4 },
  matHeaderText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  matRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  matInput: { height: 38, paddingHorizontal: 8, fontSize: 13, borderWidth: 1 },
  matTotal: { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  matRemove: { width: 28, alignItems: 'center' },
  addMaterialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 10, marginTop: 10 },
  addMaterialText: { fontWeight: '700' },
  chargeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  chargeLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  chargeInput: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, width: 120 },
  prefix: { fontSize: 15, fontWeight: '700', marginRight: 4 },
  notesInput: { padding: 12, fontSize: 14, minHeight: 60 },
  descInput: { padding: 12, fontSize: 14, minHeight: 100 },
  summaryCard: { borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  summaryTitle: { fontSize: 15, fontWeight: '800', marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 14 },
  summaryVal: { fontSize: 14, fontWeight: '700' },
  totalDivider: { height: 1.5, marginVertical: 10 },
  grandLabel: { fontSize: 17, fontWeight: '900' },
  grandVal: { fontSize: 20, fontWeight: '900' },
  previewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 58, borderRadius: 18, gap: 10, marginBottom: 20, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  previewBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
