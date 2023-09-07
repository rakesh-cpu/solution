import React, { useEffect, useState } from 'react';
import { Layout } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import axios from 'axios'; // Import Axios

const { Content } = Layout;

function Profile() {
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    // Make an API request to fetch the user's information
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      // Make an Axios GET request to get user information
      const response = await axios.get('http://localhost:8080/api/user', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      console.log(response);

      if (response.status === 200) {
        const user = response.data?.data;
        
        // Assuming your user object has a property named 'firstName'
        setUserName(user.firstName);
        setUserEmail(user.email);
      } else {
        // Handle errors here
        console.error('Failed to fetch user information');
      }
    } catch (error) {
      // Handle errors here
      console.error('An error occurred while fetching user information', error);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <UserOutlined style={{ fontSize: '64px', marginBottom: '16px' }} />
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>User Dashboard</h1>
          <p style={{ fontSize: '16px', color: '#888' }}>Welcome, {userName}!</p>
        </div>
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>User Information</h2>
          <p style={{ fontSize: '16px',color:'blue' }}>Name: {userName}</p>
          <p style={{ fontSize: '16px',color:'blue' }}>Email: {userEmail}</p>
        </div>
      </Content>
    </Layout>
  );
}

export default Profile;
