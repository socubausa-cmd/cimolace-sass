import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { User, Mail, Shield, MapPin } from 'lucide-react';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';

const UserProfile = () => {
  const vitrineEmail = useVitrineContactEmail();
  return (
    <Card className="border-none shadow-lg bg-[#192734] overflow-hidden">
      <div className="h-32 bg-gradient-to-r from-blue-600 to-purple-600"></div>
      <CardContent className="relative pt-0 px-6 pb-6">
        <div className="flex flex-col md:flex-row items-center md:items-end -mt-12 mb-6 gap-6">
          <Avatar className="w-24 h-24 border-4 border-[#192734] shadow-xl">
             <AvatarImage src="https://github.com/shadcn.png" />
             <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-white">Admin User</h2>
            <p className="text-gray-400">Senior Administrator</p>
          </div>
          <Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500">Edit Profile</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center p-4 bg-white/5 rounded-lg border border-white/10">
            <Mail className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Email Address</p>
              <p className="text-white">{vitrineEmail}</p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-white/5 rounded-lg border border-white/10">
            <Shield className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Role</p>
              <p className="text-white">Super Admin</p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-white/5 rounded-lg border border-white/10">
            <User className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Employee ID</p>
              <p className="text-white">#EMP-001</p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-white/5 rounded-lg border border-white/10">
            <MapPin className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Location</p>
              <p className="text-white">Paris, France</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserProfile;