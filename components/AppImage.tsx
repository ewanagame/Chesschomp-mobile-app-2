import { Image, type ImageProps } from 'react-native';

/**
 * Local packed images without Android's default 300ms fade.
 * `resize` decodes at the view size so 512px bot art is not decoded full-res.
 */
export default function AppImage({
  fadeDuration = 0,
  resizeMethod = 'resize',
  ...props
}: ImageProps) {
  return <Image fadeDuration={fadeDuration} resizeMethod={resizeMethod} {...props} />;
}
