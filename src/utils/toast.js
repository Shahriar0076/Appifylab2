import { toast as notify } from 'react-toastify';

const whiteStyle = { backgroundColor: '#fff', color: '#333' };

export const toast = {
  success: (msg, opts = {}) => notify.success(msg, { style: whiteStyle, ...opts }),
  info: (msg, opts = {}) => notify.info(msg, { style: whiteStyle, ...opts }),
  warning: (msg, opts = {}) => notify.warning(msg, { style: whiteStyle, ...opts }),
  error: (msg) => notify.error(msg, { style: whiteStyle }),
  dismiss: (id) => notify.dismiss(id),
};
