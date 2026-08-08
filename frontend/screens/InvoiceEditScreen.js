import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, SafeAreaView, Animated, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import api from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINR, formatINRExact } from '../utils/currency';

let _itemId = 100;
const newItem = () => ({ id: ++_itemId, name: '', qty: '1', unit_cost: '' });

// Defined outside to prevent focus loss on re-render
const FieldInput = ({ label, field, placeholder, keyboardType = 'default', prefix, form, setForm, colors, inputStyle }) => (
  <View style={styles.fieldGroup}>
    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
    <View style={[styles.inputRow, inputStyle, { borderWidth: 1, borderRadius: 12 }]}>
      {!!prefix && <Text style={[styles.prefix, { color: colors.textSecondary }]}>{prefix}</Text>}
      <TextInput
        style={[styles.input, { color: colors.text, flex: 1 }]}
        value={form[field]}
        onChangeText={v => setForm(f => ({ ...f, [field]: v }))}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType={keyboardType}
      />
    </View>
  </View>
);

export default function InvoiceEditScreen({ route, navigation }) {
  const { invoiceId } = route.params || {};
  const { colors, isDarkMode } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [invoice, setInvoice]   = useState(null);
  const [materials, setMaterials] = useState([newItem()]);
  const [form, setForm] = useState({
    travel_cost: '',
    emergency_cost: '',
    other_cost: '',
    other_cost_note: '',
    service_description: '',
    notes: '',
  });

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    fetchInvoice();
  }, []);

  const fetchInvoice = async () => {
    try {
      const res = await api.get(`/invoice/${invoiceId}`);
      if (res.data.success) {
        const inv = res.data.data.invoice;
        setInvoice(inv);
        setForm({
          travel_cost:         String(inv.travel_cost      || ''),
          emergency_cost:      String(inv.emergency_cost   || ''),
          other_cost:          String(inv.other_cost       || ''),
          other_cost_note:     inv.other_cost_note         || '',
          service_description: inv.service_description     || '',
          notes:               inv.notes                   || '',
        });
        if (inv.material_items?.length) {
          setMaterials(inv.material_items.map(m => ({ id: ++_itemId, name: m.name, qty: String(m.qty), unit_cost: String(m.unit_cost) })));
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const updateMaterial = (id, field, val) =>
    setMaterials(m => m.map(i => i.id === id ? { ...i, [field]: val } : i));

  const addMaterial    = () => setMaterials(m => [...m, newItem()]);
  const removeMaterial = (id) => setMaterials(m => m.filter(i => i.id !== id));

  const handleSave = async () => {
    if (form.service_description.trim().length < 20) {
      Alert.alert('Validation', 'Service description must be at least 20 characters');
      return;
    }
    setSaving(true);
    try {
      const validMaterials = materials
        .filter(i => i.name.trim() && parseFloat(i.unit_cost) >= 0)
        .map(i => ({ name: i.name.trim(), qty: parseFloat(i.qty) || 1, unit_cost: parseFloat(i.unit_cost) || 0 }));

      const payload = {
        material_items:      validMaterials,
        travel_cost:         parseFloat(form.travel_cost)    || 0,
        emergency_cost:      parseFloat(form.emergency_cost) || 0,
        other_cost:          parseFloat(form.other_cost)     || 0,
        other_cost_note:     form.other_cost_note,
        service_description: form.service_description.trim(),
        notes:               form.notes.trim(),
      };
      const res = await api.put(`/invoice/${invoiceId}`, payload);
      if (res.data.success) {
        Alert.alert('✅ Saved', 'Invoice updated successfully.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  const glass = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
    borderColor:     isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  const inputStyle = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F5F7FA',
    borderColor:     isDarkMode ? 'rgba(255,255,255,0.10)' : '#E5E7EB',
    color:           colors.text,
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#101415' : '#fff' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#101415' : '#FFFFFF' }}>
      <PremiumBackground />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Invoice #{invoiceId}</Text>
          <View style={{ width: 40 }} />
        </Animated.View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
            <Animated.View style={{ opacity: fadeAnim }}>

              {/* Materials Section */}
              <View style={[styles.card, glass]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>📦 Materials</Text>
                <View style={styles.matHeader}>
                  <Text style={[styles.matHeaderText, { color: colors.textSecondary, flex: 3 }]}>Item</Text>
                  <Text style={[styles.matHeaderText, { color: colors.textSecondary, flex: 1.2, textAlign: 'center' }]}>Qty</Text>
                  <Text style={[styles.matHeaderText, { color: colors.textSecondary, flex: 1.5, textAlign: 'right' }]}>Unit ₹</Text>
                  <Text style={[styles.matHeaderText, { color: colors.textSecondary, flex: 1.5, textAlign: 'right' }]}>Total</Text>
                  <View style={{ width: 28 }} />
                </View>

                {materials.map(item => {
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
                      <Text style={[styles.matTotal, { color: colors.text, flex: 1.5 }]}>{formatINR(rowTotal)}</Text>
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
              </View>

              {/* Optional Charges */}
              <View style={[styles.card, glass]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>💰 Optional Charges</Text>
                <FieldInput label="Travel Charge" field="travel_cost" placeholder="0" keyboardType="decimal-pad" prefix="₹" form={form} setForm={setForm} colors={colors} inputStyle={inputStyle} />
                <FieldInput label="Emergency Charge" field="emergency_cost" placeholder="0" keyboardType="decimal-pad" prefix="₹" form={form} setForm={setForm} colors={colors} inputStyle={inputStyle} />
                <FieldInput label="Other Charge" field="other_cost" placeholder="0" keyboardType="decimal-pad" prefix="₹" form={form} setForm={setForm} colors={colors} inputStyle={inputStyle} />
                {parseFloat(form.other_cost) > 0 && (
                  <FieldInput label="Note for Other Charge" field="other_cost_note" placeholder="Describe other charge..." form={form} setForm={setForm} colors={colors} inputStyle={inputStyle} />
                )}
              </View>

              {/* Service Description */}
              <View style={[styles.card, glass]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>📝 Service Description *</Text>
                <TextInput
                  style={[styles.textarea, inputStyle, { borderWidth: 1, borderRadius: 12, color: colors.text }]}
                  value={form.service_description}
                  onChangeText={v => setForm(f => ({ ...f, service_description: v }))}
                  placeholder="Describe the work completed in detail..."
                  placeholderTextColor={colors.placeholder}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                />
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4, textAlign: 'right' }}>
                  {form.service_description.length}/1000
                </Text>
              </View>

              {/* Notes */}
              <View style={[styles.card, glass]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>🗒 Notes (Optional)</Text>
                <TextInput
                  style={[styles.textarea, inputStyle, { borderWidth: 1, borderRadius: 12, color: colors.text }]}
                  value={form.notes}
                  onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                  placeholder="Any additional notes..."
                  placeholderTextColor={colors.placeholder}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                />
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.error }]}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.error }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: saving ? colors.textSecondary : colors.primary }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="save" size={18} color="#fff" />
                      <Text style={styles.saveBtnText}>Save Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, marginLeft: 8 },
  card: { borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 14 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  prefix: { fontSize: 16, fontWeight: '700', marginRight: 4 },
  input: { height: 46, fontSize: 15 },
  textarea: { padding: 12, fontSize: 14, minHeight: 90 },
  matHeader: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)', marginBottom: 4 },
  matHeaderText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  matRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  matInput: { height: 38, paddingHorizontal: 8, fontSize: 13, borderWidth: 1 },
  matTotal: { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  matRemove: { width: 28, alignItems: 'center' },
  addMaterialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 10, marginTop: 10 },
  addMaterialText: { fontWeight: '700' },
  cancelBtn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontWeight: '700', fontSize: 15 },
  saveBtn: { flex: 2, height: 48, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
