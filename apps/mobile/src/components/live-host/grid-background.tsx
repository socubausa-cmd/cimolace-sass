import { StyleSheet } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

/**
 * Fond TABLEAU à carreaux — surface immersive partagée HÔTE ↔ ÉLÈVE.
 *
 * Navy sombre (#0a0b0f) + quadrillage fin (lignes blanches très translucides
 * tous les 44px), façon surface de tableau / papier millimétré. Aligné sur le
 * compositeur smartboard web (SmartBoardCompositor). Le smartboard immersif
 * (transparent) se pose dessus → effet « contenu écrit sur le tableau ».
 */
export default function GridBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <Pattern id="sbgrid" width={44} height={44} patternUnits="userSpaceOnUse">
          <Path d="M44 0 H0 V44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="#0a0b0f" />
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#sbgrid)" />
    </Svg>
  );
}
