import { getImageUrl } from '../../utils/getImageUrl';

export function AuthHero({ heroImage, leftClass, leftImageClass }) {
  return (
    <div className={leftClass || '_social_login_left'}>
      <div className={leftImageClass || '_social_login_left_image'}>
        <img
          src={getImageUrl(heroImage)}
          alt=""
          className="_left_img"
          decoding="async"
        />
      </div>
    </div>
  );
}
