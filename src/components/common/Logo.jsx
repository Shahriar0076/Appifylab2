import { getImageUrl } from '../../utils/getImageUrl';

export function Logo({ className, logoFile = 'logo.svg', linkTo }) {
  const img = <img src={getImageUrl(logoFile)} alt="Logo" className={className || '_left_logo'} />;
  if (linkTo) {
    return <a href={linkTo}>{img}</a>;
  }
  return img;
}
