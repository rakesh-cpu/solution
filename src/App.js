import React from 'react';
import { useState } from 'react';
import { Routes, Route, Link ,useNavigate } from 'react-router-dom';
import { Layout, Typography, Space } from 'antd';
import  Navbar  from './components/Navbar';
import  Home  from './components/Home';
import Login from './components/Login/Login';
import Signup from './components/Signup/Signup';
import Profile from './components/Profile';


import './App.css';

const user = localStorage.getItem("token");

function App() {

  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(!!user); 

  const handleLogout = () => {
    
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    navigate('/signin'); 
  };
  return (
    <div className="app">
      <div className="navbar">
      <Navbar isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      </div>
      {/* {user && <Route path="/" element={<Homepage />} />} */}
      <div className="main">
        <Layout>
          <div className="routes">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/profile" element={<Profile/>}/>
              <Route path="/signin" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Routes>
          </div>
        </Layout>

       
      </div>
    </div>
  );
}

export default App;
