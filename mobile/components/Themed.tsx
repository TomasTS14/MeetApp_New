/**
 * Learn more about Light and Dark modes:
 * https://docs.expo.io/guides/color-schemes/
 */
import {
  StyleSheet,
  Text as DefaultText,
  View as DefaultView,
  type TextProps as DefaultTextProps,
  type ViewProps as DefaultViewProps,
} from 'react-native';

import { useColorScheme } from './useColorScheme';

import Colors from '@/constants/Colors';
import { useSettings } from '@/lib/settings';

// React Native's default text size, used when a style does not set one.
const DEFAULT_FONT_SIZE = 14;

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultTextProps;
export type ViewProps = ThemeProps & DefaultViewProps;

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme();
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}

// Text in the theme's colour, scaled by the text size chosen in Settings.
export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const { fontScale } = useSettings();
  const flat = StyleSheet.flatten(style) ?? {};
  const scaled =
    fontScale === 1
      ? null
      : {
          fontSize: (flat.fontSize ?? DEFAULT_FONT_SIZE) * fontScale,
          ...(flat.lineHeight ? { lineHeight: flat.lineHeight * fontScale } : null),
        };

  return <DefaultText style={[{ color }, style, scaled]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
