import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

const { width, height } = Dimensions.get('window');

export function LoadingOverlay({ visible }) {
  const [spinValue] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [visible, spinValue]);

  if (!visible) return null;

  const spinRotation = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.overlayContainer}>
      <View style={styles.loaderWrapper}>
        {/* Outer Static Light Ring */}
        <View style={styles.staticRing} />

        {/* Outer Rotating Golden Ring Segment */}
        <Animated.View
          style={[
            styles.rotatingRing,
            { transform: [{ rotate: spinRotation }] },
          ]}
        />

        {/* Inner Black Circular Badge */}
        <View style={styles.logoBadge}>
          {/* Stylized Golden 'L' Logo Image */}
          <Image
            source={require('@/assets/images/logo-L.png')}
            style={styles.logoImage}
            contentFit="contain"
          />
        </View>
      </View>

      {/* Messages */}
      <Text style={styles.titleText}>Wait for a Second...</Text>
      <Text style={styles.subtitleText}>Everything is getting ready for you</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: width,
    height: height,
    backgroundColor: '#FAF9F6', // Off-white cream shade matching left background
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // Render on top of all other components
  },
  loaderWrapper: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  staticRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 4,
    borderColor: '#EFECE5', // Light cream ring base
    position: 'absolute',
  },
  rotatingRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: '#C4B295', // Golden beige accent color for spinner segment
    position: 'absolute',
  },
  logoBadge: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: '#000000', // Black inner badge
    justifyContent: 'center',
    alignItems: 'center',
    // Soft shadow around the black circle
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  logoImage: {
    width: 82,
    height: 82,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1510', // Dark warm brown/black
    marginTop: 26,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 16,
    color: '#8E8882', // Medium gray
    marginTop: 6,
    textAlign: 'center',
  },
});
