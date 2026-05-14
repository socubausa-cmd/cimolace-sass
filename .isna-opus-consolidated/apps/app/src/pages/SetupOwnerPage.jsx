import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle, Shield } from 'lucide-react';

const SetupOwnerPage = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error' | null
  const [message, setMessage] = useState('');

  const handleCreateOwner = async () => {
    setLoading(true);
    setStatus(null);
    setMessage('');

    try {
      console.log('Invoking create-owner-user function...');
      const { data, error } = await supabase.functions.invoke('create-owner-user');
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStatus('success');
      setMessage('Owner account created successfully! You can now log in.');
    } catch (err) {
      console.error('Setup failed:', err);
      setStatus('error');
      setMessage(err.message || 'Failed to create owner account. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#192734] border-white/10 text-white shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-[#D4AF37]/20 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#D4AF37]">Setup Owner Account</CardTitle>
          <CardDescription className="text-gray-400">
            Initialize the system by creating the primary owner account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-black/20 p-4 rounded-lg border border-white/5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Email:</span>
              <span className="text-white font-mono">socubausa@gmail.com</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Password:</span>
              <span className="text-white font-mono">badika@1990</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Role:</span>
              <span className="text-[#D4AF37] font-bold uppercase text-xs">Owner</span>
            </div>
          </div>

          {status === 'success' && (
             <div className="flex items-start gap-3 p-3 bg-green-500/10 text-green-400 rounded-lg border border-green-500/20 text-sm">
               <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
               <p>{message}</p>
             </div>
          )}

          {status === 'error' && (
             <div className="flex items-start gap-3 p-3 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20 text-sm">
               <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
               <p>{message}</p>
             </div>
          )}

          <div className="space-y-3">
            <Button 
              onClick={handleCreateOwner} 
              disabled={loading}
              className="w-full bg-[#D4AF37] hover:bg-yellow-500 text-black font-bold transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? 'Initializing...' : 'Create Owner User'}
            </Button>

            {status === 'success' && (
              <Button 
                variant="outline" 
                className="w-full border-white/10 text-white hover:bg-white/5"
                onClick={() => window.location.href = '/login'}
              >
                Go to Login Page
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupOwnerPage;