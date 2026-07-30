import { useRef, useState } from 'react';
import { Avatar } from '../common/Avatar';
import { PrivacyToggle } from './PrivacyToggle';
import { PhotoIcon, PostSendIcon, PublicIcon, PrivateIcon } from '../icons';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { validateImageFile } from '../../utils/imageValidation';
import { resizeImageToJpeg } from '../../utils/resizeImageToJpeg';

export function PostComposer({ currentUser, uiText, onPost }) {
  const [content, setContent] = useState('');
  const [privacy, setPrivacy] = useState('public');
  const [imageBlob, setImageBlob] = useState(null);
  const [imageError, setImageError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { objectUrl: previewUrl, setBlob: setPreviewBlob, clearObjectUrl: clearPreview } = useObjectUrl();
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    setImageError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setImageError(validation.error);
      e.target.value = '';
      return;
    }

    setIsProcessing(true);
    try {
      const resizedBlob = await resizeImageToJpeg(file);
      setImageBlob(resizedBlob);
      setPreviewBlob(resizedBlob);
    } catch (err) {
      setImageError(err.message || 'Failed to process image.');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = () => {
    setImageBlob(null);
    clearPreview();
    setImageError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const hasContent = content.trim();
    const hasImage = !!imageBlob;

    if (!hasContent && !hasImage) return;

    onPost?.({ content, privacy, imageBlob: hasImage ? imageBlob : null });

    setContent('');
    handleRemoveImage();
  };

  return (
    <div className="_feed_inner_text_area _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16">
      <div className="_feed_inner_text_area_box">
        <div className="_feed_inner_text_area_box_image">
          <Avatar
            name={currentUser?.name}
            initials={currentUser?.initials}
            background={currentUser?.avatarColor}
            className="_txt_img"
          />
        </div>
        <div className="form-floating _feed_inner_text_area_box_form">
          <textarea
            className="form-control _textarea"
            placeholder={uiText?.composerPlaceholder || 'Write something...'}
            id="floatingTextarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <label className="_feed_textarea_label" htmlFor="floatingTextarea">
            {uiText?.composerPlaceholder || 'Write something ...'}
          </label>
        </div>
      </div>

      {previewUrl && (
        <div className="_feed_composer_preview">
          <img
            src={previewUrl}
            alt="Upload preview"
            className="_time_img _feed_composer_preview_img"
          />
          <button
            type="button"
            className="_feed_composer_remove_btn"
            onClick={handleRemoveImage}
            title="Remove image"
            aria-label="Remove image"
          >
            &times;
          </button>
        </div>
      )}

      {imageError && (
        <p className="_post_composer_err_msg">
          {imageError}
        </p>
      )}

      <div className="_feed_inner_text_area_bottom">
        <div className="_feed_inner_text_area_item">
          <div className="_feed_inner_text_area_bottom_photo _feed_common">
            <button
              type="button"
              className="_feed_inner_text_area_bottom_photo_link"
              id="_image_upload_btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                <PhotoIcon />
              </span>
              {isProcessing ? 'Processing...' : (uiText?.photoButton || 'Photo')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="_hidden_input"
              onChange={handleFileSelect}
            />
          </div>
          <div className="_feed_inner_text_area_bottom_event _feed_common">
            <PrivacyToggle
              value={privacy}
              onChange={setPrivacy}
              options={uiText?.privacyOptions || [
                { value: 'public', label: 'Public' },
                { value: 'private', label: 'Private' }
              ]}
            />
          </div>
        </div>
        <div className="_feed_inner_text_area_btn">
          <button
            type="button"
            className="_feed_inner_text_area_btn_link"
            onClick={handleSubmit}
            disabled={isProcessing}
          >
            <PostSendIcon className="_mar_img" /> <span>{uiText?.postButton || 'Post'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="_feed_inner_text_area_bottom_mobile">
        <div className="_feed_inner_text_mobile">
          <div className="_feed_inner_text_area_bottom_photo _feed_common">
            <button
              type="button"
              className="_feed_inner_text_area_bottom_photo_link"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              aria-label={uiText?.photoButton || 'Photo'}
            >
              <span className="_feed_inner_text_area_bottom_photo_iamge">
                <PhotoIcon />
              </span>
            </button>
          </div>
          <div className="_feed_inner_text_area_bottom_event">
            <button
              type="button"
              className="_feed_mobile_privacy_btn"
              onClick={() => setPrivacy((p) => (p === 'public' ? 'private' : 'public'))}
              aria-label={privacy === 'public' ? 'Set post to private' : 'Set post to public'}
            >
              {privacy === 'public' ? <PublicIcon width={14} height={14} /> : <PrivateIcon width={14} height={14} />}
              <span>{privacy === 'public' ? 'Public' : 'Private'}</span>
            </button>
          </div>
          <div className="_feed_inner_text_area_btn">
            <button
              type="button"
              className="_feed_inner_text_area_btn_link"
              onClick={handleSubmit}
              disabled={isProcessing}
            >
              <PostSendIcon className="_mar_img" /> <span>{uiText?.postButton || 'Post'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
