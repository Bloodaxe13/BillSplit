import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Colors } from '../../constants/colors';

interface ClaimCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ClaimCheckbox({ checked, onToggle, disabled }: ClaimCheckboxProps) {
  const progress = useSharedValue(checked ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(checked ? 1 : 0, { duration: 200 });
  }, [checked, progress]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['transparent', Colors.accent]
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [Colors.border, Colors.accent]
    ),
    transform: [{ scale: scale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: progress.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.checkbox, boxStyle]}
      onPress={() => {
        if (disabled) return;
        scale.value = withSpring(0.85, { damping: 15 }, () => {
          scale.value = withSpring(1, { damping: 12 });
        });
        onToggle();
      }}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
    >
      <Animated.Text style={[styles.checkmark, checkStyle]}>
        {'\u2713'}
      </Animated.Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textInverse,
  },
});
