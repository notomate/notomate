import axios from 'axios';

interface SignInData {
  email: string;
  password: string;
}

interface SignUpData {
  username: string;
  email: string;
  password: string;
}

export const signIn = async (data: SignInData) => {
  const response = await axios.post('/api/v1/signin', {
    email: data.email,
    password: data.password,
  });
  return response.data;
};

export const signUp = async (data: SignUpData) => {
  const response = await axios.post('/api/v1/signup', {
    email: data.email,
    username: data.username,
    password: data.password,
  });
  return response.data;
};

export const signOut = async () => {
  const response = await axios.get('/api/v1/signout', { withCredentials: true });
  return response.data;
}; 

export const me = async () =>{
  const response = await axios.get('/api/v1/me', { withCredentials: true });
  return response.data
}