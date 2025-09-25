import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { loading } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const finalizeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) {
          return;
        }

        if (error) {
          console.error('Supabase OAuth callback error', error);
          navigate('/login', { replace: true });
          return;
        }

        if (data.session) {
          navigate('/experiences', { replace: true });
          return;
        }

        if (!loading) {
          navigate('/login', { replace: true });
        }
      } catch (err) {
        if (!isMounted) {
          return;
        }
        console.error('Unexpected error handling OAuth callback', err);
        navigate('/login', { replace: true });
      }
    };

    finalizeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }
      if (session) {
        navigate('/experiences', { replace: true });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, loading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-lg text-gray-700 font-medium">Signing you in…</p>
        <p className="text-sm text-gray-500 mt-2">This should only take a moment.</p>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
