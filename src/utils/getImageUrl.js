const imageModules = import.meta.glob('../assets/images/*', {
  eager: true,
  import: 'default'
});

export function getImageUrl(fileName) {
  if (!fileName) return '';
  const imagePath = `../assets/images/${fileName}`;
  return imageModules[imagePath] || '';
}
