import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Linking,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

export default function HelpScreen({ navigation }) {
  const helpItems = [
    {
      icon: 'phone',
      title: 'Contact Support',
      description: 'Get in touch with our support team',
      action: () => Linking.openURL('tel:+917019801479'),
    },
    {
      icon: 'email',
      title: 'Email Us',
      description: 'Send us an email for detailed queries',
      action: () => Linking.openURL('mailto:support@hifix.com'),
    },
    {
      icon: 'forum',
      title: 'FAQ',
      description: 'Find answers to common questions',
      action: () => {},
    },
    {
      icon: 'chat',
      title: 'Live Chat',
      description: 'Chat with our support team',
      action: () => {},
    },
    {
      icon: 'description',
      title: 'Terms of Service',
      description: 'Read our terms and conditions',
      action: () => {},
    },
    {
      icon: 'policy',
      title: 'Privacy Policy',
      description: 'Learn about our privacy practices',
      action: () => {},
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <Icon name="help-outline" size={60} color="#4285F4" />
          <Text style={styles.bannerTitle}>How can we help you?</Text>
          <Text style={styles.bannerSubtitle}>
            We're here to assist you with any questions or concerns
          </Text>
        </View>

        <View style={styles.section}>
          {helpItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.helpItem}
              onPress={item.action}
            >
              <View style={styles.iconContainer}>
                <Icon name={item.icon} size={28} color="#4285F4" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDescription}>{item.description}</Text>
              </View>
              <Icon name="chevron-right" size={24} color="#555" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>HIFIX - Your Home Service Partner</Text>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 15,
  },
  content: {
    flex: 1,
  },
  banner: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#1E1E1E',
    margin: 15,
    borderRadius: 15,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 8,
  },
  section: {
    margin: 15,
    backgroundColor: '#1E1E1E',
    borderRadius: 15,
    overflow: 'hidden',
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 15,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  itemDescription: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 4,
  },
  footer: {
    alignItems: 'center',
    padding: 30,
  },
  footerText: {
    fontSize: 14,
    color: '#aaa',
  },
  versionText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
});
