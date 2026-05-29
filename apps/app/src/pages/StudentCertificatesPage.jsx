import React from 'react';
import { Button } from '@/components/ui/button';
import { Award, Download, Share2 } from 'lucide-react';
import Header from '@/components/Header';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import CertificateTemplate from '@/components/certificates/CertificateTemplate';

const StudentCertificatesPage = () => {
  // Mock data for student view
  const myCertificates = [
     { id: 1, title: "Cycle Fondamental - Année 1", date: new Date().toISOString(), number: "CERT-2024001", studentName: "Jean Dupont" }
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] flex flex-col">
       <Header />
       <main className="flex-grow pt-24 px-4 container mx-auto text-white">
          <div className="max-w-4xl mx-auto space-y-8">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-[#D4AF37]/10 rounded-full text-[#D4AF37]">
                   <Award className="w-8 h-8" />
                </div>
                <div>
                   <h1 className="text-3xl font-bold">Mes Certificats</h1>
                   <p className="text-gray-400">Retrouvez ici tous vos diplômes et certifications obtenus.</p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myCertificates.map(cert => (
                   <Card key={cert.id} className="bg-[#192734] border-white/10 overflow-hidden group">
                      <div className="h-40 bg-white relative p-4 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                         <div className="scale-50 transform origin-center w-[800px]">
                            <CertificateTemplate 
                               studentName={cert.studentName}
                               title={cert.title}
                               date={cert.date}
                               certificateNumber={cert.number}
                            />
                         </div>
                      </div>
                      <div className="p-6">
                         <h3 className="text-lg font-bold text-white mb-2">{cert.title}</h3>
                         <p className="text-sm text-gray-400 mb-4">Obtenu le {new Date(cert.date).toLocaleDateString()}</p>
                         <div className="flex gap-2">
                             <Dialog>
                               <DialogTrigger asChild>
                                  <Button className="flex-1 bg-[#D4AF37] text-black hover:bg-yellow-500">Voir</Button>
                               </DialogTrigger>
                               <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
                                 <DialogHeader className="sr-only">
                                   <DialogTitle>Certificat</DialogTitle>
                                 </DialogHeader>
                                  <div className="w-full aspect-[1.414/1] bg-white rounded-lg overflow-hidden">
                                     <CertificateTemplate 
                                        studentName={cert.studentName}
                                        title={cert.title}
                                        date={cert.date}
                                        certificateNumber={cert.number}
                                     />
                                  </div>
                               </DialogContent>
                            </Dialog>
                            <Button variant="outline" className="border-white/10 text-white"><Download className="w-4 h-4" /></Button>
                            <Button variant="outline" className="border-white/10 text-white"><Share2 className="w-4 h-4" /></Button>
                         </div>
                      </div>
                   </Card>
                ))}
             </div>
          </div>
       </main>
    </div>
  );
};

export default StudentCertificatesPage;