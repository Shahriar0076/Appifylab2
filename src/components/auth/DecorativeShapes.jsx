import { getImageUrl } from '../../utils/getImageUrl';

export function DecorativeShapes() {
  return (
    <>
      <div className="_shape_one">
        <img src={getImageUrl('shape1.svg')} alt="" className="_shape_img" decoding="async" />
      </div>
      <div className="_shape_two">
        <img src={getImageUrl('shape2.svg')} alt="" className="_shape_img" decoding="async" />
      </div>
      <div className="_shape_three">
        <img src={getImageUrl('shape3.svg')} alt="" className="_shape_img" decoding="async" />
      </div>
    </>
  );
}
