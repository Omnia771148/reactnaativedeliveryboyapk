import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function BrandHeader() {
  return (
    <View style={styles.headerBar}>
      <View style={styles.headerCircle}>
        <Image
          source={require('@/assets/images/logo-L.png')}
          style={styles.headerLogo}
          contentFit="contain"
        />
      </View>
      <View style={styles.headerTitleContainer}>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.headerTitle}>
          LEEVON DELIVERY
        </Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCD5C7', // Sand/Beige header bar background
    height: 54,
    borderRadius: 27,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  headerCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogo: {
    width: 24,
    height: 24,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#2A3037',
    letterSpacing: 2,
    paddingHorizontal: 8,
  },
  headerSpacer: {
    width: 36,
  },
});
