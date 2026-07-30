import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../common/Logo';
import { Avatar } from '../common/Avatar';
import { LogoutIcon } from '../icons';
import { logoutUser } from '../../services/authService';
import { toast } from '../../utils/toast';

export function Header({ currentUser }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutUser();
      toast.success('Logged out successfully');
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
      toast.error('Logout failed. Please try again.');
    }
  };

  return (
    <nav className="navbar navbar-expand navbar-light _header_nav _padd_t10">
      <div className="container _custom_container">
        <div className="_logo_wrap">
          <Link className="navbar-brand" to="/feed">
            <Logo logoFile="logo.svg" className="_nav_logo" />
          </Link>
        </div>
        <div className="navbar-collapse" id="navbarSupportedContent">
          <ul className="navbar-nav mb-2 mb-lg-0 _header_nav_list ms-auto _mar_r8">
            <li className="nav-item _header_nav_item">
              <button
                className="nav-link _header_nav_link _header_logout_btn"
                onClick={handleLogout}
                title="Logout"
              >
                <LogoutIcon />
              </button>
            </li>
          </ul>
          <div className="_header_nav_profile">
            <div className="_header_nav_profile_image">
              <Avatar
                name={currentUser?.name}
                initials={currentUser?.initials}
                background={currentUser?.avatarColor}
                className="_nav_profile_img"
              />
            </div>
            <p className="_header_nav_para">{currentUser?.name || ''}</p>
          </div>
        </div>
      </div>
    </nav>
  );
}
