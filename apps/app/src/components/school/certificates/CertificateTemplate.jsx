import React from 'react';
import { Award } from 'lucide-react';

const CertificateTemplate = ({ studentName, title, date, certificateNumber }) => {
  return (
    <div className="w-full h-full bg-white text-black p-8 relative overflow-hidden flex flex-col items-center justify-center border-[16px] border-[var(--school-accent)] double-border">
      <div className="absolute top-0 left-0 w-32 h-32 border-b-[30px] border-r-[30px] border-[#1a3a52] rounded-br-[50px]"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 border-t-[30px] border-l-[30px] border-[#1a3a52] rounded-tl-[50px]"></div>
      
      <div className="text-center z-10 space-y-6">
         <div className="flex justify-center mb-4">
             <div className="w-20 h-20 bg-[#1a3a52] rounded-full flex items-center justify-center text-[var(--school-accent)]">
                <Award className="w-10 h-10" />
             </div>
         </div>
         
         <h1 className="text-5xl font-serif font-bold text-[#1a3a52] uppercase tracking-wider">Certificat</h1>
         <h2 className="text-2xl font-serif text-[var(--school-accent)] italic">d'accomplissement</h2>
         
         <div className="py-8">
            <p className="text-lg text-gray-600 mb-2">Ce certificat est fièrement décerné à</p>
            <p className="text-4xl font-cursive font-bold text-[#1a3a52] border-b-2 border-[var(--school-accent)] pb-2 inline-block px-12 min-w-[400px]">
               {studentName}
            </p>
         </div>

         <div>
            <p className="text-lg text-gray-600 mb-2">Pour avoir complété avec succès</p>
            <h3 className="text-3xl font-bold text-[#1a3a52]">{title}</h3>
         </div>

         <div className="flex justify-between w-full max-w-2xl mt-16 px-12">
            <div className="text-center">
               <div className="w-40 border-b border-gray-400 mb-2"></div>
               <p className="text-sm font-bold text-[#1a3a52]">Date</p>
               <p className="text-sm text-gray-500">{new Date(date).toLocaleDateString()}</p>
            </div>
            <div className="text-center">
               <div className="w-40 h-10 flex items-end justify-center mb-2">
                  <span className="font-cursive text-2xl text-[#1a3a52]">Directeur</span>
               </div>
               <div className="w-40 border-b border-gray-400 mb-2"></div>
               <p className="text-sm font-bold text-[#1a3a52]">Signature</p>
            </div>
         </div>

         <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-400">
            ID: {certificateNumber} • PRORASCIENCE ACADEMY
         </div>
      </div>
    </div>
  );
};

export default CertificateTemplate;