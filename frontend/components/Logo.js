import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const Logo = ({ size = 150, style }) => {
  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('../assets/logo.png')}
        style={[styles.logo, { width: size, height: size }]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 150,
    height: 150,
  },
});

export default Logo;

