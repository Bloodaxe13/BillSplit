import { Pressable, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { Colors } from '../../constants/colors';

interface ClaimCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function ClaimCheckbox({ checked, onToggle, disabled }: ClaimCheckboxProps) {
  const progress = useRef(new Animated.Value(checked ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: checked ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [checked, progress]);

  const circleStyle = {
    backgroundColor: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [Colors.transparent, Colors.accent],
    }),
    borderColor: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [Colors.surfaceTertiary, Colors.accent],
    }),
    transform: [{ scale }],
  };

  const checkStyle = {
    opacity: progress,
    transform: [{ scale: progress }],
  };

  const handlePress = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.85,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
    onToggle();
  };

  return (
    <Animated.View style={[styles.circle, circleStyle]}>
      <Pressable
        onPress={handlePress}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        style={styles.pressArea}
      >
        <Animated.Text style={[styles.checkmark, checkStyle]}>
          {'\u2713'}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressArea: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textInverse,
  },
});
