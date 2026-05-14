import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';

export default function CimolaceGoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleGoogleCallback = async () => {
      try {
        /* Supabase gère automatiquement le callback OAuth */
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('OAuth Google error:', error);
          navigate('/cimolace/login?error=google_oauth_error');
          return;
        }

        if (session?.user) {
          navigate('/cimolace/admin');
        } else {
          navigate('/cimolace/login?error=no_session');
        }
      } catch (err) {
        console.error('OAuth Google callback error:', err);
        navigate('/cimolace/login?error=callback_failed');
      }
    };

    handleGoogleCallback();
  }, [searchParams, navigate]);

  return (
    <>
      <Helmet>
        <title>Connexion Google — CIMOLACE</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg">Connexion avec Google...</p>
        </div>
      </div>
    </>
  );
}
