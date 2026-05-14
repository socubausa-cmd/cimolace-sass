import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, ShieldCheck, UserPlus } from 'lucide-react';

const CreateUserPage = () => {
  const [formData, setFormData] = useState({
    email: 'socubausa@gmail.com',
    password: 'badika@1990',
    full_name: 'Propriétaire'
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('create-owner-user-direct', {
        body: formData
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Unknown error occurred');
      }

      setResult({
        type: 'success',
        title: 'User Created Successfully',
        message: data.message,
        details: data
      });
    } catch (err) {
      console.error('Creation failed:', err);
      setResult({
        type: 'error',
        title: 'Creation Failed',
        message: err.message || 'Failed to create user. Check console.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-[#192734] border-white/10 text-white shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#D4AF37]/20 rounded-lg">
              <UserPlus className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">Create Owner User</CardTitle>
              <CardDescription className="text-gray-400">
                Directly create or update a user with Owner privileges via Admin API.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="bg-[#0F1419] border-white/10 text-white focus:border-[#D4AF37]/50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">Password</Label>
              <Input
                id="password"
                name="password"
                type="text" 
                value={formData.password}
                onChange={handleChange}
                className="bg-[#0F1419] border-white/10 text-white focus:border-[#D4AF37]/50 font-mono"
                required
              />
              <p className="text-sm text-gray-500">Visible for verification purposes.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-gray-300">Full Name</Label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                value={formData.full_name}
                onChange={handleChange}
                className="bg-[#0F1419] border-white/10 text-white focus:border-[#D4AF37]/50"
                required
              />
            </div>

            {result && (
              <Alert className={`mt-4 border ${result.type === 'success' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                {result.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-400" />
                )}
                <AlertTitle className={result.type === 'success' ? 'text-green-400' : 'text-red-400'}>
                  {result.title}
                </AlertTitle>
                <AlertDescription className="text-gray-300 mt-1">
                  {result.message}
                  {result.details && (
                    <div className="mt-2 text-xs font-mono bg-black/20 p-2 rounded">
                      ID: {result.details.user_id}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full bg-[#D4AF37] hover:bg-yellow-500 text-black font-bold mt-4"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating User...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Create Owner Account
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-white/5 pt-4">
           <Button variant="link" className="text-gray-400 hover:text-white" onClick={() => window.location.href = '/login'}>
             Back to Login
           </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CreateUserPage;