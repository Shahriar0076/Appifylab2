import loginImage from '../assets/images/login.png';
import logo from '../assets/images/logo.svg';
import logoCopy from '../assets/images/logo-copy.svg';
import registrationImage from '../assets/images/registration.png';
import shape1 from '../assets/images/shape1.svg';
import shape2 from '../assets/images/shape2.svg';
import shape3 from '../assets/images/shape3.svg';
import timelineImage from '../assets/images/timeline_img.png';

const imageModules = {
  'login.png': loginImage,
  'logo.svg': logo,
  'logo-copy.svg': logoCopy,
  'registration.png': registrationImage,
  'shape1.svg': shape1,
  'shape2.svg': shape2,
  'shape3.svg': shape3,
  'timeline_img.png': timelineImage,
};

export function getImageUrl(fileName) {
  if (!fileName) return '';
  return imageModules[fileName] || '';
}
