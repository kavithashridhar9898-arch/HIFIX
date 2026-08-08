import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Animated, ActivityIndicator, SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import PremiumBackground from '../components/PremiumBackground';
import { formatINR } from '../utils/currency';

const SERVICE_TYPES = [
  { label: 'Painter',      value: 'painter',      icon: 'format-paint' },
  { label: 'Electrician',  value: 'electrician',  icon: 'bolt' },
  { label: 'Plumber',      value: 'plumber',      icon: 'plumbing' },
  { label: 'Carpenter',    value: 'carpenter',    icon: 'handyman' },
  { label: 'Handyman',     value: 'handyman',     icon: 'build' },
  { label: 'HVAC',         value: 'hvac',         icon: 'ac-unit' },
  { label: 'Other',        value: 'other',        icon: 'home-repair-service' },
];

const InfoRow = ({ icon, label, value, colors }) => (
  <View style={styles.infoRow}>
    <Icon name={icon} size={20} color={colors.primary} />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value || '—'}</Text>
    </View>
  </View>
);

const ServiceTypePicker = ({ form, setForm, colors }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Service Type</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
      {SERVICE_TYPES.map(s => (
        <TouchableOpacity
          key={s.value}
          onPress={() => setForm(f => ({ ...f, service_type: s.value }))}
          style={[
            styles.serviceChip,
            form.service_type === s.value && { backgroundColor: colors.primary, borderColor: colors.primary },
            form.service_type !== s.value && { borderColor: colors.border },
          ]}
        >
          <Icon name={s.icon} size={16} color={form.service_type === s.value ? '#fff' : colors.textSecondary} />
          <Text style={{ color: form.service_type === s.value ? '#fff' : colors.textSecondary, fontSize: 12, marginLeft: 4, fontWeight: '600' }}>
            {s.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

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

export default function ProfessionalDetailsScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);

  // Form state
  const [form, setForm] = useState({
    service_type: '',
    experience_years: '',
    hourly_rate: '',
    min_charge: '',
    travel_charge_per_km: '',
    emergency_charge: '',
    working_hours: '',
    service_radius: '',
    bio: '',
    skills: '',
  });

  useEffect(() => {
    loadProfile();
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await api.get('/worker-profile/me');
      if (res.data.success) {
        const p = res.data.data.workerProfile;
        setProfile(p);
        setForm({
          service_type:         p.service_type         || '',
          experience_years:     String(p.experience_years ?? ''),
          hourly_rate:          String(p.hourly_rate    ?? ''),
          min_charge:           String(p.min_charge     ?? ''),
          travel_charge_per_km: String(p.travel_charge_per_km ?? ''),
          emergency_charge:     String(p.emergency_charge     ?? ''),
          working_hours:        p.working_hours         || '9am - 6pm',
          service_radius:       String(p.service_radius ?? '10'),
          bio:                  p.bio                   || '',
          skills:               p.skills                || '',
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load professional details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.hourly_rate || parseFloat(form.hourly_rate) < 1) {
      Alert.alert('Validation', 'Hourly rate must be at least ₹1');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        service_type:         form.service_type,
        experience_years:     parseInt(form.experience_years)      || 0,
        hourly_rate:          parseFloat(form.hourly_rate)         || 0,
        min_charge:           parseFloat(form.min_charge)          || 0,
        travel_charge_per_km: form.travel_charge_per_km ? parseFloat(form.travel_charge_per_km) : null,
        emergency_charge:     form.emergency_charge      ? parseFloat(form.emergency_charge)     : null,
        working_hours:        form.working_hours,
        service_radius:       parseInt(form.service_radius)        || 10,
        bio:                  form.bio,
        skills:               form.skills,
      };
      const res = await api.put('/worker-profile/professional', payload);
      if (res.data.success) {
        setProfile(res.data.data.workerProfile);
        setEditing(false);
        Alert.alert('✅ Saved', 'Professional details updated successfully!');
      }
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const glass = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
    borderColor:     isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  };

  const inputStyle = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F5F7FA',
    borderColor:     isDarkMode ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
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
        <Animated.View style={[styles.headerBar, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Professional Details</Text>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)} style={[styles.editBtn, { backgroundColor: colors.primary }]}>
              <Icon name="edit" size={16} color="#fff" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          {editing && <View style={{ width: 60 }} />}
        </Animated.View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* View Mode */}
            {!editing && profile && (
              <View style={[styles.card, glass]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  <Icon name="badge" size={18} color={colors.primary} /> {'  '}Professional Details
                </Text>

                <InfoRow icon="home-repair-service" label="Profession"       value={profile.service_type?.replace(/_/g,' ').toUpperCase()} colors={colors} />
                <InfoRow icon="work-history"        label="Experience"        value={`${profile.experience_years ?? 0} years`} colors={colors} />
                <InfoRow icon="circle"              label="Availability"      value={profile.availability_status?.toUpperCase()} colors={colors} />
                <InfoRow icon="my-location"         label="Service Radius"    value={`${profile.service_radius ?? 10} km`} colors={colors} />
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <InfoRow icon="payments"            label="Hourly Rate"       value={formatINR(profile.hourly_rate) + '/hr'} colors={colors} />
                <InfoRow icon="price-check"         label="Minimum Charge"    value={formatINR(profile.min_charge)} colors={colors} />
                <InfoRow icon="directions-car"      label="Travel Charge/KM"  value={profile.travel_charge_per_km ? formatINR(profile.travel_charge_per_km) + '/km' : 'Not set'} colors={colors} />
                <InfoRow icon="emergency"           label="Emergency Charge"  value={profile.emergency_charge ? formatINR(profile.emergency_charge) : 'Not set'} colors={colors} />
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <InfoRow icon="schedule"            label="Working Hours"     value={profile.working_hours || '9am - 6pm'} colors={colors} />
              </View>
            )}

            {/* Edit Mode */}
            {editing && (
              <View style={[styles.card, glass]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Edit Professional Details</Text>

                <ServiceTypePicker form={form} setForm={setForm} colors={colors} />

                <FieldInput label="Experience (years)" field="experience_years" placeholder="e.g. 5" keyboardType="numeric" form={form} setForm={setForm} colors={colors} inputStyle={inputStyle} />

                <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 16 }]} />
                <Text style={[styles.subsectionTitle, { color: colors.text }]}>💰 Rates & Charges</Text>

                <FieldInput label="Hourly Rate *" field="hourly_rate" placeholder="e.g. 500" keyboardType="decimal-pad" prefix="₹" form={form} setForm={setForm} colors={colors} inputStyle={inputStyle} />
                <FieldInput label="Minimum Service Charge" field="min_charge" placeholder="e.g. 300" keyboardType="decimal-pad" prefix="₹" form={form} setForm={setForm} colors={colors} inputStyle={inputStyle} />
                <FieldInput label="Travel Charge per KM (optional)" field="travel_charge_per_km" placeholder="e.g. 15" keyboardType="decimal-pad" prefix="₹" form={form} setForm={setForm} colors={colors} inputStyle={inputStyle} />
                <FieldInput label="Emergency Service Charge (optional)" field="emergency_charge" placeholder="e.g. 250" keyboardType="decimal-pad" prefix="₹" form={form} setForm={setForm} colors={colors} inputStyle={inputStyle} />

                <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 16 }]} />
                <Text style={[styles.subsectionTitle, { color: colors.text }]}>⏰ Schedule</Text>

                <FieldInput label="Working Hours" field="working_hours" placeholder="e.g. 9am - 6pm" form={form} setForm={setForm} colors={colors} inputStyle={inputStyle} />
                <FieldInput label="Service Radius (km)" field="service_radius" placeholder="e.g. 10" keyboardType="numeric" form={form} setForm={setForm} colors={colors} inputStyle={inputStyle} />

                <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 16 }]} />
                <Text style={[styles.subsectionTitle, { color: colors.text }]}>📝 About</Text>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bio</Text>
                  <TextInput
                    style={[styles.textarea, inputStyle, { borderWidth: 1, borderRadius: 12, color: colors.text }]}
                    value={form.bio}
                    onChangeText={v => setForm(f => ({ ...f, bio: v }))}
                    placeholder="Describe your expertise..."
                    placeholderTextColor={colors.placeholder}
                    multiline numberOfLines={3}
                    maxLength={1000}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Skills (comma-separated)</Text>
                  <TextInput
                    style={[styles.input, inputStyle, { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }]}
                    value={form.skills}
                    onChangeText={v => setForm(f => ({ ...f, skills: v }))}
                    placeholder="e.g. Wiring, Repairs, Installations"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: colors.error }]}
                    onPress={() => { setEditing(false); loadProfile(); }}
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
                        <Text style={styles.saveBtnText}>Save</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '700', flex: 1, marginLeft: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  editBtnText: { color: '#fff', fontWeight: '700', marginLeft: 4, fontSize: 13 },
  card: { borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 18 },
  subsectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)' },
  infoLabel: { fontSize: 12, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '600' },
  divider: { height: 1, marginVertical: 8 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  prefix: { fontSize: 16, fontWeight: '700', marginRight: 4 },
  input: { height: 46, fontSize: 15, paddingHorizontal: 0, paddingVertical: 0 },
  textarea: { padding: 12, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  serviceChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontWeight: '700', fontSize: 15 },
  saveBtn: { flex: 2, height: 48, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
