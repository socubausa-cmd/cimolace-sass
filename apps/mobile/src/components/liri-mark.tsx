import { Image, type StyleProp, type ImageStyle } from 'react-native';

/**
 * La marque LIRI officielle (les deux « r » dorés), rendue partout par CE
 * composant — pendant natif du `LiriWordmark` du web : changer la marque ici
 * la change dans toute l'app.
 *
 * Elle remplace l'ancien carré coral à éclair, qui était une invention de l'app
 * mobile et ne correspondait à aucune charte.
 */
export function LiriMark({ size = 44, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={require('../../assets/images/liri-mark.png')}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="LIRI"
    />
  );
}
