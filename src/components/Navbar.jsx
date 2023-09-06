import React, { useState, useEffect } from "react";
import { Button, Menu, Typography } from "antd";
import { Link } from "react-router-dom";
import {
  MenuOutlined,
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";


const Navbar = ({ isLoggedIn, onLogout }) => {
  const [activeMenu, setActiveMenu] = useState(true);
  const [screenSize, setScreenSize] = useState(undefined);

  useEffect(() => {
    const handleResize = () => setScreenSize(window.innerWidth);

    window.addEventListener("resize", handleResize);

    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (screenSize <= 800) {
      setActiveMenu(false);
    } else {
      setActiveMenu(true);
    }
  }, [screenSize]);
  const user = localStorage.getItem("token");
  return (
    <div className="nav-container">
      <div className="logo-container">
        <Typography.Title level={2} className="logo">
          <Link to="/">App</Link>
        </Typography.Title>
        <Button
          className="menu-control-container"
          onClick={() => setActiveMenu(!activeMenu)}
        >
          <MenuOutlined />
        </Button>
      </div>
      {activeMenu && (
        <Menu theme="dark">
          {user ? (
            <Menu.Item icon={<UserOutlined />}>
              <Link to="/profile">Profile</Link>
            </Menu.Item>
          ) : (
            <Menu.Item icon={<LogoutOutlined />}>
              <Link to="/signin">LogIn</Link>
            </Menu.Item>
          )}
          {isLoggedIn && (
            <Menu.Item icon={<LogoutOutlined />} onClick={onLogout}>
              Logout
            </Menu.Item>
          )}
        </Menu>
      )}
    </div>
  );
};
export default Navbar;
