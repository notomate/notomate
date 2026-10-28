import axios from 'axios';
import { useCurrentUserStore } from '@/stores/current-user';

// Setup axios interceptor to handle 401 errors globally
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if the error is a 401 Unauthorized
    if (error.response && error.response.status === 401) {
      // Exclude /share/... paths and root path from redirect
      const currentPath = window.location.pathname;
      const shouldRedirect = !currentPath.startsWith('/share/') && currentPath !== '/' && !currentPath.startsWith('/explore') && !currentPath.startsWith('/signup') && !currentPath.startsWith('/signin');

      if (shouldRedirect) {
        // Clear user state
        useCurrentUserStore.getState().resetCurrentUser();

        // Redirect to sign-in page if not already there
        if (!window.location.pathname.startsWith('/signin')) {
          window.location.href = '/signin';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default axios;
